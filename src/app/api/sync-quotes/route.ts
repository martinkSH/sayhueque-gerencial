export const runtime = 'nodejs'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/user-context'
import { toISO, getTemporada } from '@/lib/season'
import { tpConnect } from '@/lib/tourplan/db'
import { BRANCH_MAP } from '@/lib/tourplan/constants'
import { getLatestUpload, batchInsert } from '@/lib/supabase/batch'

export async function POST(req: Request) {
  // Permitir llamada con secret header para cron job (igual que sync-tourplan)
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

  let pool: any = null
  
  try {
    // Obtener upload_id actual
    const lastUpload = await getLatestUpload(supabase)
    if (!lastUpload) {
      return NextResponse.json({ error: 'No hay upload disponible' }, { status: 404 })
    }

    const uploadId = lastUpload.id

    // Conectar a TourPlan
    pool = await tpConnect()

    // Query solo para Quotes (QU)
    const result = await pool.request().query(`
      SELECT
        BookingReference,
        BookingBranchCode,
        BookingAgentName,
        BookingTravelDate,
        LastServiceDate
      FROM vw_BookingHeaderReportData
      WHERE BookingBranchCode IN ('WE','WI','PL','AL','DM','GR','BN')
        AND BookingStatus = 'QU'
        AND BookingTravelDate >= '20250501'
        AND BookingTravelDate <= '20280501'
        AND BookingDepartmentName NOT IN ('Test','Sites','Personal Trips','FAM Tours')
        AND BookingBranchName NOT IN ('Test')
      ORDER BY BookingTravelDate DESC
    `)

    // Transformar datos
    const quotes = result.recordset.map((r: any) => {
      const fechaIn = toISO(r.BookingTravelDate)
      const fechaOut = toISO(r.LastServiceDate)
      
      return {
        upload_id: uploadId,
        file_code: String(r.BookingReference ?? '').trim(),
        booking_branch: BRANCH_MAP[String(r.BookingBranchCode ?? '').trim()] ?? null,
        cliente: String(r.BookingAgentName ?? '').trim() || null,
        fecha_in: fechaIn,
        fecha_out: fechaOut,
        temporada: getTemporada(fechaIn),
      }
    }).filter((q: any) => q.file_code && q.fecha_in)

    // Limpiar quotes anteriores del mismo upload
    await supabase.from('tourplan_quotes').delete().eq('upload_id', uploadId)

    // Insertar nuevos quotes en batches
    await batchInsert(supabase, 'tourplan_quotes', quotes)

    return NextResponse.json({
      ok: true,
      quotes: quotes.length,
      uploadId,
      fetchedAt: new Date().toISOString()
    })

  } catch (err: any) {
    console.error('[sync-quotes]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  } finally {
    if (pool) {
      try {
        await pool.close()
      } catch (e) {
        console.error('Error closing pool:', e)
      }
    }
  }
}

export async function GET(req: Request) {
  return POST(req)
}
