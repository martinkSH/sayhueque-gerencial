import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: unknown }

/**
 * Trae TODAS las filas de una query Supabase superando el límite implícito de 1000.
 *
 * Supabase devuelve como máximo 1000 filas por request sin avisar. Sobre tablas
 * grandes (team_leader_rows ~150k, salesforce_rows ~42k) eso trunca los totales
 * silenciosamente. Este helper pagina con .range() hasta agotar el resultado.
 *
 * IMPORTANTE: la query DEBE incluir un .order(...) estable, si no la paginación
 * puede repetir o saltear filas entre páginas.
 *
 * @example
 *   const rows = await fetchAllRows<Row>((from, to) =>
 *     supabase.from('team_leader_rows')
 *       .select('file_code, venta')
 *       .eq('upload_id', uploadId)
 *       .order('file_code')
 *       .range(from, to)
 *   )
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0

  for (;;) {
    const { data: batch, error } = await buildQuery(offset, offset + pageSize - 1)
    if (error) throw error
    if (!batch || batch.length === 0) break
    all.push(...batch)
    if (batch.length < pageSize) break
    offset += pageSize
  }

  return all
}

/**
 * Map file_code (UPPERCASE) → venta de Salesforce, para un upload dado.
 * Paginado: trae todas las filas de salesforce_rows sin truncar.
 */
export async function fetchSalesforceVentaMap(
  supabase: SupabaseClient,
  uploadId: string,
): Promise<Map<string, number>> {
  const rows = await fetchAllRows<{ file_code: string; venta: number | null }>((from, to) =>
    supabase
      .from('salesforce_rows')
      .select('file_code, venta')
      .eq('upload_id', uploadId)
      .order('file_code')
      .range(from, to),
  )

  const map = new Map<string, number>()
  rows.forEach(r => map.set(r.file_code.toUpperCase(), r.venta ?? 0))
  return map
}
