'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function SyncTourplanButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  async function handleSync() {
    setStatus('loading')
    setMsg(null)
    try {
      const res = await fetch('/api/sync-tourplan', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      setStatus('ok')
      setMsg(`✓ ${data.teamLeader} files · ${data.audit} audit · ${data.fetchedAt}`)
      // Recargar la página para ver datos nuevos
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      setStatus('error')
      setMsg(e.message)
    }
  }

  const colors = {
    idle:    { bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.3)', color: 'var(--teal-400)' },
    loading: { bg: 'rgba(20,184,166,0.05)', border: 'rgba(20,184,166,0.2)', color: 'var(--muted)' },
    ok:      { bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.3)', color: '#4ade80' },
    error:   { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
  }
  const c = colors[status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        onClick={handleSync}
        disabled={status === 'loading'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          border: `1px solid ${c.border}`,
          background: c.bg, color: c.color,
          transition: 'all 0.15s',
        }}
      >
        <RefreshCw size={14} style={{ animation: status === 'loading' ? 'spin 1s linear infinite' : 'none' }} />
        {status === 'loading' ? 'Sincronizando...' : 'Sync TourPlan'}
      </button>
      {msg && (
        <span style={{ fontSize: 11, color: status === 'error' ? '#f87171' : 'var(--muted)', maxWidth: 280, textAlign: 'right' }}>
          {msg}
        </span>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
