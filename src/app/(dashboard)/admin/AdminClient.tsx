'use client'

import { useState } from 'react'
import { Settings, Plus, Trash2, Edit2, Check, X } from 'lucide-react'

const AREAS_DISPONIBLES = ['B2C', 'Aliwen', 'DMC FITS', 'Grupos DMC', 'Booknow']

type UserRow = {
  id: string
  full_name: string | null
  role: string
  areas: string[] | null
  created_at: string
}

export default function AdminClient({ users: initialUsers, currentUserId }: {
  users: UserRow[]
  currentUserId: string
}) {
  const [users, setUsers] = useState(initialUsers)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Form crear usuario
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState<'comercial' | 'admin'>('comercial')
  const [newAreas, setNewAreas] = useState<string[]>([])

  // Form editar
  const [editAreas, setEditAreas] = useState<string[]>([])
  const [editRole, setEditRole] = useState<'comercial' | 'admin'>('comercial')

  function toggleArea(area: string, current: string[], setter: (a: string[]) => void) {
    setter(current.includes(area) ? current.filter(a => a !== area) : [...current, area])
  }

  async function handleCreate() {
    if (!newEmail || !newPass || !newName) {
      setMsg({ type: 'err', text: 'Email, nombre y contraseña son obligatorios' })
      return
    }
    if (newRole === 'comercial' && newAreas.length === 0) {
      setMsg({ type: 'err', text: 'Asigná al menos un área al usuario comercial' })
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPass, full_name: newName, role: newRole, areas: newAreas }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear usuario')
      setUsers(prev => [...prev, data.user])
      setMsg({ type: 'ok', text: `Usuario ${newEmail} creado exitosamente` })
      setShowCreate(false)
      setNewEmail(''); setNewName(''); setNewPass(''); setNewAreas([]); setNewRole('comercial')
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Error desconocido' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar usuario ${name}? Esta acción no se puede deshacer.`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      })
      if (!res.ok) throw new Error('Error al eliminar')
      setUsers(prev => prev.filter(u => u.id !== id))
      setMsg({ type: 'ok', text: `Usuario eliminado` })
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Error' })
    } finally {
      setLoading(false)
    }
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id)
    setEditAreas(u.areas ?? [])
    setEditRole((u.role as 'comercial' | 'admin') ?? 'comercial')
  }

  async function handleSaveEdit(id: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, role: editRole, areas: editAreas }),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: editRole, areas: editAreas } : u))
      setEditingId(null)
      setMsg({ type: 'ok', text: 'Usuario actualizado' })
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>


      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
        </div>
        <button onClick={() => { setShowCreate(true); setMsg(null) }} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: 'var(--teal-600)', color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          <Plus size={15} /> Nuevo usuario
        </button>
      </div>

      {/* Mensaje */}
      {msg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 13,
          background: msg.type === 'ok' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          color: msg.type === 'ok' ? '#4ade80' : '#f87171',
          border: `1px solid ${msg.type === 'ok' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Form crear usuario */}
      {showCreate && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>Crear usuario</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Nombre completo', value: newName, setter: setNewName, type: 'text', placeholder: 'Ej: Juliana Mayer' },
              { label: 'Email', value: newEmail, setter: setNewEmail, type: 'email', placeholder: 'usuario@sayhueque.com' },
              { label: 'Contraseña', value: newPass, setter: setNewPass, type: 'text', placeholder: 'Mínimo 8 caracteres' },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={f.value}
                  onChange={e => f.setter(e.target.value)}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Rol */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Rol</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['comercial', 'admin'] as const).map(r => (
                <button key={r} onClick={() => setNewRole(r)} style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  background: newRole === r ? 'var(--teal-600)' : 'var(--surface2)',
                  color: newRole === r ? '#fff' : 'var(--muted)',
                  border: `1px solid ${newRole === r ? 'var(--teal-600)' : 'var(--border)'}`,
                  textTransform: 'capitalize',
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* Áreas — solo si es comercial */}
          {newRole === 'comercial' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                Áreas asignadas <span style={{ color: '#f87171' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {AREAS_DISPONIBLES.map(a => (
                  <button key={a} onClick={() => toggleArea(a, newAreas, setNewAreas)} style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    background: newAreas.includes(a) ? 'rgba(13,148,136,0.2)' : 'var(--surface2)',
                    color: newAreas.includes(a) ? 'var(--teal-400)' : 'var(--muted)',
                    border: `1px solid ${newAreas.includes(a) ? 'var(--teal-600)' : 'var(--border)'}`,
                  }}>{a}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={loading} style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'var(--teal-600)', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}>{loading ? 'Creando...' : 'Crear usuario'}</button>
            <button onClick={() => setShowCreate(false)} style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13,
              background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabla usuarios */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={15} style={{ color: 'var(--teal-400)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{users.length} usuarios</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {['Nombre', 'Rol', 'Áreas asignadas', 'Acciones'].map(h => (
                <th key={h} style={{
                  padding: '10px 20px', textAlign: 'left',
                  color: 'var(--muted)', fontWeight: 500, fontSize: 12,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{
                borderTop: '1px solid var(--border)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}>
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>{u.full_name ?? '—'}</div>
                  {u.id === currentUserId && (
                    <span style={{ fontSize: 10, color: 'var(--teal-400)' }}>Vos</span>
                  )}
                </td>

                {/* Rol — editable */}
                <td style={{ padding: '12px 20px' }}>
                  {editingId === u.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['comercial', 'admin'] as const).map(r => (
                        <button key={r} onClick={() => setEditRole(r)} style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                          background: editRole === r ? 'var(--teal-600)' : 'var(--surface2)',
                          color: editRole === r ? '#fff' : 'var(--muted)',
                          border: `1px solid ${editRole === r ? 'var(--teal-600)' : 'var(--border)'}`,
                        }}>{r}</button>
                      ))}
                    </div>
                  ) : (
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 500,
                      background: u.role === 'admin' ? 'rgba(13,148,136,0.15)' : 'rgba(139,92,246,0.15)',
                      color: u.role === 'admin' ? 'var(--teal-400)' : '#a78bfa',
                    }}>{u.role}</span>
                  )}
                </td>

                {/* Áreas — editable */}
                <td style={{ padding: '12px 20px' }}>
                  {editingId === u.id ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {AREAS_DISPONIBLES.map(a => (
                        <button key={a} onClick={() => toggleArea(a, editAreas, setEditAreas)} style={{
                          padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                          background: editAreas.includes(a) ? 'rgba(13,148,136,0.2)' : 'var(--surface2)',
                          color: editAreas.includes(a) ? 'var(--teal-400)' : 'var(--muted)',
                          border: `1px solid ${editAreas.includes(a) ? 'var(--teal-600)' : 'var(--border)'}`,
                        }}>{a}</button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {u.role === 'admin' ? (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Todas las áreas</span>
                      ) : (u.areas ?? []).length === 0 ? (
                        <span style={{ fontSize: 11, color: '#f87171' }}>Sin áreas asignadas</span>
                      ) : (u.areas ?? []).map(a => (
                        <span key={a} style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 5,
                          background: 'rgba(13,148,136,0.1)', color: 'var(--teal-400)',
                          border: '1px solid rgba(13,148,136,0.2)',
                        }}>{a}</span>
                      ))}
                    </div>
                  )}
                </td>

                {/* Acciones */}
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {editingId === u.id ? (
                      <>
                        <button onClick={() => handleSaveEdit(u.id)} disabled={loading} style={{
                          padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                          background: 'rgba(74,222,128,0.15)', color: '#4ade80',
                          border: '1px solid rgba(74,222,128,0.2)', display: 'flex', alignItems: 'center', gap: 4,
                        }}><Check size={12} /> Guardar</button>
                        <button onClick={() => setEditingId(null)} style={{
                          padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                          background: 'var(--surface2)', color: 'var(--muted)',
                          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4,
                        }}><X size={12} /> Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(u)} style={{
                          padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                          background: 'var(--surface2)', color: 'var(--muted)',
                          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4,
                        }}><Edit2 size={12} /> Editar</button>
                        {u.id !== currentUserId && (
                          <button onClick={() => handleDelete(u.id, u.full_name ?? u.id)} style={{
                            padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                            background: 'rgba(248,113,113,0.1)', color: '#f87171',
                            border: '1px solid rgba(248,113,113,0.2)', display: 'flex', alignItems: 'center', gap: 4,
                          }}><Trash2 size={12} /> Eliminar</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
