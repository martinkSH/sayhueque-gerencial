'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, Calendar, TrendingUp,
  FileSearch, Users, Upload, Settings, LogOut,
  BarChart3, UserCheck, Target
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard',       label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/confirmaciones',  label: 'Confirmaciones',  icon: CheckSquare },
  { href: '/temporada',       label: 'Temporada',       icon: Calendar },
  { href: '/comparativo',     label: 'Comparativo',     icon: TrendingUp },
  { href: '/operadores',      label: 'Operadores',      icon: FileSearch },
  { href: '/vendedores',      label: 'Vendedores',      icon: UserCheck },
  { href: '/clientes',        label: 'Clientes',        icon: Users },
  { href: '/contribucion',    label: 'Contrib. MG',     icon: BarChart3 },
  { href: '/detalle-cm',      label: 'Detalle CM',      icon: Target },
]

interface Props {
  user: { email: string; name: string; role: string; areas: string[] }
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = user.role === 'admin'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const areaLabel = !isAdmin && user.areas.length > 0 ? user.areas.join(', ') : null

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 8, marginBottom: 2,
        fontSize: 13, fontWeight: active ? 500 : 400,
        color: active ? 'var(--teal-400)' : 'var(--text-dim)',
        background: active ? 'rgba(20, 184, 166, 0.08)' : 'transparent',
        textDecoration: 'none', transition: 'all 0.15s',
      }}>
        <Icon size={16} style={{ opacity: active ? 1 : 0.7 }} />
        {label}
      </Link>
    )
  }

  return (
    <aside style={{
      width: '240px', minWidth: '240px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
    }}>
      {/* Logo ATLAS CORE */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Logo icono */}
          <div style={{
            width: 36, 
            height: 36, 
            borderRadius: 8, 
            background: 'linear-gradient(135deg, #3B82F6 0%, #14B8A6 100%)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontWeight: 700, 
            fontSize: 18, 
            color: 'white',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
          }}>
            A
          </div>
          
          {/* Texto */}
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              marginBottom: 2,
            }}>
              <span style={{ 
                fontWeight: 700, 
                fontSize: 14, 
                color: '#3B82F6',
                letterSpacing: '-0.02em',
              }}>
                ATLAS
              </span>
              <span style={{ 
                color: 'var(--border)', 
                fontSize: 12,
              }}>
                |
              </span>
              <span style={{ 
                fontWeight: 600, 
                fontSize: 14, 
                color: 'var(--teal-400)',
              }}>
                CORE
              </span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--border)', letterSpacing: '0.02em' }}>
              dev. Martin Kravez
            </div>
          </div>
        </div>
      </div>

      {/* User info */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
          {user.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user.email}</div>
        {areaLabel && (
          <div style={{
            marginTop: 8, padding: '4px 8px', borderRadius: 6,
            fontSize: 10, background: 'rgba(20, 184, 166, 0.1)',
            color: 'var(--teal-400)', border: '1px solid rgba(20, 184, 166, 0.2)',
            display: 'inline-block',
          }}>
            {areaLabel}
          </div>
        )}
      </div>

      {/* REPORTES */}
      <div style={{
        flex: 1, padding: '12px 16px', overflowY: 'auto',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--muted)',
          marginBottom: 8, paddingLeft: 4, letterSpacing: '0.05em',
        }}>
          REPORTES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {navItems.map(item => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      </div>

      {/* SISTEMA */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--muted)',
          marginBottom: 8, paddingLeft: 4, letterSpacing: '0.05em',
        }}>
          SISTEMA
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href="/subir" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8,
            fontSize: 13, fontWeight: pathname === '/subir' ? 500 : 400,
            color: pathname === '/subir' ? 'var(--teal-400)' : 'var(--text-dim)',
            background: pathname === '/subir' ? 'rgba(20, 184, 166, 0.08)' : 'transparent',
            textDecoration: 'none', transition: 'all 0.15s',
          }}>
            <Upload size={16} style={{ opacity: pathname === '/subir' ? 1 : 0.7 }} />
            Subir Excel
          </Link>

          {isAdmin && (
            <Link href="/admin" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              fontSize: 13, fontWeight: pathname.startsWith('/admin') ? 500 : 400,
              color: pathname.startsWith('/admin') ? 'var(--teal-400)' : 'var(--text-dim)',
              background: pathname.startsWith('/admin') ? 'rgba(20, 184, 166, 0.08)' : 'transparent',
              textDecoration: 'none', transition: 'all 0.15s',
            }}>
              <Settings size={16} style={{ opacity: pathname.startsWith('/admin') ? 1 : 0.7 }} />
              Admin
            </Link>
          )}

          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8, marginTop: 4,
            fontSize: 13, color: 'var(--text-dim)',
            background: 'transparent', border: 'none',
            cursor: 'pointer', textAlign: 'left', width: '100%',
            transition: 'all 0.15s',
          }}>
            <LogOut size={16} style={{ opacity: 0.7 }} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  )
}
