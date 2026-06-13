-- ════════════════════════════════════════════════════════════════════════
-- Vendedores: temporadas dinámicas + filtro de área limpio (mismo patrón que operadores).
-- Aplicadas a la DB el 13/6/2026 (vía MCP). Quedan acá para registro/replicar.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_temporadas_con_vendedores(p_upload_id uuid, p_areas text[] DEFAULT NULL)
RETURNS TABLE(temporada text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT tl.temporada FROM team_leader_rows tl
  WHERE tl.upload_id = p_upload_id AND tl.temporada IS NOT NULL
    AND tl.vendedor IS NOT NULL AND tl.vendedor <> ''
    AND (p_areas IS NULL OR tl.booking_branch = ANY(p_areas))
    AND tl.estado IN ('Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo')
  ORDER BY tl.temporada;
$$;

CREATE OR REPLACE FUNCTION public.get_ranking_vendedores_area(
  p_upload_id uuid, p_temporada text, p_areas text[], p_periodo text DEFAULT NULL
)
RETURNS TABLE(vendedor text, area text, viajes bigint, pax numeric, venta numeric, ganancia numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH base AS (
    SELECT tl.vendedor, tl.booking_branch, tl.file_code, tl.cant_pax,
           COALESCE(CASE WHEN tl.is_b2c THEN sf.venta END, tl.venta, 0) AS venta_row,
           COALESCE(CASE WHEN tl.is_b2c AND sf.venta IS NOT NULL THEN sf.venta - tl.costo END, tl.venta - tl.costo, 0) AS ganancia_row
    FROM team_leader_rows tl
    LEFT JOIN LATERAL (
      SELECT venta FROM salesforce_rows s
      WHERE s.upload_id = tl.upload_id AND upper(s.file_code) = upper(tl.file_code) LIMIT 1
    ) sf ON tl.is_b2c
    WHERE tl.upload_id = p_upload_id
      AND tl.temporada = p_temporada
      AND (p_areas IS NULL OR tl.booking_branch = ANY(p_areas))
      AND tl.estado IN ('Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo')
      AND tl.vendedor IS NOT NULL AND tl.vendedor <> ''
      AND (
        p_periodo IS NULL
        OR (p_periodo = 'con_out'   AND tl.fecha_out::date < current_date)
        OR (p_periodo = 'en_curso'  AND tl.fecha_in::date <= current_date AND tl.fecha_out::date >= current_date)
        OR (p_periodo = 'por_venir' AND tl.fecha_in::date > current_date)
      )
  )
  SELECT vendedor,
    string_agg(DISTINCT booking_branch, ' / ' ORDER BY booking_branch) AS area,
    count(DISTINCT file_code)::bigint AS viajes,
    sum(cant_pax) AS pax,
    sum(venta_row) AS venta,
    sum(ganancia_row) AS ganancia
  FROM base
  GROUP BY vendedor
  ORDER BY venta DESC;
$$;
