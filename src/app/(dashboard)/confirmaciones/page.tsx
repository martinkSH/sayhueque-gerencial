import { createClient } from '@/lib/supabase/server'
import { CheckCircle2, TrendingUp, Users, Calendar } from 'lucide-react'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
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

  // Último upload
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

  // SECCIÓN 1: Confirmaciones QU→OK últimos N días
  const { data: confirmados } = await supabase
    .from('v_confirmados_qu_ok')
    .select('file_code, area, grupo_vendedor, operador, temporada, date_of_change, venta')
    .eq('upload_id', lastUpload.id)
    .eq('rn', 1)
    .gte('date_of_change', since.toISOString())
    .order('date_of_change', { ascending: false })

  const totalVenta7d = confirmados?.reduce((s, r) => s + (r.venta ?? 0), 0) ?? 0
  const totalFiles7d = confirmados?.length ?? 0

  // SECCIÓN 2: Acumulado por temporada y área (team_leader_rows estados confirmados)
  const { data: tlRows } = await supabase
    .from('team_leader_rows')
    .select('file_code, temporada, booking_branch, venta, cant_pax, is_b2c')
    .eq('upload_id', lastUpload.id)
    .in('estado', ESTADOS_CONFIRMADOS)

  // También traer SF para B2C override
  const { data: sfRows } = await supabase
    .from('salesforce_rows')
    .select('file_code, venta')
    .eq('upload_id', lastUpload.id)

  const sfMap = new Map<string, number>()
  sfRows?.forEach(r => sfMap.set(r.file_code.toUpperCase(), r.venta ?? 0))

  // Agrupar: temporada → área → { viajes, venta, pax }
  type AreaData = { viajes: Set<string>; venta: number; pax: number }
  const temporadaMap = new Map<string, Map<string, AreaData>>()

  tlRows?.forEach(r => {
    const temp = r.temporada ?? 'Sin temporada'
    const area = r.booking_branch ?? 'Sin área'
    const ventaFinal = r.is_b2c
      ? (sfMap.get(r.file_code.toUpperCase()) ?? r.venta ?? 0)
      : (r.venta ?? 0)

    if (!temporadaMap.has(temp)) temporadaMap.set(temp, new Map())
    const areaMap = temporadaMap.get(temp)!
    if (!areaMap.has(area)) areaMap.set(area, { viajes: new Set(), venta: 0, pax: 0 })
    const d = areaMap.get(area)!
    d.viajes.add(r.file_code)
    d.venta += ventaFinal
    d.pax += r.cant_pax ?? 0
  })

  // Ordenar temporadas (más reciente primero)
  const temporadas = Array.from(temporadaMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Confirmaciones</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            QU → OK · últimos {dias} días · {lastUpload.filename}
          </p>
        </div>
        {/* Filtro días */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 14, 30].map(d => (
            <a key={d} href={`?dias=${d}`} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
              background: dias === d ? 'var(--teal-600)' : 'var(--surface2)',
              color: dias === d ? '#fff' : 'var(--muted)',
              border: `1px solid ${dias === d ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>
              {d}d
            </a>
          ))}
        </div>
      </div>

      {/* KPIs últimos N días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: `Confirmados (${dias}d)`, value: totalFiles7d, icon: CheckCircle2, color: '#4ade80' },
          { label: 'Venta acumulada', value: formatUSD(totalVenta7d), icon: TrendingUp, color: 'var(--teal-400)' },
        ].map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{card.label}</span>
                <Icon size={16} style={{ color: card.color, opacity: 0.8 }} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                {card.value}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabla confirmaciones recientes */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            Confirmaciones últimos {dias} días
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{totalFiles7d} registros</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {!confirmados?.length ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              Sin confirmaciones en los últimos {dias} días
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['Fecha', 'File', 'Área', 'Vendedor / GR', 'Operador', 'Temporada', 'Venta'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      color: 'var(--muted)', fontWeight: 500, fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confirmados.map((r, i) => (
                  <tr key={r.file_code + i} style={{
                    borderTop: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}>
                    <td style={{ padding: '9px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(r.date_of_change)}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{r.file_code}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-dim)' }}>{r.area ?? '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-dim)' }}>{r.grupo_vendedor ?? '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-dim)' }}>{r.operador ?? '—'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6,
                        background: 'rgba(13,148,136,0.15)', color: 'var(--teal-400)',
                        fontWeight: 500,
                      }}>{r.temporada ?? '—'}</span>
                    </td>
                    <td style={{ padding: '9px 14px', color: '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 500, textAlign: 'right' }}>
                      {r.venta ? formatUSD(r.venta) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Acumulado por temporada */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={15} style={{ color: 'var(--teal-400)' }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Acumulado por temporada
          </h2>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>estados confirmados</span>
        </div>

        {temporadas.map(([temporada, areaMap]) => {
          const areas = Array.from(areaMap.entries()).sort((a, b) => b[1].venta - a[1].venta)
          const totalTemp = areas.reduce((s, [, d]) => s + d.venta, 0)
          const totalViajes = areas.reduce((s, [, d]) => s + d.viajes.size, 0)
          const totalPax = areas.reduce((s, [, d]) => s + d.pax, 0)
          const maxVenta = areas[0]?.[1].venta || 1

          return (
            <div key={temporada} className="card" style={{ overflow: 'hidden' }}>
              {/* Header temporada */}
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Calendar size={14} style={{ color: 'var(--teal-400)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{temporada}</span>
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Viajes</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{totalViajes}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pax</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{totalPax.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Venta total</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>{formatUSD(totalTemp)}</div>
                  </div>
                </div>
              </div>

              {/* Desglose por área */}
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {areas.map(([area, d]) => {
                  const pct = (d.venta / maxVenta) * 100
                  return (
                    <div key={area}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, flexWrap: 'wrap', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{area}</span>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            <Users size={10} style={{ display: 'inline', marginRight: 3 }} />
                            {d.viajes.size} viajes · {d.pax} pax
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                            {formatUSD(d.venta)}
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3 }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: 'linear-gradient(90deg, var(--teal-600), var(--teal-400))',
                          borderRadius: 3, transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
