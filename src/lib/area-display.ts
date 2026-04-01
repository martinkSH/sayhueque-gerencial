// Mapeo de nombres de área para display
// Internamente se siguen usando los nombres originales de TourPlan
export function displayAreaName(area: string | null): string {
  if (!area) return 'Sin área'
  
  const AREA_DISPLAY_MAP: Record<string, string> = {
    'Aliwen': 'DMC Aliwen',
    'DMC FITS': 'DMC Fits',
    'Grupos DMC': 'DMC Grupos',
    'Booknow': 'Booknow',
    'B2C': 'B2C',
    'Web': 'Web',
    'Walk In': 'Walk In',
    'Plataformas': 'Plataformas',
  }
  
  return AREA_DISPLAY_MAP[area] || area
}
