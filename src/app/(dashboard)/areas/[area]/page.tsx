import { createClient } from '@/lib/supabase/server'
import { getUserProfile, B2C_AREAS } from '@/lib/user-context'
import { notFound } from 'next/navigation'
import AreaDetalleClient from './AreaDetalleClient'

export const dynamic = 'force-dynamic'

const ESTADOS = ['Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo']

export default async function AreaDetallePage({
  params, searchParams,
}: {
  params: { area: string }
  searchParams: { temp?: string }
}) {
  const area = decodeURIComponent(params.area)
  const temp = searchParams.temp ?? '25/26'
  const supabase = createClient()
  const profile = await getUserProfile()
  const isAdmin = profile?.role === 'admin'

  // Determinar qué booking_branches corresponden a esta área
  const areasReales = area === 'B2C' ? B2C_AREAS : [area]

  const { data: lastUpload } = await supabase
    .from('uploads').select('id, filename, created_at').eq('status', 'ok')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!lastUpload) notFound()

  const uploadId = lastUpload.id

  // Todos los files del área/temporada - INCLUIR booking_name
  const { data: rows } = await supabase
    .from('team_leader_rows')
    .select('file_code, booking_name, fecha_in, fecha_out, estado, vendedor, operador, cliente, booking_department, cant_pax, cant_dias, venta, costo, booking_branch, is_b2c')
    .eq('upload_id', uploadId)
    .eq('temporada', temp)
    .in('estado', ESTADOS)
    .in('booking_branch', areasReales)
    .order('fecha_in', { ascending: false })

  if (!rows) notFound()

  // SF rows para B2C
  const b2cFiles = rows.filter(r => r.is_b2c).map(r => r.file_code)
  let sfMap: Record<string, number> = {}
  if (b2cFiles.length > 0) {
    const { data: sfRows } = await supabase
      .from('salesforce_rows')
      .select('file_code, venta')
      .eq('upload_id', uploadId)
      .in('file_code', b2cFiles.slice(0, 500))
    sfRows?.forEach(r => { sfMap[r.file_code.toUpperCase()] = r.venta })
  }

  // Enriquecer con venta real
  const enriched = rows.map(r => {
    const ventaReal = r.is_b2c && sfMap[r.file_code.toUpperCase()]
      ? sfMap[r.file_code.toUpperCase()]
      : r.venta
    const ganancia = ventaReal - r.costo
    return { ...r, venta: ventaReal, ganancia }
  })

  return (
    <AreaDetalleClient
      area={area}
      temp={temp}
      rows={enriched}
      filename={lastUpload.filename}
      isAdmin={isAdmin}
    />
  )
}
