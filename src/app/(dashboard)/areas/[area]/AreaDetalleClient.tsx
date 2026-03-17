'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BarChart3, TrendingUp, Users, Briefcase, Globe, Building2 } from 'lucide-react'

type Row = {
  file_code: string
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

const TEMPORADAS = ['25/26','26/27','24/25']

type Tab = 'resumen' | 'mes' | 'vendedores' | 'operadores' | 'clientes' | 'departamentos'

export default function AreaDetalleClient({
  area, temp, rows, filename, isAdmin,
}: {
  area: string
  temp: string
  rows: Row[]
  filename: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('resumen')

  // ── KPIs ────────────────────────────────────────────────────────────────
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

  // ── Por mes ──────────────────────────────────────────────────────────────
  const porMes = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = mesKey(r.fecha_in)
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!
      m.viajes.add(r.file_code)
      m.pax += r.cant_pax ?? 0
      m.venta += r.venta
      m.ganancia += r.ganancia
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({
        key: k, label: mesLabel(k.length === 7 ? k + '-01' : null),
        viajes: v.viajes.size, pax: v.pax, venta: v.venta, ganancia: v.ganancia,
        cm: v.venta > 0 ? v.ganancia / v.venta : 0,
      }))
  }, [rows])

  // ── Por vendedor ─────────────────────────────────────────────────────────
  const porVendedor = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = r.vendedor || 'Sin asignar'
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!
      m.viajes.add(r.file_code); m.pax += r.cant_pax ?? 0
      m.venta += r.venta; m.ganancia += r.ganancia
    })
    return Array.from(map.entries())
      .map(([nombre, v]) => ({ nombre, viajes: v.viajes.size, pax: v.pax, venta: v.venta, ganancia: v.ganancia, cm: v.venta > 0 ? v.ganancia / v.venta : 0 }))
      .sort((a, b) => b.venta - a.venta)
  }, [rows])

  // ── Por operador ─────────────────────────────────────────────────────────
  const porOperador = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; dias: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = r.operador && r.operador !== 'Unassigned' ? r.operador : 'Sin asignar'
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, dias: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!
      m.viajes.add(r.file_code); m.pax += r.cant_pax ?? 0
      m.dias += r.cant_dias ?? 0; m.venta += r.venta; m.ganancia += r.ganancia
    })
    return Array.from(map.entries())
      .map(([nombre, v]) => ({ nombre, viajes: v.viajes.size, pax: v.pax, dias: v.dias, venta: v.venta, ganancia: v.ganancia, cm: v.venta > 0 ? v.ganancia / v.venta : 0 }))
      .sort((a, b) => b.viajes - a.viajes)
  }, [rows])

  // ── Por cliente ──────────────────────────────────────────────────────────
  const porCliente = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = r.cliente || 'Sin cliente'
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!
      m.viajes.add(r.file_code); m.pax += r.cant_pax ?? 0
      m.venta += r.venta; m.ganancia += r.ganancia
    })
    return Array.from(map.entries())
      .map(([nombre, v]) => ({ nombre, viajes: v.viajes.size, pax: v.pax, venta: v.venta, ganancia: v.ganancia, cm: v.venta > 0 ? v.ganancia / v.venta : 0 }))
      .sort((a, b) => b.venta - a.venta)
  }, [rows])

  // ── Por departamento ─────────────────────────────────────────────────────
  const porDepto = useMemo(() => {
    const map = new Map<string, { viajes: Set<string>; pax: number; venta: number; ganancia: number }>()
    rows.forEach(r => {
      const k = r.booking_department || 'Sin departamento'
      if (!map.has(k)) map.set(k, { viajes: new Set(), pax: 0, venta: 0, ganancia: 0 })
      const m = map.get(k)!
      m.viajes.add(r.file_code); m.pax += r.cant_pax ?? 0
      m.venta += r.venta; m.ganancia += r.ganancia
    })
    return Array.from(map.entries())
      .map(([nombre, v]) => ({ nombre, viajes: v.viajes.size, pax: v.pax, venta: v.venta, ganancia: v.ganancia, cm: v.venta > 0 ? v.ganancia / v.venta : 0 }))
      .sort((a, b) => b.venta - a.venta)
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

  const cmColor = (cm: number) => cm >= 0.25 ? '#4ade80' : cm >= 0.18 ? '#fb923c' : '#f87171'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--muted)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
          }}>
            <ArrowLeft size={13} /> Volver
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{area}</h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
              Temporada {temp} · {filename}
            </p>
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
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '8px 14px', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', border: 'none', borderRadius: '8px 8px 0 0',
            background: tab === t.id ? 'var(--surface2)' : 'transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--muted)',
            borderBottom: tab === t.id ? '2px solid var(--teal-500)' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
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
              <div key={v.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
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
      )}

      {/* ── POR MES ── */}
      {tab === 'mes' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Evolución mensual</span>
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
                  <tr key={m.key} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VENDEDORES ── */}
      {tab === 'vendedores' && (
        <TablaGenerica
          titulo="Facturación por vendedor"
          cols={['Vendedor','Viajes','Pax','Venta','Ganancia','CM %']}
          rows={porVendedor.map((v, i) => [
            <span key="n"><span style={{ color: 'var(--muted)', fontSize: 11, marginRight: 8, fontFamily: 'var(--font-mono)' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i+1}</span>{v.nombre}</span>,
            v.viajes, v.pax, formatUSD(v.venta), formatUSD(v.ganancia),
            <span key="cm" style={{ color: cmColor(v.cm), fontWeight: 600 }}>{(v.cm*100).toFixed(1)}%</span>,
          ])}
          totals={['TOTAL', kpis.viajes, kpis.pax, formatUSD(kpis.venta), formatUSD(kpis.ganancia), (kpis.cm*100).toFixed(1)+'%']}
        />
      )}

      {/* ── OPERADORES ── */}
      {tab === 'operadores' && (
        <TablaGenerica
          titulo="Viajes por operador"
          cols={['Operador','Viajes','Pax','Días','Venta','Ganancia','CM %']}
          rows={porOperador.map((o, i) => [
            <span key="n"><span style={{ color: 'var(--muted)', fontSize: 11, marginRight: 8, fontFamily: 'var(--font-mono)' }}>{i+1}</span>{o.nombre}</span>,
            o.viajes, o.pax, o.dias, formatUSD(o.venta), formatUSD(o.ganancia),
            <span key="cm" style={{ color: cmColor(o.cm), fontWeight: 600 }}>{(o.cm*100).toFixed(1)}%</span>,
          ])}
        />
      )}

      {/* ── CLIENTES ── */}
      {tab === 'clientes' && (
        <TablaGenerica
          titulo="Reporte por cliente"
          cols={['Cliente','Viajes','Pax','Venta','Ganancia','CM %']}
          rows={porCliente.map((c, i) => [
            <span key="n"><span style={{ color: 'var(--muted)', fontSize: 11, marginRight: 8, fontFamily: 'var(--font-mono)' }}>{i+1}</span>{c.nombre}</span>,
            c.viajes, c.pax, formatUSD(c.venta), formatUSD(c.ganancia),
            <span key="cm" style={{ color: cmColor(c.cm), fontWeight: 600 }}>{(c.cm*100).toFixed(1)}%</span>,
          ])}
          totals={['TOTAL', kpis.viajes, kpis.pax, formatUSD(kpis.venta), formatUSD(kpis.ganancia), (kpis.cm*100).toFixed(1)+'%']}
        />
      )}

      {/* ── DEPARTAMENTOS ── */}
      {tab === 'departamentos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {porDepto.map(d => (
            <div key={d.nombre} className="card" style={{ padding: '16px 20px' }}>
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

function TablaGenerica({ titulo, cols, rows, totals }: {
  titulo: string
  cols: string[]
  rows: React.ReactNode[][]
  totals?: React.ReactNode[]
}) {
  const alignRight = (h: string) => !['Vendedor','Operador','Cliente','Departamento'].includes(h)
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{titulo}</span>
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
              <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: '10px 16px', textAlign: alignRight(cols[j]) ? 'right' : 'left', color: 'var(--text)', fontFamily: j > 0 ? 'var(--font-mono)' : undefined }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                {totals.map((cell, j) => (
                  <td key={j} style={{ padding: '10px 16px', textAlign: alignRight(cols[j]) ? 'right' : 'left', fontWeight: 700, color: 'var(--text)', fontFamily: j > 0 ? 'var(--font-mono)' : undefined }}>
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
