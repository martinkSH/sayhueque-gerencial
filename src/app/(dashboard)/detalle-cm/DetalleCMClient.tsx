'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Target, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(s: string) {
  if (!s) return '—'
  return s.slice(0, 10).split('-').reverse().join('/')
}

type FileRow = {
  file_code: string; area: string; vendedor: string; cliente: string
  departamento: string; fecha_in: string; fecha_out: string; estado: string
  pax: number; costo: number; venta: number; ganancia: number; cm: number
  ganancia_sf: number | null; venta_sf: number | null; costo_sf: number | null; sin_sf: boolean
}

type Excepcion = { file_code: string; area: string; motivo: string | null; aprobado_por_nombre: string | null }
type SortKey = keyof FileRow
type SortDir = 'asc' | 'desc'
type CmFiltro = 'all' | 'en_rango' | 'bajo' | 'sobre' | 'sin_sf' | 'aprobados'
type Rango = { cm_min: number; cm_max: number }

function getCmColor(cm: number, rango: Rango): { bg: string; color: string; label: string } {
  const { cm_min, cm_max } = rango
  if (cm >= cm_min && cm <= cm_max) return { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', label: 'En rango' }
  if (cm > cm_max) {
    const diff = cm - cm_max
    if (diff > 0.10) return { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', label: `+${(diff*100).toFixed(0)}pp sobre máx` }
    return { bg: 'rgba(163,230,53,0.12)', color: '#a3e635', label: `+${(diff*100).toFixed(0)}pp sobre máx` }
  }
  const diff = cm_min - cm
  if (diff > 0.15) return { bg: 'rgba(248,113,113,0.15)', color: '#f87171', label: `${(diff*100).toFixed(0)}pp bajo mín` }
  if (diff > 0.07) return { bg: 'rgba(251,146,60,0.15)', color: '#fb923c', label: `${(diff*100).toFixed(0)}pp bajo mín` }
  return { bg: 'rgba(253,224,71,0.12)', color: '#fde047', label: `${(diff*100).toFixed(0)}pp bajo mín` }
}

const COLS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'file_code',    label: 'File',        align: 'left' },
  { key: 'fecha_in',     label: 'Fecha IN',    align: 'left' },
  { key: 'fecha_out',    label: 'Fecha OUT',   align: 'left' },
  { key: 'estado',       label: 'Estado',      align: 'left' },
  { key: 'cliente',      label: 'Cliente',     align: 'left' },
  { key: 'departamento', label: 'Depto',       align: 'left' },
  { key: 'vendedor',     label: 'Vendedor',    align: 'left' },
  { key: 'pax',          label: 'Pax',         align: 'right' },
  { key: 'costo',        label: 'Costo',       align: 'right' },
  { key: 'costo_sf',     label: 'Costo SF',    align: 'right' },
  { key: 'venta',        label: 'Venta',       align: 'right' },
  { key: 'venta_sf',     label: 'Venta TP',    align: 'right' },
  { key: 'ganancia',     label: 'Ganancia',    align: 'right' },
  { key: 'ganancia_sf',  label: 'Gan. SF',     align: 'right' },
  { key: 'cm',           label: 'CM %',        align: 'right' },
]

const TEMPORADAS = ['25/26','24/25','26/27']

export default function DetalleCMClient({
  files, areas, areaFiltro, temp, rangoMin, rangoMax, isAdmin, excepciones: excepcionesInit, userNombre,
}: {
  files: FileRow[]; areas: string[]; areaFiltro: string; temp: string
  rangoMin: number; rangoMax: number; isAdmin: boolean
  excepciones: Excepcion[]; userNombre: string
}) {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('cm')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [cmFiltro, setCmFiltro] = useState<CmFiltro>('all')
  const [excepciones, setExcepciones] = useState<Map<string, Excepcion>>(
    () => new Map(excepcionesInit.map(e => [e.file_code, e]))
  )
  const [pendingApproval, setPendingApproval] = useState<{ file_code: string; motivo: string } | null>(null)
  const [saving, setSaving] = useState(false)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return files.filter(f => {
      if (q && !f.file_code.toLowerCase().includes(q) && !f.cliente.toLowerCase().includes(q)) return false
      const isExcepcion = excepciones.has(f.file_code)
      if (cmFiltro === 'en_rango') return f.cm >= rangoMin && f.cm <= rangoMax && !isExcepcion
      if (cmFiltro === 'bajo') return f.cm < rangoMin && !isExcepcion
      if (cmFiltro === 'sobre') return f.cm > rangoMax && !isExcepcion
      if (cmFiltro === 'sin_sf') return f.sin_sf
      if (cmFiltro === 'aprobados') return isExcepcion
      return true
    })
  }, [files, search, cmFiltro, excepciones, rangoMin, rangoMax])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number')
        return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [filtered, sortKey, sortDir])

  const totalPax = sorted.reduce((s, r) => s + r.pax, 0)
  const totalVenta = sorted.reduce((s, r) => s + r.venta, 0)
  const totalVentaSf = sorted.filter(r => r.venta_sf !== null).reduce((s, r) => s + (r.venta_sf ?? 0), 0)
  const totalCosto = sorted.reduce((s, r) => s + r.costo, 0)
  const totalCostoSf = sorted.filter(r => r.costo_sf !== null).reduce((s, r) => s + (r.costo_sf ?? 0), 0)
  const totalGanancia = sorted.reduce((s, r) => s + r.ganancia, 0)
  const totalGananciaSf = sorted.filter(r => r.ganancia_sf !== null).reduce((s, r) => s + (r.ganancia_sf ?? 0), 0)
  const hasSfData = sorted.some(r => r.ganancia_sf !== null)
  const totalCM = totalVenta > 0 ? totalGanancia / totalVenta : 0

  const enRangoCount = files.filter(f => (f.cm >= rangoMin && f.cm <= rangoMax) || excepciones.has(f.file_code)).length
  const bajoCount = files.filter(f => f.cm < rangoMin && !excepciones.has(f.file_code)).length
  const sobreCount = files.filter(f => f.cm > rangoMax && !excepciones.has(f.file_code)).length
  const sinSfCount = files.filter(f => f.sin_sf).length
  const aprobadosCount = excepciones.size

  const aprobar = useCallback(async (file_code: string, motivo: string) => {
    setSaving(true)
    const { error } = await supabase.from('cm_excepciones').upsert({
      file_code, area: areaFiltro, motivo: motivo || null, aprobado_por_nombre: userNombre,
    }, { onConflict: 'file_code,area' })
    if (!error) {
      setExcepciones(prev => new Map(prev).set(file_code, { file_code, area: areaFiltro, motivo, aprobado_por_nombre: userNombre }))
    }
    setSaving(false)
    setPendingApproval(null)
  }, [supabase, areaFiltro, userNombre])

  const revocar = useCallback(async (file_code: string) => {
    await supabase.from('cm_excepciones').delete().eq('file_code', file_code).eq('area', areaFiltro)
    setExcepciones(prev => { const m = new Map(prev); m.delete(file_code); return m })
  }, [supabase, areaFiltro])

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown size={11} style={{ opacity: 0.3 }} />
    return sortDir === 'asc' ? <ArrowUp size={11} style={{ color: 'var(--teal-400)' }} /> : <ArrowDown size={11} style={{ color: 'var(--teal-400)' }} />
  }

  const kpis: { label: string; value: number | string; color: string; sub: string; filtro: CmFiltro }[] = [
    { label: 'En rango', value: enRangoCount, color: '#4ade80', sub: `${files.length > 0 ? ((enRangoCount/files.length)*100).toFixed(0) : 0}% del total`, filtro: 'en_rango' },
    { label: 'Bajo mínimo', value: bajoCount, color: '#f87171', sub: `< ${Math.round(rangoMin*100)}%`, filtro: 'bajo' },
    { label: 'Sobre máximo', value: sobreCount, color: '#60a5fa', sub: `> ${Math.round(rangoMax*100)}%`, filtro: 'sobre' },
    { label: 'CM promedio', value: `${(totalCM*100).toFixed(1)}%`, color: totalCM >= rangoMin && totalCM <= rangoMax ? '#4ade80' : '#fb923c', sub: formatUSD(totalGanancia), filtro: 'all' },
    ...(sinSfCount > 0 ? [{ label: 'Sin match SF', value: sinSfCount, color: '#fbbf24', sub: 'B2C sin Salesforce', filtro: 'sin_sf' as CmFiltro }] : []),
    ...(aprobadosCount > 0 ? [{ label: 'Aprobados', value: aprobadosCount, color: '#a78bfa', sub: 'CM fuera de rango OK', filtro: 'aprobados' as CmFiltro }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Modal aprobar */}
      {pendingApproval && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Aprobar excepción CM</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              File <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{pendingApproval.file_code}</strong> quedará marcado como OK aunque esté fuera del rango de CM.
            </p>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Motivo (opcional)</label>
              <input
                autoFocus type="text"
                placeholder="Ej: precio especial acordado, cliente estratégico..."
                value={pendingApproval.motivo}
                onChange={e => setPendingApproval(p => p ? { ...p, motivo: e.target.value } : p)}
                onKeyDown={e => { if (e.key === 'Enter') aprobar(pendingApproval.file_code, pendingApproval.motivo) }}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingApproval(null)}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={() => aprobar(pendingApproval.file_code, pendingApproval.motivo)} disabled={saving}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#4ade80', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {saving ? 'Guardando...' : 'Aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Detalle CM</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            {areaFiltro} · {temp} · rango esperado{' '}
            <span style={{ color: '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {Math.round(rangoMin * 100)}% – {Math.round(rangoMax * 100)}%
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
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

      {/* Filtro área */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {areas.map(a => (
          <a key={a} href={`?temp=${temp}&area=${encodeURIComponent(a)}`} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
            background: areaFiltro === a ? 'var(--surface2)' : 'transparent',
            color: areaFiltro === a ? 'var(--text)' : 'var(--muted)',
            border: `1px solid ${areaFiltro === a ? 'var(--teal-600)' : 'var(--border)'}`,
          }}>{a}</a>
        ))}
      </div>

      {/* KPIs clickeables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {kpis.map(k => {
          const active = cmFiltro === k.filtro
          return (
            <div key={k.label} onClick={() => k.filtro !== 'all' && setCmFiltro(active ? 'all' : k.filtro)}
              className="card" style={{
                padding: '14px 18px',
                cursor: k.filtro !== 'all' ? 'pointer' : 'default',
                border: active ? `1px solid ${k.color}` : '1px solid var(--border)',
                transition: 'border-color 0.15s, opacity 0.15s',
                opacity: cmFiltro !== 'all' && !active ? 0.45 : 1,
              }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{k.sub}</div>
              {active && <div style={{ fontSize: 10, color: k.color, marginTop: 4, fontWeight: 600 }}>● filtrando</div>}
            </div>
          )
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
        {[
          { color: '#4ade80', label: 'En rango' },
          { color: '#fde047', label: 'Leve desvío bajo' },
          { color: '#fb923c', label: 'Desvío bajo' },
          { color: '#f87171', label: 'Crítico (muy bajo)' },
          { color: '#a3e635', label: 'Leve sobre máx' },
          { color: '#60a5fa', label: 'Muy sobre máx' },
          { color: '#a78bfa', label: 'Aprobado manualmente' },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Buscador + quitar filtro */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: 360, flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input type="text" placeholder="Buscar por file o cliente..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, fontSize: 13, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {cmFiltro !== 'all' && (
          <button onClick={() => setCmFiltro('all')}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>
            ✕ Quitar filtro
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={14} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {sorted.length} files {(search || cmFiltro !== 'all') && `(filtrados de ${files.length})`}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {COLS.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    style={{ padding: '9px 14px', textAlign: col.align, color: 'var(--muted)', fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.label} <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
                <th style={{ padding: '9px 14px', color: 'var(--muted)', fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap' }}>Aprobación</th>
              </tr>
            </thead>

            {/* Fila totales */}
            <tbody>
              <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--teal-600)' }}>
                <td style={{ padding: '9px 14px', fontWeight: 700, fontSize: 11, color: 'var(--teal-400)', whiteSpace: 'nowrap' }}>TOTAL ({sorted.length} files)</td>
                <td colSpan={6} />
                <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{totalPax.toLocaleString('es-AR')}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--muted)' }}>{formatUSD(totalCosto)}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                  {hasSfData ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#60a5fa' }}>{formatUSD(totalCostoSf)}</span>
                    {totalCosto > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: Math.abs(((totalCostoSf-totalCosto)/totalCosto)*100) < 5 ? 'var(--muted)' : totalCostoSf > totalCosto ? '#f87171' : '#4ade80' }}>{((totalCostoSf-totalCosto)/totalCosto) >= 0 ? '+' : ''}{(((totalCostoSf-totalCosto)/totalCosto)*100).toFixed(1)}%</span>}
                  </div> : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{formatUSD(totalVenta)}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                  {hasSfData ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#60a5fa' }}>{formatUSD(totalVentaSf)}</span>
                    {totalVenta > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: Math.abs(((totalVentaSf-totalVenta)/totalVenta)*100) < 5 ? 'var(--muted)' : totalVentaSf > totalVenta ? '#4ade80' : '#f87171' }}>{((totalVentaSf-totalVenta)/totalVenta) >= 0 ? '+' : ''}{(((totalVentaSf-totalVenta)/totalVenta)*100).toFixed(1)}%</span>}
                  </div> : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#4ade80' }}>{formatUSD(totalGanancia)}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                  {hasSfData ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#60a5fa' }}>{formatUSD(totalGananciaSf)}</span>
                    {totalGanancia > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: Math.abs(((totalGananciaSf-totalGanancia)/totalGanancia)*100) < 5 ? 'var(--muted)' : totalGananciaSf > totalGanancia ? '#4ade80' : '#f87171' }}>{((totalGananciaSf-totalGanancia)/totalGanancia) >= 0 ? '+' : ''}{(((totalGananciaSf-totalGanancia)/totalGanancia)*100).toFixed(1)}%</span>}
                  </div> : <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-mono)', background: getCmColor(totalCM, { cm_min: rangoMin, cm_max: rangoMax }).bg, color: getCmColor(totalCM, { cm_min: rangoMin, cm_max: rangoMax }).color }}>
                    {(totalCM * 100).toFixed(1)}%
                  </span>
                </td>
                <td />
              </tr>
            </tbody>

            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={COLS.length + 1} style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>Sin resultados</td></tr>
              ) : sorted.map((r, i) => {
                const excepcion = excepciones.get(r.file_code)
                const isAprobado = !!excepcion
                const cmStyle = isAprobado ? { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', label: 'Aprobado' } : getCmColor(r.cm, { cm_min: rangoMin, cm_max: rangoMax })
                const fueraDeRango = r.cm < rangoMin || r.cm > rangoMax

                return (
                  <tr key={r.file_code} style={{
                    borderTop: '1px solid var(--border)',
                    background: isAprobado ? 'rgba(167,139,250,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}>
                    <td style={{ padding: '8px 14px', color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{r.file_code}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmtDate(r.fecha_in)}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.fecha_out)}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)' }}>{r.estado}</span>
                    </td>
                    <td style={{ padding: '8px 14px', color: 'var(--text)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.departamento}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.vendedor}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatUSD(r.costo)}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.costo_sf !== null ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#60a5fa' }}>{formatUSD(r.costo_sf)}</span>
                          {r.costo > 0 && (() => { const d = ((r.costo_sf - r.costo) / r.costo) * 100; return <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: Math.abs(d) < 5 ? 'var(--muted)' : d > 0 ? '#f87171' : '#4ade80' }}>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</span> })()}
                        </div>
                      ) : <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {formatUSD(r.venta)}
                      {r.sin_sf && <span title="B2C sin match en Salesforce" style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', verticalAlign: 'middle' }}>SF?</span>}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.venta_sf !== null ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#60a5fa' }}>{formatUSD(r.venta_sf)}</span>
                          {r.venta > 0 && (() => { const d = ((r.venta_sf - r.venta) / r.venta) * 100; return <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: Math.abs(d) < 5 ? 'var(--muted)' : d > 0 ? '#4ade80' : '#f87171' }}>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</span> })()}
                        </div>
                      ) : <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', color: r.ganancia < 0 ? '#f87171' : 'var(--text)' }}>{formatUSD(r.ganancia)}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.ganancia_sf !== null ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: r.ganancia_sf < 0 ? '#f87171' : '#60a5fa' }}>{formatUSD(r.ganancia_sf)}</span>
                          {(() => { const d = r.ganancia > 0 ? ((r.ganancia_sf - r.ganancia) / r.ganancia) * 100 : null; if (d === null) return null; return <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: Math.abs(d) < 5 ? 'var(--muted)' : d > 0 ? '#4ade80' : '#f87171' }}>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</span> })()}
                        </div>
                      ) : <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', background: cmStyle.bg, color: cmStyle.color, minWidth: 52, textAlign: 'center' }}
                        title={isAprobado && excepcion?.motivo ? `Aprobado por ${excepcion.aprobado_por_nombre}: ${excepcion.motivo}` : cmStyle.label}>
                        {(r.cm * 100).toFixed(1)}%
                      </span>
                    </td>
                    {/* Aprobación */}
                    <td style={{ padding: '8px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {isAprobado ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={13} style={{ color: '#a78bfa' }} />
                            <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600 }}>OK manual</span>
                          </div>
                          {excepcion?.aprobado_por_nombre && <span style={{ fontSize: 9, color: 'var(--muted)' }}>{excepcion.aprobado_por_nombre}</span>}
                          {excepcion?.motivo && <span style={{ fontSize: 9, color: 'var(--muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={excepcion.motivo}>{excepcion.motivo}</span>}
                          <button onClick={() => revocar(r.file_code)} style={{ fontSize: 9, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>revocar</button>
                        </div>
                      ) : fueraDeRango ? (
                        <button onClick={() => setPendingApproval({ file_code: r.file_code, motivo: '' })}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#a78bfa', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          <CheckCircle size={11} /> Aprobar
                        </button>
                      ) : <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>}
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
