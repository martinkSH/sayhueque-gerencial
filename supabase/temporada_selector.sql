-- ════════════════════════════════════════════════════════════════════════
-- Selector de temporada en /temporada.
-- Aplicadas a la DB el 13/6/2026 (vía MCP). Quedan acá para registro/replicar.
--
-- La RPC vieja get_temporada_por_area hardcodeaba tl.temporada = '25/26'.
-- Estas dos permiten elegir cualquier temporada que tenga viajes confirmados.
-- ════════════════════════════════════════════════════════════════════════

-- Lista de temporadas que tienen viajes confirmados (alimenta el selector).
CREATE OR REPLACE FUNCTION public.get_temporadas_confirmadas(p_upload_id uuid, p_areas text[] DEFAULT NULL)
RETURNS TABLE(temporada text, viajes bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT tl.temporada, count(DISTINCT tl.file_code)::bigint AS viajes
  FROM team_leader_rows tl
  WHERE tl.upload_id = p_upload_id
    AND tl.temporada IS NOT NULL
    AND (p_areas IS NULL OR tl.booking_branch = ANY(p_areas))
    AND tl.estado IN ('Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo')
  GROUP BY tl.temporada
  ORDER BY tl.temporada;
$$;

-- Resumen por área para la temporada elegida (bucketea por current_date).
CREATE OR REPLACE FUNCTION public.get_temporada_resumen(p_upload_id uuid, p_temporada text, p_areas text[] DEFAULT NULL)
RETURNS TABLE(area text, corte text, viajes bigint, pax bigint, venta numeric, costo numeric, ganancia numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    tl.booking_branch AS area,
    CASE
      WHEN tl.fecha_out <= current_date THEN 'terminado'
      WHEN tl.fecha_in <= current_date AND tl.fecha_out > current_date THEN 'en_curso'
      ELSE 'futuro'
    END AS corte,
    count(DISTINCT tl.file_code)::bigint AS viajes,
    sum(tl.cant_pax)::bigint AS pax,
    sum(COALESCE(CASE WHEN tl.is_b2c THEN sf.venta END, tl.venta, 0)) AS venta,
    sum(tl.costo) AS costo,
    sum(COALESCE(
      CASE WHEN tl.is_b2c AND sf.venta IS NOT NULL THEN sf.venta - tl.costo END,
      tl.venta - tl.costo, 0
    )) AS ganancia
  FROM team_leader_rows tl
  LEFT JOIN LATERAL (
    SELECT venta FROM salesforce_rows s
    WHERE s.upload_id = tl.upload_id AND upper(s.file_code) = upper(tl.file_code) LIMIT 1
  ) sf ON tl.is_b2c
  WHERE tl.upload_id = p_upload_id
    AND tl.temporada = p_temporada
    AND (p_areas IS NULL OR tl.booking_branch = ANY(p_areas))
    AND tl.estado IN ('Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo')
  GROUP BY tl.booking_branch, 2
  ORDER BY tl.booking_branch, 2;
$$;
