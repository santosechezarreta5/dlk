-- ============================================================================
--  Fase 3b · El refresco de catálogos FCI corta por statement_timeout
--  Corre esto UNA VEZ en Supabase → SQL Editor (después de fci_catalogos_mv.sql).
-- ============================================================================
--
--  PROBLEMA
--  --------
--  supabase_sync.py llama a fci_refrescar_catalogos() con la service_role key al
--  terminar cada importación. Desde la cartera del 11/09/2026 la llamada vuelve:
--
--    HTTP 500 · 57014 "canceling statement due to statement timeout"  (~9 s)
--
--  Las requests de la API corren con un statement_timeout de ~8 s y recalcular
--  las tres vistas sobre fci_tenencias (~475k filas, +25k por semana) ya tarda
--  más que eso. Las tenencias se suben bien, pero fci_fechas_mv queda
--  congelada: la solapa "Movimientos de FCI" no ofrece las fechas nuevas.
--
--  SOLUCIÓN
--  --------
--  Darle a service_role (que sólo usan los scripts de carga, nunca la página)
--  un límite propio de 5 minutos. PostgREST aplica la configuración del rol con
--  el que impersona cada request, así que el refresco deja de cortarse.
--  anon y authenticated (la página pública y el admin) siguen con sus límites.
-- ============================================================================

alter role service_role set statement_timeout = '5min';
notify pgrst, 'reload config';     -- que PostgREST relea la configuración de roles

-- Poner los catálogos al día ahora (acá corre como postgres, sin el límite de la API).
select public.fci_refrescar_catalogos();


-- ---------------------------------------------------------------------------
--  VERIFICACIÓN — la última fecha tiene que ser la última cartera importada
-- ---------------------------------------------------------------------------
-- select max(fecha) from public.fci_tenencias;     -- lo que hay cargado
-- select max(f) from public.fci_fechas() f;          -- lo que ve la app: tiene que coincidir
-- select rolname, rolconfig from pg_roles where rolname in ('service_role', 'authenticator');


-- ---------------------------------------------------------------------------
--  ROLLBACK
-- ---------------------------------------------------------------------------
-- alter role service_role reset statement_timeout;
-- notify pgrst, 'reload config';
