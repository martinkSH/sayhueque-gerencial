/**
 * Constantes de dominio puras (sin imports de server) — fuente única de verdad.
 * Vive separado de user-context.ts (que importa código server-only vía next/headers)
 * para poder importarse también desde componentes client sin romper el build.
 */

/** Las 7 áreas/branches reales en orden canónico. */
export const ALL_AREAS = ['Web', 'Plataformas', 'Walk In', 'Aliwen', 'DMC FITS', 'Grupos DMC', 'Booknow']

/** Áreas que componen el agregado B2C. */
export const B2C_AREAS = ['Web', 'Plataformas', 'Walk In']

/**
 * Estados de booking considerados "confirmados/activos" (excluye Quote / Cancelado / Reservado).
 * INCLUYE 'Final' (booking finalizado, códigos FI/FN de TourPlan): ~1135 files / ~$14M de venta
 * que las páginas que lo omitían dejaban afuera.
 */
export const ESTADOS_CONFIRMADOS = [
  'Final + Day by Day', 'Final', 'Confirmed', 'Pre Final',
  'En Operaciones', 'Cerrado', 'Cierre Operativo',
]
