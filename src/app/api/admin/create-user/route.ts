import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.res
  const { admin } = auth

  let body: { email?: string; password?: string; full_name?: string; role?: string; areas?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const { email, password, full_name, role, areas } = body
  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Faltan campos requeridos (email, password, role)' }, { status: 400 })
  }

  const { data: newUser, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Crear perfil
  const { error: profileError } = await admin.from('profiles').upsert({
    id: newUser.user.id,
    full_name,
    role,
    areas: role === 'admin' ? [] : areas,
  })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  return NextResponse.json({
    user: {
      id: newUser.user.id,
      full_name,
      role,
      areas: role === 'admin' ? [] : areas,
      created_at: newUser.user.created_at,
    }
  })
}
