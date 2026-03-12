/**
 * POST /api/upload
 * Recibe la ruta del archivo en Supabase Storage, lo descarga, parsea e inserta.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseExcel } from '@/lib/parser'

export const maxDuration = 60

const CHUNK_SIZE = 500

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  // 1. Auth
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos para subir archivos' }, { status: 403 })
  }

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
    .insert({ uploaded_by: user.id, filename, semana, periodo, status: 'processing' })
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

    // 6. Borrar uploads anteriores (cascade borra datos)
    await supabase.from('uploads').delete().neq('id', uploadId)

    // 7. Insertar en batches
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

async function batchInsert(
  supabase: ReturnType<typeof createServiceClient>,
  table: string,
  rows: Record<string, unknown>[]
) {
  if (rows.length === 0) return
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`Error insertando en ${table}: ${error.message}`)
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
