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

  // Áreas disponibles
  const { data: areasRaw } = await supabase
    .from('team_leader_rows').select('booking_branch')
    .eq('upload_id', uploadId).eq('temporada', temp)
    .in('estado', ESTADOS).limit(10000)

  const areasSet = new Set<string>()
  areasRaw?.forEach(r => { if (r.booking_branch) areasSet.add(r.booking_branch) })

  const available = expandedUserAreas
    ? Array.from(areasSet).filter(a => expandedUserAreas.includes(a))
    : Array.from(areasSet)
  available.sort()

  const areaFiltro = searchParams.area ?? available[0] ?? 'Web'

  // Rangos CM
  const { data: rangosRaw } = await supabase.from('cm_rangos').select('area, cm_min, cm_max')
  const rangos = Object.fromEntries((rangosRaw ?? []).map(r => [r.area, r]))

  // Rango para el área seleccionada
  // Si es B2C (Web/Plat/WalkIn) no agrupamos, mostramos individual
  const rango = rangos[areaFiltro] ?? { cm_min: 0.10, cm_max: 0.30 }

  // Files del área
  let query = supabase
    .from('team_leader_rows')
    .select('file_code, booking_branch, vendedor, cliente, booking_department, fecha_in, fecha_out, estado, cant_pax, costo, venta, is_b2c')
    .eq('upload_id', uploadId)
    .eq('temporada', temp)
    .eq('booking_branch', areaFiltro)
    .in('estado', ESTADOS)
    .limit(10000)

  const { data: tlRows } = await query

  // Salesforce para B2C
  const { data: sfRows } = await supabase
    .from('salesforce_rows').select('file_code, venta').eq('upload_id', uploadId)
  const sfMap = new Map<string, number>()
  sfRows?.forEach(r => sfMap.set(r.file_code.toUpperCase(), r.venta ?? 0))

  // Deduplicar por file_code
  type FileRow = {
    file_code: string
    area: string
    vendedor: string
    cliente: string
    departamento: string
    fecha_in: string
    fecha_out: string
    estado: string
    pax: number
    costo: number
    venta: number
    ganancia: number
    cm: number
  }

  const seen = new Set<string>()
  const files: FileRow[] = []
  tlRows?.forEach(r => {
    if (seen.has(r.file_code)) return
    seen.add(r.file_code)
    const sfVenta = r.is_b2c ? sfMap.get(r.file_code.toUpperCase()) : undefined
    const venta = sfVenta !== undefined ? sfVenta : (r.venta ?? 0)
    const costo = r.costo ?? 0
    const ganancia = venta - costo
    const cm = venta > 0 ? ganancia / venta : 0
    files.push({
      file_code: r.file_code,
      area: r.booking_branch ?? '',
      vendedor: r.vendedor ?? '—',
      cliente: r.cliente ?? '—',
      departamento: r.booking_department ?? '—',
      fecha_in: r.fecha_in ?? '',
      fecha_out: r.fecha_out ?? '',
      estado: r.estado ?? '',
      pax: r.cant_pax ?? 0,
      costo,
      venta,
      ganancia,
      cm,
    })
  })

  return (
    <DetalleCMClient
      files={files}
      areas={available}
      areaFiltro={areaFiltro}
      temp={temp}
      rango={rango}
      isAdmin={isAdmin}
    />
  )
}
