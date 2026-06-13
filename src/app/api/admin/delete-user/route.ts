import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.res
  const { admin, userId: callerId } = auth

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const { userId } = body
  if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
  if (userId === callerId) return NextResponse.json({ error: 'No podés eliminarte a vos mismo' }, { status: 400 })

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
