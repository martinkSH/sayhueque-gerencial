export const runtime = 'nodejs'
/* eslint-disable @typescript-eslint/no-require-imports */
const sql = require('mssql')

const config = {
  server:   'LA-SAYHUE.data.tourplan.net',
  port:     50409,
  database: 'LA-SAYHUE',
  user:     'excelLA-SAYHUE',
  password: 'o6rmFv7$RJnp14NzqI18',
  options: {
    encrypt:                true,
    trustServerCertificate: true,
    connectTimeout:         30000,
    requestTimeout:         120000,
  },
}

// Mapeo BookingStatus code → nombre legible (igual que el parser del Excel)
const ESTADO_MAP: Record<string, string> = {
  'FF': 'Final + Day by Day',
  'FI': 'Final',
  'FN': 'Final',
  'OK': 'Confirmed',
  'C7': 'Confirmed',
  'CD': 'Confirmed',
  'CT': 'Confirmed',
  'PF': 'Pre Final',
  'OP': 'En Operaciones',
  'CL': 'Cerrado',
  'CO': 'Cierre Operativo',
  'QU': 'Quote',
  'RE': 'Reservado',
  'XC': 'Cancelado',
  'XX': 'Cancelado',
}

// Mapeo BranchCode → booking_branch (igual que en Supabase)
const BRANCH_MAP: Record<string, string> = {
  'WE': 'Web',
  'WI': 'Walk In',
  'PL': 'Plataformas',
  'AL': 'Aliwen',
  'DM': 'DMC FITS',
  'GR': 'Grupos DMC',
  'BN': 'Booknow',
}

const FILE_PREFIX_MAP: Record<string, string> = {
  'WE': 'Web',
  'WI': 'Walk In',
  'PL': 'Plataformas',
  'AL': 'Aliwen',
  'DM': 'DMC FITS',
  'GR': 'Grupos DMC',
  'BN': 'Booknow',
}

function areaFromFileCode(fileCode: string): string | null {
  const prefix = fileCode.slice(0, 2).toUpperCase()
  return FILE_PREFIX_MAP[prefix] ?? null
}

function toISO(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) {
    if (v.getFullYear() <= 1900) return null
    return v.toISOString().split('T')[0]
  }
  return String(v).slice(0, 10) || null
}

function getTemporada(fechaIn: string | null): string | null {
  if (!fechaIn) return null
  const d = new Date(fechaIn)
  const m = d.getMonth() + 1 // 1-12
  const y = d.getFullYear()
  const desde = m >= 5 ? y : y - 1
  return `${String(desde).slice(2)}/${String(desde + 1).slice(2)}`
}

function seasonMonthIdx(fechaIn: string | null): number | null {
  if (!fechaIn) return null
  const d = new Date(fechaIn)
  const m = d.getMonth() + 1
  // May=0, Jun=1, ..., Dec=7, Jan=8, Feb=9, Mar=10, Apr=11
  return m >= 5 ? m - 5 : m + 7
}

export interface TLRowTP {
  file_code: string
  booking_branch: string | null
  booking_department: string | null
  estado: string | null
  fecha_in: string | null
  fecha_out: string | null
  cant_pax: number | null
  cant_dias: number | null
  vendedor: string | null
  operador: string | null
  cliente: string | null
  costo: number
  venta: number
  contribucion_mg: number | null
  temporada: string | null
  mes_season_idx: number | null
  impuesto_venta: number | null
  impuesto_costo: number | null
}

export interface AuditRowTP {
  file_code: string
  booking_name: string | null  // ← AGREGADO
  fecha_in: string | null
  area: string | null
  previous_status: string | null
  new_status: string | null
  date_of_change: string | null
  operador: string | null
  temporada: string | null
}

// Configuración de Craft (se carga dinámicamente desde Supabase)
let craftConfig: { activa: boolean; vendedores: string[] } | null = null

async function loadCraftConfig() {
  if (craftConfig !== null) return craftConfig
  try {
    const { createClient } = require('@/lib/supabase/server')
    const supabase = createClient()
    const { data } = await supabase
      .from('config_areas_virtuales')
      .select('activa, vendedores')
      .eq('area_nombre', 'Craft')
      .single()
    craftConfig = data ? { activa: data.activa, vendedores: data.vendedores } : { activa: false, vendedores: [] }
  } catch {
    craftConfig = { activa: false, vendedores: [] }
  }
  return craftConfig
}

export async function fetchTourplanData(): Promise<{
  teamLeader: TLRowTP[]
  audit: AuditRowTP[]
  fetchedAt: string
}> {
  let pool: any = null
  try {
    // Cargar config de Craft
    const craft = await loadCraftConfig()
    
    pool = await sql.connect(config)

    // ── Team Leader ───────────────────────────────────────────────────────
    const tlResult = await pool.request().query(`
      SELECT
        DATEDIFF(DAY, BookingTravelDate, LastServiceDate) AS Cant_Dias,
        BookingReference, BookingStatus, BookingConsultantName,
        BookingBranchCode, BookingBranchName, BookingDepartmentName,
        BookingAnalysis1Name, BookingAgentName,
        BookingTravelDate, LastServiceDate,
        BookingPaxQty,
        BookingCostAmount, BookingCostTaxAmount,
        BookingRetailAmount, BookingSellTaxAmount,
        BookingMarginAmount
      FROM vw_BookingHeaderReportData
      WHERE BookingBranchCode IN ('WE','WI','PL','AL','DM','GR','BN')
        AND BookingTravelDate >= '20250501'
        AND BookingTravelDate <= '20280501'
        AND BookingStatus IN ('C7','CD','CT','FI','FN','IN','OK','OP','PF','XC')
        AND BookingDepartmentName NOT IN ('Test','Sites','Personal Trips','FAM Tours')
        AND BookingBranchName NOT IN ('Test')
        AND BookingStatusName NOT IN ('Quote','Test Booking','Quote - Lost','Bloqueo','Reservation')
      ORDER BY BookingTravelDate DESC
    `)

    const teamLeader: TLRowTP[] = tlResult.recordset.map((r: any) => {
      const impVenta = Number(r.BookingSellTaxAmount)  || 0
      const impCosto = Number(r.BookingCostTaxAmount)   || 0
      const venta    = Number(r.BookingRetailAmount)    || 0
      const costo    = Number(r.BookingCostAmount)      || 0
      const ganancia = Number(r.BookingMarginAmount)    || (venta - costo)
      const fechaIn  = toISO(r.BookingTravelDate)
      const fechaOut = toISO(r.LastServiceDate)
      const statusRaw = String(r.BookingStatus ?? '').trim()
      const estado = ESTADO_MAP[statusRaw] ?? statusRaw
      const vendedor = r.BookingConsultantName?.trim() || null

      // Reclasificar a Craft si está activo y el vendedor está en la lista
      let bookingBranch = BRANCH_MAP[String(r.BookingBranchCode ?? '').trim()] ?? r.BookingBranchName ?? null
      if (craft.activa && vendedor && craft.vendedores.includes(vendedor)) {
        bookingBranch = 'Craft'
      }

      return {
        file_code:          String(r.BookingReference ?? '').trim(),
        booking_branch:     bookingBranch,
        booking_department: r.BookingDepartmentName ?? null,
        estado,
        fecha_in:           fechaIn,
        fecha_out:          fechaOut,
        cant_pax:           Number(r.BookingPaxQty) || null,
        cant_dias:          Number(r.Cant_Dias) || null,
        vendedor:           vendedor,
        operador:           r.BookingAnalysis1Name?.trim() || null,
        cliente:            r.BookingAgentName?.trim() || null,
        costo,
        venta,
        contribucion_mg:    venta !== 0 ? ganancia / venta : null,
        temporada:          getTemporada(fechaIn),
        mes_season_idx:     seasonMonthIdx(fechaIn),
        impuesto_venta:     impVenta,
        impuesto_costo:     impCosto,
      }
    })

    // ── Bookings Audit ────────────────────────────────────────────────────
    // ← MODIFICADO: Agregamos BookingName al SELECT
    const auditResult = await pool.request().query(`
      SELECT
        x.FULL_REFERENCE, 
        x.BookingName,
        x.Analysis1,
        x.PrevBookingStatus AS PreviousStatus,
        x.BOOKINGSTATUS AS NewStatus,
        x.DateOfChange, 
        x.ChangedBy,
        x.TRAVELDATE, 
        x.BRANCH
      FROM (
        SELECT
          bhd.REFERENCE, 
          bhd.FULL_REFERENCE, 
          bhd.NAME AS BookingName,
          bud.BOOKINGSTATUS,
          bud.lw_date AS DateOfChange, 
          bud.USERNAME AS ChangedBy,
          bhd.TRAVELDATE, 
          bhd.BRANCH,
          SA1.DESCRIPTION Analysis1,
          LAG(bud.BOOKINGSTATUS) OVER (
            PARTITION BY bhd.BHD_ID ORDER BY bud.DATECREATED
          ) AS PrevBookingStatus
        FROM [LA-SAYHUE_Audit].dbo.BUD AS bud
        JOIN BHD ON BHD.BHD_ID = bud.BHD_ID
        JOIN SA1 ON SA1.CODE = BHD.SALE1
        JOIN SA3 ON SA3.CODE = BHD.SALE3
      ) x
      WHERE x.PrevBookingStatus IS NOT NULL
        AND x.PrevBookingStatus <> x.BOOKINGSTATUS
        AND x.TRAVELDATE >= '20250501'
      ORDER BY x.FULL_REFERENCE, x.DateOfChange
    `)

    const audit: AuditRowTP[] = auditResult.recordset.map((r: any) => {
      const fechaIn = toISO(r.TRAVELDATE)
      const operador = r.Analysis1?.trim() || null
      
      // Reclasificar a Craft si está activo
      // Nota: En audit no tenemos vendedor directo, usamos area del file_code
      let area = areaFromFileCode(String(r.FULL_REFERENCE ?? '').trim())
      
      // Si queremos que audit también refleje Craft, necesitaríamos JOIN con team_leader
      // Por ahora dejamos el área original en audit
      
      return {
        file_code:       String(r.FULL_REFERENCE ?? '').trim(),
        booking_name:    String(r.BookingName ?? '').trim() || null,
        fecha_in:        fechaIn,
        area:            area,
        previous_status: String(r.PreviousStatus ?? '').trim(),  // código raw: QU, OK, FI, etc.
        new_status:      String(r.NewStatus ?? '').trim(),        // código raw
        date_of_change:  toISO(r.DateOfChange),
        operador:        operador,
        temporada:       getTemporada(fechaIn),
      }
    })

    const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 16)
    return { teamLeader, audit, fetchedAt }

  } finally {
    if (pool) await pool.close()
  }
}
