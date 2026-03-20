'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, Users, AlertCircle, CheckCircle2 } from 'lucide-react'

type DeptoVirtual = {
  id: string
  departamento_nombre: string
  activo: boolean
  vendedores: string[]
}

export default function ConfigDeptosVirtuales() {
  const supabase = createClient()
  const [deptos, setDeptos] = useState<DeptoVirtual[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadDeptos()
  }, [])

  const loadDeptos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('config_departamentos_virtuales')
      .select('*')
      .order('departamento_nombre')
    
    setDeptos(data || [])
    setLoading(false)
  }

  const toggleActivo = async (id: string, activo: boolean) => {
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('config_departamentos_virtuales')
      .update({ activo: !activo })
      .eq('id', id)

    if (error) {
      setMessage({ type: 'error', text: 'Error al actualizar: ' + error.message })
    } else {
      setMessage({ 
        type: 'success', 
        text: `Departamento ${!activo ? 'activado' : 'desactivado'}. Ejecutá un sync de TourPlan para aplicar los cambios.` 
      })
      loadDeptos()
    }

    setSaving(false)
  }

  const updateVendedores = async (id: string, vendedores: string[]) => {
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('config_departamentos_virtuales')
      .update({ vendedores })
      .eq('id', id)

    if (error) {
      setMessage({ type: 'error', text: 'Error al actualizar vendedores: ' + error.message })
    } else {
      setMessage({ 
        type: 'success', 
        text: 'Vendedores actualizados. Ejecutá un sync de TourPlan para aplicar los cambios.' 
      })
      loadDeptos()
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ color: 'var(--muted)' }}>Cargando configuración...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>
      
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Settings size={24} style={{ color: 'var(--teal-400)' }} />
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Departamentos Virtuales
          </h1>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          Los departamentos virtuales agrupan viajes de vendedores específicos dentro de cada área.
          Por ejemplo, <strong>Craft</strong> aparecerá como departamento en Aliwen, Grupos DMC, etc.
          <br />
          Después de modificar la configuración, ejecutá un <strong>Sync de TourPlan</strong> para aplicar los cambios.
        </p>
      </div>

      {message && (
        <div style={{
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${message.type === 'success' ? '#4ade80' : '#f87171'}`,
          background: message.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          {message.type === 'success' ? (
            <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
          ) : (
            <AlertCircle size={18} style={{ color: '#f87171' }} />
          )}
          <span style={{ color: 'var(--text)', fontSize: 14 }}>{message.text}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {deptos.map(depto => (
          <DeptoCard
            key={depto.id}
            depto={depto}
            onToggle={() => toggleActivo(depto.id, depto.activo)}
            onUpdateVendedores={(v) => updateVendedores(depto.id, v)}
            saving={saving}
          />
        ))}
      </div>

      {deptos.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            No hay departamentos virtuales configurados
          </p>
        </div>
      )}
    </div>
  )
}

function DeptoCard({ depto, onToggle, onUpdateVendedores, saving }: {
  depto: DeptoVirtual
  onToggle: () => void
  onUpdateVendedores: (vendedores: string[]) => void
  saving: boolean
}) {
  const [editVend, setEditVend] = useState(false)
  const [vend, setVend] = useState(depto.vendedores.join('\n'))

  return (
    <div className="card" style={{
      padding: 20,
      border: depto.activo ? '1px solid var(--teal-600)' : '1px solid var(--border)',
      background: depto.activo ? 'rgba(20,184,166,0.04)' : 'var(--surface)'
    }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{depto.departamento_nombre}</h3>
          {depto.activo && (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontWeight: 600 }}>ACTIVO</span>
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{depto.activo ? 'Desactivar' : 'Activar'}</span>
          <div onClick={onToggle} style={{
            width: 44, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
            background: depto.activo ? 'var(--teal-600)' : 'var(--surface2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', padding: '0 2px'
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s',
              transform: depto.activo ? 'translateX(20px)' : 'translateX(0)'
            }} />
          </div>
        </label>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Users size={16} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Vendedores</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>({depto.vendedores.length})</span>
        </div>

        {!editVend ? (
          <div>
            <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
              {depto.vendedores.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {depto.vendedores.map((v, i) => <li key={i} style={{ marginBottom: 4 }}>{v}</li>)}
                </ul>
              ) : (
                <span style={{ color: 'var(--muted)' }}>Sin vendedores</span>
              )}
            </div>
            <button onClick={() => setEditVend(true)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
              Editar vendedores
            </button>
          </div>
        ) : (
          <div>
            <textarea value={vend} onChange={(e) => setVend(e.target.value)} placeholder="Un vendedor por línea&#10;Ej:&#10;Alina Dilber&#10;Ana Laura Grandinetti" rows={5}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, resize: 'vertical', marginBottom: 8, fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onUpdateVendedores(vend.split('\n').map(v => v.trim()).filter(Boolean)); setEditVend(false) }} disabled={saving}
                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--teal-600)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Guardar</button>
              <button onClick={() => { setVend(depto.vendedores.join('\n')); setEditVend(false) }}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
