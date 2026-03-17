'use client'

import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'

export default function ExportDanielButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/export-daniel')
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'Error') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('content-disposition') ?? ''
      const match = cd.match(/filename="(.+)"/)
      a.download = match?.[1] ?? `Reporte_Daniel_${new Date().toISOString().slice(0,10)}.xlsx`
      a.click(); URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button onClick={handleExport} disabled={loading} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        border: '1px solid rgba(251,146,60,0.3)',
        background: loading ? 'rgba(251,146,60,0.05)' : 'rgba(251,146,60,0.1)',
        color: loading ? 'var(--muted)' : '#fb923c',
        transition: 'all 0.15s',
      }}>
        <FileSpreadsheet size={14} />
        {loading ? 'Generando...' : 'Exportar Reporte Daniel'}
      </button>
      {error && <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>}
    </div>
  )
}
