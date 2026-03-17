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
    const { teamLeader, audit, fetchedAt } = await fetchTourplanData()

    // Crear upload record
    const { data: upload, error: upErr } = await supabase
      .from('uploads')
      .insert({ filename: `TourPlan sync ${fetchedAt}`, status: 'ok', source: 'tourplan' })
      .select('id').single()

    if (upErr) throw new Error(`Upload insert: ${upErr.message}`)
    const uploadId = upload.id

    // Insertar TL rows
    const tlRows = teamLeader.map(r => ({ ...r, upload_id: uploadId }))
    await batchUpsert(supabase, 'team_leader_rows', tlRows, 'upload_id,file_code')

    // Insertar audit rows
    if (audit.length > 0) {
      const auditRows = audit.map(r => ({ ...r, upload_id: uploadId }))
      await batchUpsert(supabase, 'bookings_audit_rows', auditRows, 'upload_id,file_code,date_of_change')
    }

    return NextResponse.json({ ok: true, fetchedAt, teamLeader: tlRows.length, audit: audit.length, uploadId })

  } catch (err: any) {
    console.error('[sync-tourplan]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
