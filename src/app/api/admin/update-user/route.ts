import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.res
  const { admin } = auth

  let body: { userId?: string; role?: string; areas?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const { userId, role, areas } = body
  if (!userId || !role) {
    return NextResponse.json({ error: 'Faltan campos requeridos (userId, role)' }, { status: 400 })
  }

  const { error } = await admin.from('profiles').update({
    role,
    areas: role === 'admin' ? [] : areas,
  }).eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
