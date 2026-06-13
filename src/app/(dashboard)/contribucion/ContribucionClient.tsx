'use client'

import { useState } from 'react'
import { PieChart, Search } from 'lucide-react'
import { formatUSD, categCM } from '@/lib/format'

export type CMFile = {
  file_code: string
  area: string
  vendedor: string
  pax: number
  venta: number
  ganancia: number
  cm: number
}

type SortKey = 'pax' | 'venta' | 'ganancia' | 'cm'

// Tope de filas renderizadas (la lista ya viene ordenada peor-CM primero, que es
// lo accionable). Si hay más, se avisa y el buscador acota.
const DISPLAY_CAP = 1000

export default function ContribucionClient({ files }: { files: CMFile[] }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('cm')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc') // CM ascendente = peor margen primero

  const q = search.trim().toLowerCase()
  const filtered = q
    ? files.filter(f =>
        f.file_code.toLowerCase().includes(q) ||
        f.vendedor.toLowerCase().includes(q) ||
        f.area.toLowerCase().includes(q))
    : files

  const sorted = [...filtered].sort((a, b) => {
    const d = a[sortKey] - b[sortKey]
    return sortDir === 'asc' ? d : -d
  })
  const visible = sorted.slice(0, DISPLAY_CAP)

  // Totales reales del conjunto filtrado (no de una muestra)
  const tVenta = filtered.reduce((s, r) => s + r.venta, 0)
  const tGan = filtered.reduce((s, r) => s + r.ganancia, 0)
  const tCM = tVenta > 0 ? tGan / tVenta : 0

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir(k === 'cm' ? 'asc' : 'desc') }
  }

  const cols: [string, SortKey | null][] = [
    ['File', null], ['Área', null], ['Vendedor', null],
    ['Pax', 'pax'], ['Venta', 'venta'], ['Ganancia', 'ganancia'], ['CM', 'cm'], ['Cat', null],
  ]

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PieChart size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {filtered.length} files · peor CM primero
          </span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>CM: <span style={{ color: 'var(--teal-400)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(tCM * 100).toFixed(1)}%</span></span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Gan: <span style={{ color: '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatUSD(tGan)}</span></span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar file, vendedor o área..."
              style={{ padding: '7px 12px 7px 32px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', minWidth: 240 }}
            />
          </div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {cols.map(([h, key]) => {
                const left = ['File', 'Área', 'Vendedor', 'Cat'].includes(h)
                const active = key !== null && sortKey === key
                return (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: left ? 'left' : 'right',
                    color: active ? 'var(--teal-400)' : 'var(--muted)', fontWeight: active ? 700 : 500, fontSize: 12, whiteSpace: 'nowrap',
                    cursor: key ? 'pointer' : 'default', userSelect: 'none',
                  }}
                    onClick={key ? () => toggleSort(key) : undefined}>
                    {h}{active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                {files.length === 0 ? 'Sin files para esta selección' : 'Sin resultados para la búsqueda'}
              </td></tr>
            ) : visible.map((r, i) => {
              const cat = categCM(r.cm)
              return (
                <tr key={r.file_code} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '9px 16px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.file_code}</td>
                  <td style={{ padding: '9px 16px', color: 'var(--muted)' }}>{r.area}</td>
                  <td style={{ padding: '9px 16px', color: 'var(--text)' }}>{r.vendedor}</td>
                  <td style={{ padding: '9px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax}</td>
                  <td style={{ padding: '9px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(r.venta)}</td>
                  <td style={{ padding: '9px 16px', textAlign: 'right', color: r.ganancia < 0 ? '#f87171' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(r.ganancia)}</td>
                  <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: cat.color }}>{(r.cm * 100).toFixed(1)}%</td>
                  <td style={{ padding: '9px 16px' }}>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `${cat.color}22`, color: cat.color, fontWeight: 500 }}>{cat.short}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sorted.length > DISPLAY_CAP && (
          <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            Mostrando {DISPLAY_CAP} de {sorted.length} files (los totales de arriba sí incluyen todos). Usá el buscador o el filtro de área para acotar.
          </div>
        )}
      </div>
    </div>
  )
}
