'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type UserPresence = {
  userId: string
  name: string
  role: string
  areas: string[]
  online_at: string
}

// Solo se monta en /admin — muestra quiénes están conectados
export default function PresenceWidget({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserPresence[]>([])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('online-users')

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<UserPresence>()
        const list: UserPresence[] = []
        Object.values(state).forEach(presences => {
          presences.forEach(p => list.push(p as unknown as UserPresence))
        })
        setUsers(list)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const others = users.filter(u => u.userId !== currentUserId)
  const me = users.find(u => u.userId === currentUserId)

  if (users.length === 0) return null

  function initials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'
  }

  function roleColor(role: string) {
    return role === 'admin' ? 'var(--teal-600)' : '#7c3aed'
  }

  const totalOnline = users.length

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#4ade80',
            display: 'inline-block',
            boxShadow: '0 0 0 2px rgba(74,222,128,0.3)',
          }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {totalOnline} {totalOnline === 1 ? 'usuario conectado' : 'usuarios conectados'}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>En tiempo real</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Yo primero */}
        {me && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(13,148,136,0.08)',
            border: '1px solid rgba(13,148,136,0.15)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: roleColor(me.role),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
              position: 'relative',
            }}>
              {initials(me.name)}
              <span style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 8, height: 8, borderRadius: '50%',
                background: '#4ade80',
                border: '1.5px solid var(--surface)',
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                {me.name} <span style={{ fontSize: 11, color: 'var(--teal-400)' }}>· vos</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>
                {me.role} {me.role !== 'admin' && me.areas.length > 0 ? `· ${me.areas.join(', ')}` : ''}
              </div>
            </div>
          </div>
        )}

        {/* Los demás */}
        {others.length > 0 && others.map(u => (
          <div key={u.userId} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: roleColor(u.role),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
              position: 'relative',
            }}>
              {initials(u.name)}
              <span style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 8, height: 8, borderRadius: '50%',
                background: '#4ade80',
                border: '1.5px solid var(--surface2)',
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>
                {u.role}
                {u.role !== 'admin' && u.areas.length > 0 ? ` · ${u.areas.join(', ')}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
              {formatTimeAgo(u.online_at)}
            </div>
          </div>
        ))}

        {others.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 2 }}>
            Nadie más conectado en este momento
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'hace ' + diff + 's'
  if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + 'm'
  return 'hace ' + Math.floor(diff / 3600) + 'h'
}
