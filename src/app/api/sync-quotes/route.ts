export const runtime = 'nodejs'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/user-context'

/* eslint-disable @typescript-eslint/no-require-imports */
const sql = require('mssql')

const config = {
  server:   'LA-SAYHUE.data.tourplan.net',
  port:     50409,
  database: 'DBSAYHUEQUE',
  user:     'excelLA-SAYHUE',
  password: 'o6rmFv7$RJnp14NzqI18',
  options: {
    encrypt:                true,
    trustServerCertificate: true,
    connectTimeout:         30000,
    requestTimeout:         120000,
  },
}

const BRANCH_MAP: Record<string, string> = {
  'WE': 'Web',
  'WI': 'Walk In',
  'PL': 'Plataformas',
  'AL': 'Aliwen',
  'DM': 'DMC FITS',
  'GR': 'Grupos DMC',
  'BN': 'Booknow',
}

function toISO(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) {
    if (v.getFullYear() <= 1900) return null
    return v.toISOString().split('T')[0]
  }
  return String(v).slice(0, 10) || null
}

function getTemporada(fechaIn: string | null): string | null {
  if (!fechaIn) return null
  const d = new Date(fechaIn)
  const m = d.getMonth() + 1
  const y = d.getFullYear()
  const desde = m >= 5 ? y : y - 1
  return `${String(desde).slice(2)}/${String(desde + 1).slice(2)}`
}

export async function POST(req: Request) {
  const supabase = createClient()
  const profile = await getUserProfile()
  
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let pool: any = null
  
  try {
    // Obtener upload_id actual
    const { data: lastUpload } = await supabase
      .from('uploads')
      .select('id')
      .eq('status', 'ok')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!lastUpload) {
      return NextResponse.json({ error: 'No hay upload disponible' }, { status: 404 })
    }

    const uploadId = lastUpload.id

    // Conectar a TourPlan
    pool = await sql.connect(config)

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
    const BATCH = 500
    for (let i = 0; i < quotes.length; i += BATCH) {
      const chunk = quotes.slice(i, i + BATCH)
      const { error } = await supabase.from('tourplan_quotes').insert(chunk)
      if (error) throw new Error(`Error insertando quotes: ${error.message}`)
    }

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
