import { createClient } from '@/lib/supabase/server'
import { Users, Calendar, CheckCircle2, Upload, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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
  const areaDetalle = searchParams.area ?? null
  const today = new Date().toISOString().slice(0, 10)

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
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Subí tu primer Excel para ver el dashboard completo.</p>
        <Link href="/subir" className="btn-primary">Subir Excel ahora</Link>
      </div>
    )
  }

  const uploadId = lastUpload.id
  const since7days = new Date()
  since7days.setDate(since7days.getDate() - 7)

  // CP1: Confirmados QU→OK últimos 7 días
  const { data: confirmados } = await supabase
    .from('v_confirmados_qu_ok')
    .select('venta')
    .eq('upload_id', uploadId)
    .eq('rn', 1)
    .gte('date_of_change', since7days.toISOString())

  const totalConfirmados = confirmados?.length ?? 0
  const ventaConfirmados = confirmados?.reduce((s, r) => s + (r.venta ?? 0), 0) ?? 0

  // Viajes futuros hasta 30/04/2026 — filtrado en Supabase
  const { data: futurosRaw } = await supabase
    .from('team_leader_rows')
    .select('file_code, booking_branch, venta, ganancia, cant_pax, is_b2c')
    .eq('upload_id', uploadId)
    .in('estado', ESTADOS_CONFIRMADOS)
    .gt('fecha_in', today)
    .lte('fecha_in', FIN_TEMPORADA)
    .limit(10000)

  // SF para B2C override
  const { data: sfRows } = await supabase
    .from('salesforce_rows')
    .select('file_code, venta, ganancia')
    .eq('upload_id', uploadId)

  const sfMap = new Map<string, { venta: number; ganancia: number }>()
  sfRows?.forEach(r => sfMap.set(r.file_code.toUpperCase(), { venta: r.venta ?? 0, ganancia: r.ganancia ?? 0 }))

  // Deduplicar por file_code y aplicar B2C override
  const futurosMap = new Map<string, { venta: number; ganancia: number; pax: number }>()
  futurosRaw?.forEach(r => {
    if (futurosMap.has(r.file_code)) return
    const sf = r.is_b2c ? sfMap.get(r.file_code.toUpperCase()) : null
    futurosMap.set(r.file_code, {
      venta: sf ? sf.venta : (r.venta ?? 0),
      ganancia: sf ? sf.ganancia : (r.ganancia ?? 0),
      pax: r.cant_pax ?? 0,
    })
  })
  const futuros = Array.from(futurosMap.values())
  const totalFuturos = futuros.length
  const ventaFutura = futuros.reduce((s, r) => s + r.venta, 0)
  const gananciaFutura = futuros.reduce((s, r) => s + r.ganancia, 0)
  const cmFutura = ventaFutura > 0 ? gananciaFutura / ventaFutura : 0

  // En curso hoy — filtrado en Supabase
  const { data: enCursoRaw } = await supabase
    .from('team_leader_rows')
    .select('file_code, booking_branch, cant_pax')
    .eq('upload_id', uploadId)
    .in('estado', ESTADOS_CONFIRMADOS)
    .lte('fecha_in', today)
    .gt('fecha_out', today)
    .limit(10000)

  const enCursoMap = new Map<string, { pax: number; area: string }>()
  enCursoRaw?.forEach(r => {
    if (!enCursoMap.has(r.file_code)) {
      enCursoMap.set(r.file_code, { pax: r.cant_pax ?? 0, area: r.booking_branch ?? 'Sin área' })
    }
  })
  const enCursoList = Array.from(enCursoMap.values())
  const totalEnCurso = enCursoList.length
  const paxEnCurso = enCursoList.reduce((s, r) => s + r.pax, 0)

  const enCursoPorArea = new Map<string, { viajes: number; pax: number }>()
  enCursoList.forEach(r => {
    const cur = enCursoPorArea.get(r.area) ?? { viajes: 0, pax: 0 }
    enCursoPorArea.set(r.area, { viajes: cur.viajes + 1, pax: cur.pax + r.pax })
  })
  const enCursoAreas = Array.from(enCursoPorArea.entries()).sort((a, b) => b[1].viajes - a[1].viajes)

  // Ganancia por área — temporada 25/26, filtrado en Supabase
  const { data: temp2526 } = await supabase
    .from('team_leader_rows')
    .select('file_code, booking_branch, venta, ganancia, is_b2c')
    .eq('upload_id', uploadId)
    .eq('temporada', '25/26')
    .in('estado', ESTADOS_CONFIRMADOS)
    .limit(10000)

  const areaTotals = new Map<string, { venta: number; ganancia: number }>()
  const seenFiles = new Set<string>()
  temp2526?.forEach(r => {
    if (seenFiles.has(r.file_code)) return
    seenFiles.add(r.file_code)
    const area = r.booking_branch ?? 'Sin área'
    const sf = r.is_b2c ? sfMap.get(r.file_code.toUpperCase()) : null
    const venta = sf ? sf.venta : (r.venta ?? 0)
    const ganancia = sf ? sf.ganancia : (r.ganancia ?? 0)
    const cur = areaTotals.get(area) ?? { venta: 0, ganancia: 0 }
    areaTotals.set(area, { venta: cur.venta + venta, ganancia: cur.ganancia + ganancia })
  })
  const areasSorted = Array.from(areaTotals.entries())
    .sort((a, b) => b[1].ganancia - a[1].ganancia)

  const uploadDate = format(new Date(lastUpload.created_at), "d 'de' MMMM, HH:mm", { locale: es })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Último update: {uploadDate} · {lastUpload.filename}
          </p>
        </div>
        <Link href="/subir" className="btn-ghost">
          <Upload size={14} /> Actualizar datos
        </Link>
      </div>

      {/* KPI row */}
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

      {/* Ganancia por área 25/26 */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={14} style={{ color: 'var(--teal-400)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Ganancia por área — temporada 25/26</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {areasSorted.map(([area, data]) => {
            const maxGan = areasSorted[0]?.[1].ganancia || 1
            const pct = Math.max(0, (data.ganancia / maxGan) * 100)
            const cm = data.venta > 0 ? data.ganancia / data.venta : 0
            return (
              <div key={area}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{area}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>CM {(cm * 100).toFixed(1)}%</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: data.ganancia < 0 ? '#f87171' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(data.ganancia)}</span>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal-600)', borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

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
