'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type CRow = { 
  cliente: string
  viajes: number
  quotes: number
  tasa_conversion: number
  pax: number
  venta: number
  ganancia: number
}

export default function ClientesClient({
  uploadId,
  temp,
  areaFiltro,
  areaOptions,
  temporadas,
  fechaDesde: initialDesde,
  fechaHasta: initialHasta,
  isAdmin,
  expandedUserAreas,
}: {
  uploadId: string
  temp: string
  areaFiltro: string
  areaOptions: string[]
  temporadas: string[]
  fechaDesde: string
  fechaHasta: string
  isAdmin: boolean
  expandedUserAreas: string[] | null
}) {
  const router = useRouter()
  const supabase = createClient()
  
  const [fechaDesde, setFechaDesde] = useState(initialDesde)
  const [fechaHasta, setFechaHasta] = useState(initialHasta)
  const [clientes, setClientes] = useState<CRow[]>([])
  const [loading, setLoading] = useState(false)

  const B2C_AREAS = ['Web', 'Plataformas', 'Walk In']

  useEffect(() => {
    loadClientes()
  }, [uploadId, temp, areaFiltro, fechaDesde, fechaHasta])

  async function loadClientes() {
    setLoading(true)
    
    const areasReales = areaFiltro === 'B2C'
      ? (expandedUserAreas ? B2C_AREAS.filter(a => expandedUserAreas.includes(a)) : B2C_AREAS)
      : [areaFiltro]

    const { data: rawClientes } = await supabase
      .rpc('get_clientes_por_area_fechas', {
        p_upload_id: uploadId,
        p_temporada: temp,
        p_areas: areasReales,
        p_fecha_desde: fechaDesde,
        p_fecha_hasta: fechaHasta
      })

    setClientes((rawClientes ?? []) as CRow[])
    setLoading(false)
  }

  function handleFiltrar() {
    const params = new URLSearchParams()
    params.set('temp', temp)
    params.set('area', areaFiltro)
    params.set('desde', fechaDesde)
    params.set('hasta', fechaHasta)
    router.push(`/clientes?${params.toString()}`)
  }

  const totalVenta = clientes.reduce((s, r) => s + r.venta, 0)
  const totalGanancia = clientes.reduce((s, r) => s + r.ganancia, 0)
  const totalViajes = clientes.reduce((s, r) => s + r.viajes, 0)
  const totalQuotes = clientes.reduce((s, r) => s + r.quotes, 0)
  const totalCM = totalVenta > 0 ? totalGanancia / totalVenta : 0
  const totalConversion = totalQuotes > 0 ? totalViajes / totalQuotes : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Análisis Clientes</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Temporada {temp} · {areaFiltro}
          </p>
        </div>
        
        {/* Selector de temporada */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {temporadas.map(t => (
            <a key={t} href={`?temp=${t}&area=${areaFiltro}`} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
              background: temp === t ? 'var(--teal-600)' : 'var(--surface2)',
              color: temp === t ? '#fff' : 'var(--muted)',
              border: `1px solid ${temp === t ? 'var(--teal-600)' : 'var(--border)'}`,
            }}>{t}</a>
          ))}
        </div>
      </div>

      {/* Filtro de fechas */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Calendar size={16} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Rango de fechas</span>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
              Fecha desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
              Fecha hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          
          <button
            onClick={handleFiltrar}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: loading ? 'var(--surface2)' : 'var(--teal-600)',
              color: loading ? 'var(--muted)' : '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Cargando...' : 'Filtrar'}
          </button>
        </div>
      </div>

      {/* Selector de área */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {areaOptions.map(a => (
          <a key={a} href={`?temp=${temp}&area=${encodeURIComponent(a)}&desde=${fechaDesde}&hasta=${fechaHasta}`} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
            background: areaFiltro === a ? 'var(--surface2)' : 'transparent',
            color: areaFiltro === a ? 'var(--text)' : 'var(--muted)',
            border: `1px solid ${areaFiltro === a ? 'var(--teal-600)' : 'var(--border)'}`,
          }}>{a}</a>
        ))}
      </div>

      {/* Tabla de clientes */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {clientes.length} clientes · {areaFiltro} · {temp}
          </span>
        </div>
        
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            Cargando...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['#', 'Cliente', 'Viajes', 'Quotes', 'Conv %', 'Pax', 'Venta', 'Ganancia', 'CM'].map(h => (
                    <th key={h} style={{
                      padding: '10px 20px',
                      textAlign: h === 'Cliente' ? 'left' : 'right',
                      color: 'var(--muted)', fontWeight: 500, fontSize: 12,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                      No hay clientes en este rango de fechas
                    </td>
                  </tr>
                ) : (
                  <>
                    {clientes.map((r, i) => {
                      const cm = r.venta > 0 ? r.ganancia / r.venta : 0
                      const conv = r.quotes > 0 ? (r.viajes / r.quotes) * 100 : 0
                      return (
                        <tr key={i} style={{
                          borderTop: '1px solid var(--border)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                        }}>
                          <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{i + 1}</td>
                          <td style={{ padding: '10px 20px', color: 'var(--text)', fontWeight: 500 }}>{r.cliente}</td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{r.viajes}</td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.quotes}</td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                            <span style={{ color: conv >= 50 ? '#4ade80' : conv >= 30 ? '#fbbf24' : '#f87171' }}>
                              {conv.toFixed(0)}%
                            </span>
                          </td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.pax}</td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatUSD(r.venta)}</td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', color: r.ganancia < 0 ? '#f87171' : '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatUSD(r.ganancia)}</td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            <span style={{ color: cm >= 0.25 ? '#4ade80' : cm >= 0.18 ? '#fbbf24' : '#f87171' }}>
                              {(cm * 100).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    
                    {/* Total */}
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                      <td style={{ padding: '10px 20px' }}></td>
                      <td style={{ padding: '10px 20px', color: 'var(--text)', fontWeight: 700 }}>TOTAL</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{totalViajes}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{totalQuotes}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--teal-400)' }}>
                        {(totalConversion * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '10px 20px' }}></td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{formatUSD(totalVenta)}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4ade80' }}>{formatUSD(totalGanancia)}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--teal-400)' }}>
                        {(totalCM * 100).toFixed(1)}%
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
