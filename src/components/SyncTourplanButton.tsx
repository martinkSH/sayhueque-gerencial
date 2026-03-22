'use client'

import { useState } from 'react'
import { RefreshCw, Database, CheckCircle2, AlertCircle } from 'lucide-react'

type SyncResult = {
  success: boolean
  message: string
  rowsInserted?: number
  auditRowsInserted?: number
  dateRange?: { desde: string; hasta: string }
}

export default function SyncTourplanButton({ 
  initialDateRange 
}: { 
  initialDateRange?: { desde: string; hasta: string } 
}) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)

  async function handleSync() {
    setSyncing(true)
    setResult(null)

    try {
      const res = await fetch('/api/sync-tourplan', { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({
        success: false,
        message: `Error de red: ${err instanceof Error ? err.message : 'desconocido'}`,
      })
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const dateRange = result?.dateRange || initialDateRange

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        onClick={handleSync}
        disabled={syncing}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          borderRadius: 8,
          border: 'none',
          background: syncing ? 'var(--surface2)' : 'var(--teal-600)',
          color: syncing ? 'var(--muted)' : '#fff',
          cursor: syncing ? 'not-allowed' : 'pointer',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {syncing ? (
          <>
            <RefreshCw size={16} className="spin" />
            Sincronizando...
          </>
        ) : (
          <>
            <Database size={16} />
            Sincronizar TourPlan
          </>
        )}
      </button>

      {/* Rango de fechas */}
      {dateRange && (
        <div style={{
          padding: 10,
          borderRadius: 6,
          background: 'rgba(20,184,166,0.08)',
          border: '1px solid rgba(20,184,166,0.2)',
          fontSize: 12,
          color: 'var(--muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={12} style={{ color: 'var(--teal-400)' }} />
            <span>
              Rango: <strong style={{ color: 'var(--text)' }}>{formatDate(dateRange.desde)}</strong>
              {' → '}
              <strong style={{ color: 'var(--text)' }}>{formatDate(dateRange.hasta)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Resultado del sync */}
      {result && (
        <div
          style={{
            padding: 14,
            borderRadius: 8,
            border: `1px solid ${result.success ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
            background: result.success ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            display: 'flex',
            gap: 10,
          }}
        >
          {result.success ? (
            <CheckCircle2 size={18} style={{ color: '#4ade80', flexShrink: 0, marginTop: 1 }} />
          ) : (
            <AlertCircle size={18} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
          )}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                color: result.success ? '#4ade80' : '#f87171',
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              {result.success ? '✓ Sincronización exitosa' : '✕ Error en sincronización'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {result.message}
            </div>
            {result.success && result.rowsInserted !== undefined && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                {result.rowsInserted.toLocaleString('es-AR')} bookings insertados
                {result.auditRowsInserted !== undefined && ` · ${result.auditRowsInserted.toLocaleString('es-AR')} cambios de estado`}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}
