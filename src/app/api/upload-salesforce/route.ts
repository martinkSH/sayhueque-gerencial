import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { batchInsert, getLatestUpload } from '@/lib/supabase/batch'
import { requireUploader } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireUploader(req)
  if (!auth.ok) return auth.res
  const { supabase } = auth

  let storagePath: string, filename: string
  try {
    const body = await req.json()
    storagePath = body.storagePath
    filename = body.filename
    if (!storagePath || !filename) throw new Error('Faltan campos')
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { data: fileData, error: downloadErr } = await supabase.storage
    .from('excel-uploads').download(storagePath)
  if (downloadErr || !fileData) {
    return NextResponse.json({ error: `Error descargando: ${downloadErr?.message}` }, { status: 500 })
  }

  try {
    const buffer = await fileData.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })

    // Buscar hoja "Files B2C SaleForce"
    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('salesforce') || n.toLowerCase().includes('b2c'))
    if (!sheetName) throw new Error('No se encontró la hoja "Files B2C SaleForce"')

    const ws = wb.Sheets[sheetName]
    const raw = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: null })

    // Row 0 = header: Venta, Ganancia, CM, File
    const sfRows: { file_code: string; venta: number; ganancia: number; cm: number | null }[] = []
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i]
      const fileCode = row[3] ? String(row[3]).trim() : null
      if (!fileCode) continue
      const venta    = Number(row[0]) || 0
      const ganancia = Number(row[1]) || 0
      const cm       = venta !== 0 ? ganancia / venta : null
      sfRows.push({ file_code: fileCode, venta, ganancia, cm })
    }

    if (sfRows.length === 0) throw new Error('No se encontraron filas de Salesforce')

    // Obtener el upload_id activo más reciente (del sync de TourPlan)
    const lastUpload = await getLatestUpload(supabase)
    if (!lastUpload) throw new Error('No hay upload activo. Hacé un sync de TourPlan primero.')

    const uploadId = lastUpload.id

    // Borrar SF rows del upload activo y reinsertar
    await supabase.from('salesforce_rows').delete().eq('upload_id', uploadId)

    await batchInsert(supabase, 'salesforce_rows', sfRows.map(r => ({ ...r, upload_id: uploadId })))

    return NextResponse.json({ success: true, rows: sfRows.length, upload_id: uploadId })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
