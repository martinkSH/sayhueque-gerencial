export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTourplanData } from '@/lib/tourplan/mssql'

export async function POST() {
  try {
    const supabase = createClient()

    // 1. Fetch data from TourPlan
    const { teamLeader, audit, fetchedAt, dateRange } = await fetchTourplanData()

    // 2. Delete old TourPlan data
    await supabase.from('team_leader_rows').delete().neq('file_code', '__DUMMY__')

    // 3. Insert new rows (SIN preservar Salesforce - eso lo hacés vos manualmente)
    const rowsToInsert = teamLeader.map(tl => ({
      ...tl,
      synced_at: fetchedAt,
    }))

    const { error: tlError } = await supabase.from('team_leader_rows').insert(rowsToInsert)
    if (tlError) throw tlError

    // 4. Insert audit rows
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
