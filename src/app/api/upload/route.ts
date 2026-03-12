/**
 * POST /api/upload
 * Recibe el .xlsm, lo parsea con las reglas de los macros,
 * borra todos los datos anteriores e inserta los nuevos.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseExcel } from '@/lib/parser'

const CHUNK_SIZE = 500  // filas por batch insert

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  // 1. Auth: solo admin/manager pueden subir
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos para subir archivos' }, { status: 403 })
  }

  // 2. Leer el archivo
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
  }

  if (!file.name.match(/\.(xlsx|xlsm|xls)$/i)) {
    return NextResponse.json({ error: 'El archivo debe ser .xlsx, .xlsm o .xls' }, { status: 400 })
  }

  // 3. Crear registro de upload (estado: processing)
  const now = new Date()
  const semana = getISOWeek(now)
  const periodo = `${now.getFullYear()}-W${String(semana).padStart(2, '0')}`

  const { data: uploadRecord, error: uploadErr } = await supabase
    .from('uploads')
    .insert({
      uploaded_by: user.id,
      filename: file.name,
      semana,
      periodo,
      status: 'processing',
    })
    .select('id')
    .single()

  if (uploadErr || !uploadRecord) {
    return NextResponse.json({ error: 'Error creando registro de upload' }, { status: 500 })
  }

  const uploadId = uploadRecord.id

  try {
    // 4. Parsear el Excel
    const buffer = await file.arrayBuffer()
    const parsed = await parseExcel(buffer)

    // 5. REPLACE ALL: borrar datos anteriores de uploads anteriores
    //    (borramos en cascada via FK, así que solo borramos uploads viejos)
    const { error: deleteErr } = await supabase
      .from('uploads')
      .delete()
      .neq('id', uploadId)    // borrar todos menos el actual (que está en processing)

    if (deleteErr) {
      throw new Error(`Error borrando datos anteriores: ${deleteErr.message}`)
    }

    // 6. Insertar datos nuevos en batches

    // Team Leader
    const tlRows = parsed.teamLeader.map(row => ({ ...row, upload_id: uploadId }))
    await batchInsert(supabase, 'team_leader_rows', tlRows)

    // Salesforce
    const sfRows = parsed.salesforce.map(row => ({ ...row, upload_id: uploadId }))
    await batchInsert(supabase, 'salesforce_rows', sfRows)

    // Audit
    const auditRows = parsed.audit.map(row => ({ ...row, upload_id: uploadId }))
    await batchInsert(supabase, 'bookings_audit_rows', auditRows)

    // Temp 2425 Ganancia
    const g2425 = parsed.temp2425Ganancia.map(row => ({ ...row, upload_id: uploadId }))
    await batchInsert(supabase, 'temp_2425_ganancia', g2425)

    // Temp 2425 Venta
    const v2425 = parsed.temp2425Venta.map(row => ({ ...row, upload_id: uploadId }))
    await batchInsert(supabase, 'temp_2425_venta', v2425)

    // Temp 2425 Cantidad
    const c2425 = parsed.temp2425Cantidad.map(row => ({ ...row, upload_id: uploadId }))
    await batchInsert(supabase, 'temp_2425_cantidad', c2425)

    // 7. Marcar upload como ok
    const rowCount = {
      team_leader: tlRows.length,
      salesforce:  sfRows.length,
      audit:       auditRows.length,
      temp2425:    g2425.length,
    }

    await supabase
      .from('uploads')
      .update({ status: 'ok', row_count: rowCount })
      .eq('id', uploadId)

    return NextResponse.json({
      success: true,
      upload_id: uploadId,
      row_count: rowCount,
      message: `Excel procesado correctamente. ${tlRows.length} filas de Team Leader cargadas.`,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'

    // Marcar upload como error
    await supabase
      .from('uploads')
      .update({ status: 'error', error_msg: message })
      .eq('id', uploadId)

    console.error('[upload] Error procesando Excel:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
async function batchInsert(
  supabase: ReturnType<typeof createServiceClient>,
  table: string,
  rows: Record<string, unknown>[]
) {
  if (rows.length === 0) return

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from(table).insert(chunk)
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
