import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/user-context'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

type LetiRow = {
  area: string
  mes_out: string
  cant_viajes: number
  total_venta: number
  iva_venta: number
  venta_neta: number
  total_costo: number
  iva_costo: number
  costo_neto: number
  cm_usd: number
  cm_pct: number
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const AREAS_ORDER = ['Web','Plataformas','Walk In','Aliwen','DMC FITS','Grupos DMC','Booknow']

function mesLabel(d: string) {
  const dt = new Date(d)
  return `${MESES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}

const HEADER_BG  = '1E3A5F'
const COL_HDR_BG = '37474F'
const AREA_BG    = 'C8E6C9'
const TOTAL_BG   = 'E8F5E9'
const STRIPE     = 'F5F5F5'

const COL_WIDTHS  = [16, 14, 9, 15, 13, 15, 15, 13, 15, 14, 10]
const COL_HEADERS = ['Área','Mes de OUT','Viajes','Total Venta','IVA Venta','Venta Neta','Total Costo','IVA Costo','Costo Neto','CM USD','CM %']
const NCOLS = COL_HEADERS.length

function cellLetter(colIdx: number) {
  return String.fromCharCode(64 + colIdx)
}

function applyBg(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function styleHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, bgcolor: string) {
  COL_HEADERS.forEach((h, i) => {
    const cell = ws.getRow(rowNum).getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    applyBg(cell, `FF${bgcolor}`)
    cell.alignment = { horizontal: i <= 2 ? 'left' : 'right', vertical: 'middle' }
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF546E7A' } } }
  })
  ws.getRow(rowNum).height = 22
}

function writeDataRow(ws: ExcelJS.Worksheet, rowNum: number, r: LetiRow, isStripe: boolean) {
  const bg = isStripe ? `FF${STRIPE}` : 'FFFFFFFF'
  const vals: (string | number)[] = [
    r.area, mesLabel(r.mes_out), Number(r.cant_viajes),
    Number(r.total_venta), Number(r.iva_venta), Number(r.venta_neta),
    Number(r.total_costo), Number(r.iva_costo), Number(r.costo_neto),
    Number(r.cm_usd), Number(r.cm_pct),
  ]
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

function writeTotalRow(ws: ExcelJS.Worksheet, rowNum: number, dataStart: number, dataEnd: number) {
  const totRow = ws.getRow(rowNum)
  totRow.getCell(1).value = 'TOTAL'
  totRow.getCell(2).value = ''
  totRow.getCell(3).value = { formula: `SUM(C${dataStart}:C${dataEnd})` }
  totRow.getCell(3).numFmt = '#,##0'
  ;[4,5,6,7,8,9,10].forEach(c => {
    totRow.getCell(c).value = { formula: `SUM(${cellLetter(c)}${dataStart}:${cellLetter(c)}${dataEnd})` }
    totRow.getCell(c).numFmt = '$#,##0;($#,##0);"-"'
  })
  totRow.getCell(11).value = { formula: `IF(F${rowNum}=0,0,J${rowNum}/F${rowNum})` }
  totRow.getCell(11).numFmt = '0.0%;(0.0%);"-"'
  for (let c = 1; c <= NCOLS; c++) {
    const cell = totRow.getCell(c)
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1A237E' } }
    applyBg(cell, `FF${TOTAL_BG}`)
    cell.alignment = { horizontal: c <= 2 ? 'left' : 'right', vertical: 'middle' }
    cell.border = {
      top:    { style: 'medium', color: { argb: 'FF2E7D32' } },
      bottom: { style: 'medium', color: { argb: 'FF2E7D32' } },
    }
  }
  ws.getRow(rowNum).height = 22
}

export async function GET(req: Request) {
  const supabase = createClient()
  const profile = await getUserProfile()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const temporada = searchParams.get('temp') ?? '25/26'

  const { data: lastUpload } = await supabase
    .from('uploads').select('id').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) return NextResponse.json({ error: 'Sin datos' }, { status: 404 })

  const { data: rows } = await supabase.rpc('get_reporte_leti', {
    p_upload_id: lastUpload.id,
    p_temporada: temporada,
  })

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'Sin datos para el reporte' }, { status: 404 })
  }

  const byArea = new Map<string, LetiRow[]>()
  for (const r of rows as LetiRow[]) {
    if (!byArea.has(r.area)) byArea.set(r.area, [])
    byArea.get(r.area)!.push(r)
  }

  const areasToRender = AREAS_ORDER.filter(a => byArea.has(a))
    .concat(Array.from(byArea.keys()).filter(a => !AREAS_ORDER.includes(a)))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Say Hueque - Gerencial'
  wb.created = new Date()

  // ── Resumen (primera hoja) ────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet('Resumen', {
    properties: { tabColor: { argb: 'FF1E3A5F' } },
  })
  wsSummary.columns = COL_WIDTHS.map(w => ({ width: w }))

  let sRow = 1
  wsSummary.mergeCells(`A${sRow}:K${sRow}`)
  const sTitleCell = wsSummary.getCell(`A${sRow}`)
  sTitleCell.value = `Resumen General — Temporada ${temporada}`
  sTitleCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  applyBg(sTitleCell, 'FF1E3A5F')
  sTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  wsSummary.getRow(sRow).height = 30
  sRow += 2

  styleHeaderRow(wsSummary, sRow, COL_HDR_BG)
  sRow++

  const areaTotalRows: number[] = []

  for (const area of areasToRender) {
    const areaRows = byArea.get(area)!

    wsSummary.mergeCells(`A${sRow}:K${sRow}`)
    const areaCell = wsSummary.getCell(`A${sRow}`)
    areaCell.value = `▸ ${area}`
    areaCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1A237E' } }
    applyBg(areaCell, `FF${AREA_BG}`)
    wsSummary.getRow(sRow).height = 18
    sRow++

    const areaDataStart = sRow
    areaRows.forEach((r, idx) => { writeDataRow(wsSummary, sRow++, r, idx % 2 === 1) })

    writeTotalRow(wsSummary, sRow, areaDataStart, sRow - 1)
    areaTotalRows.push(sRow)
    sRow += 2
  }

  // Grand total
  const grandRow = wsSummary.getRow(sRow)
  grandRow.getCell(1).value = 'TOTAL GENERAL'
  grandRow.getCell(2).value = ''
  grandRow.getCell(3).value = { formula: areaTotalRows.map(r => `C${r}`).join('+') }
  grandRow.getCell(3).numFmt = '#,##0'
  ;[4,5,6,7,8,9,10].forEach(c => {
    const l = cellLetter(c)
    grandRow.getCell(c).value = { formula: areaTotalRows.map(r => `${l}${r}`).join('+') }
    grandRow.getCell(c).numFmt = '$#,##0;($#,##0);"-"'
  })
  grandRow.getCell(11).value = { formula: `IF(F${sRow}=0,0,J${sRow}/F${sRow})` }
  grandRow.getCell(11).numFmt = '0.0%;(0.0%);"-"'
  for (let c = 1; c <= NCOLS; c++) {
    grandRow.getCell(c).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    applyBg(grandRow.getCell(c), 'FF1E3A5F')
    grandRow.getCell(c).alignment = { horizontal: c <= 2 ? 'left' : 'right', vertical: 'middle' }
    grandRow.getCell(c).border = {
      top:    { style: 'medium', color: { argb: 'FF90CAF9' } },
      bottom: { style: 'medium', color: { argb: 'FF90CAF9' } },
    }
  }
  wsSummary.getRow(sRow).height = 26

  // ── Por área ──────────────────────────────────────────────────────────────
  for (const area of areasToRender) {
    const areaRows = byArea.get(area)!
    const ws = wb.addWorksheet(area, {
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
    })
    ws.columns = COL_WIDTHS.map(w => ({ width: w }))

    let row = 1

    ws.mergeCells(`A${row}:K${row}`)
    const titleCell = ws.getCell(`A${row}`)
    titleCell.value = `Reporte Contribución Marginal — ${area} — Temporada ${temporada}`
    titleCell.font = { name: 'Arial', bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
    applyBg(titleCell, `FF${HEADER_BG}`)
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 28
    row++

    ws.mergeCells(`A${row}:K${row}`)
    const subCell = ws.getCell(`A${row}`)
    subCell.value = `Generado: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    subCell.font = { name: 'Arial', italic: true, size: 10, color: { argb: 'FF90A4AE' } }
    applyBg(subCell, `FF${HEADER_BG}`)
    subCell.alignment = { horizontal: 'center' }
    ws.getRow(row).height = 18
    row++
    row++

    styleHeaderRow(ws, row, COL_HDR_BG)
    row++

    const dataStart = row
    areaRows.forEach((r, idx) => { writeDataRow(ws, row++, r, idx % 2 === 1) })
    writeTotalRow(ws, row, dataStart, row - 1)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `Reporte_Leti_${temporada.replace('/', '-')}_${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
