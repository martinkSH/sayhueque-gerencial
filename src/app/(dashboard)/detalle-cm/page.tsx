import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas, B2C_AREAS } from '@/lib/user-context'
import DetalleCMClient from './DetalleCMClient'

const ESTADOS = ['Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo']

export default async function DetalleCMPage({
  searchParams,
}: {
  searchParams: { area?: string; temp?: string }
}) {
  const supabase = createClient()
  const userProfile = await getUserProfile()
  const isAdmin = userProfile?.role === 'admin'
  const expandedUserAreas = isAdmin ? null : expandAreas(userProfile?.areas ?? [])
  const temp = searchParams.temp ?? '25/26'

  const { data: lastUpload } = await supabase
    .from('uploads').select('id, filename').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) return (
    <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>Sin datos.</div>
  )

  const uploadId = lastUpload.id

  // Áreas disponibles via RPC para evitar límite 1000
  const { data: areasRaw } = await supabase
    .rpc('get_areas_disponibles', { p_upload_id: uploadId, p_temporada: temp })

  // Si no existe la RPC, fallback con query paginada
  let available: string[] = []
  if (areasRaw && Array.isArray(areasRaw)) {
    available = (areasRaw as { booking_branch: string }[]).map(r => r.booking_branch).filter(Boolean).sort()
  } else {
    // Fallback: obtener áreas únicas con GROUP BY via query distinta
    const { data: fallback } = await supabase
      .from('team_leader_rows')
      .select('booking_branch')
      .eq('upload_id', uploadId)
      .eq('temporada', temp)
      .in('estado', ESTADOS)
      .limit(10000)
    const set = new Set<string>()
    fallback?.forEach((r: { booking_branch: string | null }) => { if (r.booking_branch) set.add(r.booking_branch) })
    available = Array.from(set).sort()
  }

  if (expandedUserAreas) {
    available = available.filter(a => expandedUserAreas.includes(a))
  }

  const areaFiltro = searchParams.area ?? available[0] ?? 'Web'

  // Rangos CM
  const { data: rangosRaw } = await supabase.from('cm_rangos').select('area, cm_min, cm_max')
  const rangos: Record<string, { cm_min: number; cm_max: number }> =
    Object.fromEntries((rangosRaw ?? []).map((r: { area: string; cm_min: number; cm_max: number }) => [r.area, r]))
  const rango = rangos[areaFiltro] ?? { cm_min: 0.10, cm_max: 0.30 }

  // Filas via RPC (sin límite 1000)
  const { data: rpcRows } = await supabase
    .rpc('get_detalle_cm', {
      p_upload_id: uploadId,
      p_temporada: temp,
      p_area: areaFiltro,
    })

  type RpcRow = {
    file_code: string; booking_branch: string; vendedor: string | null
    cliente: string | null; booking_department: string | null
    fecha_in: string | null; fecha_out: string | null; estado: string | null
    cant_pax: number | null; costo: number | null
    venta_tl: number | null; venta_sf: number | null; is_b2c: boolean
  }

  const files = ((rpcRows ?? []) as RpcRow[]).map(r => {
    const venta = r.is_b2c && r.venta_sf !== null ? r.venta_sf : (r.venta_tl ?? 0)
    const costo = r.costo ?? 0
    const ganancia = venta - costo
    const cm = venta > 0 ? ganancia / venta : 0
    return {
      file_code: r.file_code,
      area: r.booking_branch ?? '',
      vendedor: r.vendedor ?? '—',
      cliente: r.cliente ?? '—',
      departamento: r.booking_department ?? '—',
      fecha_in: r.fecha_in ?? '',
      fecha_out: r.fecha_out ?? '',
      estado: r.estado ?? '',
      pax: r.cant_pax ?? 0,
      costo, venta, ganancia, cm,
    }
  })

  return (
    <DetalleCMClient
      files={files}
      areas={available}
      areaFiltro={areaFiltro}
      temp={temp}
      rangoMin={rango.cm_min}
      rangoMax={rango.cm_max}
      isAdmin={isAdmin}
    />
  )
}
