/**
 * Mapeos de códigos de TourPlan → nombres legibles, fuente única de verdad.
 * Antes estaban duplicados en mssql.ts y sync-quotes/route.ts.
 */

/** BookingBranchCode → nombre de área. */
export const BRANCH_MAP: Record<string, string> = {
  WE: 'Web',
  WI: 'Walk In',
  PL: 'Plataformas',
  AL: 'Aliwen',
  DM: 'DMC FITS',
  GR: 'Grupos DMC',
  BN: 'Booknow',
}

/** Códigos de branch B2C usados como filtro en las queries de TourPlan. */
export const BRANCH_CODES = Object.keys(BRANCH_MAP)

/** BookingStatus code → nombre legible (igual que el parser del Excel). */
export const ESTADO_MAP: Record<string, string> = {
  FF: 'Final + Day by Day',
  FI: 'Final',
  FN: 'Final',
  OK: 'Confirmed',
  C7: 'Confirmed',
  CD: 'Confirmed',
  CT: 'Confirmed',
  PF: 'Pre Final',
  OP: 'En Operaciones',
  CL: 'Cerrado',
  CO: 'Cierre Operativo',
  QU: 'Quote',
  RE: 'Reservado',
  XC: 'Cancelado',
  XX: 'Cancelado',
}
