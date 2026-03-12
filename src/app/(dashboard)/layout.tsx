import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import PresenceTracker from '@/components/PresenceTracker'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, areas')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'comercial'
  const areas: string[] = profile?.areas ?? []
  const name = profile?.full_name ?? user.email ?? ''

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar user={{ email: user.email ?? '', name, role, areas }} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 animate-fade-in">
          {children}
        </div>
      </main>
      {/* Presence tracker — invisible, solo registra al usuario en el canal */}
      <PresenceTracker
        userId={user.id}
        name={name}
        role={role}
        areas={areas}
      />
    </div>
  )
}
