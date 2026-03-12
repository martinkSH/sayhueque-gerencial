'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  name: string
  role: string
  areas: string[]
}

// Se monta en el layout para TODOS los usuarios
// Solo trackea presencia — no muestra nada
export default function PresenceTracker({ userId, name, role, areas }: Props) {
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('online-users', {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            name,
            role,
            areas,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [userId, name, role, areas])

  return null
}
