/**
 * POST /api/upload
 * Recibe la ruta del archivo en Supabase Storage, lo descarga, parsea e inserta.
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseExcel } from '@/lib/parser'
import { batchInsert } from '@/lib/supabase/batch'
import { requireUploader } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  // 1. Auth (Bearer token + rol admin/manager)
  const auth = await requireUploader(req)
  if (!auth.ok) return auth.res
  const { supabase, userId } = auth

  // 2. Leer storagePath del body JSON
  let storagePath: string
  let filename: string
  try {
    const body = await req.json()
    storagePath = body.storagePath
    filename = body.filename
    if (!storagePath || !filename) throw new Error('Faltan campos')
  } catch {
    return NextResponse.json({ error: 'Body inválido: se esperaba { storagePath, filename }' }, { status: 400 })
  }

  // 3. Descargar el archivo desde Supabase Storage
  const { data: fileData, error: downloadErr } = await supabase.storage
    .from('excel-uploads')
    .download(storagePath)

  if (downloadErr || !fileData) {
    return NextResponse.json({ error: `Error descargando archivo: ${downloadErr?.message}` }, { status: 500 })
  }

  // 4. Crear registro de upload
  const now = new Date()
  const semana = getISOWeek(now)
  const periodo = `${now.getFullYear()}-W${String(semana).padStart(2, '0')}`

  const { data: uploadRecord, error: uploadErr } = await supabase
    .from('uploads')
    .insert({ uploaded_by: userId, filename, semana, periodo, status: 'processing' })
    .select('id')
    .single()

  if (uploadErr || !uploadRecord) {
    return NextResponse.json({ error: 'Error creando registro de upload' }, { status: 500 })
  }

  const uploadId = uploadRecord.id

  try {
    // 5. Parsear
    const buffer = await fileData.arrayBuffer()
    const parsed = await parseExcel(buffer)

    // 6. Insertar en batches (ANTES de borrar los uploads viejos, para no perder
    //    datos si falla algún insert — el catch deja los datos previos intactos).
    const tlRows = parsed.teamLeader.map(row => ({ ...row, upload_id: uploadId }))
    const sfRows = parsed.salesforce.map(row => ({ ...row, upload_id: uploadId }))
    const auditRows = parsed.audit.map(row => ({ ...row, upload_id: uploadId }))
    const g2425 = parsed.temp2425Ganancia.map(row => ({ ...row, upload_id: uploadId }))
    const v2425 = parsed.temp2425Venta.map(row => ({ ...row, upload_id: uploadId }))
    const c2425 = parsed.temp2425Cantidad.map(row => ({ ...row, upload_id: uploadId }))

    await batchInsert(supabase, 'team_leader_rows', tlRows)
    await batchInsert(supabase, 'salesforce_rows', sfRows)
    await batchInsert(supabase, 'bookings_audit_rows', auditRows)
    await batchInsert(supabase, 'temp_2425_ganancia', g2425)
    await batchInsert(supabase, 'temp_2425_venta', v2425)
    await batchInsert(supabase, 'temp_2425_cantidad', c2425)

    // 7. Recién ahora borrar los uploads anteriores (cascade borra sus datos).
    await supabase.from('uploads').delete().neq('id', uploadId)

    const rowCount = {
      team_leader: tlRows.length,
      salesforce: sfRows.length,
      audit: auditRows.length,
      temp2425: g2425.length,
    }

    await supabase.from('uploads').update({ status: 'ok', row_count: rowCount }).eq('id', uploadId)

    return NextResponse.json({ success: true, upload_id: uploadId, row_count: rowCount,
      message: `Excel procesado. ${tlRows.length} filas de Team Leader cargadas.` })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    await supabase.from('uploads').update({ status: 'error', error_msg: message }).eq('id', uploadId)
    console.error('[upload] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
