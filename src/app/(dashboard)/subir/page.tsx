'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface UploadResult {
  success: boolean
  message?: string
  error?: string
  row_count?: { team_leader: number; salesforce: number; audit: number; temp2425: number }
}

type Step = 'idle' | 'uploading-storage' | 'processing' | 'done'

export default function SubirPage() {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)

  const handleFile = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xlsm|xls)$/i)) {
      setResult({ success: false, error: 'El archivo debe ser .xlsx o .xlsm' })
      return
    }
    setFile(f)
    setResult(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  async function handleUpload() {
    if (!file) return
    setStep('uploading-storage')
    setResult(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sesión expirada, volvé a loguearte')

      // 1. Subir archivo directo a Supabase Storage (sin pasar por Vercel)
      const storagePath = `uploads/${Date.now()}_${file.name}`
      const { error: storageErr } = await supabase.storage
        .from('excel-uploads')
        .upload(storagePath, file, { upsert: true })

      if (storageErr) throw new Error(`Error subiendo archivo: ${storageErr.message}`)

      // 2. Decirle a la API que procese el archivo desde Storage
      setStep('processing')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storagePath, filename: file.name }),
      })

      const data = await res.json()
      setResult(data)

      // 3. Borrar el archivo de Storage (ya procesado)
      await supabase.storage.from('excel-uploads').remove([storagePath])

    } catch (err: unknown) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Error desconocido' })
    } finally {
      setStep('done')
    }
  }

  const uploading = step === 'uploading-storage' || step === 'processing'

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Subir Excel</h1>
        <p style={{ color: 'var(--muted)', marginTop: 6, fontSize: 14 }}>
          Subí el archivo .xlsm actualizado y el dashboard se actualiza automáticamente.
        </p>
      </div>

      <div style={{
        background: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.25)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 24,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <Info size={16} style={{ color: 'var(--teal-400)', marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>¿Qué se procesa?</strong>{' '}
          Reporte Team Leader · Files B2C SaleForce · Bookings Audit · Temp 24/25.<br />
          Los datos anteriores se <strong style={{ color: 'var(--text)' }}>reemplazan completamente</strong> con cada subida.
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && document.getElementById('file-input')?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--teal-500)' : file ? 'var(--teal-700)' : 'var(--border)'}`,
          borderRadius: 14, padding: '48px 24px', textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          background: dragging ? 'rgba(20, 184, 166, 0.05)' : file ? 'rgba(20, 184, 166, 0.03)' : 'var(--surface)',
          transition: 'all 0.2s', opacity: uploading ? 0.6 : 1,
        }}
      >
        <input id="file-input" type="file" accept=".xlsx,.xlsm,.xls" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {file ? (
          <>
            <FileSpreadsheet size={40} style={{ color: 'var(--teal-400)', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{file.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Hacé click para cambiar</div>
          </>
        ) : (
          <>
            <Upload size={40} style={{ color: 'var(--muted)', marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Arrastrá el Excel acá</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>o hacé click para seleccionar · .xlsx · .xlsm · .xls</div>
          </>
        )}
      </div>

      {file && !result?.success && (
        <button onClick={handleUpload} disabled={uploading} className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 16, padding: '12px 24px', fontSize: 15 }}>
          {uploading
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {step === 'uploading-storage' ? 'Subiendo archivo…' : 'Procesando datos…'}</>
            : <><Upload size={16} /> Procesar y actualizar dashboard</>
          }
        </button>
      )}

      {uploading && (
        <div style={{ marginTop: 16 }} className="card">
          <div style={{ padding: '16px 20px' }}>
            {[
              { label: 'Subiendo archivo a storage', done: step === 'processing', active: step === 'uploading-storage' },
              { label: 'Parseando Reporte Team Leader', done: false, active: step === 'processing' },
              { label: 'Procesando Bookings Audit y SF', done: false, active: step === 'processing' },
              { label: 'Actualizando base de datos', done: false, active: step === 'processing' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {s.done
                  ? <CheckCircle2 size={12} style={{ color: '#4ade80' }} />
                  : <Loader2 size={12} style={{ color: s.active ? 'var(--teal-400)' : 'var(--muted)', animation: s.active ? 'spin 1s linear infinite' : 'none' }} />
                }
                <span style={{ fontSize: 13, color: s.active ? 'var(--text)' : s.done ? '#4ade80' : 'var(--muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div style={{
          marginTop: 16, borderRadius: 12, padding: '16px 20px',
          border: `1px solid ${result.success ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`,
          background: result.success ? 'rgba(20, 83, 45, 0.2)' : 'rgba(69, 10, 10, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: result.success ? 12 : 0 }}>
            {result.success ? <CheckCircle2 size={18} style={{ color: '#4ade80' }} /> : <AlertCircle size={18} style={{ color: '#f87171' }} />}
            <span style={{ fontWeight: 500, fontSize: 14, color: result.success ? '#4ade80' : '#f87171' }}>
              {result.success ? '¡Listo! Dashboard actualizado' : 'Error al procesar'}
            </span>
          </div>
          {result.success && result.row_count && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
              {[
                { label: 'Team Leader', val: result.row_count.team_leader },
                { label: 'Salesforce', val: result.row_count.salesforce },
                { label: 'Audit', val: result.row_count.audit },
                { label: 'Temp 24/25', val: result.row_count.temp2425 },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>{item.val.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>filas</div>
                </div>
              ))}
            </div>
          )}
          {result.error && (
            <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{result.error}</div>
          )}
        </div>
      )}

      {result?.success && (
        <button onClick={() => { setFile(null); setResult(null); setStep('idle') }} className="btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
          Subir otro archivo
        </button>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
