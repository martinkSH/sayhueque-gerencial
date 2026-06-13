import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.res
  const { admin } = auth

  let body: { area?: string; cm_min?: number; cm_max?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const { area, cm_min, cm_max } = body
  if (!area || cm_min == null || cm_max == null) {
    return NextResponse.json({ error: 'Faltan campos requeridos (area, cm_min, cm_max)' }, { status: 400 })
  }

  const { error } = await admin.from('cm_rangos').upsert({
    area, cm_min, cm_max, updated_at: new Date().toISOString()
  }, { onConflict: 'area' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
