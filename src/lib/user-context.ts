import { createClient } from '@/lib/supabase/server'

export type UserProfile = {
  id: string
  email: string
  role: 'admin' | 'comercial'
  areas: string[]
  full_name: string
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, areas')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? '',
    role: (profile?.role ?? 'comercial') as 'admin' | 'comercial',
    areas: profile?.areas ?? [],
    full_name: profile?.full_name ?? '',
  }
}

// Devuelve las áreas reales de Supabase para un filtro dado
// Si es admin y pide 'todas' → null (sin filtro)
// Si es comercial → siempre sus áreas
export const ALL_AREAS = ['Web', 'Plataformas', 'Walk In', 'Aliwen', 'DMC FITS', 'Grupos DMC', 'Booknow']
export const B2C_AREAS = ['Web', 'Plataformas', 'Walk In']

export function resolveAreas(
  role: string,
  userAreas: string[],
  areaFiltro: string
): string[] | null {
  // Comercial: siempre filtrar por sus áreas (expandir B2C si corresponde)
  if (role !== 'admin') {
    return expandAreas(userAreas)
  }
  // Admin: respetar el filtro elegido
  if (areaFiltro === 'todas' || areaFiltro === 'empresa') return null
  if (areaFiltro === 'B2C') return B2C_AREAS
  return [areaFiltro]
}

export function expandAreas(areas: string[]): string[] {
  const result = new Set<string>()
  areas.forEach(a => {
    if (a === 'B2C') {
      B2C_AREAS.forEach(x => result.add(x))
    } else {
      result.add(a)
    }
  })
  return Array.from(result)
}
