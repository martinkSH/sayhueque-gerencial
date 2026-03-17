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

function AreaCard({ row, tab }: { row: AreaStat; tab: string }) {
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
        border: `1px solid var(--border)`,
        background: accent,
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'border-color 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = dot; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
    >
      {/* Dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />

      {/* Nombre */}
      <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: isB2C ? '#14b8a6' : 'var(--text)' }}>
        {row.area}
      </span>

      {/* Stats */}
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
            {areas2526.map(row => <AreaCard key={row.area} row={row} tab="25/26" />)}
          </div>
        </div>
      )}

      {hasNext && areas2627.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>TEMPORADA 26/27</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {areas2627.map(row => <AreaCard key={row.area} row={row} tab="26/27" />)}
          </div>
        </div>
      )}
    </div>
  )
}

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
  'B2C (Web + Plataformas + Walk In)': { dot: '#14b8a6', accent: 'rgba(20,184,166,0.15)' },
  'Aliwen':     { dot: '#a78bfa', accent: 'rgba(167,139,250,0.12)' },
  'DMC FITS':   { dot: '#fb923c', accent: 'rgba(251,146,60,0.12)' },
  'Grupos DMC': { dot: '#f472b6', accent: 'rgba(244,114,182,0.12)' },
  'Booknow':    { dot: '#60a5fa', accent: 'rgba(96,165,250,0.12)' },
}

function getColor(area: string) {
  return AREA_COLORS[area] ?? { dot: '#94a3b8', accent: 'rgba(148,163,184,0.1)' }
}

export default function AreasPanel({ areas2526, areas2627 }: {
  areas2526: AreaStat[]
  areas2627: AreaStat[]
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tab, setTab] = useState<'25/26' | '26/27'>('25/26')

  const areas = tab === '25/26' ? areas2526 : areas2627
  const hasNext = areas2627.length > 0

  function toggle(area: string) {
    setExpanded(prev => prev === area ? null : area)
  }

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Resumen por área
        </h2>
        {hasNext && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['25/26', '26/27'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setExpanded(null) }} style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: `1px solid ${tab === t ? 'var(--teal-600)' : 'var(--border)'}`,
                background: tab === t ? 'var(--teal-600)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--muted)',
              }}>{t}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {areas.map(row => {
          const cm = row.venta > 0 ? row.ganancia / row.venta : 0
          const isOpen = expanded === row.area
          const { dot, accent } = getColor(row.area)
          const isB2C = row.area.startsWith('B2C')

          return (
            <div key={row.area} style={{
              borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${isOpen ? dot + '40' : 'var(--border)'}`,
              transition: 'border-color 0.2s',
            }}>
              {/* Header row — clickeable */}
              <button onClick={() => toggle(row.area)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: isOpen ? accent : 'transparent',
                cursor: 'pointer', border: 'none', textAlign: 'left',
                transition: 'background 0.2s',
              }}>
                {/* Dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />

                {/* Nombre */}
                <span style={{
                  fontSize: 13, fontWeight: 500, flex: 1,
                  color: isB2C ? '#14b8a6' : 'var(--text)',
                }}>{row.area}</span>

                {/* CM badge */}
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: cm >= 0.25 ? '#4ade80' : cm >= 0.18 ? '#fb923c' : '#f87171',
                  marginRight: 4,
                }}>CM {(cm * 100).toFixed(1)}%</span>

                {/* Ganancia */}
                <span style={{
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  color: 'var(--text)', minWidth: 110, textAlign: 'right',
                }}>{formatUSD(row.ganancia)}</span>

                {/* Chevron */}
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {/* Expanded panel */}
              {isOpen && (
                <div style={{
                  padding: '16px 20px',
                  background: accent,
                  borderTop: `1px solid ${dot}30`,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 12,
                }}>
                  {[
                    { label: 'Viajes', val: row.viajes.toLocaleString(), mono: true },
                    { label: 'Pax', val: row.pax.toLocaleString(), mono: true },
                    { label: 'Venta', val: formatUSD(row.venta), mono: true },
                    { label: 'Ganancia', val: formatUSD(row.ganancia), mono: true, highlight: true },
                    { label: 'CM %', val: (cm * 100).toFixed(1) + '%', mono: true,
                      color: cm >= 0.25 ? '#4ade80' : cm >= 0.18 ? '#fb923c' : '#f87171' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '10px 14px',
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontSize: 15, fontWeight: 600,
                        fontFamily: item.mono ? 'var(--font-mono)' : undefined,
                        color: item.color ?? (item.highlight ? dot : 'var(--text)'),
                      }}>
                        {item.val}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
