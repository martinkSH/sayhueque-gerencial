'use client'

import { useState, useMemo } from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Target } from 'lucide-react'

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
  sin_sf: boolean
}


type SortKey = keyof FileRow
type SortDir = 'asc' | 'desc'
type Rango = { cm_min: number; cm_max: number }

function getCmColor(cm: number, rango: Rango): { bg: string; color: string; label: string } {
  const { cm_min, cm_max } = rango
  const mid = (cm_min + cm_max) / 2
  if (cm >= cm_min && cm <= cm_max) return { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', label: 'En rango' }
  if (cm > cm_max) {
    const diff = cm - cm_max
    if (diff > 0.10) return { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', label: `+${(diff*100).toFixed(0)}pp sobre máx` }
    return { bg: 'rgba(163,230,53,0.12)', color: '#a3e635', label: `+${(diff*100).toFixed(0)}pp sobre máx` }
  }
  // por debajo del mínimo
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
  { key: 'venta',        label: 'Venta',       align: 'right' },
  { key: 'ganancia',     label: 'Ganancia',    align: 'right' },
  { key: 'cm',           label: 'CM %',        align: 'right' },
]

const TEMPORADAS = ['25/26','24/25','26/27']

export default function DetalleCMClient({
  files, areas, areaFiltro, temp, rangoMin, rangoMax, isAdmin,
}: {
  files: FileRow[]; areas: string[]; areaFiltro: string; temp: string; rangoMin: number; rangoMax: number; isAdmin: boolean
}) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('cm')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return files.filter(f =>
      !q || f.file_code.toLowerCase().includes(q) || f.cliente.toLowerCase().includes(q)
    )
  }, [files, search])

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

  // Totales
  const totalVenta = sorted.reduce((s, r) => s + r.venta, 0)
  const totalCosto = sorted.reduce((s, r) => s + r.costo, 0)
  const totalGanancia = sorted.reduce((s, r) => s + r.ganancia, 0)
  const totalCM = totalVenta > 0 ? totalGanancia / totalVenta : 0

  // Conteo por categoría
  const enRango = sorted.filter(f => f.cm >= rangoMin && f.cm <= rangoMax).length
  const bajo = sorted.filter(f => f.cm < rangoMin).length
  const sobre = sorted.filter(f => f.cm > rangoMax).length
  const sinSf = sorted.filter(f => f.sin_sf).length

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown size={11} style={{ opacity: 0.3 }} />
    return sortDir === 'asc' ? <ArrowUp size={11} style={{ color: 'var(--teal-400)' }} /> : <ArrowDown size={11} style={{ color: 'var(--teal-400)' }} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[
          { label: 'En rango', value: enRango, color: '#4ade80', sub: `${sorted.length > 0 ? ((enRango/sorted.length)*100).toFixed(0) : 0}% del total` },
          { label: 'Bajo mínimo', value: bajo, color: '#f87171', sub: `< ${Math.round(rangoMin*100)}%` },
          { label: 'Sobre máximo', value: sobre, color: '#60a5fa', sub: `> ${Math.round(rangoMax*100)}%` },
          { label: 'CM promedio', value: `${(totalCM*100).toFixed(1)}%`, color: totalCM >= rangoMin && totalCM <= rangoMax ? '#4ade80' : '#fb923c', sub: formatUSD(totalGanancia) },
          ...(sinSf > 0 ? [{ label: 'Sin match SF', value: sinSf, color: '#fbbf24', sub: 'B2C sin Salesforce' }] : []),
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Leyenda colores */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
        {[
          { color: '#4ade80', label: 'En rango' },
          { color: '#fde047', label: 'Leve desvío bajo' },
          { color: '#fb923c', label: 'Desvío bajo' },
          { color: '#f87171', label: 'Crítico (muy bajo)' },
          { color: '#a3e635', label: 'Leve sobre máx' },
          { color: '#60a5fa', label: 'Muy sobre máx' },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative', maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input
          type="text" placeholder="Buscar por file o cliente..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, fontSize: 13,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Tabla */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={14} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {sorted.length} files {search && `(filtrados de ${files.length})`}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {COLS.map(col => (
                  <th key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: '9px 14px', textAlign: col.align, color: 'var(--muted)',
                      fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap',
                      cursor: 'pointer', userSelect: 'none',
                    }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.label} <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={COLS.length} style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>Sin resultados</td></tr>
              ) : sorted.map((r, i) => {
                const cmStyle = getCmColor(r.cm, { cm_min: rangoMin, cm_max: rangoMax })
                return (
                  <tr key={r.file_code} style={{
                    borderTop: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}>
                    <td style={{ padding: '8px 14px', color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{r.file_code}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmtDate(r.fecha_in)}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.fecha_out)}</td>
                    <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5,
                        background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)' }}>
                        {r.estado}
                      </span>
                    </td>
                    <td style={{ padding: '8px 14px', color: 'var(--text)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.departamento}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.vendedor}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatUSD(r.costo)}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {formatUSD(r.venta)}
                      {r.sin_sf && (
                        <span title="B2C sin match en Salesforce — usando venta de Team Leader" style={{
                          marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 4,
                          background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                          border: '1px solid rgba(251,191,36,0.3)', verticalAlign: 'middle',
                        }}>SF?</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                      color: r.ganancia < 0 ? '#f87171' : 'var(--text)' }}>{formatUSD(r.ganancia)}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                        fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        background: cmStyle.bg, color: cmStyle.color,
                        minWidth: 52, textAlign: 'center',
                      }}>
                        {(r.cm * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
              {/* Totales */}
              {sorted.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                  <td colSpan={8} style={{ padding: '9px 14px', color: 'var(--text)', fontWeight: 700, fontSize: 12 }}>
                    TOTAL ({sorted.length} files)
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--muted)', fontSize: 12 }}>{formatUSD(totalCosto)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)', fontSize: 12 }}>{formatUSD(totalVenta)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4ade80', fontSize: 12 }}>{formatUSD(totalGanancia)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                      fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                      background: getCmColor(totalCM, { cm_min: rangoMin, cm_max: rangoMax }).bg,
                      color: getCmColor(totalCM, { cm_min: rangoMin, cm_max: rangoMax }).color,
                      minWidth: 52, textAlign: 'center',
                    }}>
                      {(totalCM * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
