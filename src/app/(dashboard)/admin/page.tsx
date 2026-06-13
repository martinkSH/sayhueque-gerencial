import { createClient } from '@/lib/supabase/server'
import { requireAdminProfile } from '@/lib/auth'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  // El guard de rol admin lo aplica admin/layout.tsx; acá solo necesitamos el id.
  const profile = await requireAdminProfile()
  const supabase = createClient()

  const { data: users } = await supabase
    .from('profiles').select('id, full_name, role, areas, created_at')
    .order('created_at', { ascending: true })

  const { data: cmRangos } = await supabase
    .from('cm_rangos').select('area, cm_min, cm_max').order('area')

  return <AdminClient users={users ?? []} currentUserId={profile.id} cmRangos={cmRangos ?? []} />
}
