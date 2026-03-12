import { createClient } from '@/lib/supabase/server'
import { TrendingUp } from 'lucide-react'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const TEMPORADAS = ['25/26', '24/25', '23/24', '26/27']
const ESTADOS_CONFIRMADOS = [
  'Final + Day by Day', 'Confirmed', 'Pre Final',
  'En Operaciones', 'Cerrado', 'Cierre Operativo'
]
const B2C_AREAS = ['Web', 'Plataformas', 'Walk In']

export default async function VendedoresPage({
  searchParams,
}: {
  searchParams: { temp?: string }
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

  // Traer TL rows de la temporada seleccionada
  const { data: tlRows } = await supabase
    .from('team_leader_rows')
    .select('file_code, vendedor, booking_branch, venta, ganancia, cant_pax, is_b2c')
    .eq('upload_id', uploadId)
    .eq('temporada', temp)
    .in('estado', ESTADOS_CONFIRMADOS)
    .limit(10000)

  // SF map para B2C override
  const { data: sfRows } = await supabase
    .from('salesforce_rows')
    .select('file_code, venta, ganancia')
    .eq('upload_id', uploadId)

  const sfMap = new Map<string, { venta: number; ganancia: number }>()
  sfRows?.forEach(r => sfMap.set(r.file_code.toUpperCase(), { venta: r.venta ?? 0, ganancia: r.ganancia ?? 0 }))

  // Agrupar por vendedor, agrupando B2C areas
  type VendedorData = {
    viajes: Set<string>
    pax: number
    venta: number
    ganancia: number
    area: string
  }

  const vendMap = new Map<string, VendedorData>()
  const seenFiles = new Set<string>()

  tlRows?.forEach(r => {
    if (!r.vendedor) return
    if (seenFiles.has(r.file_code)) return
    seenFiles.add(r.file_code)

    const sf = r.is_b2c ? sfMap.get(r.file_code.toUpperCase()) : null
    const venta = sf ? sf.venta : (r.venta ?? 0)
    const ganancia = sf ? sf.ganancia : (r.ganancia ?? 0)
    const area = B2C_AREAS.includes(r.booking_branch ?? '') ? 'B2C' : (r.booking_branch ?? 'Sin área')

    const key = r.vendedor
    const cur = vendMap.get(key) ?? { viajes: new Set(), pax: 0, venta: 0, ganancia: 0, area }
    cur.viajes.add(r.file_code)
    cur.pax += r.cant_pax ?? 0
    cur.venta += venta
    cur.ganancia += ganancia
    vendMap.set(key, cur)
  })

  const ranking = Array.from(vendMap.entries())
    .map(([vendedor, d]) => ({
      vendedor,
      area: d.area,
      viajes: d.viajes.size,
      pax: d.pax,
      venta: d.venta,
      ganancia: d.ganancia,
      cm: d.venta > 0 ? d.ganancia / d.venta : 0,
    }))
    .sort((a, b) => b.ganancia - a.ganancia)

  const totalVenta = ranking.reduce((s, r) => s + r.venta, 0)
  const totalGanancia = ranking.reduce((s, r) => s + r.ganancia, 0)
  const totalViajes = ranking.reduce((s, r) => s + r.viajes, 0)
  const totalCM = totalVenta > 0 ? totalGanancia / totalVenta : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Ranking Vendedores</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Temporada {temp} · estados confirmados · {lastUpload.filename}</p>
        </div>
        {/* Selector de temporada */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TEMPORADAS.map(t => (
            <a key={t} href={`?temp=${t}`} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
              background: temp === t ? 'var(--teal-600)' : 'var(--surface2)',
              color: temp === t ? '#fff' : 'var(--muted)',
              border: `1px solid ${temp === t ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{t}</a>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {ranking.length} vendedores · temporada {temp}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['#', 'Vendedor', 'Área', 'Viajes', 'Pax', 'Venta', 'Ganancia', 'CM'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px',
                    textAlign: ['#', 'Vendedor', 'Área'].includes(h) ? 'left' : 'right',
                    color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                    Sin datos para temporada {temp}
                  </td>
                </tr>
              ) : ranking.map((r, i) => (
                <tr key={r.vendedor} style={{
                  borderTop: '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>{r.vendedor}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 500,
                      background: r.area === 'B2C' ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.06)',
                      color: r.area === 'B2C' ? 'var(--teal-400)' : 'var(--text-dim)',
                    }}>{r.area}</span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{r.viajes}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(r.venta)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: r.ganancia < 0 ? '#f87171' : '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatUSD(r.ganancia)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500,
                    color: r.cm < 0.15 ? '#f87171' : r.cm < 0.20 ? '#fb923c' : '#4ade80'
                  }}>{(r.cm * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {/* Total */}
              {ranking.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                  <td colSpan={3} style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 700 }}>TOTAL EMPRESA</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{totalViajes}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>—</td>
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
