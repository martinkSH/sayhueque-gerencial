-- ════════════════════════════════════════════════════════════════════════
-- Operadores: temporadas dinámicas + filtro de área limpio.
-- Aplicadas a la DB el 13/6/2026 (vía MCP). Quedan acá para registro/replicar.
--
-- Antes get_ranking_operadores concatenaba TODAS las áreas de cada operador
-- (string_agg) → el filtro mostraba decenas de combinaciones ("Aliwen / DMC FITS
-- / Grupos DMC", etc). Ahora el filtro es por un set de áreas y el ranking
-- agrega al operador solo dentro de ese set.
-- ════════════════════════════════════════════════════════════════════════

-- Temporadas que tienen operadores con viajes confirmados (alimenta el selector).
CREATE OR REPLACE FUNCTION public.get_temporadas_con_operadores(p_upload_id uuid, p_areas text[] DEFAULT NULL)
RETURNS TABLE(temporada text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT tl.temporada FROM team_leader_rows tl
  WHERE tl.upload_id = p_upload_id AND tl.temporada IS NOT NULL
    AND tl.operador IS NOT NULL AND tl.operador <> ''
    AND (p_areas IS NULL OR tl.booking_branch = ANY(p_areas))
    AND tl.estado IN ('Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo')
  ORDER BY tl.temporada;
$$;

-- Ranking de operadores restringido a un set de áreas (sin concatenaciones).
CREATE OR REPLACE FUNCTION public.get_ranking_operadores_area(
  p_upload_id uuid, p_temporada text, p_areas text[], p_periodo text DEFAULT NULL
)
RETURNS TABLE(operador text, area text, files bigint, dias numeric, pax numeric, venta numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH base AS (
    SELECT tl.operador, tl.booking_branch, tl.file_code, tl.cant_dias, tl.cant_pax,
           COALESCE(CASE WHEN tl.is_b2c THEN sf.venta END, tl.venta, 0) AS venta_row
    FROM team_leader_rows tl
    LEFT JOIN LATERAL (
      SELECT venta FROM salesforce_rows s
      WHERE s.upload_id = tl.upload_id AND upper(s.file_code) = upper(tl.file_code) LIMIT 1
    ) sf ON tl.is_b2c
    WHERE tl.upload_id = p_upload_id
      AND tl.temporada = p_temporada
      AND (p_areas IS NULL OR tl.booking_branch = ANY(p_areas))
      AND tl.estado IN ('Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo')
      AND tl.operador IS NOT NULL AND tl.operador <> ''
      AND (
        p_periodo IS NULL
        OR (p_periodo = 'con_out'   AND tl.fecha_out::date < current_date)
        OR (p_periodo = 'en_curso'  AND tl.fecha_in::date <= current_date AND tl.fecha_out::date >= current_date)
        OR (p_periodo = 'por_venir' AND tl.fecha_in::date > current_date)
      )
  )
  SELECT operador,
    string_agg(DISTINCT booking_branch, ' / ' ORDER BY booking_branch) AS area,
    count(DISTINCT file_code)::bigint AS files,
    sum(cant_dias) AS dias,
    sum(cant_pax) AS pax,
    sum(venta_row) AS venta
  FROM base
  GROUP BY operador
  ORDER BY venta DESC;
$$;
