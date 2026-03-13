import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas, B2C_AREAS } from '@/lib/user-context'
import { Users } from 'lucide-react'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const ESTADOS_CONFIRMADOS = ['Final + Day by Day','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo']
const TEMPORADAS = ['25/26', '24/25', '26/27']

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { area?: string; temp?: string }
}) {
  const supabase = createClient()
  const userProfile = await getUserProfile()
  const isAdmin = userProfile?.role === 'admin'
  const expandedUserAreas = isAdmin ? null : expandAreas(userProfile?.areas ?? [])
  const temp = searchParams.temp ?? '25/26'

  const { data: lastUpload } = await supabase
    .from('uploads').select('id, filename').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) return <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>Sin datos.</div>

  const uploadId = lastUpload.id

  // Áreas disponibles (filtradas por rol)
  const { data: areasRaw } = await supabase
    .from('team_leader_rows').select('booking_branch')
    .eq('upload_id', uploadId).eq('temporada', temp)
    .in('estado', ESTADOS_CONFIRMADOS).limit(10000)

  const areasSet = new Set<string>()
  areasRaw?.forEach(r => { if (r.booking_branch) areasSet.add(r.booking_branch) })

  // Filtrar áreas según rol
  const availableRaw = expandedUserAreas
    ? Array.from(areasSet).filter(a => expandedUserAreas.includes(a))
    : Array.from(areasSet)

  const hasBc2 = availableRaw.some(a => B2C_AREAS.includes(a))
  const nonB2C = availableRaw.filter(a => !B2C_AREAS.includes(a)).sort()
  const areaOptions = [...(hasBc2 ? ['B2C'] : []), ...nonB2C]

  const areaFiltro = searchParams.area ?? areaOptions[0] ?? 'B2C'
  const areasReales = areaFiltro === 'B2C'
    ? (expandedUserAreas ? B2C_AREAS.filter(a => expandedUserAreas.includes(a)) : B2C_AREAS)
    : [areaFiltro]

  const { data: rawClientes } = await supabase
    .rpc('get_clientes_por_area', { p_upload_id: uploadId, p_temporada: temp, p_areas: areasReales })

  type CRow = { cliente: string; viajes: number; pax: number; venta: number; ganancia: number }
  const clientes = (rawClientes ?? []) as CRow[]

  const totalVenta = clientes.reduce((s, r) => s + r.venta, 0)
  const totalGanancia = clientes.reduce((s, r) => s + r.ganancia, 0)
  const totalViajes = clientes.reduce((s, r) => s + r.viajes, 0)
  const totalCM = totalVenta > 0 ? totalGanancia / totalVenta : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Análisis Clientes</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Temporada {temp} · {areaFiltro}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TEMPORADAS.map(t => (
            <a key={t} href={`?temp=${t}&area=${areaFiltro}`} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
              background: temp === t ? 'var(--teal-600)' : 'var(--surface2)',
              color: temp === t ? '#fff' : 'var(--muted)',
              border: `1px solid ${temp === t ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{t}</a>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {areaOptions.map(a => (
          <a key={a} href={`?temp=${temp}&area=${encodeURIComponent(a)}`} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
            background: areaFiltro === a ? 'var(--surface2)' : 'transparent',
            color: areaFiltro === a ? 'var(--text)' : 'var(--muted)',
            border: `1px solid ${areaFiltro === a ? 'var(--teal-600)' : 'var(--border)'}`,
          }}>{a}</a>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{clientes.length} clientes · {areaFiltro} · {temp}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['#','Cliente','Viajes','Pax','Venta','Ganancia','CM'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: ['#','Cliente'].includes(h) ? 'left' : 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>Sin clientes para {areaFiltro} en {temp}</td></tr>
              ) : clientes.map((r, i) => {
                const cm = r.venta > 0 ? r.ganancia / r.venta : 0
                return (
                  <tr key={r.cliente} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>{r.cliente}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{r.viajes}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(r.venta)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: r.ganancia < 0 ? '#f87171' : '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatUSD(r.ganancia)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500, color: cm < 0.15 ? '#f87171' : cm < 0.20 ? '#fb923c' : '#4ade80' }}>{(cm * 100).toFixed(1)}%</td>
                  </tr>
                )
              })}
              {clientes.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                  <td colSpan={2} style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{totalViajes}</td>
                  <td />
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatUSD(totalVenta)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatUSD(totalGanancia)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--teal-400)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{(totalCM * 100).toFixed(1)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
