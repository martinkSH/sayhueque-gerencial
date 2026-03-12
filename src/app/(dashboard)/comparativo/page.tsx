import { createClient } from '@/lib/supabase/server'
import { BarChart2 } from 'lucide-react'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function pct(a: number, b: number) {
  if (b === 0) return null
  return ((a - b) / b) * 100
}

const MESES = ['May','Jun','Jul','Ago','Sep','Oct','Nov','Dic','Ene','Feb','Mar','Abr']
const ESTADOS_CONFIRMADOS = [
  'Final + Day by Day','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo'
]
const B2C_AREAS = ['Web','Plataformas','Walk In']

// Columnas Temp 2425: Ganancia cols D..O = índices 3..14 (0-based), área en col A (idx 0)
// Mismo para Venta y Cantidad (cantidad cols C..N = idx 2..13)

export default async function ComparativoPage({
  searchParams,
}: {
  searchParams: { metric?: string; area?: string }
}) {
  const supabase = createClient()
  const metric = (searchParams.metric ?? 'ganancia') as 'ganancia' | 'venta' | 'cantidad'
  const areaFiltro = searchParams.area ?? 'empresa'

  const { data: lastUpload } = await supabase
    .from('uploads')
    .select('id, filename')
    .eq('status', 'ok')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!lastUpload) {
    return <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>Sin datos. Subí un Excel primero.</div>
  }

  const uploadId = lastUpload.id

  // ── 24/25 desde tablas temp ──────────────────────────────────────────────
  const tableName = metric === 'ganancia'
    ? 'temp_2425_ganancia'
    : metric === 'venta'
    ? 'temp_2425_venta'
    : 'temp_2425_cantidad'

  const { data: tempRows } = await supabase
    .from(tableName)
    .select('*')
    .eq('upload_id', uploadId)

  
  // mes_01=May, mes_02=Jun ... mes_12=Abr
  // Construir mapa area -> [12 valores]
  const temp2425: Map<string, number[]> = new Map()
  tempRows?.forEach((row: Record<string, unknown>) => {
    const area = (row.area as string) ?? ''
    const vals = Array.from({ length: 12 }, (_, i) => {
      const key = `mes_${String(i + 1).padStart(2, '0')}`
      const v = row[key]
      return typeof v === 'number' ? v : 0
    })
    temp2425.set(area, vals)
  })

  // Áreas disponibles en 24/25
  const areas2425 = Array.from(temp2425.keys()).filter(Boolean)

  // ── 25/26 desde team_leader_rows ─────────────────────────────────────────
  const { data: tlRows } = await supabase
    .from('team_leader_rows')
    .select('file_code, booking_branch, fecha_in, venta, ganancia, cant_pax, is_b2c')
    .eq('upload_id', uploadId)
    .eq('temporada', '25/26')
    .in('estado', ESTADOS_CONFIRMADOS)
    .limit(10000)

  const { data: sfRows } = await supabase
    .from('salesforce_rows')
    .select('file_code, venta, ganancia')
    .eq('upload_id', uploadId)
  const sfMap = new Map<string, { venta: number; ganancia: number }>()
  sfRows?.forEach(r => sfMap.set(r.file_code.toUpperCase(), { venta: r.venta ?? 0, ganancia: r.ganancia ?? 0 }))

  // Mes de temporada: May=0 ... Abr=11
  // fecha_in formato YYYY-MM-DD
  function mesIdx(fechaIn: string): number {
    const m = parseInt(fechaIn.slice(5, 7), 10) // 1-12
    // May(5)=0 .. Dic(12)=7, Ene(1)=8, Feb(2)=9, Mar(3)=10, Abr(4)=11
    return m >= 5 ? m - 5 : m + 7
  }

  // area -> [12]
  const temp2526: Map<string, number[]> = new Map()
  const seenFiles = new Set<string>()

  tlRows?.forEach(r => {
    if (!r.fecha_in) return
    if (seenFiles.has(r.file_code)) return
    seenFiles.add(r.file_code)

    const sf = r.is_b2c ? sfMap.get(r.file_code.toUpperCase()) : null
    const val = metric === 'cantidad'
      ? 1
      : metric === 'venta'
      ? (sf ? sf.venta : (r.venta ?? 0))
      : (sf ? sf.ganancia : (r.ganancia ?? 0))

    const rawArea = r.booking_branch ?? ''
    const area = B2C_AREAS.includes(rawArea) ? 'B2C' : rawArea
    const idx = mesIdx(r.fecha_in)

    const cur = temp2526.get(area) ?? Array(12).fill(0)
    cur[idx] += val
    temp2526.set(area, cur)
  })

  // Construir lista de áreas para el selector
  const areas2526 = Array.from(temp2526.keys()).filter(Boolean).sort()
  const allAreas = Array.from(new Set([...areas2425, ...areas2526, 'B2C'])).sort()
  const areaOptions = ['empresa', ...allAreas]

  // Totales empresa 24/25 y 25/26
  function sumAreas(map: Map<string, number[]>): number[] {
    const total = Array(12).fill(0)
    map.forEach(vals => vals.forEach((v, i) => { total[i] += v }))
    return total
  }

  // Filas a mostrar según filtro
  let rows2425: number[]
  let rows2526: number[]

  if (areaFiltro === 'empresa') {
    rows2425 = sumAreas(temp2425)
    rows2526 = sumAreas(temp2526)
  } else if (areaFiltro === 'B2C') {
    // B2C en 24/25: sumar Web + Plataformas + Walk In si existen
    rows2425 = Array(12).fill(0)
    B2C_AREAS.forEach(a => {
      const v = temp2425.get(a)
      if (v) v.forEach((x, i) => { rows2425[i] += x })
    })
    rows2526 = temp2526.get('B2C') ?? Array(12).fill(0)
  } else {
    rows2425 = temp2425.get(areaFiltro) ?? Array(12).fill(0)
    rows2526 = temp2526.get(areaFiltro) ?? Array(12).fill(0)
  }

  const total2425 = rows2425.reduce((s, v) => s + v, 0)
  const total2526 = rows2526.reduce((s, v) => s + v, 0)
  const diffTotal = pct(total2526, total2425)

  const metricLabel = metric === 'ganancia' ? 'Ganancia' : metric === 'venta' ? 'Venta' : 'Cantidad'
  const isMoney = metric !== 'cantidad'

  const fmt = (v: number) => isMoney ? formatUSD(v) : v.toLocaleString('es-AR', { maximumFractionDigits: 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Comparativo 24/25 vs 25/26</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{areaFiltro === 'empresa' ? 'Total empresa' : areaFiltro} · {metricLabel}</p>
        </div>
        {/* Métrica */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['ganancia','venta','cantidad'] as const).map(m => (
            <a key={m} href={`?metric=${m}&area=${areaFiltro}`} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none', textTransform: 'capitalize',
              background: metric === m ? 'var(--teal-600)' : 'var(--surface2)',
              color: metric === m ? '#fff' : 'var(--muted)',
              border: `1px solid ${metric === m ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{m}</a>
          ))}
        </div>
      </div>

      {/* Filtro área */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {areaOptions.map(a => (
          <a key={a} href={`?metric=${metric}&area=${encodeURIComponent(a)}`} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
            background: areaFiltro === a ? 'var(--surface2)' : 'transparent',
            color: areaFiltro === a ? 'var(--text)' : 'var(--muted)',
            border: `1px solid ${areaFiltro === a ? 'var(--teal-600)' : 'var(--border)'}`,
          }}>{a === 'empresa' ? 'Total empresa' : a}</a>
        ))}
      </div>

      {/* Tabla mes a mes */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {areaFiltro === 'empresa' ? 'Total empresa' : areaFiltro} — {metricLabel} mes a mes
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>Mes</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>24/25</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>25/26</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>Δ%</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 12, width: 160 }}>Barra</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((mes, i) => {
                const v2425 = rows2425[i] ?? 0
                const v2526 = rows2526[i] ?? 0
                const diff = pct(v2526, v2425)
                const maxVal = Math.max(...rows2425, ...rows2526, 1)
                return (
                  <tr key={mes} style={{
                    borderTop: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500 }}>{mes}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{fmt(v2425)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(v2526)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: diff === null ? 'var(--muted)' : diff >= 0 ? '#4ade80' : '#f87171'
                    }}>
                      {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${(v2425/maxVal)*100}%`, background: 'rgba(100,116,139,0.6)', borderRadius: 2 }} />
                        </div>
                        <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${(v2526/maxVal)*100}%`, background: 'var(--teal-500)', borderRadius: 2 }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {/* Total */}
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(total2425)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(total2526)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: diffTotal === null ? 'var(--muted)' : diffTotal >= 0 ? '#4ade80' : '#f87171'
                }}>
                  {diffTotal === null ? '—' : `${diffTotal >= 0 ? '+' : ''}${diffTotal.toFixed(1)}%`}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 4, background: 'rgba(100,116,139,0.6)', borderRadius: 2, display: 'inline-block' }} /> 24/25
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 4, background: 'var(--teal-500)', borderRadius: 2, display: 'inline-block' }} /> 25/26
        </span>
      </div>

    </div>
  )
}
