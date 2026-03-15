import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas, B2C_AREAS } from '@/lib/user-context'
import { Calendar, CheckCircle2, TrendingUp, Upload, Users } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import ExportLetiButton from '@/components/ExportLetiButton'

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

  // Áreas del usuario comercial (null = todas = admin)
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

  // CP1: Confirmados QU→OK últimos 7 días
  let confirmadosQuery = supabase
    .from('v_confirmados_qu_ok')
    .select('venta, area')
    .eq('upload_id', uploadId)
    .eq('rn', 1)
    .gte('date_of_change', since7days.toISOString())

  const { data: confirmados } = await confirmadosQuery

  const confirmadosFiltrados = p_areas
    ? (confirmados ?? []).filter(r => p_areas.includes(r.area ?? ''))
    : (confirmados ?? [])

  const totalConfirmados = confirmadosFiltrados.length
  const ventaConfirmados = confirmadosFiltrados.reduce((s, r) => s + (r.venta ?? 0), 0)

  // Futuros via RPC
  const { data: futurosKpiRaw } = await supabase
    .rpc('get_futuros_kpi', {
      p_upload_id: uploadId,
      p_today: today,
      p_fin: FIN_TEMPORADA,
      p_areas: p_areas,
    })
    .single()

  const futurosKpi = futurosKpiRaw as { viajes: number; venta: number; ganancia: number } | null
  const totalFuturos = futurosKpi?.viajes ?? 0
  const ventaFutura = futurosKpi?.venta ?? 0
  const gananciaFutura = futurosKpi?.ganancia ?? 0
  const cmFutura = ventaFutura > 0 ? gananciaFutura / ventaFutura : 0

  // En curso hoy
  let enCursoQuery = supabase
    .from('team_leader_rows')
    .select('file_code, booking_branch, cant_pax')
    .eq('upload_id', uploadId)
    .in('estado', ESTADOS_CONFIRMADOS)
    .lte('fecha_in', today)
    .gt('fecha_out', today)
    .limit(10000)

  if (p_areas) enCursoQuery = enCursoQuery.in('booking_branch', p_areas)

  const { data: enCursoRaw } = await enCursoQuery

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

  // Ganancia por área 25/26 via RPC — BRUTO
  const { data: gananciaPorAreaRaw } = await supabase
    .rpc('get_ganancia_por_area', { p_upload_id: uploadId, p_areas: p_areas })

  // Ganancia por área 26/27 via RPC — BRUTO
  const { data: ganancia2627Raw } = await supabase
    .rpc('get_ganancia_por_area', { p_upload_id: uploadId, p_areas: p_areas, p_temporada: '26/27' })

  type AreaRow = { area: string; venta: number; ganancia: number }
  const allAreas = (gananciaPorAreaRaw ?? []) as AreaRow[]

  // Ganancia por área 25/26 via RPC — NETO
  const { data: gananciaNetaRaw } = await supabase
    .rpc('get_ganancia_neta_por_area', { p_upload_id: uploadId, p_areas: p_areas })

  // Ganancia por área 26/27 via RPC — NETO
  const { data: gananciaNet2627Raw } = await supabase
    .rpc('get_ganancia_neta_por_area', { p_upload_id: uploadId, p_areas: p_areas, p_temporada: '26/27' })

  // Agrupar B2C — BRUTO
  const b2c = { venta: 0, ganancia: 0 }
  const otros: AreaRow[] = []
  allAreas.forEach(row => {
    if (B2C_AREAS.includes(row.area)) {
      b2c.venta += row.venta
      b2c.ganancia += row.ganancia
    } else {
      otros.push(row)
    }
  })
  const areasSorted: AreaRow[] = [
    ...(b2c.venta > 0 || b2c.ganancia !== 0 ? [{ area: 'B2C (Web + Plataformas + Walk In)', ...b2c }] : []),
    ...otros,
  ].sort((a, b) => b.ganancia - a.ganancia)

  const totalVenta = areasSorted.reduce((s, r) => s + r.venta, 0)
  const totalGanancia = areasSorted.reduce((s, r) => s + r.ganancia, 0)
  const totalCM = totalVenta > 0 ? totalGanancia / totalVenta : 0

  // Agrupar B2C — NETO
  const allAreasNeta = (gananciaNetaRaw ?? []) as AreaRow[]
  const b2cNeta = { venta: 0, ganancia: 0 }
  const otrosNeta: AreaRow[] = []
  allAreasNeta.forEach(row => {
    if (B2C_AREAS.includes(row.area)) {
      b2cNeta.venta += row.venta
      b2cNeta.ganancia += row.ganancia
    } else {
      otrosNeta.push(row)
    }
  })
  const areasNetaSorted: AreaRow[] = [
    ...(b2cNeta.venta > 0 || b2cNeta.ganancia !== 0 ? [{ area: 'B2C (Web + Plataformas + Walk In)', ...b2cNeta }] : []),
    ...otrosNeta,
  ].sort((a, b) => b.ganancia - a.ganancia)

  const totalVentaNeta = areasNetaSorted.reduce((s, r) => s + r.venta, 0)
  const totalGananciaNeta = areasNetaSorted.reduce((s, r) => s + r.ganancia, 0)
  const totalCMNeta = totalVentaNeta > 0 ? totalGananciaNeta / totalVentaNeta : 0

  // ── 26/27 BRUTO ──────────────────────────────────────────────────────────
  const allAreas2627 = (ganancia2627Raw ?? []) as AreaRow[]
  const b2c2627 = { venta: 0, ganancia: 0 }
  const otros2627: AreaRow[] = []
  allAreas2627.forEach(row => {
    if (B2C_AREAS.includes(row.area)) { b2c2627.venta += row.venta; b2c2627.ganancia += row.ganancia }
    else otros2627.push(row)
  })
  const areasSorted2627: AreaRow[] = [
    ...(b2c2627.venta > 0 || b2c2627.ganancia !== 0 ? [{ area: 'B2C (Web + Plataformas + Walk In)', ...b2c2627 }] : []),
    ...otros2627,
  ].sort((a, b) => b.ganancia - a.ganancia)
  const totalVenta2627 = areasSorted2627.reduce((s, r) => s + r.venta, 0)
  const totalGanancia2627 = areasSorted2627.reduce((s, r) => s + r.ganancia, 0)
  const totalCM2627 = totalVenta2627 > 0 ? totalGanancia2627 / totalVenta2627 : 0

  // ── 26/27 NETO ───────────────────────────────────────────────────────────
  const allAreasNeta2627 = (gananciaNet2627Raw ?? []) as AreaRow[]
  const b2cNeta2627 = { venta: 0, ganancia: 0 }
  const otrosNeta2627: AreaRow[] = []
  allAreasNeta2627.forEach(row => {
    if (B2C_AREAS.includes(row.area)) { b2cNeta2627.venta += row.venta; b2cNeta2627.ganancia += row.ganancia }
    else otrosNeta2627.push(row)
  })
  const areasNetaSorted2627: AreaRow[] = [
    ...(b2cNeta2627.venta > 0 || b2cNeta2627.ganancia !== 0 ? [{ area: 'B2C (Web + Plataformas + Walk In)', ...b2cNeta2627 }] : []),
    ...otrosNeta2627,
  ].sort((a, b) => b.ganancia - a.ganancia)
  const totalVentaNeta2627 = areasNetaSorted2627.reduce((s, r) => s + r.venta, 0)
  const totalGananciaNeta2627 = areasNetaSorted2627.reduce((s, r) => s + r.ganancia, 0)
  const totalCMNeta2627 = totalVentaNeta2627 > 0 ? totalGananciaNeta2627 / totalVentaNeta2627 : 0

  const uploadDate = format(new Date(lastUpload.created_at), "d 'de' MMMM, HH:mm", { locale: es })

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
            <ExportLetiButton temp="25/26" />
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
                  <td style={{ padding: '9px 20px', color: 'var(--text)' }}>{area}</td>
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

      {/* Ganancia por área — BRUTO */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={14} style={{ color: 'var(--teal-400)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Ganancia por área — temporada 25/26 <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(BRUTO)</span></h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {areasSorted.map(row => {
            const maxGan = Math.max(...areasSorted.map(r => r.ganancia), 1)
            const pct = Math.max(0, (row.ganancia / maxGan) * 100)
            const cm = row.venta > 0 ? row.ganancia / row.venta : 0
            const isB2C = row.area.startsWith('B2C')
            return (
              <div key={row.area}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: isB2C ? 'var(--teal-400)' : 'var(--text)', fontWeight: isB2C ? 600 : 400 }}>{row.area}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>CM {(cm * 100).toFixed(1)}%</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: row.ganancia < 0 ? '#f87171' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(row.ganancia)}</span>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isB2C ? 'var(--teal-500)' : 'var(--teal-700)', borderRadius: 2 }} />
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
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Venta</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(totalVenta)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Ganancia</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4ade80' }}>{formatUSD(totalGanancia)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>CM</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--teal-400)' }}>{(totalCM * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ganancia por área — NETO */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TrendingUp size={14} style={{ color: '#a78bfa' }} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Ganancia por área — temporada 25/26 <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(NETO)</span></h2>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, marginTop: 2 }}>
          Venta y costo descontados de IVA · IVA venta B2C estimado ~4%
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {areasNetaSorted.map(row => {
            const maxGan = Math.max(...areasNetaSorted.map(r => r.ganancia), 1)
            const pct = Math.max(0, (row.ganancia / maxGan) * 100)
            const cm = row.venta > 0 ? row.ganancia / row.venta : 0
            const isB2C = row.area.startsWith('B2C')
            return (
              <div key={row.area}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: isB2C ? '#a78bfa' : 'var(--text)', fontWeight: isB2C ? 600 : 400 }}>{row.area}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>CM {(cm * 100).toFixed(1)}%</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: row.ganancia < 0 ? '#f87171' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(row.ganancia)}</span>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: isB2C ? '#7c3aed' : '#5b21b6', borderRadius: 2 }} />
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
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Venta Neta</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(totalVentaNeta)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Ganancia Neta</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a78bfa' }}>{formatUSD(totalGananciaNeta)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>CM</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a78bfa' }}>{(totalCMNeta * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ganancia por área 26/27 — BRUTO */}
      {areasSorted2627.length > 0 && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={14} style={{ color: 'var(--teal-400)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Ganancia por área — temporada 26/27 <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(BRUTO)</span>
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {areasSorted2627.map(row => {
              const maxGan = Math.max(...areasSorted2627.map(r => r.ganancia), 1)
              const pct = Math.max(0, (row.ganancia / maxGan) * 100)
              const cm = row.venta > 0 ? row.ganancia / row.venta : 0
              const isB2C = row.area.startsWith('B2C')
              return (
                <div key={row.area}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: isB2C ? 'var(--teal-400)' : 'var(--text)', fontWeight: isB2C ? 600 : 400 }}>{row.area}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>CM {(cm * 100).toFixed(1)}%</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: row.ganancia < 0 ? '#f87171' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(row.ganancia)}</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isB2C ? 'var(--teal-500)' : 'var(--teal-700)', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{isAdmin ? 'TOTAL EMPRESA' : 'TOTAL'}</span>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Venta</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(totalVenta2627)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Ganancia</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4ade80' }}>{formatUSD(totalGanancia2627)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>CM</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--teal-400)' }}>{(totalCM2627 * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ganancia por área 26/27 — NETO */}
      {areasNetaSorted2627.length > 0 && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <TrendingUp size={14} style={{ color: '#a78bfa' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Ganancia por área — temporada 26/27 <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(NETO)</span>
            </h2>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, marginTop: 2 }}>
            Venta y costo descontados de IVA · IVA venta B2C estimado ~4%
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {areasNetaSorted2627.map(row => {
              const maxGan = Math.max(...areasNetaSorted2627.map(r => r.ganancia), 1)
              const pct = Math.max(0, (row.ganancia / maxGan) * 100)
              const cm = row.venta > 0 ? row.ganancia / row.venta : 0
              const isB2C = row.area.startsWith('B2C')
              return (
                <div key={row.area}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: isB2C ? '#a78bfa' : 'var(--text)', fontWeight: isB2C ? 600 : 400 }}>{row.area}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>CM {(cm * 100).toFixed(1)}%</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: row.ganancia < 0 ? '#f87171' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(row.ganancia)}</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isB2C ? '#7c3aed' : '#5b21b6', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{isAdmin ? 'TOTAL EMPRESA' : 'TOTAL'}</span>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Venta Neta</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(totalVentaNeta2627)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Ganancia Neta</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a78bfa' }}>{formatUSD(totalGananciaNeta2627)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>CM</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a78bfa' }}>{(totalCMNeta2627 * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
