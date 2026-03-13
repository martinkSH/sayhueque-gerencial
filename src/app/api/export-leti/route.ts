import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/user-context'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const AREAS_ORDER = ['Web','Plataformas','Walk In','Aliwen','DMC FITS','Grupos DMC','Booknow']

function mesLabel(d: string) {
  const dt = new Date(d)
  return `${MESES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
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

  // Group by area
  const byArea = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!byArea.has(r.area)) byArea.set(r.area, [])
    byArea.get(r.area)!.push(r)
  }

  // Create workbook
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Say Hueque - Gerencial'
  wb.created = new Date()

  // Colors
  const HEADER_BG = '1E3A5F'    // dark blue
  const SUBHEADER_BG = '2D6A4F' // dark green
  const AREA_BG = 'C8E6C9'      // light green for area title
  const COL_HDR_BG = '37474F'   // dark slate for column headers
  const TOTAL_BG = 'E8F5E9'     // very light green for totals
  const STRIPE = 'F5F5F5'       // light gray stripe

  const areasToRender = AREAS_ORDER.filter(a => byArea.has(a))
    .concat(Array.from(byArea.keys()).filter(a => !AREAS_ORDER.includes(a)))

  for (const area of areasToRender) {
    const areaRows = byArea.get(area)!
    const ws = wb.addWorksheet(area, {
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
    })

    // Column widths
    ws.columns = [
      { width: 16 }, // Area
      { width: 14 }, // Mes OUT
      { width: 15 }, // Total Venta
      { width: 13 }, // IVA Venta
      { width: 15 }, // Venta Neta
      { width: 15 }, // Total Costo
      { width: 13 }, // IVA Costo
      { width: 15 }, // Costo Neto
      { width: 14 }, // CM USD
      { width: 10 }, // CM %
    ]

    let row = 1

    // Title row
    ws.mergeCells(`A${row}:J${row}`)
    const titleCell = ws.getCell(`A${row}`)
    titleCell.value = `Reporte Contribución Marginal — ${area} — Temporada ${temporada}`
    titleCell.font = { name: 'Arial', bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_BG}` } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 28
    row++

    // Subtitle
    ws.mergeCells(`A${row}:J${row}`)
    const subCell = ws.getCell(`A${row}`)
    subCell.value = `Generado: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}`
    subCell.font = { name: 'Arial', italic: true, size: 10, color: { argb: 'FF90A4AE' } }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_BG}` } }
    subCell.alignment = { horizontal: 'center' }
    ws.getRow(row).height = 18
    row++

    // Empty row
    row++

    // Column headers
    const headers = ['Área', 'Mes de OUT', 'Total Venta', 'IVA Venta', 'Venta Neta', 'Total Costo', 'IVA Costo', 'Costo Neto', 'CM USD', 'CM %']
    const hdrRow = ws.getRow(row)
    headers.forEach((h, i) => {
      const cell = hdrRow.getCell(i + 1)
      cell.value = h
      cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COL_HDR_BG}` } }
      cell.alignment = { horizontal: i <= 1 ? 'left' : 'right', vertical: 'middle' }
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF546E7A' } },
      }
    })
    ws.getRow(row).height = 22
    row++

    const dataStartRow = row

    // Data rows
    areaRows.forEach((r, idx) => {
      const dataRow = ws.getRow(row)
      const isStripe = idx % 2 === 1
      const bg = isStripe ? `FF${STRIPE}` : 'FFFFFFFF'

      const vals = [
        r.area,
        mesLabel(r.mes_out),
        Number(r.total_venta),
        Number(r.iva_venta),
        Number(r.venta_neta),
        Number(r.total_costo),
        Number(r.iva_costo),
        Number(r.costo_neto),
        Number(r.cm_usd),
        Number(r.cm_pct),
      ]

      vals.forEach((v, i) => {
        const cell = dataRow.getCell(i + 1)
        cell.value = v
        cell.font = { name: 'Arial', size: 10 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.alignment = { horizontal: i <= 1 ? 'left' : 'right', vertical: 'middle' }
        if (i >= 2 && i <= 8) {
          cell.numFmt = '$#,##0.00;($#,##0.00);"-"'
        }
        if (i === 9) {
          cell.numFmt = '0.0%;(0.0%);"-"'
          // Color CM% cell
          const pct = Number(r.cm_pct)
          if (pct >= 0.25) {
            cell.font = { name: 'Arial', size: 10, color: { argb: 'FF2E7D32' }, bold: true }
          } else if (pct >= 0.18) {
            cell.font = { name: 'Arial', size: 10, color: { argb: 'FFE65100' } }
          } else {
            cell.font = { name: 'Arial', size: 10, color: { argb: 'FFC62828' } }
          }
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        }
      })
      ws.getRow(row).height = 18
      row++
    })

    const dataEndRow = row - 1

    // Total row
    const totRow = ws.getRow(row)
    totRow.getCell(1).value = 'TOTAL'
    totRow.getCell(2).value = ''
    const totCols = [3, 4, 5, 6, 7, 8, 9]
    totCols.forEach(c => {
      totRow.getCell(c).value = { formula: `SUM(${String.fromCharCode(64+c)}${dataStartRow}:${String.fromCharCode(64+c)}${dataEndRow})` }
      totRow.getCell(c).numFmt = '$#,##0.00;($#,##0.00);"-"'
    })
    // CM% total = CM USD total / Venta Neta total
    totRow.getCell(10).value = { formula: `IF(E${row}=0,0,I${row}/E${row})` }
    totRow.getCell(10).numFmt = '0.0%;(0.0%);"-"'

    for (let c = 1; c <= 10; c++) {
      const cell = totRow.getCell(c)
      cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1A237E' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${TOTAL_BG}` } }
      cell.alignment = { horizontal: c <= 2 ? 'left' : 'right', vertical: 'middle' }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF2E7D32' } },
        bottom: { style: 'medium', color: { argb: 'FF2E7D32' } },
      }
    }
    ws.getRow(row).height = 22
  }

  // Summary sheet with all areas
  const wsSummary = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: 'FF1E3A5F' } } })
  wsSummary.columns = [
    { width: 16 }, { width: 14 }, { width: 15 }, { width: 13 }, { width: 15 },
    { width: 15 }, { width: 13 }, { width: 15 }, { width: 14 }, { width: 10 },
  ]

  let sRow = 1
  wsSummary.mergeCells(`A${sRow}:J${sRow}`)
  const sTitleCell = wsSummary.getCell(`A${sRow}`)
  sTitleCell.value = `Resumen General — Temporada ${temporada}`
  sTitleCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  sTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
  sTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  wsSummary.getRow(sRow).height = 30
  sRow += 2

  const sHeaders = ['Área', 'Mes de OUT', 'Total Venta', 'IVA Venta', 'Venta Neta', 'Total Costo', 'IVA Costo', 'Costo Neto', 'CM USD', 'CM %']
  const sHdrRow = wsSummary.getRow(sRow)
  sHeaders.forEach((h, i) => {
    const cell = sHdrRow.getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF37474F' } }
    cell.alignment = { horizontal: i <= 1 ? 'left' : 'right', vertical: 'middle' }
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF546E7A' } } }
  })
  wsSummary.getRow(sRow).height = 22
  sRow++

  let lastAreaEnd = 0
  const areaTotalRows: number[] = []

  for (const area of areasToRender) {
    const areaRows = byArea.get(area)!

    // Area header
    wsSummary.mergeCells(`A${sRow}:J${sRow}`)
    const areaCell = wsSummary.getCell(`A${sRow}`)
    areaCell.value = `▸ ${area}`
    areaCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF1A237E' } }
    areaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${AREA_BG}` } }
    wsSummary.getRow(sRow).height = 18
    sRow++

    const areaDataStart = sRow

    areaRows.forEach((r, idx) => {
      const dataRow = wsSummary.getRow(sRow)
      const isStripe = idx % 2 === 1
      const bg = isStripe ? `FF${STRIPE}` : 'FFFFFFFF'
      const vals = [r.area, mesLabel(r.mes_out), Number(r.total_venta), Number(r.iva_venta),
        Number(r.venta_neta), Number(r.total_costo), Number(r.iva_costo), Number(r.costo_neto),
        Number(r.cm_usd), Number(r.cm_pct)]
      vals.forEach((v, i) => {
        const cell = dataRow.getCell(i + 1)
        cell.value = v
        cell.font = { name: 'Arial', size: 9 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.alignment = { horizontal: i <= 1 ? 'left' : 'right' }
        if (i >= 2 && i <= 8) cell.numFmt = '$#,##0;($#,##0);"-"'
        if (i === 9) cell.numFmt = '0.0%;(0.0%);"-"'
      })
      wsSummary.getRow(sRow).height = 16
      sRow++
    })

    // Area subtotal
    const totRow = wsSummary.getRow(sRow)
    totRow.getCell(1).value = `Total ${area}`
    totRow.getCell(2).value = ''
    ;[3,4,5,6,7,8,9].forEach(c => {
      totRow.getCell(c).value = { formula: `SUM(${String.fromCharCode(64+c)}${areaDataStart}:${String.fromCharCode(64+c)}${sRow-1})` }
      totRow.getCell(c).numFmt = '$#,##0;($#,##0);"-"'
    })
    totRow.getCell(10).value = { formula: `IF(E${sRow}=0,0,I${sRow}/E${sRow})` }
    totRow.getCell(10).numFmt = '0.0%;(0.0%);"-"'
    for (let c = 1; c <= 10; c++) {
      totRow.getCell(c).font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF2E7D32' } }
      totRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
      totRow.getCell(c).alignment = { horizontal: c <= 2 ? 'left' : 'right' }
      totRow.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FF81C784' } },
        bottom: { style: 'thin', color: { argb: 'FF81C784' } },
      }
    }
    areaTotalRows.push(sRow)
    wsSummary.getRow(sRow).height = 18
    sRow += 2
  }

  // Grand total
  const grandTotRow = wsSummary.getRow(sRow)
  grandTotRow.getCell(1).value = 'TOTAL GENERAL'
  grandTotRow.getCell(2).value = ''
  ;[3,4,5,6,7,8,9].forEach(c => {
    const refs = areaTotalRows.map(r => `${String.fromCharCode(64+c)}${r}`).join('+')
    grandTotRow.getCell(c).value = { formula: refs }
    grandTotRow.getCell(c).numFmt = '$#,##0;($#,##0);"-"'
  })
  grandTotRow.getCell(10).value = { formula: `IF(E${sRow}=0,0,I${sRow}/E${sRow})` }
  grandTotRow.getCell(10).numFmt = '0.0%;(0.0%);"-"'
  for (let c = 1; c <= 10; c++) {
    grandTotRow.getCell(c).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    grandTotRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    grandTotRow.getCell(c).alignment = { horizontal: c <= 2 ? 'left' : 'right', vertical: 'middle' }
    grandTotRow.getCell(c).border = {
      top: { style: 'medium', color: { argb: 'FF90CAF9' } },
      bottom: { style: 'medium', color: { argb: 'FF90CAF9' } },
    }
  }
  wsSummary.getRow(sRow).height = 24

  // Move summary to first position
  wb.moveSheet('Resumen', 0)

  // Generate buffer
  const buffer = await wb.xlsx.writeBuffer()
  const filename = `Reporte_Leti_${temporada.replace('/', '-')}_${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
