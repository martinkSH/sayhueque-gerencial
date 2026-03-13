import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas } from '@/lib/user-context'

export const dynamic = 'force-dynamic'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const ESTADOS_CONFIRMADOS = ['Final + Day by Day','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo']
const TEMPORADAS = ['25/26','24/25','26/27']

function categCM(cm: number): { label: string; short: string; color: string } {
  if (cm >= 0.30) return { label: '≥30% Excelente', short: '≥30%',  color: '#4ade80' }
  if (cm >= 0.20) return { label: '20-30% OK',       short: '20-30%', color: '#a3e635' }
  if (cm >= 0.10) return { label: '10-20% Bajo',     short: '10-20%', color: '#fb923c' }
  return              { label: '<10% Crítico',        short: '<10%',   color: '#f87171' }
}
const CATS = ['≥30% Excelente','20-30% OK','10-20% Bajo','<10% Crítico']
const COLOR_MAP: Record<string,string> = { '≥30% Excelente':'#4ade80','20-30% OK':'#a3e635','10-20% Bajo':'#fb923c','<10% Crítico':'#f87171' }

export default async function ContribucionPage({
  searchParams,
}: {
  searchParams: { area?: string; temp?: string }
}) {
  const supabase = createClient()
  const userProfile = await getUserProfile()
  const isAdmin = userProfile?.role === 'admin'
  const expandedUserAreas = isAdmin ? null : expandAreas(userProfile?.areas ?? [])
  const temp = searchParams.temp ?? '25/26'
  const areaFiltro = searchParams.area ?? 'empresa'

  const { data: lastUpload } = await supabase
    .from('uploads').select('id, filename').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) return <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>Sin datos.</div>

  const uploadId = lastUpload.id

  // Áreas disponibles para selector (solo admin)
  const { data: areasRaw } = await supabase
    .from('team_leader_rows').select('booking_branch')
    .eq('upload_id', uploadId).eq('temporada', temp)
    .in('estado', ESTADOS_CONFIRMADOS).limit(10000)

  const areasSet = new Set<string>()
  areasRaw?.forEach(r => { if (r.booking_branch) areasSet.add(r.booking_branch) })
  const availableRaw = expandedUserAreas
    ? Array.from(areasSet).filter(a => expandedUserAreas.includes(a))
    : Array.from(areasSet)
  const hasBc2 = availableRaw.some(a => B2C_AREAS.includes(a))
  const nonB2C = availableRaw.filter(a => !B2C_AREAS.includes(a)).sort()
  const areaOptions = isAdmin
    ? ['empresa', ...(hasBc2 ? ['B2C'] : []), ...nonB2C]
    : null

  // Áreas reales para query
  let areasReales: string[] | null
  if (!isAdmin) {
    areasReales = expandedUserAreas
  } else if (areaFiltro === 'empresa') {
    areasReales = null
  } else if (areaFiltro === 'B2C') {
    areasReales = B2C_AREAS
  } else {
    areasReales = [areaFiltro]
  }

  let query = supabase
    .from('team_leader_rows')
    .select('file_code, booking_branch, vendedor, venta, costo, ganancia, cant_pax, is_b2c')
    .eq('upload_id', uploadId).eq('temporada', temp)
    .in('estado', ESTADOS_CONFIRMADOS).limit(10000)
  if (areasReales) query = query.in('booking_branch', areasReales)
  const { data: tlRows } = await query

  // Solo necesitamos venta de Salesforce para B2C
  const { data: sfRows } = await supabase
    .from('salesforce_rows').select('file_code, venta').eq('upload_id', uploadId)
  const sfMap = new Map<string, number>()
  sfRows?.forEach(r => sfMap.set(r.file_code.toUpperCase(), r.venta ?? 0))

  type FileData = { file_code: string; area: string; vendedor: string; venta: number; ganancia: number; pax: number; cm: number }
  const filesMap = new Map<string, FileData>()
  tlRows?.forEach(r => {
    if (filesMap.has(r.file_code)) return
    let venta: number
    let ganancia: number
    if (r.is_b2c) {
      const ventaSF = sfMap.get(r.file_code.toUpperCase()) ?? (r.venta ?? 0)
      venta = ventaSF
      ganancia = ventaSF - (r.costo ?? 0)  // venta SF - costo TL
    } else {
      venta = r.venta ?? 0
      ganancia = r.ganancia ?? 0
    }
    const area = B2C_AREAS.includes(r.booking_branch ?? '') ? 'B2C' : (r.booking_branch ?? 'Sin área')
    filesMap.set(r.file_code, { file_code: r.file_code, area, vendedor: r.vendedor ?? '—', venta, ganancia, pax: r.cant_pax ?? 0, cm: venta > 0 ? ganancia / venta : 0 })
  })

  const allFiles = Array.from(filesMap.values())
  const total = allFiles.length
  const catCount = new Map<string, number>(CATS.map(c => [c, 0]))
  allFiles.forEach(f => { const c = categCM(f.cm); catCount.set(c.label, (catCount.get(c.label) ?? 0) + 1) })

  const sampleN = Math.max(10, Math.round(total * 0.10))
  const sample = [...allFiles].sort(() => Math.random() - 0.5).slice(0, sampleN).sort((a, b) => b.cm - a.cm)
  const sampleVenta = sample.reduce((s, r) => s + r.venta, 0)
  const sampleGanancia = sample.reduce((s, r) => s + r.ganancia, 0)
  const sampleCM = sampleVenta > 0 ? sampleGanancia / sampleVenta : 0

  const areaDisplay = !isAdmin
    ? (userProfile?.areas ?? []).join(', ')
    : areaFiltro === 'empresa' ? 'Total empresa' : areaFiltro

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Contribución Marginal</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {total} files · muestra {sampleN} · {areaDisplay} · {temp}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
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

      {isAdmin && areaOptions && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {areaOptions.map(a => (
            <a key={a} href={`?temp=${temp}&area=${encodeURIComponent(a)}`} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
              background: areaFiltro === a ? 'var(--surface2)' : 'transparent',
              color: areaFiltro === a ? 'var(--text)' : 'var(--muted)',
              border: `1px solid ${areaFiltro === a ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{a === 'empresa' ? 'Total empresa' : a}</a>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {CATS.map(label => {
          const count = catCount.get(label) ?? 0
          return (
            <div key={label} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', color: COLOR_MAP[label] }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{total > 0 ? ((count/total)*100).toFixed(1) : 0}% del total</div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieChart size={15} style={{ color: 'var(--teal-400)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Muestra aleatoria — {sampleN} files</span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>CM: <span style={{ color: 'var(--teal-400)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(sampleCM*100).toFixed(1)}%</span></span>
            <span style={{ color: 'var(--muted)' }}>Gan: <span style={{ color: '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatUSD(sampleGanancia)}</span></span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['File','Área','Vendedor','Pax','Venta','Ganancia','CM','Cat'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: ['File','Área','Vendedor','Cat'].includes(h) ? 'left' : 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.map((r, i) => {
                const cat = categCM(r.cm)
                return (
                  <tr key={r.file_code} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '9px 16px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.file_code}</td>
                    <td style={{ padding: '9px 16px', color: 'var(--muted)' }}>{r.area}</td>
                    <td style={{ padding: '9px 16px', color: 'var(--text)' }}>{r.vendedor}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(r.venta)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: r.ganancia < 0 ? '#f87171' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(r.ganancia)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: cat.color }}>{(r.cm*100).toFixed(1)}%</td>
                    <td style={{ padding: '9px 16px' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `${cat.color}22`, color: cat.color, fontWeight: 500 }}>{cat.short}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
