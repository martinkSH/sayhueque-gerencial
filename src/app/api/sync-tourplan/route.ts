export const runtime = 'nodejs'
export const maxDuration = 120
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/user-context'
import { fetchTourplanData } from '@/lib/tourplan/mssql'

const BATCH = 500

async function batchUpsert(supabase: any, table: string, rows: any[], conflictCol: string) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflictCol })
    if (error) throw new Error(`${table} upsert error: ${error.message}`)
  }
}

export async function POST(req: Request) {
  // Permitir llamada con secret header para cron job
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  const supabase = createClient()

  if (!isCron) {
    const profile = await getUserProfile()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  try {
    const { teamLeader, audit, fetchedAt, dateRange } = await fetchTourplanData()

    // ── Aplicar departamentos virtuales ──────────────────────────────────
    const { data: deptosVirtuales } = await supabase
      .from('config_departamentos_virtuales')
      .select('*')
      .eq('activo', true)

    if (deptosVirtuales && deptosVirtuales.length > 0) {
      teamLeader.forEach(row => {
        if (!row.vendedor) return
        
        // Buscar si el vendedor está en algún depto virtual
        for (const depto of deptosVirtuales) {
          if (depto.vendedores.includes(row.vendedor)) {
            row.booking_department = depto.departamento_nombre
            break // Solo un depto virtual por viaje
          }
        }
      })
    }

    // Crear upload record
    const { data: upload, error: upErr } = await supabase
      .from('uploads')
      .insert({ filename: `TourPlan sync ${fetchedAt}`, status: 'ok', source: 'tourplan' })
      .select('id').single()
    if (upErr) throw new Error(`Upload insert: ${upErr.message}`)
    const uploadId = upload.id

    // Copiar salesforce_rows del upload anterior al nuevo
    const { data: prevUpload } = await supabase
      .from('uploads').select('id').eq('status', 'ok').neq('id', uploadId)
      .order('created_at', { ascending: false }).limit(1).single()

    if (prevUpload) {
      const { data: prevSF } = await supabase
        .from('salesforce_rows').select('*').eq('upload_id', prevUpload.id)
      if (prevSF && prevSF.length > 0) {
        const newSF = prevSF.map(({ id: _id, upload_id: _uid, ...rest }: any) => ({ ...rest, upload_id: uploadId }))
        const CHUNK = 500
        for (let i = 0; i < newSF.length; i += CHUNK) {
          await supabase.from('salesforce_rows').insert(newSF.slice(i, i + CHUNK))
        }
      }
    }

    // Insertar TL rows (ya con departamentos virtuales aplicados)
    const tlRows = teamLeader.map(r => ({ ...r, upload_id: uploadId }))
    await batchUpsert(supabase, 'team_leader_rows', tlRows, 'upload_id,file_code')

    // Insertar audit rows
    if (audit.length > 0) {
      // Deduplicar por (file_code, date_of_change) antes del upsert
      const auditMap = new Map<string, any>()
      audit.forEach(r => {
        const key = `${r.file_code}__${r.date_of_change}`
        auditMap.set(key, { ...r, upload_id: uploadId })
      })
      const auditRows = Array.from(auditMap.values())
      await batchUpsert(supabase, 'bookings_audit_rows', auditRows, 'upload_id,file_code,date_of_change')
    }

    return NextResponse.json({ 
      ok: true, 
      fetchedAt, 
      teamLeader: tlRows.length, 
      audit: audit.length, 
      uploadId,
      dateRange
    })
  } catch (err: any) {
    console.error('[sync-tourplan]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
