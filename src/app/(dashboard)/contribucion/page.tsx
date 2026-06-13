import { createClient } from '@/lib/supabase/server'
import { fetchAllRows, fetchSalesforceVentaMap } from '@/lib/supabase/fetch-all'
import { getUserProfile, expandAreas, B2C_AREAS, ESTADOS_CONFIRMADOS } from '@/lib/user-context'
import { categCM } from '@/lib/format'
import ContribucionClient, { type CMFile } from './ContribucionClient'

export const dynamic = 'force-dynamic'

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
  const areaFiltro = searchParams.area ?? 'empresa'

  const { data: lastUpload } = await supabase
    .from('uploads').select('id, filename').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) return <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>Sin datos.</div>

  const uploadId = lastUpload.id

  // Temporadas con viajes confirmados (dinámicas). Default: 26/27 (la vigente).
  const { data: tempsRaw } = await supabase.rpc('get_temporadas_confirmadas', {
    p_upload_id: uploadId, p_areas: expandedUserAreas,
  })
  const TEMPORADAS = ((tempsRaw ?? []) as { temporada: string }[]).map(t => t.temporada)
  const temp = searchParams.temp && TEMPORADAS.includes(searchParams.temp)
    ? searchParams.temp
    : TEMPORADAS.includes('26/27') ? '26/27' : (TEMPORADAS[0] ?? '26/27')

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

  // Paginado: supera el límite de 1000 de Supabase sobre team_leader_rows.
  type TlRow = {
    file_code: string; booking_branch: string | null; vendedor: string | null
    venta: number | null; costo: number | null; ganancia: number | null
    cant_pax: number | null; is_b2c: boolean
  }
  const tlRows = await fetchAllRows<TlRow>((from, to) => {
    let q = supabase
      .from('team_leader_rows')
      .select('file_code, booking_branch, vendedor, venta, costo, ganancia, cant_pax, is_b2c')
      .eq('upload_id', uploadId).eq('temporada', temp)
      .in('estado', ESTADOS_CONFIRMADOS)
      .order('file_code')
      .range(from, to)
    if (areasReales) q = q.in('booking_branch', areasReales)
    return q
  })

  // Venta de Salesforce para B2C
  const sfMap = await fetchSalesforceVentaMap(supabase, uploadId)

  const filesMap = new Map<string, CMFile>()
  tlRows.forEach(r => {
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

  // Distribución por categoría de CM (sobre TODOS los files)
  const catCount = new Map<string, number>(CATS.map(c => [c, 0]))
  allFiles.forEach(f => { const c = categCM(f.cm); catCount.set(c.label, (catCount.get(c.label) ?? 0) + 1) })

  const areaDisplay = !isAdmin
    ? (userProfile?.areas ?? []).join(', ')
    : areaFiltro === 'empresa' ? 'Total empresa' : areaFiltro

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Contribución Marginal</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {total} files · {areaDisplay} · {temp}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TEMPORADAS.map(t => (
            <a key={t} href={`?temp=${t}&area=${encodeURIComponent(areaFiltro)}`} style={{
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

      <ContribucionClient files={allFiles} />
    </div>
  )
}
