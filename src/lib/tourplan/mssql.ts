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

// Convertir fecha YYYY-MM-DD a formato YYYYMMDD para TourPlan
function toTPDateFormat(dateStr: string): string {
  return dateStr.replace(/-/g, '')
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
  booking_name: string | null
  fecha_in: string | null
  area: string | null
  previous_status: string | null
  new_status: string | null
  date_of_change: string | null
  operador: string | null
  temporada: string | null
}

// Configuración de Craft (se carga dinámicamente desde Supabase)
let craftConfig: { activo: boolean; vendedores: string[] } | null = null

async function loadCraftConfig() {
  if (craftConfig !== null) return craftConfig
  try {
    const { createClient } = require('@/lib/supabase/server')
    const supabase = createClient()
    const { data } = await supabase
      .from('config_departamentos_virtuales')
      .select('activo, vendedores')
      .eq('departamento_nombre', 'Craft')
      .single()
    craftConfig = data ? { activo: data.activo, vendedores: data.vendedores } : { activo: false, vendedores: [] }
  } catch {
    craftConfig = { activo: false, vendedores: [] }
  }
  return craftConfig
}

// Configuración de fechas de sync (se carga dinámicamente desde Supabase)
let syncDatesConfig: { fecha_desde: string; fecha_hasta: string } | null = null

async function loadSyncDatesConfig() {
  if (syncDatesConfig !== null) return syncDatesConfig
  try {
    const { createClient } = require('@/lib/supabase/server')
    const supabase = createClient()
    const { data } = await supabase
      .from('config_sync_tourplan')
      .select('fecha_desde, fecha_hasta')
      .single()
    
    if (data) {
      syncDatesConfig = {
        fecha_desde: data.fecha_desde,
        fecha_hasta: data.fecha_hasta
      }
    } else {
      // Valores por defecto si no hay configuración
      syncDatesConfig = {
        fecha_desde: '2025-05-01',
        fecha_hasta: '2028-05-01'
      }
    }
  } catch {
    // Valores por defecto en caso de error
    syncDatesConfig = {
      fecha_desde: '2025-05-01',
      fecha_hasta: '2028-05-01'
    }
  }
  return syncDatesConfig
}

export async function fetchTourplanData(): Promise<{
  teamLeader: TLRowTP[]
  audit: AuditRowTP[]
  fetchedAt: string
  dateRange: { desde: string; hasta: string }
}> {
  let pool: any = null
  try {
    // Cargar config de Craft
    const craft = await loadCraftConfig()
    
    // Cargar config de fechas de sync
    const dates = await loadSyncDatesConfig()
    const fechaDesdeTP = toTPDateFormat(dates.fecha_desde)
    const fechaHastaTP = toTPDateFormat(dates.fecha_hasta)
    
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
        AND BookingTravelDate >= '${fechaDesdeTP}'
        AND BookingTravelDate <= '${fechaHastaTP}'
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

      // Reclasificar departamento a Craft si está activo y el vendedor está en la lista
      let bookingDepartment = r.BookingDepartmentName ?? null
      if (craft.activo && vendedor && craft.vendedores.includes(vendedor)) {
        bookingDepartment = 'Craft'
      }

      return {
        file_code:          String(r.BookingReference ?? '').trim(),
        booking_branch:     BRANCH_MAP[String(r.BookingBranchCode ?? '').trim()] ?? r.BookingBranchName ?? null,
        booking_department: bookingDepartment,
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
        AND x.TRAVELDATE >= '${fechaDesdeTP}'
      ORDER BY x.FULL_REFERENCE, x.DateOfChange
    `)

    const audit: AuditRowTP[] = auditResult.recordset.map((r: any) => {
      const fechaIn = toISO(r.TRAVELDATE)
      const operador = r.Analysis1?.trim() || null
      let area = areaFromFileCode(String(r.FULL_REFERENCE ?? '').trim())
      
      return {
        file_code:       String(r.FULL_REFERENCE ?? '').trim(),
        booking_name:    String(r.BookingName ?? '').trim() || null,
        fecha_in:        fechaIn,
        area:            area,
        previous_status: String(r.PreviousStatus ?? '').trim(),
        new_status:      String(r.NewStatus ?? '').trim(),
        date_of_change:  toISO(r.DateOfChange),
        operador:        operador,
        temporada:       getTemporada(fechaIn),
      }
    })

    const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 16)
    return { 
      teamLeader, 
      audit, 
      fetchedAt,
      dateRange: {
        desde: dates.fecha_desde,
        hasta: dates.fecha_hasta
      }
    }

  } finally {
    if (pool) await pool.close()
  }
}
