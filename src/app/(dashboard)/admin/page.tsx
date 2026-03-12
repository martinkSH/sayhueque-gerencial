import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles').select('id, full_name, role, areas, created_at')
    .order('created_at', { ascending: true })

  const { data: cmRangos } = await supabase
    .from('cm_rangos').select('area, cm_min, cm_max').order('area')

  return <AdminClient users={users ?? []} currentUserId={user.id} cmRangos={cmRangos ?? []} />
}
