'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Step = 'idle' | 'uploading-storage' | 'processing' | 'done'

interface UploadResult {
  success: boolean
  message?: string
  error?: string
  row_count?: { team_leader: number; salesforce: number; audit: number; temp2425: number }
  rows?: number
}

function UploadZone({
  label, sublabel, accept, apiRoute, steps, resultLabels,
}: {
  label: string
  sublabel: string
  accept: string
  apiRoute: string
  steps: string[]
  resultLabels?: (r: UploadResult) => { label: string; val: number }[]
}) {
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

  const uploading = step === 'uploading-storage' || step === 'processing'

  async function handleUpload() {
    if (!file) return
    setStep('uploading-storage')
    setResult(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sesión expirada')

      const storagePath = `uploads/${Date.now()}_${file.name}`
      const { error: storageErr } = await supabase.storage
        .from('excel-uploads').upload(storagePath, file, { upsert: true })
      if (storageErr) throw new Error(`Error subiendo: ${storageErr.message}`)

      setStep('processing')
      const res = await fetch(apiRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ storagePath, filename: file.name }),
      })
      const data = await res.json()
      setResult(data)
      await supabase.storage.from('excel-uploads').remove([storagePath])
    } catch (err: unknown) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Error desconocido' })
    } finally {
      setStep('done')
    }
  }

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>{label}</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>{sublabel}</p>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && document.getElementById(`file-input-${apiRoute}`)?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--teal-500)' : file ? 'var(--teal-700)' : 'var(--border)'}`,
          borderRadius: 12, padding: '32px 24px', textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          background: dragging ? 'rgba(20,184,166,0.05)' : 'transparent',
          transition: 'all 0.2s', opacity: uploading ? 0.6 : 1,
        }}
      >
        <input id={`file-input-${apiRoute}`} type="file" accept={accept} style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {file ? (
          <>
            <FileSpreadsheet size={32} style={{ color: 'var(--teal-400)', marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Click para cambiar</div>
          </>
        ) : (
          <>
            <Upload size={32} style={{ color: 'var(--muted)', marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>Arrastrá el archivo acá</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>o hacé click para seleccionar</div>
          </>
        )}
      </div>

      {file && !result?.success && (
        <button onClick={handleUpload} disabled={uploading} className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: '11px 24px', fontSize: 14 }}>
          {uploading
            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {step === 'uploading-storage' ? 'Subiendo...' : 'Procesando...'}</>
            : <><Upload size={15} /> Procesar</>
          }
        </button>
      )}

      {uploading && (
        <div style={{ marginTop: 12, background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < steps.length - 1 ? 6 : 0 }}>
              <Loader2 size={11} style={{ color: 'var(--teal-400)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div style={{
          marginTop: 12, borderRadius: 10, padding: '14px 16px',
          border: `1px solid ${result.success ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
          background: result.success ? 'rgba(20,83,45,0.2)' : 'rgba(69,10,10,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {result.success
              ? <CheckCircle2 size={16} style={{ color: '#4ade80' }} />
              : <AlertCircle size={16} style={{ color: '#f87171' }} />}
            <span style={{ fontWeight: 500, fontSize: 13, color: result.success ? '#4ade80' : '#f87171' }}>
              {result.success ? '¡Procesado correctamente!' : 'Error al procesar'}
            </span>
          </div>
          {result.success && resultLabels && (
            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              {resultLabels(result).map(item => (
                <div key={item.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '6px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>{item.val.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.label}</div>
                </div>
              ))}
            </div>
          )}
          {result.error && (
            <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{result.error}</div>
          )}
        </div>
      )}

      {result?.success && (
        <button onClick={() => { setFile(null); setResult(null); setStep('idle') }} className="btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 10, fontSize: 13 }}>
          <RefreshCw size={13} /> Subir otro
        </button>
      )}
    </div>
  )
}

export default function SubirPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Subir datos</h1>
        <p style={{ color: 'var(--muted)', marginTop: 6, fontSize: 13 }}>
          Los datos de TourPlan se sincronizan automáticamente. Usá estas opciones para cargas manuales.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <UploadZone
          label="Archivo Salesforce B2C"
          sublabel="Subí el archivo con los datos de Salesforce para B2C. Se asocia al último sync de TourPlan."
          accept=".xlsx,.xlsm,.xls"
          apiRoute="/api/upload-salesforce"
          steps={['Subiendo archivo...', 'Procesando Salesforce...', 'Actualizando base de datos...']}
          resultLabels={r => [{ label: 'Files SF', val: r.rows ?? 0 }]}
        />

        <UploadZone
          label="Excel completo (fallback)"
          sublabel="Solo si TourPlan no está disponible. Reemplaza todos los datos con el Excel completo."
          accept=".xlsx,.xlsm,.xls"
          apiRoute="/api/upload"
          steps={['Subiendo archivo...', 'Parseando Team Leader...', 'Procesando Audit y SF...', 'Actualizando base de datos...']}
          resultLabels={r => r.row_count ? [
            { label: 'Team Leader', val: r.row_count.team_leader },
            { label: 'Salesforce', val: r.row_count.salesforce },
            { label: 'Audit', val: r.row_count.audit },
          ] : []}
        />
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
