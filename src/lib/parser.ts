/**
 * parser.ts
 * Replica exacta de las reglas de los macros VBA del Reporte Gerencial.
 * Procesa el .xlsm y devuelve objetos listos para insertar en Supabase.
 */

import * as XLSX from 'xlsx'

// ─── Constantes ────────────────────────────────────────────────────────────
const ESTADOS_OK = new Set([
  'Final + Day by Day', 'Confirmed', 'Pre Final',
  'En Operaciones', 'Cerrado', 'Cierre Operativo',
])

const AREA_MAP: Record<string, string> = {
  AL: 'Aliwen', BN: 'Booknow', DM: 'DMC FITS',
  GR: 'Grupos DMC', PL: 'Plataformas', WE: 'Web', WI: 'Walk In',
}

// ─── Tipos ─────────────────────────────────────────────────────────────────
export interface TLRow {
  file_code: string
  booking_branch: string | null
  booking_department: string | null
  estado: string | null
  fecha_in: string | null        // ISO date
  fecha_out: string | null       // ISO date
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
}

export interface SFRow {
  file_code: string
  venta: number
  ganancia: number
  cm: number | null
  fecha_in: string | null
  fecha_out: string | null
  venta_tp: number | null
}

export interface AuditRow {
  file_code: string
  fecha_in: string | null
  area: string | null
  area_nombre: string | null
  gr: string | null
  previous_status: string | null
  new_status: string | null
  date_of_change: string | null  // ISO datetime
  booking_status: string | null
  operador: string | null
  temporada: string | null
}

export interface Temp2425Row {
  area: string
  mes_01: number; mes_02: number; mes_03: number; mes_04: number
  mes_05: number; mes_06: number; mes_07: number; mes_08: number
  mes_09: number; mes_10: number; mes_11: number; mes_12: number
}

export interface ParseResult {
  teamLeader: TLRow[]
  salesforce: SFRow[]
  audit: AuditRow[]
  temp2425Ganancia: Temp2425Row[]
  temp2425Venta: Temp2425Row[]
  temp2425Cantidad: Temp2425Row[]
}

// ─── Helper: serialNumber de Excel → Date ──────────────────────────────────
function excelDateToISO(val: unknown): string | null {
  if (val == null || val === '') return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (!date) return null
    const y = date.y, m = String(date.m).padStart(2, '0'), d = String(date.d).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    // Formato "2025-12-21 00:00:00"
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return null
}

function excelDateTimeToISO(val: unknown): string | null {
  if (val == null || val === '') return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (!date) return null
    return new Date(date.y, date.m - 1, date.d, date.H ?? 0, date.M ?? 0, date.S ?? 0).toISOString()
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

function toNum(val: unknown): number {
  if (val == null || val === '') return 0
  if (typeof val === 'number') return val
  const s = String(val).replace(/[^0-9.,\-]/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function toStr(val: unknown): string | null {
  if (val == null || val === '') return null
  return String(val).trim() || null
}

/** Normaliza CM: si viene como 25 → 0.25, si ya es 0.25 → 0.25 */
function normalizePct(val: unknown): number | null {
  const n = toNum(val)
  if (n === 0) return null
  return n > 1.5 ? n / 100 : n
}

/** Temporada mayo→mayo */
function getTemporada(isoDate: string | null): string | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  const y = d.getFullYear(), m = d.getMonth() + 1
  const start = m >= 5 ? y : y - 1
  return `${String(start).slice(2)}/${String(start + 1).slice(2)}`
}

/** Índice de mes en temporada 25/26: May=1 … Apr=12 */
function seasonMonthIdx(isoDate: string | null): number | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  const y = d.getFullYear(), m = d.getMonth() + 1
  if (y === 2025 && m >= 5 && m <= 12) return m - 4
  if (y === 2026 && m >= 1 && m <= 4)  return m + 8
  return null
}

function isB2C(fileCode: string): boolean {
  const p = fileCode.slice(0, 2).toUpperCase()
  return p === 'WE' || p === 'PL' || p === 'WI'
}

// ─── Encontrar fila de encabezado ──────────────────────────────────────────
function findHeaderRow(
  sheet: XLSX.WorkSheet,
  targetCol: string,
  maxRows = 20
): { rowIdx: number; headers: Record<string, number> } | null {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + maxRows - 1); r++) {
    const headers: Record<string, number> = {}
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      if (cell?.v != null) {
        const v = String(cell.v).trim()
        headers[v.toLowerCase()] = c
      }
    }
    if (targetCol.toLowerCase() in headers) {
      return { rowIdx: r, headers }
    }
  }
  return null
}

function getCell(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  return sheet[addr]?.v ?? null
}

// ─── PARSER PRINCIPAL ──────────────────────────────────────────────────────
export async function parseExcel(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, raw: false })

  return {
    teamLeader:       parseTeamLeader(wb),
    salesforce:       parseSalesforce(wb),
    audit:            parseAudit(wb),
    temp2425Ganancia: parseTemp2425Ganancia(wb),
    temp2425Venta:    parseTemp2425Venta(wb),
    temp2425Cantidad: parseTemp2425Cantidad(wb),
  }
}

// ─── Team Leader ───────────────────────────────────────────────────────────
// Hoja: "Reporte Team Leader", encabezado fila 9
// Cols: File|Cant.Pax|FechaIN|FechaOut|Cant_Dias|Vendedor|Operador|Estado|
//       BookingBranchName|Costo|Venta|BookingDepartmentName|Cliente|Total
function parseTeamLeader(wb: XLSX.WorkBook): TLRow[] {
  const ws = wb.Sheets['Reporte Team Leader']
  if (!ws) throw new Error("No encuentro la hoja 'Reporte Team Leader'")

  const hdr = findHeaderRow(ws, 'File', 15)
  if (!hdr) throw new Error("No encuentro encabezado 'File' en Reporte Team Leader")

  const { rowIdx, headers } = hdr

  // Mapeo de columnas (case-insensitive, igual que el macro)
  const col = (name: string) => {
    const key = name.toLowerCase()
    for (const [k, v] of Object.entries(headers)) {
      if (k === key) return v
    }
    return -1
  }

  const cFile    = col('file')
  const cPax     = col('cant. pax')
  const cIn      = col('fecha de in')
  const cOut     = col('fecha out')
  const cDias    = col('cant_dias')
  const cVendedor= col('vendedor')
  const cOperador= col('operador')
  const cEstado  = col('estado')
  const cBranch  = col('bookingbranchname')
  const cCosto   = col('costo')
  const cVenta   = col('venta')
  const cDept    = col('bookingdepartmentname')
  const cCliente = col('cliente')

  if (cFile < 0 || cVenta < 0 || cCosto < 0)
    throw new Error('Faltan columnas clave en Reporte Team Leader (File/Venta/Costo)')

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  const rows: TLRow[] = []

  for (let r = rowIdx + 1; r <= range.e.r; r++) {
    const fileCode = toStr(getCell(ws, r, cFile))
    if (!fileCode) continue

    const venta = toNum(getCell(ws, r, cVenta))
    const costo = toNum(getCell(ws, r, cCosto))
    const ganancia = venta - costo
    const cm = venta !== 0 ? ganancia / venta : null

    const fechaIn  = excelDateToISO(getCell(ws, r, cIn))
    const fechaOut = excelDateToISO(getCell(ws, r, cOut))

    rows.push({
      file_code:          fileCode,
      booking_branch:     toStr(getCell(ws, r, cBranch)),
      booking_department: cDept >= 0 ? toStr(getCell(ws, r, cDept)) : null,
      estado:             toStr(getCell(ws, r, cEstado)),
      fecha_in:           fechaIn,
      fecha_out:          fechaOut,
      cant_pax:           toNum(getCell(ws, r, cPax)) || null,
      cant_dias:          cDias >= 0 ? (toNum(getCell(ws, r, cDias)) || null) : null,
      vendedor:           cVendedor >= 0 ? toStr(getCell(ws, r, cVendedor)) : null,
      operador:           cOperador >= 0 ? toStr(getCell(ws, r, cOperador)) : null,
      cliente:            cCliente >= 0 ? toStr(getCell(ws, r, cCliente)) : null,
      costo,
      venta,
      contribucion_mg:    cm,
      temporada:          getTemporada(fechaIn),
      mes_season_idx:     seasonMonthIdx(fechaIn),
    })
  }

  return rows
}

// ─── Salesforce B2C ────────────────────────────────────────────────────────
// Hoja: "Files B2C SaleForce", encabezado fila 1
// Cols: Venta|Ganancia|CM|FILE|FechaIN|FechaOUT|VentaTP
function parseSalesforce(wb: XLSX.WorkBook): SFRow[] {
  const ws = wb.Sheets['Files B2C SaleForce']
  if (!ws) return []   // opcional, no rompe

  const hdr = findHeaderRow(ws, 'FILE', 5)
  if (!hdr) return []

  const { rowIdx, headers } = hdr
  const col = (name: string) => {
    const key = name.toLowerCase()
    for (const [k, v] of Object.entries(headers)) {
      if (k === key) return v
    }
    return -1
  }

  const cFile   = col('file')
  const cVenta  = col('venta')
  const cGan    = col('ganancia')
  const cCM     = col('cm')
  const cIn     = col('fecha de in')
  const cOut    = col('fecha de out')
  const cVTP    = col('venta tp')

  if (cFile < 0 || cVenta < 0 || cGan < 0)
    return []

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  const rows: SFRow[] = []
  const seen = new Set<string>()

  for (let r = rowIdx + 1; r <= range.e.r; r++) {
    const fileCode = toStr(getCell(ws, r, cFile))
    if (!fileCode) continue
    if (seen.has(fileCode.toUpperCase())) continue  // quedarse con primero (mayor venta = primero en hoja)
    seen.add(fileCode.toUpperCase())

    const venta   = toNum(getCell(ws, r, cVenta))
    const ganancia= toNum(getCell(ws, r, cGan))
    const cmRaw   = cCM >= 0 ? getCell(ws, r, cCM) : null

    // CM: puede ser fórmula =B/A, viene como resultado numérico
    let cm: number | null = null
    if (cmRaw != null && cmRaw !== '') {
      cm = normalizePct(cmRaw) ?? (venta !== 0 ? ganancia / venta : null)
    } else {
      cm = venta !== 0 ? ganancia / venta : null
    }

    rows.push({
      file_code: fileCode,
      venta,
      ganancia,
      cm,
      fecha_in:  cIn  >= 0 ? excelDateToISO(getCell(ws, r, cIn))   : null,
      fecha_out: cOut >= 0 ? excelDateToISO(getCell(ws, r, cOut))  : null,
      venta_tp:  cVTP >= 0 ? toNum(getCell(ws, r, cVTP)) || null   : null,
    })
  }

  return rows
}

// ─── Bookings Audit ────────────────────────────────────────────────────────
// Hoja: "Bookings Audit", encabezado fila 7
// Cols: File|FechaIN|AREA|GR|PreviousStatus|NewStatus|DateOfChange|BookingStatus|Operador
function parseAudit(wb: XLSX.WorkBook): AuditRow[] {
  const ws = wb.Sheets['Bookings Audit'] ?? wb.Sheets['Booking Audit']
  if (!ws) throw new Error("No encuentro la hoja 'Bookings Audit'")

  const hdr = findHeaderRow(ws, 'File', 15)
  if (!hdr) throw new Error("No encuentro encabezado 'File' en Bookings Audit")

  const { rowIdx, headers } = hdr
  const col = (name: string) => {
    const key = name.toLowerCase()
    for (const [k, v] of Object.entries(headers)) {
      if (k === key) return v
    }
    return -1
  }

  const cFile    = col('file')
  const cFechaIn = col('fecha in')
  const cArea    = col('area')
  const cGR      = col('gr')
  const cPrev    = col('previousstatus')
  const cNew     = col('newstatus')
  const cChange  = col('dateofchange')
  const cBkStatus= col('bookingstatus')
  const cOp      = col('operador')

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  const rows: AuditRow[] = []

  for (let r = rowIdx + 1; r <= range.e.r; r++) {
    const fileCode = toStr(getCell(ws, r, cFile))
    if (!fileCode) continue

    const fechaIn = cFechaIn >= 0 ? excelDateToISO(getCell(ws, r, cFechaIn)) : null
    const area    = cArea >= 0 ? toStr(getCell(ws, r, cArea))?.toUpperCase() ?? null : null

    rows.push({
      file_code:       fileCode,
      fecha_in:        fechaIn,
      area:            area,
      area_nombre:     area ? (AREA_MAP[area] ?? area) : null,
      gr:              cGR      >= 0 ? toStr(getCell(ws, r, cGR))       : null,
      previous_status: cPrev    >= 0 ? toStr(getCell(ws, r, cPrev))     : null,
      new_status:      cNew     >= 0 ? toStr(getCell(ws, r, cNew))      : null,
      date_of_change:  cChange  >= 0 ? excelDateTimeToISO(getCell(ws, r, cChange)) : null,
      booking_status:  cBkStatus>= 0 ? toStr(getCell(ws, r, cBkStatus)) : null,
      operador:        cOp      >= 0 ? toStr(getCell(ws, r, cOp))       : null,
      temporada:       getTemporada(fechaIn),
    })
  }

  return rows
}

// ─── Temp 2425 Ganancia ────────────────────────────────────────────────────
// Hoja: "Temp 2425", col A=área, cols D..O = May..Apr (12 meses)
function parseTemp2425Ganancia(wb: XLSX.WorkBook): Temp2425Row[] {
  return parseTemp2425Sheet(wb, 'Temp 2425', 3)   // datos empiezan col D (índice 3)
}

function parseTemp2425Venta(wb: XLSX.WorkBook): Temp2425Row[] {
  return parseTemp2425Sheet(wb, 'Temp 2425 Venta', 3)  // col D en adelante
}

function parseTemp2425Cantidad(wb: XLSX.WorkBook): Temp2425Row[] {
  return parseTemp2425Sheet(wb, 'Temp 2425 cantidad', 2) // col C en adelante (índice 2)
}

function parseTemp2425Sheet(wb: XLSX.WorkBook, sheetName: string, firstDataCol: number): Temp2425Row[] {
  const ws = wb.Sheets[sheetName]
  if (!ws) return []

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  const rows: Temp2425Row[] = []

  // Fila 1 = encabezado, filas 2+ = datos
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const area = toStr(getCell(ws, r, 0))  // col A
    if (!area) continue

    const meses: number[] = []
    for (let m = 0; m < 12; m++) {
      meses.push(toNum(getCell(ws, r, firstDataCol + m)))
    }

    rows.push({
      area,
      mes_01: meses[0],  mes_02: meses[1],  mes_03: meses[2],
      mes_04: meses[3],  mes_05: meses[4],  mes_06: meses[5],
      mes_07: meses[6],  mes_08: meses[7],  mes_09: meses[8],
      mes_10: meses[9],  mes_11: meses[10], mes_12: meses[11],
    })
  }

  return rows
}

// ─── Exportar helpers para uso en API route ────────────────────────────────
export { ESTADOS_OK, AREA_MAP, isB2C, getTemporada, seasonMonthIdx }
