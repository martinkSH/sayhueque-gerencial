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
  fecha_in: string | null
  area: string | null
  previous_status: string | null
  new_status: string | null
  date_of_change: string | null
  operador: string | null
  temporada: string | null
}

export async function fetchTourplanData(): Promise<{
  teamLeader: TLRowTP[]
  audit: AuditRowTP[]
  fetchedAt: string
}> {
  let pool: any = null
  try {
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
        BookingSellAmount, BookingSellTaxAmount
      FROM vw_BookingHeaderReportData
      WHERE BookingBranchCode IN ('WE','WI','PL','AL','DM','GR','BN')
        AND BookingTravelDate >= '20250501'
        AND BookingTravelDate <= '20280501'
        AND BookingStatus IN ('C7','CD','CT','FI','FN','IN','OK','OP','PF','XC')
      ORDER BY BookingTravelDate DESC
    `)

    const teamLeader: TLRowTP[] = tlResult.recordset.map((r: any) => {
      const impVenta = Number(r.BookingSellTaxAmount) || 0
      const impCosto = Number(r.BookingCostTaxAmount)  || 0
      const venta    = (Number(r.BookingSellAmount) || 0) + impVenta
      const costo    = (Number(r.BookingCostAmount) || 0) + impCosto
      const ganancia = venta - costo
      const fechaIn  = toISO(r.BookingTravelDate)
      const fechaOut = toISO(r.LastServiceDate)
      const statusRaw = String(r.BookingStatus ?? '').trim()
      const estado = ESTADO_MAP[statusRaw] ?? statusRaw

      return {
        file_code:          String(r.BookingReference ?? '').trim(),
        booking_branch:     BRANCH_MAP[String(r.BookingBranchCode ?? '').trim()] ?? r.BookingBranchName ?? null,
        booking_department: r.BookingDepartmentName ?? null,
        estado,
        fecha_in:           fechaIn,
        fecha_out:          fechaOut,
        cant_pax:           Number(r.BookingPaxQty) || null,
        cant_dias:          Number(r.Cant_Dias) || null,
        vendedor:           r.BookingConsultantName?.trim() || null,
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
        x.FULL_REFERENCE, x.Analysis1,
        x.PrevBookingStatus AS PreviousStatus,
        x.BOOKINGSTATUS AS NewStatus,
        x.DateOfChange, x.ChangedBy,
        x.TRAVELDATE, x.BRANCH
      FROM (
        SELECT
          bhd.REFERENCE, bhd.FULL_REFERENCE, bud.BOOKINGSTATUS,
          bud.lw_date AS DateOfChange, bud.USERNAME AS ChangedBy,
          bhd.TRAVELDATE, bhd.BRANCH,
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
      return {
        file_code:       String(r.FULL_REFERENCE ?? '').trim(),
        fecha_in:        fechaIn,
        area:            BRANCH_MAP[String(r.BRANCH ?? '').trim()] ?? null,
        previous_status: ESTADO_MAP[String(r.PreviousStatus ?? '').trim()] ?? r.PreviousStatus ?? null,
        new_status:      ESTADO_MAP[String(r.NewStatus ?? '').trim()] ?? r.NewStatus ?? null,
        date_of_change:  toISO(r.DateOfChange),
        operador:        r.Analysis1?.trim() || null,
        temporada:       getTemporada(fechaIn),
      }
    })

    const fetchedAt = new Date().toISOString().replace('T', ' ').slice(0, 16)
    return { teamLeader, audit, fetchedAt }

  } finally {
    if (pool) await pool.close()
  }
}
