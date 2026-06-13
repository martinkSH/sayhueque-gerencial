import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas, B2C_AREAS, ALL_AREAS } from '@/lib/user-context'
import { BarChart2 } from 'lucide-react'
import { formatUSD } from '@/lib/format'

export const dynamic = 'force-dynamic'

function pct(a: number, b: number) {
  if (b === 0) return null
  return ((a - b) / b) * 100
}

const MESES = ['May','Jun','Jul','Ago','Sep','Oct','Nov','Dic','Ene','Feb','Mar','Abr']
// 24/25 es un snapshot histórico que vive en las tablas temp_2425_* (no en team_leader_rows).
const TEMP_HISTORICA = '24/25'
const HISTORICO_ID = '00000000-0000-0000-0000-000000002425'

export default async function ComparativoPage({
  searchParams,
}: {
  searchParams: { metric?: string; area?: string; tempA?: string; tempB?: string }
}) {
  const supabase = createClient()
  const userProfile = await getUserProfile()
  const isAdmin = userProfile?.role === 'admin'
  const expandedUserAreas = isAdmin ? null : expandAreas(userProfile?.areas ?? [])

  const metric = (searchParams.metric ?? 'ganancia') as 'ganancia' | 'venta' | 'cantidad'
  const areaFiltro = searchParams.area ?? 'empresa'

  const { data: lastUpload } = await supabase
    .from('uploads').select('id, filename').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) return <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>Sin datos.</div>

  const uploadId = lastUpload.id

  // Temporadas disponibles para comparar: la histórica 24/25 + las que tienen
  // viajes confirmados en team_leader_rows.
  const { data: tempsRaw } = await supabase.rpc('get_temporadas_confirmadas', {
    p_upload_id: uploadId, p_areas: expandedUserAreas,
  })
  const tlTemps = ((tempsRaw ?? []) as { temporada: string }[]).map(t => t.temporada)
  const seasons = Array.from(new Set([TEMP_HISTORICA, ...tlTemps])).sort()

  // Temporadas elegidas (default: 24/25 vs 25/26, como era antes).
  const pick = (val: string | undefined, fallback: string) =>
    val && seasons.includes(val) ? val : (seasons.includes(fallback) ? fallback : seasons[0])
  const tempA = pick(searchParams.tempA, '24/25')
  const tempB = pick(searchParams.tempB, '25/26')

  // Resolución de áreas para el filtro (igual para ambas temporadas).
  let areasResueltas: string[] | null
  if (!isAdmin) areasResueltas = expandedUserAreas
  else if (areaFiltro === 'B2C') areasResueltas = B2C_AREAS
  else if (areaFiltro === 'empresa') areasResueltas = null
  else areasResueltas = [areaFiltro]

  function sumAreas(map: Map<string, number[]>, areas: string[] | null): number[] {
    const total = Array(12).fill(0)
    if (areas === null) {
      map.forEach(vals => vals.forEach((v, i) => { total[i] += v }))
    } else {
      areas.forEach(a => { const v = map.get(a); if (v) v.forEach((x, i) => { total[i] += x }) })
    }
    return total
  }

  // Serie mensual (12 valores May→Abr) de una temporada para la métrica/áreas actuales.
  async function serieTemporada(temporada: string): Promise<number[]> {
    if (temporada === TEMP_HISTORICA) {
      const tableName = metric === 'ganancia' ? 'temp_2425_ganancia' : metric === 'venta' ? 'temp_2425_venta' : 'temp_2425_cantidad'
      const { data: tempRows } = await supabase.from(tableName).select('*').eq('upload_id', HISTORICO_ID)
      const map: Map<string, number[]> = new Map()
      tempRows?.forEach((row: Record<string, unknown>) => {
        const area = (row.area as string) ?? ''
        const vals = Array.from({ length: 12 }, (_, i) => {
          const v = row[`mes_${String(i + 1).padStart(2, '0')}`]
          return typeof v === 'number' ? v : 0
        })
        map.set(area, vals)
      })
      return sumAreas(map, areasResueltas)
    }
    const { data: rpcRows } = await supabase.rpc('get_comparativo_mensual', {
      p_upload_id: uploadId, p_temporada: temporada, p_metric: metric, p_areas: areasResueltas,
    })
    const arr = Array(12).fill(0)
    ;((rpcRows ?? []) as { mes_idx: number; valor: number }[]).forEach(r => {
      const i = r.mes_idx - 1
      if (i >= 0 && i < 12) arr[i] = r.valor
    })
    return arr
  }

  const rowsA = await serieTemporada(tempA)
  const rowsB = await serieTemporada(tempB)

  // Opciones de área para el selector (solo admin)
  const areaOptions = isAdmin
    ? ['empresa', 'B2C', ...ALL_AREAS.filter(a => !B2C_AREAS.includes(a)).sort()]
    : null

  const totalA = rowsA.reduce((s, v) => s + v, 0)
  const totalB = rowsB.reduce((s, v) => s + v, 0)
  const diffTotal = pct(totalB, totalA)
  const metricLabel = metric === 'ganancia' ? 'Ganancia' : metric === 'venta' ? 'Venta' : 'Cantidad'
  const isMoney = metric !== 'cantidad'
  const fmt = (v: number) => isMoney ? formatUSD(v) : v.toLocaleString('es-AR', { maximumFractionDigits: 0 })
  const maxVal = Math.max(...rowsA, ...rowsB, 1)

  const areaDisplay = !isAdmin
    ? (userProfile?.areas ?? []).join(', ')
    : areaFiltro === 'empresa' ? 'Total empresa' : areaFiltro

  // Helpers para armar los href de los selectores preservando el resto de params.
  const hrefMetric = (m: string) => `?metric=${m}&area=${encodeURIComponent(areaFiltro)}&tempA=${encodeURIComponent(tempA)}&tempB=${encodeURIComponent(tempB)}`
  const hrefArea = (a: string) => `?metric=${metric}&area=${encodeURIComponent(a)}&tempA=${encodeURIComponent(tempA)}&tempB=${encodeURIComponent(tempB)}`
  const hrefTempA = (t: string) => `?metric=${metric}&area=${encodeURIComponent(areaFiltro)}&tempA=${encodeURIComponent(t)}&tempB=${encodeURIComponent(tempB)}`
  const hrefTempB = (t: string) => `?metric=${metric}&area=${encodeURIComponent(areaFiltro)}&tempA=${encodeURIComponent(tempA)}&tempB=${encodeURIComponent(t)}`

  const seasonTab = (t: string, active: boolean, href: string, accent: string) => (
    <a key={t} href={href} style={{
      padding: '4px 11px', borderRadius: 7, fontSize: 12, textDecoration: 'none', fontFamily: 'var(--font-mono)',
      background: active ? accent : 'var(--surface2)',
      color: active ? '#fff' : 'var(--muted)',
      border: `1px solid ${active ? accent : 'var(--border)'}`,
    }}>{t}</a>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Comparativo {tempA} vs {tempB}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{areaDisplay} · {metricLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['ganancia','venta','cantidad'] as const).map(m => (
            <a key={m} href={hrefMetric(m)} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none', textTransform: 'capitalize',
              background: metric === m ? 'var(--teal-600)' : 'var(--surface2)',
              color: metric === m ? '#fff' : 'var(--muted)',
              border: `1px solid ${metric === m ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{m}</a>
          ))}
        </div>
      </div>

      {/* Selector de temporadas a comparar */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 2 }}>Comparar</span>
          {seasons.map(t => seasonTab(t, t === tempA, hrefTempA(t), 'rgba(100,116,139,0.9)'))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>vs</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {seasons.map(t => seasonTab(t, t === tempB, hrefTempB(t), 'var(--teal-600)'))}
        </div>
      </div>

      {/* Filtro área — solo admin */}
      {isAdmin && areaOptions && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {areaOptions.map(a => (
            <a key={a} href={hrefArea(a)} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
              background: areaFiltro === a ? 'var(--surface2)' : 'transparent',
              color: areaFiltro === a ? 'var(--text)' : 'var(--muted)',
              border: `1px solid ${areaFiltro === a ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{a === 'empresa' ? 'Total empresa' : a}</a>
          ))}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{areaDisplay} — {metricLabel} mes a mes</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Mes', tempA, tempB, 'Δ%', 'Barra'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Mes' || h === 'Barra' ? 'left' : 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 12, width: h === 'Barra' ? 160 : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MESES.map((mes, i) => {
                const vA = rowsA[i] ?? 0
                const vB = rowsB[i] ?? 0
                const diff = pct(vB, vA)
                return (
                  <tr key={mes} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>{mes}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{fmt(vA)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(vB)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: diff === null ? 'var(--muted)' : diff >= 0 ? '#4ade80' : '#f87171' }}>
                      {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${(vA/maxVal)*100}%`, background: 'rgba(100,116,139,0.6)', borderRadius: 2 }} />
                        </div>
                        <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${(vB/maxVal)*100}%`, background: 'var(--teal-500)', borderRadius: 2 }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(totalA)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(totalB)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: diffTotal === null ? 'var(--muted)' : diffTotal >= 0 ? '#4ade80' : '#f87171' }}>
                  {diffTotal === null ? '—' : `${diffTotal >= 0 ? '+' : ''}${diffTotal.toFixed(1)}%`}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 4, background: 'rgba(100,116,139,0.6)', borderRadius: 2, display: 'inline-block' }} /> {tempA}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 4, background: 'var(--teal-500)', borderRadius: 2, display: 'inline-block' }} /> {tempB}
        </span>
      </div>
    </div>
  )
}
