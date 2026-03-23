'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, FileText } from 'lucide-react'

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type FilaConfirmado = {
  area: string
  temporada: string
  count: number
  venta: number
}

type FileDetalle = {
  file_code: string
  booking_name: string | null
  cliente: string | null
  vendedor: string | null
  date_of_change: string
  venta: number
}

export default function ConfirmacionesClient({
  filas,
  totalCount,
  totalVenta,
  dias,
  uploadId,
}: {
  filas: FilaConfirmado[]
  totalCount: number
  totalVenta: number
  dias: number
  uploadId: string
}) {
  const [modalData, setModalData] = useState<{ area: string; temporada: string; files: FileDetalle[] } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRowClick(area: string, temporada: string) {
    setLoading(true)
    const supabase = createClient()

    const since = new Date()
    since.setDate(since.getDate() - dias)

    // Traer detalle de files confirmados
    const { data } = await supabase
      .from('v_confirmados_qu_ok')
      .select('file_code, booking_name, area, temporada, date_of_change, venta, operador')
      .eq('upload_id', uploadId)
      .eq('rn', 1)
      .eq('area', area)
      .eq('temporada', temporada)
      .gte('date_of_change', since.toISOString())
      .order('date_of_change', { ascending: false })

    if (!data) {
      setLoading(false)
      return
    }

    // Traer info adicional de team_leader_rows
    const fileCodes = data.map(f => f.file_code)
    const { data: tlData } = await supabase
      .from('team_leader_rows')
      .select('file_code, booking_name, cliente, vendedor')
      .eq('upload_id', uploadId)
      .in('file_code', fileCodes)

    const tlMap = new Map(tlData?.map(t => [t.file_code, t]) || [])

    const files: FileDetalle[] = data.map(f => {
      const tl = tlMap.get(f.file_code)
      return {
        file_code: f.file_code,
        booking_name: tl?.booking_name || null,
        cliente: tl?.cliente || null,
        vendedor: f.operador || tl?.vendedor || null,
        date_of_change: f.date_of_change,
        venta: f.venta || 0,
      }
    })

    setModalData({ area, temporada, files })
    setLoading(false)
  }

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Área', 'Temporada', 'Confirmados', 'Venta Total (USD)'].map(h => (
                <th key={h} style={{
                  padding: '10px 20px',
                  textAlign: h === 'Área' || h === 'Temporada' ? 'left' : 'right',
                  color: 'var(--muted)', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                  Sin confirmaciones en los últimos {dias} días
                </td>
              </tr>
            ) : (
              <>
                {filas.map((r, i) => (
                  <tr
                    key={`${r.area}-${r.temporada}`}
                    onClick={() => handleRowClick(r.area, r.temporada)}
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(20,184,166,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                  >
                    <td style={{ padding: '10px 20px', color: 'var(--text)' }}>{r.area}</td>
                    <td style={{ padding: '10px 20px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6,
                        background: 'rgba(13,148,136,0.15)', color: 'var(--teal-400)', fontWeight: 500,
                      }}>{r.temporada}</span>
                    </td>
                    <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{r.count}</td>
                    <td style={{ padding: '10px 20px', textAlign: 'right', color: r.venta < 0 ? '#f87171' : '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatUSD(r.venta)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                  <td style={{ padding: '10px 20px', color: 'var(--text)', fontWeight: 700 }} colSpan={2}>TOTAL EMPRESA</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{totalCount}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', color: '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatUSD(totalVenta)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalData && (
        <div
          onClick={() => setModalData(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 12, maxWidth: 900, width: '100%',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              border: '1px solid var(--border)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  Detalle de Confirmaciones
                </h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  {modalData.area} · {modalData.temporada} · {modalData.files.length} files
                </p>
              </div>
              <button
                onClick={() => setModalData(null)}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex',
                }}
              >
                <X size={18} style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            {/* Content */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface2)', zIndex: 1 }}>
                  <tr>
                    {['File', 'Booking Name', 'Cliente', 'Vendedor', 'Fecha Conf.', 'Venta'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left', color: 'var(--muted)',
                        fontWeight: 500, fontSize: 12, borderBottom: '1px solid var(--border)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modalData.files.map((f, i) => (
                    <tr key={f.file_code} style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--teal-400)' }}>
                          {f.file_code}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.booking_name || '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.cliente || '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.vendedor || '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {new Date(f.date_of_change).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: f.venta < 0 ? '#f87171' : '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        {formatUSD(f.venta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={14} style={{ color: 'var(--muted)' }} />
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {modalData.files.length} confirmaciones
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>
                {formatUSD(modalData.files.reduce((s, f) => s + f.venta, 0))}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ color: 'var(--text)', fontSize: 14 }}>Cargando...</div>
        </div>
      )}
    </>
  )
}
