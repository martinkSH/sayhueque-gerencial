import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas, B2C_AREAS } from '@/lib/user-context'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function fmt(n: number) { return n.toLocaleString('es-AR', { maximumFractionDigits: 0 }) }

const CORTES = [
  { key: 'terminado', label: 'Terminados',  emoji: '✅', color: '#94a3b8' },
  { key: 'en_curso',  label: 'En curso',    emoji: '🟡', color: '#fbbf24' },
  { key: 'futuro',    label: 'Futuros',     emoji: '🔵', color: '#60a5fa' },
]

type Row = {
  area: string
  corte: string
  viajes: number
  pax: number
  venta: number
  costo: number
  ganancia: number
}

type AreaData = {
  viajes: number
  pax: number
  venta: number
  costo: number
  ganancia: number
}

function emptyArea(): AreaData {
  return { viajes: 0, pax: 0, venta: 0, costo: 0, ganancia: 0 }
}

const FIN_TEMPORADA = '2026-04-30'

export default async function TemporadaPage() {
  const supabase = createClient()
  const userProfile = await getUserProfile()
  const isAdmin = userProfile?.role === 'admin'
  const expandedUserAreas = isAdmin ? null : expandAreas(userProfile?.areas ?? [])

  const today = new Date().toISOString().slice(0, 10)

  const { data: lastUpload } = await supabase
    .from('uploads').select('id, filename, created_at').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) {
    return (
      <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>
        Sin datos. Subí un Excel primero.
      </div>
    )
  }

  const { data: rawRows } = await supabase.rpc('get_temporada_por_area', {
    p_upload_id: lastUpload.id,
    p_today: today,
    p_fin: FIN_TEMPORADA,
    p_areas: expandedUserAreas,
  })

  const rows = (rawRows ?? []) as Row[]

  // Agrupar: área → corte → datos
  // B2C: agrupar Web + Plataformas + Walk In
  type AreaMap = Map<string, Map<string, AreaData>>
  const data: AreaMap = new Map()

  function addRow(areaKey: string, corte: string, r: Row) {
    if (!data.has(areaKey)) data.set(areaKey, new Map())
    const corteMap = data.get(areaKey)!
    if (!corteMap.has(corte)) corteMap.set(corte, emptyArea())
    const d = corteMap.get(corte)!
    d.viajes += r.viajes
    d.pax += r.pax
    d.venta += r.venta
    d.costo += r.costo
    d.ganancia += r.ganancia
  }

  rows.forEach(r => {
    const areaKey = B2C_AREAS.includes(r.area) ? 'B2C' : r.area
    addRow(areaKey, r.corte, r)
  })

  // Ordenar áreas: B2C primero, luego por ganancia total desc
  const areaList = Array.from(data.entries()).map(([area, corteMap]) => {
    const total = Array.from(corteMap.values()).reduce((acc, d) => {
      acc.viajes += d.viajes; acc.pax += d.pax
      acc.venta += d.venta; acc.costo += d.costo; acc.ganancia += d.ganancia
      return acc
    }, emptyArea())
    return { area, corteMap, total }
  }).sort((a, b) => {
    if (a.area === 'B2C') return -1
    if (b.area === 'B2C') return 1
    return b.total.ganancia - a.total.ganancia
  })

  // Totales generales por corte
  const totalesPorCorte = new Map<string, AreaData>()
  CORTES.forEach(c => totalesPorCorte.set(c.key, emptyArea()))
  areaList.forEach(({ corteMap }) => {
    corteMap.forEach((d, corte) => {
      const t = totalesPorCorte.get(corte)
      if (t) {
        t.viajes += d.viajes; t.pax += d.pax
        t.venta += d.venta; t.costo += d.costo; t.ganancia += d.ganancia
      }
    })
  })

  const grandTotal = emptyArea()
  Array.from(totalesPorCorte.values()).forEach(d => {
    grandTotal.viajes += d.viajes; grandTotal.pax += d.pax
    grandTotal.venta += d.venta; grandTotal.costo += d.costo; grandTotal.ganancia += d.ganancia
  })

  function DataCell({ d, highlight }: { d: AreaData; highlight?: boolean }) {
    const cm = d.venta > 0 ? d.ganancia / d.venta : 0
    return (
      <td style={{ padding: '11px 14px', verticalAlign: 'top', borderRight: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Viajes</span>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: highlight ? 700 : 400, color: 'var(--text)' }}>{fmt(d.viajes)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Pax</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{fmt(d.pax)}</span>
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Venta</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(d.venta)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Costo</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{formatUSD(d.costo)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Ganancia</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: d.ganancia < 0 ? '#f87171' : '#4ade80' }}>{formatUSD(d.ganancia)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>MG</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
              color: cm < 0.15 ? '#f87171' : cm < 0.20 ? '#fb923c' : 'var(--teal-400)'
            }}>{(cm * 100).toFixed(1)}%</span>
          </div>
        </div>
      </td>
    )
  }

  const areaLabel = !isAdmin ? (userProfile?.areas ?? []).join(', ') : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Resumen Temporada 25/26</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Viajes terminados · en curso · futuros hasta 30/04
          {areaLabel && <span style={{ color: 'var(--teal-400)', marginLeft: 8 }}>· {areaLabel}</span>}
        </p>
      </div>

      {/* Totales por corte - KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {CORTES.map(c => {
          const d = totalesPorCorte.get(c.key) ?? emptyArea()
          const cm = d.venta > 0 ? d.ganancia / d.venta : 0
          return (
            <div key={c.key} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 15 }}>{c.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.label}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Viajes</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{fmt(d.viajes)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Pax</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{fmt(d.pax)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Venta</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(d.venta)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Ganancia</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#4ade80' }}>{formatUSD(d.ganancia)}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>MG</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--teal-400)' }}>{(cm * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabla por área */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {isAdmin ? 'Desglose por área' : 'Desglose'} — temporada 25/26
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12, borderRight: '1px solid var(--border)', width: 120 }}>Área</th>
                {CORTES.map(c => (
                  <th key={c.key} style={{ padding: '10px 16px', color: c.color, fontWeight: 600, fontSize: 12, borderRight: '1px solid var(--border)', minWidth: 160, textAlign: 'left' }}>
                    {c.emoji} {c.label}
                  </th>
                ))}
                <th style={{ padding: '10px 16px', color: 'var(--muted)', fontWeight: 500, fontSize: 12, textAlign: 'left', minWidth: 160 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {areaList.map(({ area, corteMap, total }, i) => {
                const isB2C = area === 'B2C'
                return (
                  <tr key={area} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', verticalAlign: 'top' }}>
                    <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <span style={{
                        fontSize: 13, fontWeight: isB2C ? 700 : 500,
                        color: isB2C ? 'var(--teal-400)' : 'var(--text)',
                      }}>{area}</span>
                      {isB2C && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Web · Plataformas · Walk In</div>}
                    </td>
                    {CORTES.map(c => {
                      const d = corteMap.get(c.key) ?? emptyArea()
                      return <DataCell key={c.key} d={d} />
                    })}
                    <DataCell d={total} highlight />
                  </tr>
                )
              })}
            </tbody>
            {/* Fila total empresa (solo admin) */}
            {isAdmin && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                  <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border)', fontWeight: 700, color: 'var(--text)', verticalAlign: 'middle' }}>
                    TOTAL<br /><span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>empresa</span>
                  </td>
                  {CORTES.map(c => <DataCell key={c.key} d={totalesPorCorte.get(c.key) ?? emptyArea()} highlight />)}
                  <DataCell d={grandTotal} highlight />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  )
}
