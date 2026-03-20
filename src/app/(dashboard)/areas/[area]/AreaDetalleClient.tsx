'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BarChart3, TrendingUp, Users, Briefcase, Globe, Building2, X } from 'lucide-react'

type Row = {
  file_code: string
  booking_name: string | null
  fecha_in: string | null
  fecha_out: string | null
  estado: string | null
  vendedor: string | null
  operador: string | null
  cliente: string | null
  booking_department: string | null
  cant_pax: number | null
  cant_dias: number | null
  venta: number
  costo: number
  ganancia: number
  booking_branch: string | null
  is_b2c: boolean
}

type DrillFilter = { tipo: string; valor: string }

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function mesLabel(d: string | null) {
  if (!d) return 'Sin fecha'
  const dt = new Date(d)
  return `${MESES_ES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}
function mesKey(d: string | null) {
  if (!d) return '9999-99'
  return d.slice(0, 7)
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const TEMPORADAS = ['25/26','26/27','24/25']
type Tab = 'resumen' | 'mes' | 'vendedores' | 'operadores' | 'clientes' | 'departamentos'

// ── Modal de detalle de files ────────────────────────────────────────────────
function FilesModal({ titulo, rows, onClose }: {
  titulo: string
  rows: Row[]
  onClose: () => void
}) {
  const totalVenta = rows.reduce((s, r) => s + r.venta, 0)
  const totalCosto = rows.reduce((s, r) => s + r.costo, 0)
  const totalGan   = rows.reduce((s, r) => s + r.ganancia, 0)
  const totalCM    = totalVenta > 0 ? totalGan / totalVenta : 0
  const cmColor = (cm: number) => cm >= 0.25 ? '#4ade80' : cm >= 0.18 ? '#fb923c' : '#f87171'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', flex: 1, display: 'flex', flexDirection: 'column',
          marginTop: 48, borderRadius: '16px 16px 0 0',
          border: '1px solid var(--border)', borderBottom: 'none',
          maxHeight: 'calc(100vh - 48px)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onClose} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)',
              cursor: 'pointer', color: 'var(--text)', fontSize: 13, fontWeight: 500,
            }}>
              <ArrowLeft size={13} /> Atrás
            </button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{rows.length} files</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabla */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: 'var(--surface2)' }}>
                {['File','Fecha IN','Fecha OUT','Estado','Cliente','Depto','Vendedor','Pax','Costo','Venta','Ganancia','CM%'].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', whiteSpace: 'nowrap',
                    textAlign: ['Pax','Costo','Venta','Ganancia','CM%'].includes(h) ? 'right' : 'left',
                    color: 'var(--muted)', fontWeight: 500, fontSize: 11,
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const cm = r.venta > 0 ? r.ganancia / r.venta : 0
                return (
                  <tr key={r.file_code} style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal-400)', fontSize: 11, fontWeight: 600 }}>
                          {r.file_code}
                        </div>
                        {r.booking_name && (
                          <div style={{ fontSize: 10, color: 'var(--muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.booking_name}>
                            {r.booking_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.fecha_in)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.fecha_out)}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)' }}>{r.estado}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente ?? '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.booking_department ?? '—'}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{r.vendedor ?? '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{r.cant_pax ?? '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{formatUSD(r.costo)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(r.venta)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.ganancia < 0 ? '#f87171' : '#4ade80', fontWeight: 500 }}>{formatUSD(r.ganancia)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: cmColor(cm) }}>{(cm * 100).toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0 }}>
              <tr style={{ background: 'var(--surface2)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={8} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)', fontSize: 12 }}>TOTAL — {rows.length} files</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{formatUSD(totalCosto)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{formatUSD(totalVenta)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4ade80' }}>{formatUSD(totalGan)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: cmColor(totalCM) }}>{(totalCM * 100).toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AreaDetalleClient({
  area, temp, rows, filename, isAdmin,
}: {
  area: string; temp: string; rows: Row[]; filename: string; isAdmin: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('resumen')
  const [drill, setDrill] = useState<DrillFilter | null>(null)

  const cmColor = (cm: number) => cm >= 0.25 ? '#4ade80' : cm >= 0.18 ? '#fb923c' : '#f87171'

  // Files para el modal según el filtro activo
  const drillRows = useMemo(() => {
    if (!drill) return []
    return rows.filter(r => {
      if (drill.tipo === 'mes')           return mesKey(r.fecha_in) === drill.valor
      if (drill.tipo === 'vendedor')      return (r.vendedor || 'Sin asignar') === drill.valor
      if (drill.tipo === 'operador')      return (r.operador && r.operador !== 'Unassigned' ? r.operador : 'Sin asignar') === drill.valor
      if (drill.tipo === 'cliente')       return (r.cliente || 'Sin cliente') === drill.valor
      if (drill.tipo === 'departamento')  return (r.booking_department || 'Sin departamento') === drill.valor
      return false
    })
  }, [drill, rows])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const viajes   = new Set(rows.map(r => r.file_code)).size
    const pax      = rows.reduce((s, r) => s + (r.cant_pax ?? 0), 0)
    const dias     = rows.reduce((s, r) => s + (r.cant_dias ?? 0), 0)
    const venta    = rows.reduce((s, r) => s + r.venta, 0)
    const costo    = rows.reduce((s, r) => s + r.costo, 0)
    const ganancia = rows.reduce((s, r) => s + r.ganancia, 0)
    const cm       = venta > 0 ? ganancia / venta : 0
    return { viajes, pax, dias, venta, costo, ganancia, cm }
  }, [rows])

  // ── Agrupaciones ─────────────────────────────────────────────────────────
  const porMes = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = mesKey(r.fecha_in)
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!
      m.viajes.add(r.file_code); m.pax += r.cant_pax ?? 0; m.venta += r.venta; m.ganancia += r.ganancia
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ key: k, label: mesLabel(k + '-01'), viajes: v.viajes.size, pax: v.pax, venta: v.venta, ganancia: v.ganancia, cm: v.venta > 0 ? v.ganancia / v.venta : 0 }))
  }, [rows])

  const porEstado = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; venta: number; costo: number; ganancia: number }>()
    rows.forEach(r => {
      const k = r.estado || 'Sin estado'
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, venta: 0, costo: 0, ganancia: 0 })
      const m = map.get(k)!
      m.viajes.add(r.file_code)
      m.pax += r.cant_pax ?? 0
      m.venta += r.venta
      m.costo += r.costo
      m.ganancia += r.ganancia
    })
    return Array.from(map.entries())
      .map(([nombre, v]) => ({ 
        nombre, 
        viajes: v.viajes.size, 
        pax: v.pax, 
        venta: v.venta, 
        costo: v.costo,
        ganancia: v.ganancia, 
        cm: v.venta > 0 ? v.ganancia / v.venta : 0 
      }))
      .sort((a, b) => b.venta - a.venta)
  }, [rows])

  const porVendedor = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = r.vendedor || 'Sin asignar'
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!; m.viajes.add(r.file_code); m.pax += r.cant_pax ?? 0; m.venta += r.venta; m.ganancia += r.ganancia
    })
    return Array.from(map.entries()).map(([nombre, v]) => ({ nombre, viajes: v.viajes.size, pax: v.pax, venta: v.venta, ganancia: v.ganancia, cm: v.venta > 0 ? v.ganancia / v.venta : 0 })).sort((a, b) => b.venta - a.venta)
  }, [rows])

  const porOperador = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; dias: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = r.operador && r.operador !== 'Unassigned' ? r.operador : 'Sin asignar'
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, dias: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!; m.viajes.add(r.file_code); m.pax += r.cant_pax ?? 0; m.dias += r.cant_dias ?? 0; m.venta += r.venta; m.ganancia += r.ganancia
    })
    return Array.from(map.entries()).map(([nombre, v]) => ({ nombre, viajes: v.viajes.size, pax: v.pax, dias: v.dias, venta: v.venta, ganancia: v.ganancia, cm: v.venta > 0 ? v.ganancia / v.venta : 0 })).sort((a, b) => b.viajes - a.viajes)
  }, [rows])

  const porCliente = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = r.cliente || 'Sin cliente'
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!; m.viajes.add(r.file_code); m.pax += r.cant_pax ?? 0; m.venta += r.venta; m.ganancia += r.ganancia
    })
    return Array.from(map.entries()).map(([nombre, v]) => ({ nombre, viajes: v.viajes.size, pax: v.pax, venta: v.venta, ganancia: v.ganancia, cm: v.venta > 0 ? v.ganancia / v.venta : 0 })).sort((a, b) => b.venta - a.venta)
  }, [rows])

  const porDepto = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = r.booking_department || 'Sin departamento'
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!; m.viajes.add(r.file_code); m.pax += r.cant_pax ?? 0; m.venta += r.venta; m.ganancia += r.ganancia
    })
    return Array.from(map.entries()).map(([nombre, v]) => ({ nombre, viajes: v.viajes.size, pax: v.pax, venta: v.venta, ganancia: v.ganancia, cm: v.venta > 0 ? v.ganancia / v.venta : 0 })).sort((a, b) => b.venta - a.venta)
  }, [rows])

  const maxMesVenta = Math.max(...porMes.map(m => m.venta), 1)

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'resumen',       label: 'Resumen',       icon: <BarChart3 size={13} /> },
    { id: 'mes',           label: 'Por mes',        icon: <TrendingUp size={13} /> },
    { id: 'vendedores',    label: 'Vendedores',     icon: <Users size={13} /> },
    { id: 'operadores',    label: 'Operadores',     icon: <Briefcase size={13} /> },
    { id: 'clientes',      label: 'Clientes',       icon: <Globe size={13} /> },
    { id: 'departamentos', label: 'Departamentos',  icon: <Building2 size={13} /> },
  ]

  // Función para fila clickeable
  function ClickRow({ children, tipo, valor, style }: { children: React.ReactNode; tipo: string; valor: string; style?: React.CSSProperties }) {
    return (
      <tr
        onClick={() => setDrill({ tipo, valor })}
        style={{ cursor: 'pointer', transition: 'background 0.1s', ...style }}
        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(20,184,166,0.06)'}
        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = style?.background?.toString() ?? 'transparent'}
      >
        {children}
      </tr>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Modal */}
      {drill && (
        <FilesModal
          titulo={`${drill.tipo.charAt(0).toUpperCase() + drill.tipo.slice(1)}: ${drill.valor}`}
          rows={drillRows}
          onClose={() => setDrill(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '6px 10px', cursor: 'pointer', color: 'var(--muted)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
          }}>
            <ArrowLeft size={13} /> Volver
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{area}</h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>Temporada {temp} · {filename}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TEMPORADAS.map(t => (
            <a key={t} href={`/areas/${encodeURIComponent(area)}?temp=${t}`} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
              background: temp === t ? 'var(--teal-600)' : 'var(--surface2)',
              color: temp === t ? '#fff' : 'var(--muted)',
              border: `1px solid ${temp === t ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{t}</a>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[
          { label: 'Viajes', val: kpis.viajes.toLocaleString() },
          { label: 'Pax', val: kpis.pax.toLocaleString() },
          { label: 'Días operados', val: kpis.dias.toLocaleString() },
          { label: 'Venta', val: formatUSD(kpis.venta) },
          { label: 'Ganancia', val: formatUSD(kpis.ganancia), color: '#4ade80' },
          { label: 'CM %', val: (kpis.cm * 100).toFixed(1) + '%', color: cmColor(kpis.cm) },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color ?? 'var(--text)', fontFamily: 'var(--font-mono)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
            borderRadius: '8px 8px 0 0', background: tab === t.id ? 'var(--surface2)' : 'transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--muted)',
            borderBottom: tab === t.id ? '2px solid var(--teal-500)' : '2px solid transparent',
          }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Primera fila: Stats + Top Vendedores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Resumen temporada</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {[
                    { label: 'Total viajes', val: kpis.viajes.toLocaleString() },
                    { label: 'Total pax', val: kpis.pax.toLocaleString() },
                    { label: 'Días operados', val: kpis.dias.toLocaleString() },
                    { label: 'Venta total', val: formatUSD(kpis.venta), bold: true },
                    { label: 'Costo total', val: formatUSD(kpis.costo) },
                    { label: 'Ganancia', val: formatUSD(kpis.ganancia), bold: true, color: '#4ade80' },
                    { label: 'CM %', val: (kpis.cm * 100).toFixed(2) + '%', bold: true, color: cmColor(kpis.cm) },
                  ].map(row => (
                    <tr key={row.label} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 0', color: 'var(--muted)' }}>{row.label}</td>
                      <td style={{ padding: '9px 0', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: row.bold ? 700 : 400, color: row.color ?? 'var(--text)' }}>{row.val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Top vendedores</h3>
              {porVendedor.slice(0, 6).map((v, i) => (
                <div key={v.nombre}
                  onClick={() => setDrill({ tipo: 'vendedor', valor: v.nombre })}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(20,184,166,0.05)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', width: 16 }}>{i+1}</span>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{v.nombre}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{v.viajes} viajes</span>
                    <span style={{ fontSize: 13, color: 'var(--teal-400)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatUSD(v.venta)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Segunda fila: Resumen por Estado */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Resumen por estado</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Estado','Viajes','Pax','Costo','Venta','Ganancia','CM %'].map(h => (
                      <th key={h} style={{ 
                        padding: '10px 16px', 
                        textAlign: h === 'Estado' ? 'left' : 'right', 
                        color: 'var(--muted)', 
                        fontWeight: 500, 
                        fontSize: 12,
                        whiteSpace: 'nowrap'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porEstado.map((e, i) => (
                    <tr key={e.nombre} style={{ 
                      borderTop: '1px solid var(--border)', 
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' 
                    }}>
                      <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)', marginRight: 8 }}>
                          {e.nombre}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{e.viajes}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{e.pax.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{formatUSD(e.costo)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(e.venta)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#4ade80', fontWeight: 500 }}>{formatUSD(e.ganancia)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: cmColor(e.cm), fontWeight: 600 }}>{(e.cm * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface2)', borderTop: '2px solid var(--teal-600)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--teal-400)', fontSize: 11 }}>TOTAL</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{kpis.viajes}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{kpis.pax.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{formatUSD(kpis.costo)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{formatUSD(kpis.venta)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4ade80' }}>{formatUSD(kpis.ganancia)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: cmColor(kpis.cm) }}>{(kpis.cm * 100).toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── POR MES ── */}
      {tab === 'mes' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Evolución mensual</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>· click en una fila para ver los files</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['Mes','Viajes','Pax','Venta','Ganancia','CM %',''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: ['Mes'].includes(h) ? 'left' : 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porMes.map((m, i) => (
                  <ClickRow key={m.key} tipo="mes" valor={m.key} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>{m.label}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{m.viajes}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{m.pax}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatUSD(m.venta)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#4ade80' }}>{formatUSD(m.ganancia)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: cmColor(m.cm), fontWeight: 600 }}>{(m.cm * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 16px', width: 120 }}>
                      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${(m.venta / maxMesVenta) * 100}%`, background: 'var(--teal-600)', borderRadius: 2 }} />
                      </div>
                    </td>
                  </ClickRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VENDEDORES ── */}
      {tab === 'vendedores' && (
        <TablaClickeable
          titulo="Facturación por vendedor"
          hint="click en un vendedor para ver sus files"
          cols={['Vendedor','Viajes','Pax','Venta','Ganancia','CM %']}
          rows={porVendedor.map((v, i) => ({
            tipo: 'vendedor', valor: v.nombre,
            cells: [
              <span key="n"><span style={{ color: 'var(--muted)', fontSize: 11, marginRight: 8 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}</span>{v.nombre}</span>,
              v.viajes, v.pax, formatUSD(v.venta), formatUSD(v.ganancia),
              <span key="cm" style={{ color: cmColor(v.cm), fontWeight: 600 }}>{(v.cm*100).toFixed(1)}%</span>,
            ]
          }))}
          totals={['TOTAL', kpis.viajes, kpis.pax, formatUSD(kpis.venta), formatUSD(kpis.ganancia), (kpis.cm*100).toFixed(1)+'%']}
          onDrill={setDrill}
        />
      )}

      {/* ── OPERADORES ── */}
      {tab === 'operadores' && (
        <TablaClickeable
          titulo="Viajes por operador"
          hint="click en un operador para ver sus files"
          cols={['Operador','Viajes','Pax','Días','Venta','Ganancia','CM %']}
          rows={porOperador.map((o, i) => ({
            tipo: 'operador', valor: o.nombre,
            cells: [
              <span key="n"><span style={{ color: 'var(--muted)', fontSize: 11, marginRight: 8 }}>{i+1}</span>{o.nombre}</span>,
              o.viajes, o.pax, o.dias, formatUSD(o.venta), formatUSD(o.ganancia),
              <span key="cm" style={{ color: cmColor(o.cm), fontWeight: 600 }}>{(o.cm*100).toFixed(1)}%</span>,
            ]
          }))}
          onDrill={setDrill}
        />
      )}

      {/* ── CLIENTES ── */}
      {tab === 'clientes' && (
        <TablaClickeable
          titulo="Reporte por cliente"
          hint="click en un cliente para ver sus files"
          cols={['Cliente','Viajes','Pax','Venta','Ganancia','CM %']}
          rows={porCliente.map((c, i) => ({
            tipo: 'cliente', valor: c.nombre,
            cells: [
              <span key="n"><span style={{ color: 'var(--muted)', fontSize: 11, marginRight: 8 }}>{i+1}</span>{c.nombre}</span>,
              c.viajes, c.pax, formatUSD(c.venta), formatUSD(c.ganancia),
              <span key="cm" style={{ color: cmColor(c.cm), fontWeight: 600 }}>{(c.cm*100).toFixed(1)}%</span>,
            ]
          }))}
          totals={['TOTAL', kpis.viajes, kpis.pax, formatUSD(kpis.venta), formatUSD(kpis.ganancia), (kpis.cm*100).toFixed(1)+'%']}
          onDrill={setDrill}
        />
      )}

      {/* ── DEPARTAMENTOS ── */}
      {tab === 'departamentos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {porDepto.map(d => (
            <div key={d.nombre}
              onClick={() => setDrill({ tipo: 'departamento', valor: d.nombre })}
              className="card"
              style={{ padding: '16px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--teal-600)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{d.nombre}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{d.viajes} viajes · {d.pax} pax</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { label: 'Venta', val: formatUSD(d.venta) },
                  { label: 'Ganancia', val: formatUSD(d.ganancia), color: '#4ade80' },
                  { label: 'CM', val: (d.cm*100).toFixed(1)+'%', color: cmColor(d.cm) },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: item.color ?? 'var(--text)', fontFamily: 'var(--font-mono)' }}>{item.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, height: 3, background: 'var(--surface2)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${Math.min(d.cm * 200, 100)}%`, background: cmColor(d.cm), borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TablaClickeable ───────────────────────────────────────────────────────────
function TablaClickeable({ titulo, hint, cols, rows, totals, onDrill }: {
  titulo: string
  hint?: string
  cols: string[]
  rows: { tipo: string; valor: string; cells: React.ReactNode[] }[]
  totals?: React.ReactNode[]
  onDrill: (f: DrillFilter) => void
}) {
  const alignRight = (h: string) => !['Vendedor','Operador','Cliente','Departamento'].includes(h)
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{titulo}</span>
        {hint && <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {hint}</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {cols.map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: alignRight(h) ? 'right' : 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}
                onClick={() => onDrill({ tipo: row.tipo, valor: row.valor })}
                style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(20,184,166,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
              >
                {row.cells.map((cell, j) => (
                  <td key={j} style={{ padding: '10px 16px', textAlign: alignRight(cols[j]) ? 'right' : 'left', color: 'var(--text)', fontFamily: j > 0 ? 'var(--font-mono)' : undefined }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                {totals.map((cell, j) => (
                  <td key={j} style={{ padding: '10px 16px', textAlign: alignRight(cols[j]) ? 'right' : 'left', fontWeight: 700, color: 'var(--text)', fontFamily: j > 0 ? 'var(--font-mono)' : undefined }}>{cell}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
