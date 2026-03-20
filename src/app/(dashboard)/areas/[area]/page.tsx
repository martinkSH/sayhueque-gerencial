// =============================================
// MODIFICACIÓN EN: src/app/(dashboard)/areas/[area]/page.tsx
// =============================================

// CAMBIO 1: Modificar el SELECT de team_leader_rows (línea ~31 aprox)

// ANTES:
const { data: rows } = await supabase
  .from('team_leader_rows')
  .select('file_code, fecha_in, fecha_out, estado, vendedor, operador, cliente, booking_department, cant_pax, cant_dias, venta, costo, booking_branch, is_b2c')
  .eq('upload_id', uploadId)
  .eq('temporada', temp)
  .in('estado', ESTADOS)
  .in('booking_branch', areasReales)
  .order('fecha_in', { ascending: false })

// DESPUÉS (agregar booking_name al SELECT):
const { data: rows } = await supabase
  .from('team_leader_rows')
  .select('file_code, booking_name, fecha_in, fecha_out, estado, vendedor, operador, cliente, booking_department, cant_pax, cant_dias, venta, costo, booking_branch, is_b2c')
  .eq('upload_id', uploadId)
  .eq('temporada', temp)
  .in('estado', ESTADOS)
  .in('booking_branch', areasReales)
  .order('fecha_in', { ascending: false })

// CAMBIO 2: Incluir booking_name en el mapeo enriquecido (línea ~53 aprox)

// ANTES:
const enriched = rows.map(r => {
  const ventaReal = r.is_b2c && sfMap[r.file_code.toUpperCase()]
    ? sfMap[r.file_code.toUpperCase()]
    : r.venta
  const ganancia = ventaReal - r.costo
  return { ...r, venta: ventaReal, ganancia }
})

// DESPUÉS (booking_name ya está incluido en ...r, solo asegurarse que el spread lo preserve):
const enriched = rows.map(r => {
  const ventaReal = r.is_b2c && sfMap[r.file_code.toUpperCase()]
    ? sfMap[r.file_code.toUpperCase()]
    : r.venta
  const ganancia = ventaReal - r.costo
  return { ...r, venta: ventaReal, ganancia }
})
// (No requiere cambio adicional, el spread ...r ya incluye booking_name)

// =============================================
// NOTAS:
// - Asegurarse que team_leader_rows tenga la columna booking_name
// - Si no la tiene, primero correr el sync de TourPlan modificado
// =============================================
