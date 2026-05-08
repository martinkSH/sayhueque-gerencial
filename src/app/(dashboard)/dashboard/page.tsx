import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas, B2C_AREAS } from '@/lib/user-context'
import { displayAreaName } from '@/lib/area-display'
import { Calendar, CheckCircle2, TrendingUp, Upload, Users } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import ExportLetiButton from '@/components/ExportLetiButton'
import ExportDanielButton from '@/components/ExportDanielButton'
import SyncTourplanButton from '@/components/SyncTourplanButton'
import AreasPanel from '@/components/AreasPanel'
import type { AreaStat } from '@/components/AreasPanel'

export const dynamic = 'force-dynamic'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const ESTADOS_CONFIRMADOS = [
  'Final + Day by Day', 'Confirmed', 'Pre Final',
  'En Operaciones', 'Cerrado', 'Cierre Operativo'
]
const FIN_TEMPORADA = '2026-04-30'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { area?: string }
}) {
  const supabase = createClient()
  const userProfile = await getUserProfile()
  const isAdmin = userProfile?.role === 'admin'
  const areaDetalle = searchParams.area ?? null
  const today = new Date().toISOString().slice(0, 10)

  const p_areas: string[] | null = isAdmin
    ? null
    : expandAreas(userProfile?.areas ?? [])

  const { data: lastUpload } = await supabase
    .from('uploads')
    .select('id, filename, created_at')
    .eq('status', 'ok')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastUpload) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
        <Upload size={48} style={{ color: 'var(--muted)', marginBottom: 16 }} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Sin datos todavía</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Subí tu primer Excel para ver el dashboard.</p>
        {isAdmin && <Link href="/subir" className="btn-primary">Subir Excel ahora</Link>}
      </div>
    )
  }

  const uploadId = lastUpload.id
  const since7days = new Date()
  since7days.setDate(since7days.getDate() - 7)

  // ── QUERIES EN PARALELO ────────────────────────────────────────────────
  // Antes: 8 queries secuenciales (~800ms)
  // Ahora: todas en paralelo (~150-200ms)

  let enCursoQuery = supabase
    .from('team_leader_rows')
    .select('file_code, booking_branch, cant_pax')
    .eq('upload_id', uploadId)
    .in('estado', ESTADOS_CONFIRMADOS)
    .lte('fecha_in', today)
    .gt('fecha_out', today)
    .limit(10000)

  if (p_areas) enCursoQuery = enCursoQuery.in('booking_branch', p_areas)

  const [
    { data: confirmados },
    { data: futurosKpiRaw },
    { data: enCursoRaw },
    { data: gananciaPorAreaRaw },
    { data: ganancia2627Raw },
    { data: gananciaNetaRaw },
    { data: gananciaNet2627Raw },
    { data: areaStats2526Raw },
    { data: areaStats2627Raw },
  ] = await Promise.all([
    // 1. Confirmados QU→OK últimos 7 días
    supabase
      .from('v_confirmados_qu_ok')
      .select('venta, area')
      .eq('upload_id', uploadId)
      .eq('rn', 1)
      .gte('date_of_change', since7days.toISOString()),

    // 2. Futuros KPI
    supabase
      .rpc('get_futuros_kpi', {
        p_upload_id: uploadId,
        p_today: today,
        p_fin: FIN_TEMPORADA,
        p_areas: p_areas,
      })
      .single(),

    // 3. En curso hoy
    enCursoQuery,

    // 4. Ganancia 25/26 BRUTO
    supabase.rpc('get_ganancia_por_area', { p_upload_id: uploadId, p_areas: p_areas }),

    // 5. Ganancia 26/27 BRUTO
    supabase.rpc('get_ganancia_por_area', { p_upload_id: uploadId, p_areas: p_areas, p_temporada: '26/27' }),

    // 6. Ganancia 25/26 NETO
    supabase.rpc('get_ganancia_neta_por_area', { p_upload_id: uploadId, p_areas: p_areas }),

    // 7. Ganancia 26/27 NETO
    supabase.rpc('get_ganancia_neta_por_area', { p_upload_id: uploadId, p_areas: p_areas, p_temporada: '26/27' }),

    // 8. Stats 25/26
    supabase.rpc('get_stats_por_area', { p_upload_id: uploadId, p_areas: p_areas, p_temporada: '25/26' }),

    // 9. Stats 26/27
    supabase.rpc('get_stats_por_area', { p_upload_id: uploadId, p_areas: p_areas, p_temporada: '26/27' }),
  ])

  // ── PROCESAR RESULTADOS ────────────────────────────────────────────────

  // Confirmados
  const confirmadosFiltrados = p_areas
    ? (confirmados ?? []).filter(r => p_areas.includes(r.area ?? ''))
    : (confirmados ?? [])
  const totalConfirmados = confirmadosFiltrados.length
  const ventaConfirmados = confirmadosFiltrados.reduce((s, r) => s + (r.venta ?? 0), 0)

  // Futuros
  const futurosKpi = futurosKpiRaw as { viajes: number; venta: number; ganancia: number } | null
  const totalFuturos = futurosKpi?.viajes ?? 0
  const ventaFutura = futurosKpi?.venta ?? 0
  const gananciaFutura = futurosKpi?.ganancia ?? 0
  const cmFutura = ventaFutura > 0 ? gananciaFutura / ventaFutura : 0

  // En curso hoy
  const enCursoMap = new Map<string, { pax: number; area: string }>()
  enCursoRaw?.forEach(r => {
    if (!enCursoMap.has(r.file_code))
      enCursoMap.set(r.file_code, { pax: r.cant_pax ?? 0, area: r.booking_branch ?? 'Sin área' })
  })
  const enCursoList = Array.from(enCursoMap.values())
  const totalEnCurso = enCursoList.length
  const paxEnCurso = enCursoList.reduce((s, r) => s + r.pax, 0)

  const enCursoPorArea = new Map<string, { viajes: number; pax: number }>()
  enCursoList.forEach(r => {
    const area = B2C_AREAS.includes(r.area) ? 'B2C' : r.area
    const cur = enCursoPorArea.get(area) ?? { viajes: 0, pax: 0 }
    enCursoPorArea.set(area, { viajes: cur.viajes + 1, pax: cur.pax + r.pax })
  })
  const enCursoAreas = Array.from(enCursoPorArea.entries()).sort((a, b) => b[1].viajes - a[1].viajes)

  // ── Ganancia por área ──────────────────────────────────────────────────
  type AreaRow = { area: string; venta: number; ganancia: number }

  function buildGananciaAreas(raw: any): { sorted: AreaRow[]; totalVenta: number; totalGanancia: number; totalCM: number } {
    const allAreas = (raw ?? []) as AreaRow[]
    const b2c = { venta: 0, ganancia: 0 }
    const otros: AreaRow[] = []
    allAreas.forEach(row => {
      if (B2C_AREAS.includes(row.area)) { b2c.venta += row.venta; b2c.ganancia += row.ganancia }
      else otros.push(row)
    })
    const sorted: AreaRow[] = [
      ...(b2c.venta > 0 || b2c.ganancia !== 0 ? [{ area: 'B2C (Web + Plataformas + Walk In)', ...b2c }] : []),
      ...otros,
    ].sort((a, b) => b.ganancia - a.ganancia)
    const totalVenta = sorted.reduce((s, r) => s + r.venta, 0)
    const totalGanancia = sorted.reduce((s, r) => s + r.ganancia, 0)
    return { sorted, totalVenta, totalGanancia, totalCM: totalVenta > 0 ? totalGanancia / totalVenta : 0 }
  }

  const bruto2526 = buildGananciaAreas(gananciaPorAreaRaw)
  const neto2526 = buildGananciaAreas(gananciaNetaRaw)
  const bruto2627 = buildGananciaAreas(ganancia2627Raw)
  const neto2627 = buildGananciaAreas(gananciaNet2627Raw)

  // AreasPanel stats
  type StatRow = { area: string; venta: number; ganancia: number; viajes: number; pax: number }
  function buildAreaStats(raw: StatRow[] | null, temporada: string): AreaStat[] {
    if (!raw || raw.length === 0) return []
    const b2c = { venta: 0, ganancia: 0, viajes: 0, pax: 0 }
    const otros: AreaStat[] = []
    ;(raw as StatRow[]).forEach(r => {
      if (B2C_AREAS.includes(r.area)) {
        b2c.venta += r.venta; b2c.ganancia += r.ganancia
        b2c.viajes += r.viajes; b2c.pax += r.pax
      } else {
        otros.push({ ...r, temporada })
      }
    })
    const result: AreaStat[] = [
      ...(b2c.venta > 0 ? [{ area: 'B2C (Web + Plataformas + Walk In)', ...b2c, temporada }] : []),
      ...otros,
    ].sort((a, b) => b.ganancia - a.ganancia)
    return result
  }
  const areas2526Stats = buildAreaStats(areaStats2526Raw as StatRow[], '25/26')
  const areas2627Stats = buildAreaStats(areaStats2627Raw as StatRow[], '26/27')

  const uploadDate = format(new Date(lastUpload.created_at), "d 'de' MMMM, HH:mm", { locale: es })

  // ── Helper para renderizar sección de ganancia ─────────────────────────
  function GananciaSection({ data, title, colorBar, colorBarB2C, colorGan, colorLabel, label }: {
    data: { sorted: AreaRow[]; totalVenta: number; totalGanancia: number; totalCM: number }
    title: string; colorBar: string; colorBarB2C: string; colorGan: string; colorLabel: string; label: string
  }) {
    if (data.sorted.length === 0) return null
    return (
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: label === '-IVA' ? 4 : 16 }}>
          <TrendingUp size={14} style={{ color: colorLabel }} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            {title} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({label})</span>
          </h2>
        </div>
        {label === '-IVA' && (
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, marginTop: 2 }}>
            Venta y costo descontados de IVA · IVA venta B2C estimado ~4%
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.sorted.map(row => {
            const maxGan = Math.max(...data.sorted.map(r => r.ganancia), 1)
            const pct = Math.max(0, (row.ganancia / maxGan) * 100)
            const cm = row.venta > 0 ? row.ganancia / row.venta : 0
            const isB2C = row.area.startsWith('B2C')
            const displayName = isB2C ? row.area : displayAreaName(row.area)
            return (
              <div key={row.area}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: isB2C ? colorLabel : 'var(--text)', fontWeight: isB2C ? 600 : 400 }}>{displayName}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>CM {(cm * 100).toFixed(1)}%</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: row.ganancia < 0 ? '#f87171' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(row.ganancia)}</span>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isB2C ? colorBarB2C : colorBar, borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 8, paddingTop: 12, borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {isAdmin ? 'TOTAL EMPRESA' : 'TOTAL'}
            </span>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label === '-IVA' ? 'Venta Neta' : 'Venta'}</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(data.totalVenta)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label === '-IVA' ? 'Ganancia Neta' : 'Ganancia'}</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: colorGan }}>{formatUSD(data.totalGanancia)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>CM</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: colorLabel }}>{(data.totalCM * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Último update: {uploadDate} · {lastUpload.filename}
            {!isAdmin && p_areas && (
              <span style={{ marginLeft: 8, color: 'var(--teal-400)' }}>
                · {userProfile?.areas.join(', ')}
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SyncTourplanButton />
            <ExportLetiButton temp="25/26" />
            <ExportDanielButton />
            <Link href="/subir" className="btn-ghost">
              <Upload size={14} /> Actualizar datos
            </Link>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <Link href="/confirmaciones" style={{ textDecoration: 'none' }}>
          <div className="card card-hover" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Confirmados (7 días)</span>
              <CheckCircle2 size={16} style={{ color: '#4ade80', opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{totalConfirmados}</div>
            <div style={{ fontSize: 12, color: '#4ade80', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{formatUSD(ventaConfirmados)}</div>
          </div>
        </Link>

        <Link href="/temporada" style={{ textDecoration: 'none' }}>
          <div className="card card-hover" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Futuros hasta 30/04</span>
              <Calendar size={16} style={{ color: 'var(--teal-400)', opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{totalFuturos}</div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 12, color: 'var(--teal-400)', fontFamily: 'var(--font-mono)' }}>V: {formatUSD(ventaFutura)}</div>
              <div style={{ fontSize: 12, color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>G: {formatUSD(gananciaFutura)} · CM {(cmFutura * 100).toFixed(1)}%</div>
            </div>
          </div>
        </Link>

        <a href={areaDetalle ? '/dashboard' : '/dashboard?area=all'} style={{ textDecoration: 'none' }}>
          <div className="card card-hover" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>En curso hoy</span>
              <Users size={16} style={{ color: '#60a5fa', opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{totalEnCurso}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{paxEnCurso} pax en ruta · click para desglose</div>
          </div>
        </a>
      </div>

      {/* Desglose en curso */}
      {areaDetalle && enCursoAreas.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>En curso — desglose por área</span>
            <a href="/dashboard" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>✕ cerrar</a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Área', 'Viajes', 'Pax'].map(h => (
                  <th key={h} style={{ padding: '9px 20px', textAlign: h === 'Área' ? 'left' : 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enCursoAreas.map(([area, d], i) => (
                <tr key={area} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '9px 20px', color: 'var(--text)' }}>{displayAreaName(area)}</td>
                  <td style={{ padding: '9px 20px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{d.viajes}</td>
                  <td style={{ padding: '9px 20px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{d.pax}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                <td style={{ padding: '9px 20px', color: 'var(--text)', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '9px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{totalEnCurso}</td>
                <td style={{ padding: '9px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{paxEnCurso}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Ganancia por área — 4 secciones refactorizadas */}
      <GananciaSection data={bruto2526} title="Ganancia por área — temporada 25/26" label="TOTAL"
        colorBar="var(--teal-700)" colorBarB2C="var(--teal-500)" colorGan="#4ade80" colorLabel="var(--teal-400)" />

      <GananciaSection data={neto2526} title="Ganancia por área — temporada 25/26" label="-IVA"
        colorBar="#5b21b6" colorBarB2C="#7c3aed" colorGan="#a78bfa" colorLabel="#a78bfa" />

      <GananciaSection data={bruto2627} title="Ganancia por área — temporada 26/27" label="TOTAL"
        colorBar="var(--teal-700)" colorBarB2C="var(--teal-500)" colorGan="#4ade80" colorLabel="var(--teal-400)" />

      <GananciaSection data={neto2627} title="Ganancia por área — temporada 26/27" label="-IVA"
        colorBar="#5b21b6" colorBarB2C="#7c3aed" colorGan="#a78bfa" colorLabel="#a78bfa" />

      {/* Areas Panel */}
      {areas2526Stats.length > 0 && (
        <AreasPanel areas2526={areas2526Stats} areas2627={areas2627Stats} />
      )}

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { href: '/vendedores',   label: 'Ranking Vendedores', emoji: '🏆' },
          { href: '/clientes',     label: 'Análisis Clientes',  emoji: '👥' },
          { href: '/comparativo',  label: 'Comparativo 24/25',  emoji: '📊' },
          { href: '/contribucion', label: 'Contrib. Marginal',  emoji: '📈' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div className="card card-hover" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{item.emoji}</span>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.label}</span>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
