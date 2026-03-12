'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, Calendar, TrendingUp,
  FileSearch, Users, Upload, Settings, LogOut,
  BarChart3, UserCheck
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard',       label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/confirmaciones',  label: 'Confirmaciones',  icon: CheckSquare },
  { href: '/temporada',       label: 'Temporada',       icon: Calendar },
  { href: '/comparativo',     label: 'Comparativo',     icon: TrendingUp },
  { href: '/web-vs-sf',       label: 'Web vs SF',       icon: FileSearch },
  { href: '/vendedores',      label: 'Vendedores',      icon: UserCheck },
  { href: '/clientes',        label: 'Clientes',        icon: Users },
  { href: '/contribucion',    label: 'Contrib. MG',     icon: BarChart3 },
]

const bottomItems = [
  { href: '/subir',   label: 'Subir Excel',  icon: Upload },
  { href: '/admin',   label: 'Admin',        icon: Settings },
]

interface Props {
  user: { email: string; name: string; role: string }
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside style={{
      width: '240px', minWidth: '240px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--teal-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, color: 'white',
          }}>SH</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Say Hueque</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Gerencial</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px 8px' }}>
          Reportes
        </div>
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, marginBottom: 2,
              fontSize: 13, fontWeight: active ? 500 : 400,
              color: active ? 'var(--teal-400)' : 'var(--text-dim)',
              background: active ? 'rgba(20, 184, 166, 0.08)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              <Icon size={16} style={{ opacity: active ? 1 : 0.7 }} />
              {item.label}
            </Link>
          )
        })}

        <div style={{ height: 1, background: 'var(--border)', margin: '12px 10px' }} />
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px 8px' }}>
          Sistema
        </div>
        {bottomItems.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          if (item.href === '/admin' && user.role !== 'admin') return null
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, marginBottom: 2,
              fontSize: 13, fontWeight: active ? 500 : 400,
              color: active ? 'var(--teal-400)' : 'var(--text-dim)',
              background: active ? 'rgba(20, 184, 166, 0.08)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              <Icon size={16} style={{ opacity: active ? 1 : 0.7 }} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div style={{
        padding: '12px 14px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--teal-900)', border: '1px solid var(--teal-700)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: 'var(--teal-400)', flexShrink: 0,
        }}>
          {(user.name || user.email).slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.name || user.email}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'capitalize' }}>{user.role}</div>
        </div>
        <button onClick={handleLogout} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', padding: 4, borderRadius: 4,
          display: 'flex', alignItems: 'center',
          transition: 'color 0.15s',
        }} title="Cerrar sesión">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  )
}
