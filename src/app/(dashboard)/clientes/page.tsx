import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas } from '@/lib/user-context'
import ClientesClient from './ClientesClient'

export const dynamic = 'force-dynamic'

const TEMPORADAS = ['25/26', '24/25', '26/27']

// Calcular fecha inicio/fin por temporada
function getTemporadaDates(temp: string): { desde: string; hasta: string } {
  const [y1, y2] = temp.split('/').map(y => 2000 + parseInt(y))
  return {
    desde: `${y1}-05-01`,
    hasta: `${y2}-04-30`
  }
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { area?: string; temp?: string; desde?: string; hasta?: string }
}) {
  const supabase = createClient()
  const userProfile = await getUserProfile()
  const isAdmin = userProfile?.role === 'admin'
  const expandedUserAreas = isAdmin ? null : expandAreas(userProfile?.areas ?? [])
  const temp = searchParams.temp ?? '25/26'

  const { data: lastUpload } = await supabase
    .from('uploads').select('id, filename').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) return <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>Sin datos.</div>

  const uploadId = lastUpload.id

  // Fechas: default = toda la temporada, o las del querystring
  const tempDates = getTemporadaDates(temp)
  const fechaDesde = searchParams.desde ?? tempDates.desde
  const fechaHasta = searchParams.hasta ?? tempDates.hasta

  // Áreas disponibles
  const { data: areasRaw } = await supabase
    .rpc('get_areas_disponibles', { p_upload_id: uploadId, p_temporada: temp })

  const areasSet = new Set<string>()
  areasRaw?.forEach((r: { booking_branch: string }) => { if (r.booking_branch) areasSet.add(r.booking_branch) })

  const availableRaw = expandedUserAreas
    ? Array.from(areasSet).filter(a => expandedUserAreas.includes(a))
    : Array.from(areasSet)

  const B2C_AREAS = ['Web', 'Plataformas', 'Walk In']
  const hasBc2 = availableRaw.some(a => B2C_AREAS.includes(a))
  const nonB2C = availableRaw.filter(a => !B2C_AREAS.includes(a)).sort()
  const areaOptions = [...(hasBc2 ? ['B2C'] : []), ...nonB2C]

  const areaFiltro = searchParams.area ?? areaOptions[0] ?? 'B2C'

  return (
    <ClientesClient
      uploadId={uploadId}
      temp={temp}
      areaFiltro={areaFiltro}
      areaOptions={areaOptions}
      temporadas={TEMPORADAS}
      fechaDesde={fechaDesde}
      fechaHasta={fechaHasta}
      isAdmin={isAdmin}
      expandedUserAreas={expandedUserAreas}
    />
  )
}
