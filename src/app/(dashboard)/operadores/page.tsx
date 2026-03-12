import { getUserProfile, expandAreas, B2C_AREAS } from '@/lib/user-context'
import { createClient } from '@/lib/supabase/server'
import { Briefcase } from 'lucide-react'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const TEMPORADAS = ['25/26', '24/25', '23/24', '26/27']

export default async function OperadoresPage({
  searchParams,
}: {
  searchParams: { temp?: string; area?: string }
}) {
  const supabase = createClient()
  const temp = searchParams.temp ?? '25/26'
  const userProfile = await getUserProfile()
  const isAdmin = userProfile?.role === 'admin'
  const expandedUserAreas = isAdmin ? null : expandAreas(userProfile?.areas ?? [])
  const areaFiltroRaw = searchParams.area ?? 'todas'

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
    .rpc('get_ranking_operadores', { p_upload_id: lastUpload.id, p_temporada: temp })

  type ORow = { operador: string; area: string; files: number; dias: number; pax: number; venta: number }
  const rankingPorRol = expandedUserAreas
    ? (rawRanking ?? []).filter((r: ORow) => {
        if (r.area === 'B2C') return expandedUserAreas.some(a => ['Web','Plataformas','Walk In'].includes(a))
        return expandedUserAreas.includes(r.area)
      })
    : (rawRanking ?? [])
  const areaFiltro = areaFiltroRaw
  const allRanking = rankingPorRol as ORow[]

  // Áreas disponibles
  const areasSet = new Set(allRanking.map(r => r.area))
  const areaOptions = ['todas', 'B2C', ...Array.from(areasSet).filter(a => a !== 'B2C').sort()]

  // Filtrar
  const ranking = areaFiltro === 'todas'
    ? allRanking
    : allRanking.filter(r => r.area === areaFiltro)

  const totalFiles = ranking.reduce((s, r) => s + r.files, 0)
  const totalDias = ranking.reduce((s, r) => s + r.dias, 0)
  const totalPax = ranking.reduce((s, r) => s + r.pax, 0)
  const totalVenta = ranking.reduce((s, r) => s + r.venta, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Ranking Operadores</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Temporada {temp} · estados confirmados · {lastUpload.filename}
          </p>
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

      {/* Filtro área */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {areaOptions.map(a => (
          <a key={a} href={`?temp=${temp}&area=${encodeURIComponent(a)}`} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
            background: areaFiltro === a ? 'var(--surface2)' : 'transparent',
            color: areaFiltro === a ? 'var(--text)' : 'var(--muted)',
            border: `1px solid ${areaFiltro === a ? 'var(--teal-600)' : 'var(--border)'}`,
          }}>{a === 'todas' ? 'Todas las áreas' : a}</a>
        ))}
      </div>

      {/* Tabla */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Briefcase size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {ranking.length} operadores · {areaFiltro === 'todas' ? 'todas las áreas' : areaFiltro} · {temp}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['#', 'Operador', 'Área', 'Files', 'Días operados', 'Pax', 'Venta'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px',
                    textAlign: ['#', 'Operador', 'Área'].includes(h) ? 'left' : 'right',
                    color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                  Sin datos para esta selección
                </td></tr>
              ) : ranking.map((r, i) => (
                <tr key={`${r.operador}-${r.area}`} style={{
                  borderTop: '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>{r.operador}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 500,
                      background: r.area === 'B2C' ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.06)',
                      color: r.area === 'B2C' ? 'var(--teal-400)' : 'var(--text-dim)',
                    }}>{r.area}</span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{r.files.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.dias?.toLocaleString() ?? '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--teal-400)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatUSD(r.venta)}</td>
                </tr>
              ))}
              {ranking.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                  <td colSpan={3} style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{totalFiles.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{totalDias.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{totalPax.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--teal-400)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatUSD(totalVenta)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
