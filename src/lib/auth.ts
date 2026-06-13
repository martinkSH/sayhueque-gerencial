import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createServiceSupabase, type SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/user-context'

/** Cliente Supabase con service role (bypassa RLS). Solo usar en server/API routes. */
export function getServiceClient(): SupabaseClient {
  return createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

type RequireAdminResult =
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; res: NextResponse }

/**
 * Para API routes: valida sesión + rol admin.
 * Devuelve `{ ok: true, admin }` (cliente service-role listo) o `{ ok: false, res }`
 * con el NextResponse de error a retornar. Reemplaza el boilerplate repetido en cada ruta admin.
 *
 *   const auth = await requireAdmin()
 *   if (!auth.ok) return auth.res
 *   const { admin } = auth
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id, admin: getServiceClient() }
}

/**
 * Para server components/páginas: exige rol admin o redirige.
 * Devuelve el perfil si es admin; si no, hace redirect (login o dashboard) y no retorna.
 */
export async function requireAdminProfile() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')
  return profile
}

type RequireUploaderResult =
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; res: NextResponse }

/**
 * Para las rutas de upload: autentica vía Bearer token y exige rol admin/manager.
 * Devuelve el cliente service-role (para storage + inserts) o el NextResponse de error.
 * Reemplaza el bloque de auth duplicado en /api/upload y /api/upload-salesforce.
 */
export async function requireUploader(req: Request): Promise<RequireUploaderResult> {
  const supabase = createServiceClient()
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return { ok: false, res: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { ok: false, res: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return { ok: false, res: NextResponse.json({ error: 'Sin permisos para subir archivos' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id, supabase }
}
