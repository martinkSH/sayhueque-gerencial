import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/user-context'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type LetiRow = {
  area: string; mes_out: string; cant_viajes: number
  total_venta: number; iva_venta: number; venta_neta: number
  total_costo: number; iva_costo: number; costo_neto: number
  cm_usd: number; cm_pct: number
}

type AreaRow = { area: string; venta: number; ganancia: number }

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const AREAS_ORDER = ['Web','Plataformas','Walk In','Aliwen','DMC FITS','Grupos DMC','Booknow']
const B2C_AREAS   = ['Web','Plataformas','Walk In']
const TEMPORADAS  = ['25/26','26/27','27/28']

function mesLabel(d: string) {
  const dt = new Date(d)
  return `${MESES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}

const HDR_BG  = '1E3A5F'
const COL_BG  = '37474F'
const AREA_BG = 'C8E6C9'
const TOT_BG  = 'E8F5E9'
const STRIPE  = 'F5F5F5'
const NCOLS   = 11
const WIDTHS  = [16,14,9,15,13,15,15,13,15,14,10]
const HEADERS = ['Área','Mes de OUT','Viajes','Total Venta','IVA Venta','Venta Neta','Total Costo','IVA Costo','Costo Neto','CM USD','CM %']

function cl(c: number) { return String.fromCharCode(64 + c) }
function applyBg(cell: ExcelJS.Cell, argb: string) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }

function styleHdrRow(ws: ExcelJS.Worksheet, rowNum: number, bg: string) {
  HEADERS.forEach((h, i) => {
    const cell = ws.getRow(rowNum).getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    applyBg(cell, `FF${bg}`)
    cell.alignment = { horizontal: i <= 2 ? 'left' : 'right', vertical: 'middle' }
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF546E7A' } } }
  })
  ws.getRow(rowNum).height = 22
}

function writeDataRow(ws: ExcelJS.Worksheet, rowNum: number, r: LetiRow, isStripe: boolean) {
  const bg = isStripe ? `FF${STRIPE}` : 'FFFFFFFF'
  const vals: (string | number)[] = [r.area, mesLabel(r.mes_out), Number(r.cant_viajes),
    Number(r.total_venta), Number(r.iva_venta), Number(r.venta_neta),
    Number(r.total_costo), Number(r.iva_costo), Number(r.costo_neto),
    Number(r.cm_usd), Number(r.cm_pct)]
  vals.forEach((v, i) => {
    const cell = ws.getRow(rowNum).getCell(i + 1)
    cell.value = v
    cell.font = { name: 'Arial', size: 10 }
    applyBg(cell, bg)
    cell.alignment = { horizontal: i <= 2 ? 'left' : 'right', vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } } }
    if (i === 2) cell.numFmt = '#,##0'
    if (i >= 3 && i <= 9) cell.numFmt = '$#,##0.00;($#,##0.00);"-"'
    if (i === 10) {
      cell.numFmt = '0.0%;(0.0%);"-"'
      const pct = Number(r.cm_pct)
      if (pct >= 0.25)      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF2E7D32' }, bold: true }
      else if (pct >= 0.18) cell.font = { name: 'Arial', size: 10, color: { argb: 'FFE65100' } }
      else                  cell.font = { name: 'Arial', size: 10, color: { argb: 'FFC62828' } }
    }
  })
  ws.getRow(rowNum).height = 18
}

function writeTotRow(ws: ExcelJS.Worksheet, rowNum: number, dStart: number, dEnd: number) {
  const tr = ws.getRow(rowNum)
  tr.getCell(1).value = 'TOTAL'; tr.getCell(2).value = ''
  tr.getCell(3).value = { formula: `SUM(C${dStart}:C${dEnd})` }; tr.getCell(3).numFmt = '#,##0'
  ;[4,5,6,7,8,9,10].forEach(c => { tr.getCell(c).value = { formula: `SUM(${cl(c)}${dStart}:${cl(c)}${dEnd})` }; tr.getCell(c).numFmt = '$#,##0;($#,##0);"-"' })
  tr.getCell(11).value = { formula: `IF(F${rowNum}=0,0,J${rowNum}/F${rowNum})` }; tr.getCell(11).numFmt = '0.0%;(0.0%);"-"'
  for (let c = 1; c <= NCOLS; c++) {
    const cell = tr.getCell(c)
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1A237E' } }
    applyBg(cell, `FF${TOT_BG}`)
    cell.alignment = { horizontal: c <= 2 ? 'left' : 'right', vertical: 'middle' }
    cell.border = { top: { style: 'medium', color: { argb: 'FF2E7D32' } }, bottom: { style: 'medium', color: { argb: 'FF2E7D32' } } }
  }
  ws.getRow(rowNum).height = 22
}

// ── Hoja Dashboard ────────────────────────────────────────────────────────────
async function buildDashboardSheet(wb: ExcelJS.Workbook, supabase: any, uploadId: string) {
  const ws = wb.addWorksheet('Dashboard')
  ws.columns = [{ width: 24 }, { width: 18 }, { width: 18 }, { width: 14 }]

  // Title
  ws.mergeCells('A1:D1')
  const t = ws.getCell('A1')
  t.value = 'Dashboard — Say Hueque Gerencial'
  t.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  applyBg(t, `FF${HDR_BG}`)
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 28

  ws.mergeCells('A2:D2')
  const sub = ws.getCell('A2')
  sub.value = `Generado: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}`
  sub.font = { name: 'Arial', italic: true, size: 10, color: { argb: 'FF90A4AE' } }
  applyBg(sub, `FF${HDR_BG}`)
  sub.alignment = { horizontal: 'center' }
  ws.getRow(2).height = 16

  let row = 4

  for (const temp of TEMPORADAS) {
    // Bruto
    const { data: brutoRaw } = await supabase.rpc('get_ganancia_por_area', {
      p_upload_id: uploadId, p_temporada: temp,
    })
    // Neto
    const { data: netoRaw } = await supabase.rpc('get_ganancia_neta_por_area', {
      p_upload_id: uploadId, p_temporada: temp,
    })

    if (!brutoRaw || brutoRaw.length === 0) continue

    const bruto = brutoRaw as AreaRow[]
    const neto  = (netoRaw ?? []) as AreaRow[]

    for (const [label, data, color] of [
      [`Ganancia por área — ${temp} (TOTAL)`, bruto, '1E3A5F'],
      [`Ganancia por área — ${temp} (-IVA)`,  neto,  '4A235A'],
    ] as [string, AreaRow[], string][]) {
      if (data.length === 0) continue

      // NO agrupar B2C - mostrar áreas separadas
      const sorted: AreaRow[] = [...data].sort((a, b) => b.ganancia - a.ganancia)
      const totalV = sorted.reduce((s, r) => s + r.venta, 0)
      const totalG = sorted.reduce((s, r) => s + r.ganancia, 0)

      // Section header
      ws.mergeCells(`A${row}:D${row}`)
      const sh = ws.getCell(`A${row}`)
      sh.value = label
      sh.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      applyBg(sh, `FF${color}`)
      sh.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      ws.getRow(row).height = 20
      row++

      // Column headers
      ;['Área','Venta','Ganancia','CM %'].forEach((h, i) => {
        const cell = ws.getRow(row).getCell(i + 1)
        cell.value = h
        cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
        applyBg(cell, `FF${COL_BG}`)
        cell.alignment = { horizontal: i === 0 ? 'left' : 'right' }
      })
      ws.getRow(row).height = 18
      row++

      const dStart = row
      sorted.forEach((r, i) => {
        const cm = r.venta > 0 ? r.ganancia / r.venta : 0
        const bg = i % 2 === 0 ? 'FFFFFFFF' : `FF${STRIPE}`
        const vals = [r.area, r.venta, r.ganancia, cm]
        vals.forEach((v, j) => {
          const cell = ws.getRow(row).getCell(j + 1)
          cell.value = v
          cell.font = { name: 'Arial', size: 10 }
          applyBg(cell, bg)
          cell.alignment = { horizontal: j === 0 ? 'left' : 'right' }
          if (j === 1 || j === 2) cell.numFmt = '$#,##0;($#,##0);"-"'
          if (j === 3) {
            cell.numFmt = '0.0%;(0.0%);"-"'
            cell.font = { name: 'Arial', size: 10, bold: true,
              color: { argb: cm >= 0.25 ? 'FF2E7D32' : cm >= 0.18 ? 'FFE65100' : 'FFC62828' } }
          }
        })
        ws.getRow(row).height = 16
        row++
      })

      // Total
      ;[['TOTAL', totalV, totalG, totalV > 0 ? totalG / totalV : 0]].forEach(vals => {
        vals.forEach((v, j) => {
          const cell = ws.getRow(row).getCell(j + 1)
          cell.value = v
          cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1A237E' } }
          applyBg(cell, `FF${TOT_BG}`)
          cell.alignment = { horizontal: j === 0 ? 'left' : 'right' }
          cell.border = { top: { style: 'medium', color: { argb: 'FF2E7D32' } } }
          if (j === 1 || j === 2) cell.numFmt = '$#,##0;($#,##0);"-"'
          if (j === 3) cell.numFmt = '0.0%;(0.0%);"-"'
        })
        ws.getRow(row).height = 20
        row++
      })
      row++ // espacio
    }
    row++ // espacio entre temporadas
  }
}

// ── Hoja por temporada (Resumen + por área) ───────────────────────────────────
function buildTemporadaSheets(wb: ExcelJS.Workbook, rowsByTemp: Map<string, LetiRow[]>, temporada: string) {
  const allRows = rowsByTemp.get(temporada) ?? []
  if (allRows.length === 0) return

  const byArea = new Map<string, LetiRow[]>()
  for (const r of allRows) {
    if (!byArea.has(r.area)) byArea.set(r.area, [])
    byArea.get(r.area)!.push(r)
  }

  const areasToRender = AREAS_ORDER.filter(a => byArea.has(a))
    .concat(Array.from(byArea.keys()).filter(a => !AREAS_ORDER.includes(a)))

  // ── Resumen de la temporada ──
  const wsRes = wb.addWorksheet(`Resumen ${temporada.replace('/', '-')}`, { properties: { tabColor: { argb: 'FF1E3A5F' } } })
  wsRes.columns = WIDTHS.map(w => ({ width: w }))

  let sRow = 1
  wsRes.mergeCells(`A${sRow}:K${sRow}`)
  const sTit = wsRes.getCell(`A${sRow}`)
  sTit.value = `Resumen General — Temporada ${temporada}`
  sTit.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  applyBg(sTit, 'FF1E3A5F')
  sTit.alignment = { horizontal: 'center', vertical: 'middle' }
  wsRes.getRow(sRow).height = 30
  sRow += 2

  styleHdrRow(wsRes, sRow, COL_BG); sRow++

  const areaTotalRows: number[] = []

  for (const area of areasToRender) {
    const areaRows = byArea.get(area)!
    wsRes.mergeCells(`A${sRow}:K${sRow}`)
    const ac = wsRes.getCell(`A${sRow}`)
    ac.value = `▸ ${area}`
    ac.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1A237E' } }
    applyBg(ac, `FF${AREA_BG}`)
    wsRes.getRow(sRow).height = 18; sRow++

    const aStart = sRow
    areaRows.forEach((r, idx) => { writeDataRow(wsRes, sRow++, r, idx % 2 === 1) })
    writeTotRow(wsRes, sRow, aStart, sRow - 1)
    areaTotalRows.push(sRow); sRow += 2
  }

  // Grand total
  const gr = wsRes.getRow(sRow)
  gr.getCell(1).value = 'TOTAL GENERAL'; gr.getCell(2).value = ''
  gr.getCell(3).value = { formula: areaTotalRows.map(r => `C${r}`).join('+') }; gr.getCell(3).numFmt = '#,##0'
  ;[4,5,6,7,8,9,10].forEach(c => { const l = cl(c); gr.getCell(c).value = { formula: areaTotalRows.map(r => `${l}${r}`).join('+') }; gr.getCell(c).numFmt = '$#,##0;($#,##0);"-"' })
  gr.getCell(11).value = { formula: `IF(F${sRow}=0,0,J${sRow}/F${sRow})` }; gr.getCell(11).numFmt = '0.0%;(0.0%);"-"'
  for (let c = 1; c <= NCOLS; c++) {
    gr.getCell(c).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    applyBg(gr.getCell(c), 'FF1E3A5F')
    gr.getCell(c).alignment = { horizontal: c <= 2 ? 'left' : 'right', vertical: 'middle' }
    gr.getCell(c).border = { top: { style: 'medium', color: { argb: 'FF90CAF9' } }, bottom: { style: 'medium', color: { argb: 'FF90CAF9' } } }
  }
  wsRes.getRow(sRow).height = 26

  // ── Por área ──
  for (const area of areasToRender) {
    const areaRows = byArea.get(area)!
    const ws = wb.addWorksheet(`${area} ${temporada.replace('/', '-')}`, { pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' } })
    ws.columns = WIDTHS.map(w => ({ width: w }))

    let row = 1
    ws.mergeCells(`A${row}:K${row}`)
    const tc = ws.getCell(`A${row}`)
    tc.value = `Contribución Marginal — ${area} — Temporada ${temporada}`
    tc.font = { name: 'Arial', bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
    applyBg(tc, `FF${HDR_BG}`)
    tc.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 28; row++

    ws.mergeCells(`A${row}:K${row}`)
    const sc = ws.getCell(`A${row}`)
    sc.value = `IVA Venta B2C estimado 4% · Generado: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    sc.font = { name: 'Arial', italic: true, size: 10, color: { argb: 'FF90A4AE' } }
    applyBg(sc, `FF${HDR_BG}`)
    sc.alignment = { horizontal: 'center' }
    ws.getRow(row).height = 18; row++; row++

    styleHdrRow(ws, row, COL_BG); row++
    const dStart = row
    areaRows.forEach((r, idx) => { writeDataRow(ws, row++, r, idx % 2 === 1) })
    writeTotRow(ws, row, dStart, row - 1)
  }
}

export async function GET() {
  const supabase = createClient()
  const profile = await getUserProfile()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: lastUpload } = await supabase
    .from('uploads').select('id').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) return NextResponse.json({ error: 'Sin datos' }, { status: 404 })
  const uploadId = lastUpload.id

  // Fetch datos para todas las temporadas
  const rowsByTemp = new Map<string, LetiRow[]>()
  for (const temp of TEMPORADAS) {
    const { data } = await supabase.rpc('get_reporte_daniel', { p_upload_id: uploadId, p_temporada: temp })
    if (data && data.length > 0) rowsByTemp.set(temp, data as LetiRow[])
  }

  if (rowsByTemp.size === 0) return NextResponse.json({ error: 'Sin datos' }, { status: 404 })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Say Hueque - Gerencial'
  wb.created = new Date()

  // Hoja 1: Dashboard
  await buildDashboardSheet(wb, supabase, uploadId)

  // Hojas por temporada
  for (const temp of TEMPORADAS) {
    if (rowsByTemp.has(temp)) buildTemporadaSheets(wb, rowsByTemp, temp)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `Reporte_Daniel_${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
