-- ════════════════════════════════════════════════════════════════════════
-- Selector de temporadas en /comparativo.
-- Aplicada a la DB el 13/6/2026 (vía MCP). Queda acá para registro/replicar.
--
-- get_comparativo_2526 hardcodeaba '25/26'. Esta versión recibe la temporada
-- como parámetro, así se puede comparar cualquier par de temporadas de
-- team_leader_rows. (24/25 sigue saliendo de las tablas históricas temp_2425_*.)
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_comparativo_mensual(
  p_upload_id uuid, p_temporada text, p_metric text, p_areas text[] DEFAULT NULL
)
RETURNS TABLE(mes_idx integer, valor numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    CASE
      WHEN extract(month FROM tl.fecha_in) >= 5
        THEN extract(month FROM tl.fecha_in)::int - 4
      ELSE extract(month FROM tl.fecha_in)::int + 8
    END as mes_idx,
    sum(CASE p_metric
      WHEN 'venta'    THEN COALESCE(CASE WHEN tl.is_b2c THEN sf.venta END, tl.venta, 0)
      WHEN 'ganancia' THEN COALESCE(
        CASE WHEN tl.is_b2c AND sf.venta IS NOT NULL THEN sf.venta - tl.costo END,
        tl.venta - tl.costo, 0)
      ELSE 1
    END) as valor
  FROM team_leader_rows tl
  LEFT JOIN LATERAL (
    SELECT venta FROM salesforce_rows s
    WHERE s.upload_id = tl.upload_id AND upper(s.file_code) = upper(tl.file_code)
    LIMIT 1
  ) sf ON tl.is_b2c
  WHERE tl.upload_id = p_upload_id
    AND tl.temporada = p_temporada
    AND (p_areas IS NULL OR tl.booking_branch = ANY(p_areas))
    AND tl.estado IN ('Final + Day by Day','Final','Confirmed','Pre Final','En Operaciones','Cerrado','Cierre Operativo')
  GROUP BY mes_idx
  ORDER BY mes_idx;
$$;
