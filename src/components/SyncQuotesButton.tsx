'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'

export default function SyncQuotesButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSync() {
    if (loading) return
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/sync-quotes', { method: 'POST' })
      const data = await res.json()

      if (data.ok) {
        setMessage(`✅ Sincronizados ${data.quotes} quotes`)
        // Recargar la página después de 1 segundo
        setTimeout(() => window.location.reload(), 1000)
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <button
        onClick={handleSync}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 8,
          border: 'none',
          background: loading ? 'var(--surface2)' : 'var(--teal-600)',
          color: loading ? 'var(--muted)' : '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <FileText size={14} />
        {loading ? 'Sincronizando...' : 'Sync Quotes'}
      </button>
      
      {message && (
        <span style={{ fontSize: 12, color: message.startsWith('✅') ? '#4ade80' : '#f87171' }}>
          {message}
        </span>
      )}
    </div>
  )
}
