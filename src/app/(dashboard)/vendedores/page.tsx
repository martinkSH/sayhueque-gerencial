import { createClient } from '@/lib/supabase/server'
import { TrendingUp } from 'lucide-react'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const TEMPORADAS = ['25/26', '24/25', '23/24', '26/27']

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

  const { data: rawRanking } = await supabase
    .rpc('get_ranking_vendedores', { p_upload_id: lastUpload.id, p_temporada: temp })

  type VRow = { vendedor: string; area: string; viajes: number; pax: number; venta: number; ganancia: number }
  const ranking = (rawRanking ?? []) as VRow[]

  const totalVenta = ranking.reduce((s, r) => s + r.venta, 0)
  const totalGanancia = ranking.reduce((s, r) => s + r.ganancia, 0)
  const totalViajes = ranking.reduce((s, r) => s + r.viajes, 0)
  const totalCM = totalVenta > 0 ? totalGanancia / totalVenta : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Ranking Vendedores</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Temporada {temp} · estados confirmados · {lastUpload.filename}</p>
        </div>
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
                <tr><td colSpan={8} style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>Sin datos para temporada {temp}</td></tr>
              ) : ranking.map((r, i) => {
                const cm = r.venta > 0 ? r.ganancia / r.venta : 0
                return (
                  <tr key={`${r.vendedor}-${r.area}`} style={{
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
                      color: cm < 0.15 ? '#f87171' : cm < 0.20 ? '#fb923c' : '#4ade80'
                    }}>{(cm * 100).toFixed(1)}%</td>
                  </tr>
                )
              })}
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
