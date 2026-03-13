import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas, B2C_AREAS } from '@/lib/user-context'
import { BarChart2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function pct(a: number, b: number) {
  if (b === 0) return null
  return ((a - b) / b) * 100
}

const MESES = ['May','Jun','Jul','Ago','Sep','Oct','Nov','Dic','Ene','Feb','Mar','Abr']

export default async function ComparativoPage({
  searchParams,
}: {
  searchParams: { metric?: string; area?: string }
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

  // 24/25 desde tablas temp
  const tableName = metric === 'ganancia' ? 'temp_2425_ganancia' : metric === 'venta' ? 'temp_2425_venta' : 'temp_2425_cantidad'
  const { data: tempRows } = await supabase.from(tableName).select('*').eq('upload_id', uploadId)

  const temp2425: Map<string, number[]> = new Map()
  tempRows?.forEach((row: Record<string, unknown>) => {
    const area = (row.area as string) ?? ''
    const vals = Array.from({ length: 12 }, (_, i) => {
      const key = `mes_${String(i + 1).padStart(2, '0')}`
      const v = row[key]
      return typeof v === 'number' ? v : 0
    })
    temp2425.set(area, vals)
  })

  // p_areas para RPC 25/26
  let p_areas: string[] | null
  if (!isAdmin) {
    p_areas = expandedUserAreas  // comercial: sus áreas siempre
  } else if (areaFiltro === 'B2C') {
    p_areas = B2C_AREAS
  } else if (areaFiltro === 'empresa') {
    p_areas = null
  } else {
    p_areas = [areaFiltro]
  }

  const { data: rpcRows } = await supabase.rpc('get_comparativo_2526', {
    p_upload_id: uploadId, p_metric: metric, p_areas: p_areas,
  })

  type RpcRow = { mes_idx: number; valor: number }
  const rows2526 = Array(12).fill(0)
  ;(rpcRows as RpcRow[] ?? []).forEach(r => {
    const idx = r.mes_idx - 1
    if (idx >= 0 && idx < 12) rows2526[idx] = r.valor
  })

  // 24/25 según filtro
  function sumAreas(map: Map<string, number[]>, areas: string[] | null): number[] {
    const total = Array(12).fill(0)
    if (areas === null) {
      map.forEach(vals => vals.forEach((v, i) => { total[i] += v }))
    } else {
      areas.forEach(a => { const v = map.get(a); if (v) v.forEach((x, i) => { total[i] += x }) })
    }
    return total
  }

  let areas2425: string[] | null
  if (!isAdmin) {
    areas2425 = expandedUserAreas
  } else if (areaFiltro === 'B2C') {
    areas2425 = B2C_AREAS
  } else if (areaFiltro === 'empresa') {
    areas2425 = null
  } else {
    areas2425 = [areaFiltro]
  }
  const rows2425 = sumAreas(temp2425, areas2425)

  // Opciones de área para el selector (solo admin ve todas)
  const allAreas2425 = Array.from(temp2425.keys()).filter(Boolean)
  const areaOptions = isAdmin
    ? ['empresa', 'B2C', ...allAreas2425.filter(a => !B2C_AREAS.includes(a)).sort()]
    : null  // comercial no necesita selector

  const total2425 = rows2425.reduce((s, v) => s + v, 0)
  const total2526 = rows2526.reduce((s, v) => s + v, 0)
  const diffTotal = pct(total2526, total2425)
  const metricLabel = metric === 'ganancia' ? 'Ganancia' : metric === 'venta' ? 'Venta' : 'Cantidad'
  const isMoney = metric !== 'cantidad'
  const fmt = (v: number) => isMoney ? formatUSD(v) : v.toLocaleString('es-AR', { maximumFractionDigits: 0 })

  const areaDisplay = !isAdmin
    ? (userProfile?.areas ?? []).join(', ')
    : areaFiltro === 'empresa' ? 'Total empresa' : areaFiltro

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Comparativo 24/25 vs 25/26</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{areaDisplay} · {metricLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['ganancia','venta','cantidad'] as const).map(m => (
            <a key={m} href={`?metric=${m}&area=${areaFiltro}`} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none', textTransform: 'capitalize',
              background: metric === m ? 'var(--teal-600)' : 'var(--surface2)',
              color: metric === m ? '#fff' : 'var(--muted)',
              border: `1px solid ${metric === m ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{m}</a>
          ))}
        </div>
      </div>

      {/* Filtro área — solo admin */}
      {isAdmin && areaOptions && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {areaOptions.map(a => (
            <a key={a} href={`?metric=${metric}&area=${encodeURIComponent(a)}`} style={{
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
                {['Mes','24/25','25/26','Δ%','Barra'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Mes' ? 'left' : h === 'Barra' ? 'left' : 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 12, width: h === 'Barra' ? 160 : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MESES.map((mes, i) => {
                const v2425 = rows2425[i] ?? 0
                const v2526 = rows2526[i] ?? 0
                const diff = pct(v2526, v2425)
                const maxVal = Math.max(...rows2425, ...rows2526, 1)
                return (
                  <tr key={mes} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>{mes}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{fmt(v2425)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(v2526)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: diff === null ? 'var(--muted)' : diff >= 0 ? '#4ade80' : '#f87171' }}>
                      {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${(v2425/maxVal)*100}%`, background: 'rgba(100,116,139,0.6)', borderRadius: 2 }} />
                        </div>
                        <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${(v2526/maxVal)*100}%`, background: 'var(--teal-500)', borderRadius: 2 }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(total2425)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(total2526)}</td>
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
          <span style={{ width: 12, height: 4, background: 'rgba(100,116,139,0.6)', borderRadius: 2, display: 'inline-block' }} /> 24/25
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 4, background: 'var(--teal-500)', borderRadius: 2, display: 'inline-block' }} /> 25/26
        </span>
      </div>
    </div>
  )
}
