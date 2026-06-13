import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas } from '@/lib/user-context'
import { B2C_AREAS } from '@/lib/areas'
import ClientesClient from './ClientesClient'
import SyncQuotesButton from '@/components/SyncQuotesButton'

export const dynamic = 'force-dynamic'

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

  const { data: lastUpload } = await supabase
    .from('uploads').select('id, filename').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) return <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>Sin datos.</div>

  const uploadId = lastUpload.id

  // Temporadas con viajes confirmados (dinámicas). Default: 26/27 (la vigente).
  const { data: tempsRaw } = await supabase.rpc('get_temporadas_confirmadas', {
    p_upload_id: uploadId, p_areas: expandedUserAreas,
  })
  const temporadas = ((tempsRaw ?? []) as { temporada: string }[]).map(t => t.temporada)
  const temp = searchParams.temp && temporadas.includes(searchParams.temp)
    ? searchParams.temp
    : temporadas.includes('26/27') ? '26/27' : (temporadas[0] ?? '26/27')

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

  const hasBc2 = availableRaw.some(a => B2C_AREAS.includes(a))
  const nonB2C = availableRaw.filter(a => !B2C_AREAS.includes(a)).sort()
  const areaOptions = [...(hasBc2 ? ['B2C'] : []), ...nonB2C]

  const areaFiltro = searchParams.area ?? areaOptions[0] ?? 'B2C'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Botón Sync Quotes - Solo para admins */}
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SyncQuotesButton />
        </div>
      )}
      
      <ClientesClient
        uploadId={uploadId}
        temp={temp}
        areaFiltro={areaFiltro}
        areaOptions={areaOptions}
        temporadas={temporadas}
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        isAdmin={isAdmin}
        expandedUserAreas={expandedUserAreas}
      />
    </div>
  )
}
