import { createClient } from '@/lib/supabase/server'
import { fetchAllRows, fetchSalesforceVentaMap } from '@/lib/supabase/fetch-all'
import { getUserProfile, B2C_AREAS, ESTADOS_CONFIRMADOS as ESTADOS } from '@/lib/user-context'
import { notFound } from 'next/navigation'
import AreaDetalleClient from './AreaDetalleClient'

export const dynamic = 'force-dynamic'

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
  // Paginado: supera el límite de 1000 de Supabase (áreas grandes lo excedían).
  type AreaRow = {
    file_code: string; booking_name: string | null; fecha_in: string | null
    fecha_out: string | null; estado: string | null; vendedor: string | null
    operador: string | null; cliente: string | null; booking_department: string | null
    cant_pax: number | null; cant_dias: number | null; venta: number; costo: number
    booking_branch: string | null; is_b2c: boolean
  }
  const rows = await fetchAllRows<AreaRow>((from, to) =>
    supabase
      .from('team_leader_rows')
      .select('file_code, booking_name, fecha_in, fecha_out, estado, vendedor, operador, cliente, booking_department, cant_pax, cant_dias, venta, costo, booking_branch, is_b2c')
      .eq('upload_id', uploadId)
      .eq('temporada', temp)
      .in('estado', ESTADOS)
      .in('booking_branch', areasReales)
      .order('fecha_in', { ascending: false })
      .order('file_code') // tiebreaker estable para paginar
      .range(from, to)
  )

  if (rows.length === 0) notFound()

  // SF venta para B2C — map paginado y completo (antes cortaba a los primeros 500 files)
  const hasB2C = rows.some(r => r.is_b2c)
  const sfMap = hasB2C ? await fetchSalesforceVentaMap(supabase, uploadId) : new Map<string, number>()

  // Enriquecer con venta real
  const enriched = rows.map(r => {
    const ventaSF = sfMap.get(r.file_code.toUpperCase())
    const ventaReal = r.is_b2c && ventaSF ? ventaSF : r.venta
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
