/**
 * season.ts — lógica de temporada Say Hueque, fuente única de verdad.
 *
 * Una temporada va del 1 de mayo al 30 de abril del año siguiente.
 * T25/26 = 1/5/2025 → 30/4/2026.
 *
 * Todas las funciones parsean los componentes del string ISO en vez de usar
 * `new Date(...)`, para NO depender de la timezone del servidor: `new Date('2026-05-01')`
 * se interpreta como UTC medianoche y al leerlo con getMonth() local (Argentina UTC-3)
 * "retrocede" al 30/4 → temporada equivocada justo en el borde del corte.
 */

/** Extrae {year, month(1-12)} de un string ISO 'YYYY-MM-DD...' sin tocar timezone. */
function parseYearMonth(isoDate: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) }
}

/** Temporada (mayo→abril) en formato "YY/YY". Ej: 2025-07-10 → "25/26". */
export function getTemporada(isoDate: string | null): string | null {
  if (!isoDate) return null
  const ym = parseYearMonth(isoDate)
  if (!ym) return null
  const start = ym.month >= 5 ? ym.year : ym.year - 1
  return `${String(start).slice(2)}/${String(start + 1).slice(2)}`
}

/**
 * Índice de mes dentro de la temporada: May=1, Jun=2, …, Dec=8, Jan=9, …, Apr=12.
 * Relativo a la temporada (sin años hardcodeados), así sirve para cualquier temporada.
 */
export function seasonMonthIdx(isoDate: string | null): number | null {
  if (!isoDate) return null
  const ym = parseYearMonth(isoDate)
  if (!ym) return null
  return ym.month >= 5 ? ym.month - 4 : ym.month + 8
}

/** Normaliza un valor de fecha (Date de SQL Server o string) a 'YYYY-MM-DD', o null. */
export function toISO(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) {
    if (v.getUTCFullYear() <= 1900) return null // TP usa 1900-01-01 como "sin fecha"
    return v.toISOString().slice(0, 10)
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))
  return m ? m[1] : null
}
