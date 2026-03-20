// ═══════════════════════════════════════════════════════════════
// MODIFICACIÓN EN DetalleCMClient.tsx
// Solo se modifica la celda del file_code
// ═══════════════════════════════════════════════════════════════

// 1. Actualizar el tipo FileRow al inicio del archivo:
type FileRow = {
  file_code: string
  booking_name: string | null  // ← AGREGAR ESTA LÍNEA
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
  ganancia_sf: number | null
  venta_sf: number | null
  costo_sf: number | null
  sin_sf: boolean
}

// 2. REEMPLAZAR la celda del file_code en el tbody (línea ~280 aprox):

// ANTES:
<td style={{ padding: '8px 14px', color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
  {r.file_code}
</td>

// DESPUÉS:
<td style={{ padding: '8px 14px' }}>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    {/* File code */}
    <div style={{ 
      color: 'var(--text)', 
      fontFamily: 'var(--font-mono)', 
      fontSize: 12,
      fontWeight: 600 
    }}>
      {r.file_code}
    </div>
    
    {/* Booking name debajo */}
    {r.booking_name && (
      <div 
        style={{ 
          fontSize: 10, 
          color: 'var(--muted)', 
          maxWidth: 180,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={r.booking_name}
      >
        {r.booking_name}
      </div>
    )}
  </div>
</td>
