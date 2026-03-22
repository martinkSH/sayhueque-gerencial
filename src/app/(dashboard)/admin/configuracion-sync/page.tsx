'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Save, AlertCircle, CheckCircle2 } from 'lucide-react'

type SyncConfig = {
  id: string
  fecha_desde: string
  fecha_hasta: string
  updated_at: string
  updated_by: string | null
}

export default function ConfiguracionSyncPage() {
  const supabase = createClient()
  const [config, setConfig] = useState<SyncConfig | null>(null)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [userNombre, setUserNombre] = useState('')

  useEffect(() => {
    loadConfig()
    loadUser()
  }, [])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.user_metadata?.full_name) {
      setUserNombre(user.user_metadata.full_name)
    }
  }

  async function loadConfig() {
    const { data, error } = await supabase
      .from('config_sync_tourplan')
      .select('*')
      .single()

    if (error) {
      console.error('Error cargando config:', error)
      return
    }

    if (data) {
      setConfig(data)
      setFechaDesde(data.fecha_desde)
      setFechaHasta(data.fecha_hasta)
    }
  }

  async function handleSave() {
    if (!fechaDesde || !fechaHasta) {
      setMessage({ type: 'error', text: 'Ambas fechas son obligatorias' })
      return
    }

    if (new Date(fechaDesde) >= new Date(fechaHasta)) {
      setMessage({ type: 'error', text: 'La fecha desde debe ser anterior a la fecha hasta' })
      return
    }

    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('config_sync_tourplan')
      .update({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        updated_by: userNombre || 'Admin',
      })
      .eq('id', config?.id)

    if (error) {
      setMessage({ type: 'error', text: `Error al guardar: ${error.message}` })
    } else {
      setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
      loadConfig()
    }

    setSaving(false)
  }

  const diasRango = config ? Math.ceil((new Date(fechaHasta).getTime() - new Date(fechaDesde).getTime()) / (1000 * 60 * 60 * 24)) : 0

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Configuración de Sync TourPlan
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
          Define el rango de fechas que se traerá de TourPlan en cada sincronización
        </p>
      </div>

      {/* Card de configuración */}
      <div className="card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <Calendar size={20} style={{ color: 'var(--teal-400)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Rango de fechas
          </h2>
        </div>

        <div style={{ display: 'grid', gap: 20, marginBottom: 24 }}>
          {/* Fecha desde */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>
              Fecha desde (Travel Date ≥)
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>
              Fecha hasta (Travel Date ≤)
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Info del rango */}
        {fechaDesde && fechaHasta && (
          <div style={{
            padding: 16,
            borderRadius: 8,
            background: 'rgba(20,184,166,0.08)',
            border: '1px solid rgba(20,184,166,0.2)',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
              <strong>Rango configurado:</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Desde <strong style={{ color: 'var(--teal-400)', fontFamily: 'var(--font-mono)' }}>
                {new Date(fechaDesde + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </strong> hasta <strong style={{ color: 'var(--teal-400)', fontFamily: 'var(--font-mono)' }}>
                {new Date(fechaHasta + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              ({diasRango.toLocaleString('es-AR')} días)
            </div>
          </div>
        )}

        {/* Mensajes */}
        {message && (
          <div style={{
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: message.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${message.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: message.type === 'success' ? '#4ade80' : '#f87171',
          }}>
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span style={{ fontSize: 13 }}>{message.text}</span>
          </div>
        )}

        {/* Botón guardar */}
        <button
          onClick={handleSave}
          disabled={saving || !fechaDesde || !fechaHasta}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: saving ? 'var(--surface2)' : 'var(--teal-600)',
            color: saving ? 'var(--muted)' : '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>

      {/* Última actualización */}
      {config && (
        <div style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 8,
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Última actualización:{' '}
            <strong style={{ color: 'var(--text)' }}>
              {new Date(config.updated_at).toLocaleString('es-AR')}
            </strong>
            {config.updated_by && (
              <> por <strong style={{ color: 'var(--text)' }}>{config.updated_by}</strong></>
            )}
          </div>
        </div>
      )}

      {/* Info adicional */}
      <div style={{
        marginTop: 32,
        padding: 20,
        borderRadius: 8,
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertCircle size={18} style={{ color: '#fbbf24', marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Importante
            </div>
            <ul style={{ fontSize: 13, color: 'var(--muted)', margin: 0, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>Los cambios se aplicarán en la próxima sincronización con TourPlan</li>
              <li style={{ marginBottom: 4 }}>Se recomienda un rango de 3-4 años para mantener un buen rendimiento</li>
              <li>La sincronización puede tardar más tiempo con rangos muy amplios</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
