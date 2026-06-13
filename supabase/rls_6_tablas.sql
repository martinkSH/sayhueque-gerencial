-- ════════════════════════════════════════════════════════════════════════
-- RLS para las 6 tablas que lo tenían deshabilitado (advisory crítico de Supabase).
-- Espeja la convención ya usada en el proyecto: lectura para cualquier usuario
-- autenticado, escritura solo admin (helper get_my_role()).
--
-- Con RLS OFF, la anon key (pública, embebida en el front) podía leer/escribir
-- todas las filas. Esto lo cierra: solo usuarios logueados leen; solo admin escribe.
-- El service_role (sync / rutas admin) NO se ve afectado: bypassa RLS siempre.
--
-- NO aplicar a ciegas: probar el flujo de la app (configs, sync, detalle CM)
-- después de correrlo. Reversible con: ALTER TABLE ... DISABLE ROW LEVEL SECURITY;
-- ════════════════════════════════════════════════════════════════════════

-- cm_excepciones YA tiene políticas (authenticated FOR ALL); solo falta activarla.
ALTER TABLE public.cm_excepciones ENABLE ROW LEVEL SECURITY;

-- Resto: activar RLS + políticas (lectura authenticated, escritura admin).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cm_rangos',
    'config_areas_virtuales',
    'config_departamentos_virtuales',
    'config_sync_tourplan',
    'tourplan_quotes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR SELECT USING (auth.role() = 'authenticated');
    $f$, t || '_select', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL USING (get_my_role() = 'admin')
        WITH CHECK (get_my_role() = 'admin');
    $f$, t || '_admin_all', t);
  END LOOP;
END $$;
