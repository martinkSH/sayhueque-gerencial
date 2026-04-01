'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Credenciales incorrectas')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#0f172a',
    }}>
      {/* Lado izquierdo - Branding */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px',
        color: 'white',
      }}>
        {/* Logo */}
        <div>
          <svg width="180" height="42" viewBox="0 0 180 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="28" fontFamily="Inter, -apple-system, sans-serif" fontSize="24" fontWeight="700" fill="#3B82F6" letterSpacing="-0.02em">
              ATLAS
            </text>
            <line x1="88" y1="8" x2="88" y2="32" stroke="#64748B" strokeWidth="2"/>
            <text x="98" y="28" fontFamily="Inter, -apple-system, sans-serif" fontSize="24" fontWeight="600" fill="#14B8A6" letterSpacing="-0.01em">
              CORE
            </text>
          </svg>
        </div>

        {/* Texto central */}
        <div style={{ maxWidth: 480 }}>
          <h1 style={{
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 24,
            background: 'linear-gradient(135deg, #3B82F6 0%, #14B8A6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Inteligencia de negocio en tiempo real.
          </h1>
          <p style={{
            fontSize: 18,
            color: '#94a3b8',
            lineHeight: 1.6,
          }}>
            Visualizá tus operaciones, analizá tendencias y tomá decisiones estratégicas con datos actualizados de TourPlan.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          fontSize: 13,
          color: '#64748b',
        }}>
          powered by ATLAS · 2026
        </div>
      </div>

      {/* Lado derecho - Formulario */}
      <div style={{
        width: 480,
        background: '#1e293b',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{ marginBottom: 48 }}>
          <h2 style={{
            fontSize: 28,
            fontWeight: 600,
            color: 'white',
            marginBottom: 8,
          }}>
            Bienvenido
          </h2>
          <p style={{
            fontSize: 15,
            color: '#94a3b8',
          }}>
            Ingresa para ver el dashboard gerencial
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Email */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#cbd5e1',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guardista@sayhueque.com"
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 8,
                border: '1px solid #334155',
                background: '#0f172a',
                color: 'white',
                fontSize: 15,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#14B8A6'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          {/* Contraseña */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#cbd5e1',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  paddingRight: 48,
                  borderRadius: 8,
                  border: '1px solid #334155',
                  background: '#0f172a',
                  color: 'white',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#14B8A6'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? (
                  <EyeOff size={20} style={{ color: '#64748b' }} />
                ) : (
                  <Eye size={20} style={{ color: '#64748b' }} />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: 14,
            }}>
              {error}
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#64748b' : 'linear-gradient(135deg, #3B82F6 0%, #14B8A6 100%)',
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
              }
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          {/* Links auxiliares */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            color: '#94a3b8',
          }}>
            <a href="#" style={{ color: '#14B8A6', textDecoration: 'none' }}>
              Acceso restringido
            </a>
            <a href="#" style={{ color: '#94a3b8', textDecoration: 'none' }}>
              Soporte
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
