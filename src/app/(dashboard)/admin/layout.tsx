import { requireAdminProfile } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Guard server-side para TODO /admin/* (incluye las sub-páginas client como
 * departamentos-virtuales y configuracion-sync, que antes solo dependían del
 * middleware — y el middleware no valida rol). Un no-admin es redirigido.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminProfile()
  return <>{children}</>
}
