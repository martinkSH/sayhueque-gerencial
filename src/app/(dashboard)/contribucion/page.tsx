import { createClient } from '@/lib/supabase/server'
import { PieChart } from 'lucide-react'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const ESTADOS_CONFIRMADOS = [
  'Final + Day by Day','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo'
]
const B2C_AREAS = ['Web','Plataformas','Walk In']
const TEMPORADAS = ['25/26','24/25','26/27']

// Categorías CM (igual que macro VBA)
function categCM(cm: number): { label: string; color: string } {
  if (cm >= 0.30) return { label: '≥30% Excelente', color: '#4ade80' }
  if (cm >= 0.20) return { label: '20-30% OK',       color: '#a3e635' }
  if (cm >= 0.10) return { label: '10-20% Bajo',     color: '#fb923c' }
  return              { label: '<10% Crítico',        color: '#f87171' }
}

const SAMPLE_SIZE = 0.10 // 10%

export default async function ContribucionPage({
  searchParams,
}: {
  searchParams: { area?: string; temp?: string }
}) {
  const supabase = createClient()
  const temp = searchParams.temp ?? '25/26'
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

  const { data: tlRows } = await supabase
    .from('team_leader_rows')
    .select('file_code, booking_branch, vendedor, fecha_in, venta, ganancia, cant_pax, is_b2c')
    .eq('upload_id', uploadId)
    .eq('temporada', temp)
    .in('estado', ESTADOS_CONFIRMADOS)
    .limit(10000)

  const { data: sfRows } = await supabase
    .from('salesforce_rows')
    .select('file_code, venta, ganancia')
    .eq('upload_id', uploadId)
  const sfMap = new Map<string, { venta: number; ganancia: number }>()
  sfRows?.forEach(r => sfMap.set(r.file_code.toUpperCase(), { venta: r.venta ?? 0, ganancia: r.ganancia ?? 0 }))

  // Deduplicar y aplicar B2C override
  type FileData = { file_code: string; area: string; vendedor: string; venta: number; ganancia: number; pax: number; cm: number }
  const filesMap = new Map<string, FileData>()

  tlRows?.forEach(r => {
    if (filesMap.has(r.file_code)) return
    const sf = r.is_b2c ? sfMap.get(r.file_code.toUpperCase()) : null
    const venta = sf ? sf.venta : (r.venta ?? 0)
    const ganancia = sf ? sf.ganancia : (r.ganancia ?? 0)
    const area = B2C_AREAS.includes(r.booking_branch ?? '') ? 'B2C' : (r.booking_branch ?? 'Sin área')
    filesMap.set(r.file_code, {
      file_code: r.file_code,
      area,
      vendedor: r.vendedor ?? '—',
      venta,
      ganancia,
      pax: r.cant_pax ?? 0,
      cm: venta > 0 ? ganancia / venta : 0,
    })
  })

  const allFiles = Array.from(filesMap.values())
  const areaOptions = ['empresa', ...Array.from(new Set(allFiles.map(f => f.area))).sort()]

  // Filtrar por área
  const filteredFiles = areaFiltro === 'empresa'
    ? allFiles
    : allFiles.filter(f => f.area === areaFiltro)

  // Muestra aleatoria 10%
  const shuffled = [...filteredFiles].sort(() => Math.random() - 0.5)
  const sampleN = Math.max(10, Math.round(filteredFiles.length * SAMPLE_SIZE))
  const sample = shuffled.slice(0, sampleN).sort((a, b) => b.cm - a.cm)

  // Estadísticas de la muestra
  const sampleVenta = sample.reduce((s, r) => s + r.venta, 0)
  const sampleGanancia = sample.reduce((s, r) => s + r.ganancia, 0)
  const sampleCM = sampleVenta > 0 ? sampleGanancia / sampleVenta : 0

  // Distribución por categoría (de TODOS los files filtrados, no solo muestra)
  const catCount = new Map<string, number>()
  filteredFiles.forEach(f => {
    const cat = categCM(f.cm).label
    catCount.set(cat, (catCount.get(cat) ?? 0) + 1)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Contribución Marginal</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Muestra {sampleN} de {filteredFiles.length} files ({(SAMPLE_SIZE*100).toFixed(0)}%) · {areaFiltro === 'empresa' ? 'Total empresa' : areaFiltro} · {temp}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TEMPORADAS.map(t => (
            <a key={t} href={`?temp=${t}&area=${areaFiltro}`} style={{
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
        {areaOptions.map(a => (
          <a key={a} href={`?temp=${temp}&area=${encodeURIComponent(a)}`} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
            background: areaFiltro === a ? 'var(--surface2)' : 'transparent',
            color: areaFiltro === a ? 'var(--text)' : 'var(--muted)',
            border: `1px solid ${areaFiltro === a ? 'var(--teal-600)' : 'var(--border)'}`,
          }}>{a === 'empresa' ? 'Total empresa' : a}</a>
        ))}
      </div>

      {/* KPIs distribución */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {Array.from(catCount.entries()).map(([label, count]) => {
          const cat = categCM(parseFloat(label)) // reuse color by re-parsing isn't ideal; map manually
          const colorMap: Record<string, string> = {
            '≥30% Excelente': '#4ade80',
            '20-30% OK': '#a3e635',
            '10-20% Bajo': '#fb923c',
            '<10% Crítico': '#f87171',
          }
          const color = colorMap[label] ?? 'var(--muted)'
          return (
            <div key={label} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {((count / filteredFiles.length) * 100).toFixed(1)}% del total
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabla muestra */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieChart size={15} style={{ color: 'var(--teal-400)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Muestra aleatoria 10%</span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>CM muestra: <span style={{ color: 'var(--teal-400)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(sampleCM*100).toFixed(1)}%</span></span>
            <span style={{ color: 'var(--muted)' }}>Gan: <span style={{ color: '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatUSD(sampleGanancia)}</span></span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['File','Área','Vendedor','Pax','Venta','Ganancia','CM','Cat'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px',
                    textAlign: ['File','Área','Vendedor','Cat'].includes(h) ? 'left' : 'right',
                    color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.map((r, i) => {
                const cat = categCM(r.cm)
                return (
                  <tr key={r.file_code} style={{
                    borderTop: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}>
                    <td style={{ padding: '9px 16px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.file_code}</td>
                    <td style={{ padding: '9px 16px', color: 'var(--muted)' }}>{r.area}</td>
                    <td style={{ padding: '9px 16px', color: 'var(--text)' }}>{r.vendedor}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(r.venta)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', color: r.ganancia < 0 ? '#f87171' : 'var(--text)', fontFamily: 'var(--font-mono)' }}>{formatUSD(r.ganancia)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: cat.color }}>{(r.cm*100).toFixed(1)}%</td>
                    <td style={{ padding: '9px 16px' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `${cat.color}22`, color: cat.color, fontWeight: 500 }}>
                        {cat.label.split(' ')[0]}
                      </span>
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
