import { createClient } from '@/lib/supabase/server'
import { getUserProfile } from '@/lib/user-context'
import { CheckCircle2, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const ESTADOS_CONFIRMADOS = [
  'Final + Day by Day', 'Confirmed', 'Pre Final',
  'En Operaciones', 'Cerrado', 'Cierre Operativo'
]

export default async function ConfirmacionesPage({
  searchParams,
}: {
  searchParams: { dias?: string }
}) {
  const supabase = createClient()
  const dias = parseInt(searchParams.dias ?? '7')

  const { data: lastUpload } = await supabase
    .from('uploads')
    .select('id, filename, created_at')
    .eq('status', 'ok')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastUpload) {
    return (
      <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>
        Sin datos. Subí un Excel primero.
      </div>
    )
  }

  const since = new Date()
  since.setDate(since.getDate() - dias)

  // SECCIÓN 1: QU→OK últimos N días, agrupado por área + temporada
  const { data: confirmados } = await supabase
    .from('v_confirmados_qu_ok')
    .select('file_code, area, temporada, venta')
    .eq('upload_id', lastUpload.id)
    .eq('rn', 1)
    .gte('date_of_change', since.toISOString())

  // Agrupar por área+temporada
  const map7d = new Map<string, { count: number; venta: number }>()
  confirmados?.forEach(r => {
    const key = `${r.area ?? 'Sin área'}|||${r.temporada ?? 'Sin temporada'}`
    const cur = map7d.get(key) ?? { count: 0, venta: 0 }
    map7d.set(key, { count: cur.count + 1, venta: cur.venta + (r.venta ?? 0) })
  })

  // Convertir a filas ordenadas por área luego temporada
  const filas7d = Array.from(map7d.entries())
    .map(([key, d]) => {
      const [area, temporada] = key.split('|||')
      return { area, temporada, ...d }
    })
    .sort((a, b) => a.area.localeCompare(b.area) || a.temporada.localeCompare(b.temporada))

  const totalCount7d = filas7d.reduce((s, r) => s + r.count, 0)
  const totalVenta7d = filas7d.reduce((s, r) => s + r.venta, 0)

  // SECCIÓN 2: Acumulado 26/27 en adelante desde team_leader_rows
  const { data: tlRows } = await supabase
    .from('team_leader_rows')
    .select('file_code, temporada, booking_branch, venta, cant_pax, is_b2c')
    .eq('upload_id', lastUpload.id)
    .in('estado', ESTADOS_CONFIRMADOS)

  const { data: sfRows } = await supabase
    .from('salesforce_rows')
    .select('file_code, venta')
    .eq('upload_id', lastUpload.id)

  const sfMap = new Map<string, number>()
  sfRows?.forEach(r => sfMap.set(r.file_code.toUpperCase(), r.venta ?? 0))

  type AreaAcum = { viajes: Set<string>; venta: number; pax: number }
  const acumMap = new Map<string, AreaAcum>()

  tlRows?.forEach(r => {
    const temp = r.temporada ?? ''
    const startYear = parseInt(temp.slice(0, 2))
    if (isNaN(startYear) || startYear < 26) return

    const area = r.booking_branch ?? 'Sin área'
    const ventaFinal = r.is_b2c
      ? (sfMap.get(r.file_code.toUpperCase()) ?? r.venta ?? 0)
      : (r.venta ?? 0)

    if (!acumMap.has(area)) acumMap.set(area, { viajes: new Set(), venta: 0, pax: 0 })
    const d = acumMap.get(area)!
    d.viajes.add(r.file_code)
    d.venta += ventaFinal
    d.pax += r.cant_pax ?? 0
  })

  const areasAcum = Array.from(acumMap.entries()).sort((a, b) => b[1].venta - a[1].venta)
  const totalVentaAcum = areasAcum.reduce((s, [, d]) => s + d.venta, 0)
  const totalViajesAcum = areasAcum.reduce((s, [, d]) => s + d.viajes.size, 0)
  const maxVentaAcum = areasAcum[0]?.[1].venta || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Confirmaciones</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            QU → OK · {lastUpload.filename}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 14, 30].map(d => (
            <a key={d} href={`?dias=${d}`} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
              background: dias === d ? 'var(--teal-600)' : 'var(--surface2)',
              color: dias === d ? '#fff' : 'var(--muted)',
              border: `1px solid ${dias === d ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{d}d</a>
          ))}
        </div>
      </div>

      {/* SECCIÓN 1: Tabla área + temporada */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            Confirmados (QU → OK) — últimos {dias} días
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Área', 'Temporada', 'Confirmados', 'Venta Total (USD)'].map(h => (
                  <th key={h} style={{
                    padding: '10px 20px',
                    textAlign: h === 'Área' || h === 'Temporada' ? 'left' : 'right',
                    color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas7d.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                    Sin confirmaciones en los últimos {dias} días
                  </td>
                </tr>
              ) : (
                <>
                  {filas7d.map((r, i) => (
                    <tr key={`${r.area}-${r.temporada}`} style={{
                      borderTop: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}>
                      <td style={{ padding: '10px 20px', color: 'var(--text)' }}>{r.area}</td>
                      <td style={{ padding: '10px 20px' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 6,
                          background: 'rgba(13,148,136,0.15)', color: 'var(--teal-400)', fontWeight: 500,
                        }}>{r.temporada}</span>
                      </td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{r.count}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', color: r.venta < 0 ? '#f87171' : '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatUSD(r.venta)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                    <td style={{ padding: '10px 20px', color: 'var(--text)', fontWeight: 700 }} colSpan={2}>TOTAL EMPRESA</td>
                    <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{totalCount7d}</td>
                    <td style={{ padding: '10px 20px', textAlign: 'right', color: '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatUSD(totalVenta7d)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN 2: Acumulado 26/27 en adelante */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} style={{ color: 'var(--teal-400)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Acumulado temporada 26/27 en adelante</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>estados confirmados</span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Viajes</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{totalViajesAcum}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Venta total</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>{formatUSD(totalVentaAcum)}</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {areasAcum.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '16px 0' }}>
              Sin viajes en temporada 26/27 o posterior
            </div>
          ) : areasAcum.map(([area, d]) => {
            const pct = (d.venta / maxVentaAcum) * 100
            return (
              <div key={area}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{area}</span>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{d.viajes.size} viajes · {d.pax} pax</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(d.venta)}</span>
                  </div>
                </div>
                <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--teal-600), var(--teal-400))', borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>
        {areasAcum.length > 0 && (
          <div style={{ borderTop: '2px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>TOTAL</span>
            <div style={{ display: 'flex', gap: 24 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{totalViajesAcum} viajes</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>{formatUSD(totalVentaAcum)}</span>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
