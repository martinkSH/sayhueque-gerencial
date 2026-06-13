/** Formateo de números, fuente única de verdad (antes copypasteado en ~12 archivos). */

/** Monto en USD sin decimales. Ej: 1234.5 → "$1,235". */
export function formatUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

/** Porcentaje a partir de una fracción. Ej: 0.234 → "23.4%". */
export function formatPct(fraction: number, decimals = 1): string {
  return `${(fraction * 100).toFixed(decimals)}%`
}

export type CmCateg = { label: string; short: string; color: string }

/**
 * Categoría/color de un CM (contribución marginal) según umbrales canónicos 10/20/30%.
 * Fuente única de verdad — antes había umbrales divergentes (0.15/0.20, 0.18/0.25)
 * repetidos inline en ~6 vistas.
 * NOTA: detalle-cm usa rangos POR ÁREA configurables (cm_rangos) — eso es otra cosa,
 * no usa esto.
 */
export function categCM(cm: number): CmCateg {
  if (cm >= 0.30) return { label: '≥30% Excelente', short: '≥30%',   color: '#4ade80' }
  if (cm >= 0.20) return { label: '20-30% OK',      short: '20-30%', color: '#a3e635' }
  if (cm >= 0.10) return { label: '10-20% Bajo',    short: '10-20%', color: '#fb923c' }
  return            { label: '<10% Crítico',         short: '<10%',   color: '#f87171' }
}

/** Solo el color de un CM (atajo de categCM). */
export function cmColor(cm: number): string {
  return categCM(cm).color
}
