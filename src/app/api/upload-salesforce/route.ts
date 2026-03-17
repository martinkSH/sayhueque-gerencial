import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

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
    const { data: lastUpload } = await supabase
      .from('uploads').select('id').eq('status', 'ok')
      .order('created_at', { ascending: false }).limit(1).single()

    if (!lastUpload) throw new Error('No hay upload activo. Hacé un sync de TourPlan primero.')

    const uploadId = lastUpload.id

    // Borrar SF rows del upload activo y reinsertar
    await supabase.from('salesforce_rows').delete().eq('upload_id', uploadId)

    const CHUNK = 500
    for (let i = 0; i < sfRows.length; i += CHUNK) {
      const chunk = sfRows.slice(i, i + CHUNK).map(r => ({ ...r, upload_id: uploadId }))
      const { error } = await supabase.from('salesforce_rows').insert(chunk)
      if (error) throw new Error(`Error insertando SF: ${error.message}`)
    }

    return NextResponse.json({ success: true, rows: sfRows.length, upload_id: uploadId })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
