'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

export interface AreaStat {
  area: string
  venta: number
  ganancia: number
  viajes: number
  pax: number
  temporada: string
}

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const AREA_COLORS: Record<string, { dot: string; accent: string }> = {
  'B2C (Web + Plataformas + Walk In)': { dot: '#14b8a6', accent: 'rgba(20,184,166,0.08)' },
  'Aliwen':     { dot: '#a78bfa', accent: 'rgba(167,139,250,0.08)' },
  'DMC FITS':   { dot: '#fb923c', accent: 'rgba(251,146,60,0.08)' },
  'Grupos DMC': { dot: '#f472b6', accent: 'rgba(244,114,182,0.08)' },
  'Booknow':    { dot: '#60a5fa', accent: 'rgba(96,165,250,0.08)' },
}

function getColor(area: string) {
  return AREA_COLORS[area] ?? { dot: '#94a3b8', accent: 'rgba(148,163,184,0.06)' }
}

function AreaCard({ row }: { row: AreaStat }) {
  const router = useRouter()
  const cm = row.venta > 0 ? row.ganancia / row.venta : 0
  const { dot, accent } = getColor(row.area)
  const isB2C = row.area.startsWith('B2C')
  const href = `/areas/${encodeURIComponent(isB2C ? 'B2C' : row.area)}?temp=${row.temporada}`

  return (
    <div
      onClick={() => router.push(href)}
      style={{
        borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
        border: '1px solid var(--border)', background: accent,
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'border-color 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = dot; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: isB2C ? '#14b8a6' : 'var(--text)' }}>{row.area}</span>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Viajes</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{row.viajes}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Ganancia</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>{formatUSD(row.ganancia)}</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 52 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>CM</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: cm >= 0.25 ? '#4ade80' : cm >= 0.18 ? '#fb923c' : '#f87171',
          }}>{(cm * 100).toFixed(1)}%</div>
        </div>
      </div>
      <ArrowRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
    </div>
  )
}

export default function AreasPanel({ areas2526, areas2627 }: {
  areas2526: AreaStat[]
  areas2627: AreaStat[]
}) {
  const hasNext = areas2627.length > 0

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Resumen por área</h2>
      </div>

      {areas2526.length > 0 && (
        <div style={{ marginBottom: hasNext ? 20 : 0 }}>
          {hasNext && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>TEMPORADA 25/26</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {areas2526.map(row => <AreaCard key={row.area} row={row} />)}
          </div>
        </div>
      )}

      {hasNext && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>TEMPORADA 26/27</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {areas2627.map(row => <AreaCard key={row.area} row={row} />)}
          </div>
        </div>
      )}
    </div>
  )
}
