import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'
import PresenceWidget from '@/components/PresenceWidget'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, role, areas, created_at')
    .order('created_at', { ascending: true })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Administración</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Usuarios, permisos y actividad en tiempo real</p>
      </div>

      {/* Presencia en tiempo real — solo visible para admin */}
      <PresenceWidget currentUserId={user.id} />

      {/* Gestión de usuarios */}
      <AdminClient users={users ?? []} currentUserId={user.id} />
    </div>
  )
}
