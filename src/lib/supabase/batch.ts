import type { SupabaseClient } from '@supabase/supabase-js'

const CHUNK_SIZE = 500

type Row = Record<string, unknown>

/** Inserta filas en lotes de 500. Lanza si algún lote falla. */
export async function batchInsert(supabase: SupabaseClient, table: string, rows: Row[], chunk = CHUNK_SIZE) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + chunk))
    if (error) throw new Error(`Error insertando en ${table}: ${error.message}`)
  }
}

/** Upsert en lotes de 500. Lanza si algún lote falla. */
export async function batchUpsert(
  supabase: SupabaseClient,
  table: string,
  rows: Row[],
  options?: { onConflict?: string },
  chunk = CHUNK_SIZE,
) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + chunk), options)
    if (error) throw new Error(`Error en upsert de ${table}: ${error.message}`)
  }
}

/**
 * Trae el último upload con status 'ok'. Devuelve null si no hay ninguno.
 * @param columns columnas a traer (default 'id').
 */
export async function getLatestUpload<T = { id: string }>(
  supabase: SupabaseClient,
  columns = 'id',
): Promise<T | null> {
  const { data } = await supabase
    .from('uploads')
    .select(columns)
    .eq('status', 'ok')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as T | null) ?? null
}
