export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTourplanData } from '@/lib/tourplan/mssql'

export async function POST() {
  try {
    const supabase = createClient()

    // 1. Fetch data from TourPlan
    const { teamLeader, audit, fetchedAt, dateRange } = await fetchTourplanData()

    // 2. Fetch existing Salesforce rows (to preserve them)
    const { data: existingSF } = await supabase
      .from('team_leader_rows')
      .select('*')
      .not('ganancia_sf', 'is', null)

    const sfMap = new Map(
      (existingSF || []).map(r => [
        r.file_code,
        {
          ganancia_sf: r.ganancia_sf,
          venta_sf: r.venta_sf,
          costo_sf: r.costo_sf,
        },
      ])
    )

    // 3. Merge TourPlan + Salesforce
    const rowsToInsert = teamLeader.map(tl => {
      const sf = sfMap.get(tl.file_code)
      return {
        ...tl,
        ganancia_sf: sf?.ganancia_sf ?? null,
        venta_sf: sf?.venta_sf ?? null,
        costo_sf: sf?.costo_sf ?? null,
        sin_sf: !sf,
        synced_at: fetchedAt,
      }
    })

    // 4. Delete old TourPlan data
    await supabase.from('team_leader_rows').delete().neq('file_code', '__DUMMY__')

    // 5. Insert merged rows
    const { error: tlError } = await supabase.from('team_leader_rows').insert(rowsToInsert)
    if (tlError) throw tlError

    // 6. Insert audit rows
    await supabase.from('bookings_audit_rows').delete().neq('file_code', '__DUMMY__')
    const { error: auditError } = await supabase.from('bookings_audit_rows').insert(
      audit.map(a => ({ ...a, synced_at: fetchedAt }))
    )
    if (auditError) throw auditError

    return NextResponse.json({
      success: true,
      message: `Sincronización completada a las ${fetchedAt}`,
      rowsInserted: rowsToInsert.length,
      auditRowsInserted: audit.length,
      dateRange,
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
