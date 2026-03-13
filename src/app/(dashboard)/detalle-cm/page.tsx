import { createClient } from '@/lib/supabase/server'
import { getUserProfile, expandAreas } from '@/lib/user-context'
import DetalleCMClient from './DetalleCMClient'

const ESTADOS = ['Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo']
const PAGE_SIZE = 1000

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

  // Áreas disponibles via RPC
  const { data: areasRaw } = await supabase
    .rpc('get_areas_disponibles', { p_upload_id: uploadId, p_temporada: temp })

  let available: string[] = ((areasRaw ?? []) as { booking_branch: string }[])
    .map(r => r.booking_branch).filter(Boolean).sort()

  if (expandedUserAreas) {
    available = available.filter(a => expandedUserAreas.includes(a))
  }

  const areaFiltro = searchParams.area ?? available[0] ?? 'Web'

  // Rangos CM
  const { data: rangosRaw } = await supabase.from('cm_rangos').select('area, cm_min, cm_max')
  const rangos: Record<string, { cm_min: number; cm_max: number }> =
    Object.fromEntries((rangosRaw ?? []).map((r: { area: string; cm_min: number; cm_max: number }) => [r.area, r]))
  const rango = rangos[areaFiltro] ?? { cm_min: 0.10, cm_max: 0.30 }

  // Paginación para superar límite 1000 de Supabase
  type RpcRow = {
    file_code: string; booking_branch: string; vendedor: string | null
    cliente: string | null; booking_department: string | null
    fecha_in: string | null; fecha_out: string | null; estado: string | null
    cant_pax: number | null; costo: number | null
    venta_tl: number | null; venta_sf: number | null; is_b2c: boolean
  }

  let allRows: RpcRow[] = []
  let offset = 0
  let keepFetching = true

  while (keepFetching) {
    const { data: batch } = await supabase
      .from('team_leader_rows')
      .select('file_code, booking_branch, vendedor, cliente, booking_department, fecha_in, fecha_out, estado, cant_pax, costo, venta, is_b2c')
      .eq('upload_id', uploadId)
      .eq('temporada', temp)
      .eq('booking_branch', areaFiltro)
      .in('estado', ESTADOS)
      .order('file_code')
      .range(offset, offset + PAGE_SIZE - 1)

    if (!batch || batch.length === 0) break

    // Mapear a RpcRow shape
    const mapped = batch.map((r: {
      file_code: string; booking_branch: string | null; vendedor: string | null
      cliente: string | null; booking_department: string | null; fecha_in: string | null
      fecha_out: string | null; estado: string | null; cant_pax: number | null
      costo: number | null; venta: number | null; is_b2c: boolean
    }) => ({
      file_code: r.file_code,
      booking_branch: r.booking_branch ?? '',
      vendedor: r.vendedor,
      cliente: r.cliente,
      booking_department: r.booking_department,
      fecha_in: r.fecha_in,
      fecha_out: r.fecha_out,
      estado: r.estado,
      cant_pax: r.cant_pax,
      costo: r.costo,
      venta_tl: r.venta,
      venta_sf: null, // se completa abajo con sfMap
      is_b2c: r.is_b2c,
    }))

    allRows = allRows.concat(mapped)
    if (batch.length < PAGE_SIZE) keepFetching = false
    else offset += PAGE_SIZE
  }

  // Salesforce map para B2C — también paginado
  const sfMap = new Map<string, { venta: number; ganancia: number }>()
  const b2cFileCodes = allRows.filter(r => r.is_b2c).map(r => r.file_code.toUpperCase())

  if (b2cFileCodes.length > 0) {
    let sfOffset = 0
    let sfFetching = true
    while (sfFetching) {
      const { data: sfBatch } = await supabase
        .from('salesforce_rows')
        .select('file_code, venta, ganancia')
        .eq('upload_id', uploadId)
        .order('file_code')
        .range(sfOffset, sfOffset + PAGE_SIZE - 1)

      if (!sfBatch || sfBatch.length === 0) break
      sfBatch.forEach((r: { file_code: string; venta: number | null; ganancia: number | null }) =>
        sfMap.set(r.file_code.toUpperCase(), { venta: r.venta ?? 0, ganancia: r.ganancia ?? 0 })
      )
      if (sfBatch.length < PAGE_SIZE) sfFetching = false
      else sfOffset += PAGE_SIZE
    }
  }

  // Deduplicar por file_code y calcular métricas
  const seen = new Set<string>()
  const files = allRows
    .filter(r => {
      if (seen.has(r.file_code)) return false
      seen.add(r.file_code)
      return true
    })
    .map(r => {
      const sfData = r.is_b2c ? sfMap.get(r.file_code.toUpperCase()) : undefined
      const hasSf = sfData !== undefined
      const venta = hasSf ? sfData!.venta : (r.venta_tl ?? 0)
      const costo = r.costo ?? 0
      const ganancia = venta - costo
      const cm = venta > 0 ? ganancia / venta : 0
      const ganancia_sf = hasSf ? sfData!.ganancia : null
      return {
        file_code: r.file_code,
        area: r.booking_branch,
        vendedor: r.vendedor ?? '—',
        cliente: r.cliente ?? '—',
        departamento: r.booking_department ?? '—',
        fecha_in: r.fecha_in ?? '',
        fecha_out: r.fecha_out ?? '',
        estado: r.estado ?? '',
        pax: r.cant_pax ?? 0,
        costo, venta, ganancia, cm,
        ganancia_sf,
        sin_sf: r.is_b2c && !hasSf,
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
