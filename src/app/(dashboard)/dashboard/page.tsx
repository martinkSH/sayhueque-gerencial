import { createClient } from '@/lib/supabase/server'
import { TrendingUp, TrendingDown, Users, DollarSign, Calendar, CheckCircle2, AlertTriangle, Upload } from 'lucide-react'
import Link from 'next/link'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function PctBadge({ pct }: { pct: number }) {
  const positive = pct >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 12, fontWeight: 500,
      color: positive ? '#4ade80' : '#f87171',
    }}>
      <Icon size={12} />
      {positive ? '+' : ''}{(pct * 100).toFixed(1)}%
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()

  // Último upload
  const { data: lastUpload } = await supabase
    .from('uploads')
    .select('id, filename, created_at, row_count, status')
    .eq('status', 'ok')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastUpload) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
        <Upload size={48} style={{ color: 'var(--muted)', marginBottom: 16 }} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
          Sin datos todavía
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
          Subí tu primer Excel para ver el dashboard completo.
        </p>
        <Link href="/subir" className="btn-primary">Subir Excel ahora</Link>
      </div>
    )
  }

  const uploadId = lastUpload.id
  const since7days = subDays(new Date(), 7).toISOString()

  // CP1: Confirmados QU→OK últimos 7 días
  const { data: confirmados } = await supabase
    .from('v_confirmados_qu_ok')
    .select('area, venta, rn')
    .eq('upload_id', uploadId)
    .eq('rn', 1)
    .gte('date_of_change', since7days)

  const totalConfirmados = confirmados?.length ?? 0
  const ventaConfirmados = confirmados?.reduce((s, r) => s + (r.venta ?? 0), 0) ?? 0

  // CP2: Foto temporada — futuros
  const today = new Date().toISOString().slice(0, 10)
  const { data: futuros } = await supabase
    .from('v_foto_temporada')
    .select('file_code, venta_final, ganancia_final, cant_pax')
    .eq('upload_id', uploadId)
    .gt('fecha_in', today)

  const uniqueFuturos = new Map<string, { venta: number; ganancia: number; pax: number }>()
  futuros?.forEach(r => {
    if (!uniqueFuturos.has(r.file_code)) {
      uniqueFuturos.set(r.file_code, { venta: r.venta_final ?? 0, ganancia: r.ganancia_final ?? 0, pax: r.cant_pax ?? 0 })
    }
  })
  const totalFuturos = uniqueFuturos.size
  const ventaFutura = Array.from(uniqueFuturos.values()).reduce((s, r) => s + r.venta, 0)
  const gananciaFutura = Array.from(uniqueFuturos.values()).reduce((s, r) => s + r.ganancia, 0)

  // CP2: En curso hoy
  const { data: enCurso } = await supabase
    .from('v_foto_temporada')
    .select('file_code, cant_pax')
    .eq('upload_id', uploadId)
    .lte('fecha_in', today)
    .gt('fecha_out', today)

  const uniqueEnCurso = new Set(enCurso?.map(r => r.file_code) ?? [])
  const paxEnCurso = enCurso?.reduce((s, r) => s + (r.cant_pax ?? 0), 0) ?? 0

  // Web vs SF: cuántos para revisar
  const { data: webRevisar } = await supabase
    .from('v_web_vs_sf')
    .select('file_tl', { count: 'exact', head: true })
    .eq('upload_id', uploadId)
    .eq('cruce_ok', 'REVISAR')

  const paraRevisar = webRevisar?.length ?? 0

  // Temporada: por área
  const { data: porArea } = await supabase
    .from('v_foto_temporada')
    .select('area, venta_final, ganancia_final')
    .eq('upload_id', uploadId)

  const areaMap = new Map<string, { venta: number; ganancia: number }>()
  porArea?.forEach(r => {
    const a = r.area ?? '(sin área)'
    const cur = areaMap.get(a) ?? { venta: 0, ganancia: 0 }
    areaMap.set(a, { venta: cur.venta + (r.venta_final ?? 0), ganancia: cur.ganancia + (r.ganancia_final ?? 0) })
  })
  const areasSorted = Array.from(areaMap.entries())
    .sort((a, b) => b[1].ganancia - a[1].ganancia)
    .slice(0, 6)

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

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          {
            label: 'Confirmados (7 días)',
            value: totalConfirmados,
            sub: formatUSD(ventaConfirmados),
            icon: CheckCircle2,
            color: '#4ade80',
            href: '/confirmaciones',
          },
          {
            label: 'Viajes futuros',
            value: totalFuturos,
            sub: formatUSD(ventaFutura),
            icon: Calendar,
            color: 'var(--teal-400)',
            href: '/temporada',
          },
          {
            label: 'En curso hoy',
            value: uniqueEnCurso.size,
            sub: `${paxEnCurso} pax en ruta`,
            icon: Users,
            color: '#60a5fa',
            href: '/temporada',
          },
          {
            label: 'Ganancia futura',
            value: formatUSD(gananciaFutura),
            sub: ventaFutura > 0 ? `CM ${(gananciaFutura / ventaFutura * 100).toFixed(1)}%` : '—',
            icon: DollarSign,
            color: '#a78bfa',
            href: '/comparativo',
          },
          {
            label: 'Web vs SF · Revisar',
            value: paraRevisar,
            sub: 'archivos con diferencias',
            icon: AlertTriangle,
            color: paraRevisar > 0 ? '#fb923c' : '#4ade80',
            href: '/web-vs-sf',
          },
        ].map(card => {
          const Icon = card.icon
          return (
            <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
              <div className="card card-hover" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{card.label}</span>
                  <Icon size={16} style={{ color: card.color, opacity: 0.8 }} />
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{card.sub}</div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Ganancia por área */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>
          Ganancia por área — temporada completa
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {areasSorted.map(([area, data]) => {
            const maxGan = areasSorted[0]?.[1].ganancia || 1
            const pct = (data.ganancia / maxGan) * 100
            const cm = data.venta > 0 ? data.ganancia / data.venta : 0
            return (
              <div key={area}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{area}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                      CM {(cm * 100).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                      {formatUSD(data.ganancia)}
                    </span>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: 'var(--teal-600)', borderRadius: 2,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { href: '/vendedores',     label: 'Ranking Vendedores',   emoji: '🏆' },
          { href: '/clientes',       label: 'Análisis Clientes',    emoji: '👥' },
          { href: '/comparativo',    label: 'Comparativo 24/25',    emoji: '📊' },
          { href: '/contribucion',   label: 'Contrib. Marginal',    emoji: '📈' },
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
