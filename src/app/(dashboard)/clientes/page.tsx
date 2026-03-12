import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const ESTADOS_CONFIRMADOS = [
  'Final + Day by Day', 'Confirmed', 'Pre Final',
  'En Operaciones', 'Cerrado', 'Cierre Operativo'
]
const B2C_AREAS = ['Web', 'Plataformas', 'Walk In']
const TEMPORADAS = ['25/26', '24/25', '26/27']

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { area?: string; temp?: string }
}) {
  const supabase = createClient()
  const temp = searchParams.temp ?? '25/26'

  const { data: lastUpload } = await supabase
    .from('uploads')
    .select('id, filename')
    .eq('status', 'ok')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastUpload) {
    return <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>Sin datos. Subí un Excel primero.</div>
  }

  const uploadId = lastUpload.id

  // Traer todas las áreas disponibles
  const { data: areasRaw } = await supabase
    .from('team_leader_rows')
    .select('booking_branch')
    .eq('upload_id', uploadId)
    .eq('temporada', temp)
    .in('estado', ESTADOS_CONFIRMADOS)
    .limit(10000)

  const areasSet = new Set<string>()
  areasRaw?.forEach(r => { if (r.booking_branch) areasSet.add(r.booking_branch) })
  // Agrupar B2C
  const areasDisplay = ['B2C', ...Array.from(areasSet).filter(a => !B2C_AREAS.includes(a)).sort()]
  const areaFiltro = searchParams.area ?? areasDisplay[0] ?? ''

  // Determinar qué áreas reales corresponden al filtro
  const areasReales = areaFiltro === 'B2C' ? B2C_AREAS : [areaFiltro]

  // Traer rows del área seleccionada
  const { data: tlRows } = await supabase
    .from('team_leader_rows')
    .select('file_code, cliente, booking_branch, venta, ganancia, cant_pax, is_b2c')
    .eq('upload_id', uploadId)
    .eq('temporada', temp)
    .in('estado', ESTADOS_CONFIRMADOS)
    .in('booking_branch', areasReales)
    .limit(10000)

  // SF map para B2C override
  const { data: sfRows } = await supabase
    .from('salesforce_rows')
    .select('file_code, venta, ganancia')
    .eq('upload_id', uploadId)

  const sfMap = new Map<string, { venta: number; ganancia: number }>()
  sfRows?.forEach(r => sfMap.set(r.file_code.toUpperCase(), { venta: r.venta ?? 0, ganancia: r.ganancia ?? 0 }))

  // Agrupar por cliente
  type ClienteData = { viajes: Set<string>; pax: number; venta: number; ganancia: number }
  const clienteMap = new Map<string, ClienteData>()
  const seenFiles = new Set<string>()

  tlRows?.forEach(r => {
    if (!r.cliente) return
    if (seenFiles.has(r.file_code)) return
    seenFiles.add(r.file_code)

    const sf = r.is_b2c ? sfMap.get(r.file_code.toUpperCase()) : null
    const venta = sf ? sf.venta : (r.venta ?? 0)
    const ganancia = sf ? sf.ganancia : (r.ganancia ?? 0)

    const cur = clienteMap.get(r.cliente) ?? { viajes: new Set(), pax: 0, venta: 0, ganancia: 0 }
    cur.viajes.add(r.file_code)
    cur.pax += r.cant_pax ?? 0
    cur.venta += venta
    cur.ganancia += ganancia
    clienteMap.set(r.cliente, cur)
  })

  const clientes = Array.from(clienteMap.entries())
    .map(([cliente, d]) => ({
      cliente,
      viajes: d.viajes.size,
      pax: d.pax,
      venta: d.venta,
      ganancia: d.ganancia,
      cm: d.venta > 0 ? d.ganancia / d.venta : 0,
    }))
    .sort((a, b) => b.ganancia - a.ganancia)

  const totalVenta = clientes.reduce((s, r) => s + r.venta, 0)
  const totalGanancia = clientes.reduce((s, r) => s + r.ganancia, 0)
  const totalViajes = clientes.reduce((s, r) => s + r.viajes, 0)
  const totalCM = totalVenta > 0 ? totalGanancia / totalVenta : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Análisis Clientes</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Temporada {temp} · área {areaFiltro} · {lastUpload.filename}</p>
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

      {/* Filtro de área */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {areasDisplay.map(a => (
          <a key={a} href={`?temp=${temp}&area=${encodeURIComponent(a)}`} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
            background: areaFiltro === a ? 'var(--surface2)' : 'transparent',
            color: areaFiltro === a ? 'var(--text)' : 'var(--muted)',
            border: `1px solid ${areaFiltro === a ? 'var(--teal-600)' : 'var(--border)'}`,
          }}>{a}</a>
        ))}
      </div>

      {/* Tabla */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {clientes.length} clientes · {areaFiltro} · {temp}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['#', 'Cliente', 'Viajes', 'Pax', 'Venta', 'Ganancia', 'CM'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px',
                    textAlign: ['#', 'Cliente'].includes(h) ? 'left' : 'right',
                    color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                    Sin clientes para {areaFiltro} en {temp}
                  </td>
                </tr>
              ) : clientes.map((r, i) => (
                <tr key={r.cliente} style={{
                  borderTop: '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>{r.cliente}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{r.viajes}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(r.venta)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: r.ganancia < 0 ? '#f87171' : '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatUSD(r.ganancia)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500,
                    color: r.cm < 0.15 ? '#f87171' : r.cm < 0.20 ? '#fb923c' : '#4ade80'
                  }}>{(r.cm * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {clientes.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                  <td colSpan={2} style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{totalViajes}</td>
                  <td style={{ padding: '10px 16px' }} />
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
