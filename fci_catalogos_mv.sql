-- ============================================================================
--  Fase 3 · Catálogos de FCI como vistas materializadas
--  Corre esto UNA VEZ en Supabase → SQL Editor.
-- ============================================================================
--
--  PROBLEMA
--  --------
--  Los tres RPC de catálogo agregan la tabla completa `fci_tenencias`
--  (396.303 filas) en CADA llamada:
--
--    fci_bonos()  -> group by activo + count(distinct fondo)   -> 2.714 filas
--    fci_fondos() -> group by fondo  + count(distinct fecha)   -> ~1.145 filas
--    fci_fechas() -> select distinct fecha                     -> ~16 filas
--
--  Medido contra producción (5 intentos a fci_bonos):
--    2 de 5 fallaron con 57014 "canceling statement due to statement timeout"
--    los que pasaron: 2,45 s en frío / 0,85 s en caliente
--
--  Y hay un multiplicador: `fci_bonos` ordena POR UN AGREGADO
--  (order by count(distinct fondo) desc), así que Postgres tiene que resolver
--  la agregación entera antes de poder aplicar limit/offset. Como el cliente
--  pagina de a 1000 filas (db-max-rows de Supabase), las 2.714 filas se piden
--  en 3 requests... y cada una vuelve a agregar las 396k filas desde cero.
--  Total real medido en el navegador: 3 requests a fci_bonos + 2 a fci_fondos.
--
--  Los reintentos del cliente tapan el fallo, y por eso el síntoma que se ve no
--  es un error sino "a veces la solapa de FCI tarda un montón".
--
--  SOLUCIÓN
--  --------
--  Estos catálogos sólo cambian cuando se importa una cartera nueva. Se
--  precalculan una vez y se consultan por índice. La agregación pasa de
--  ejecutarse en cada request a ejecutarse una vez por importación.
--
--  Los RPC mantienen exactamente el mismo nombre, firma, columnas y orden,
--  así que el front no necesita ningún cambio.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Diagnóstico previo (opcional, para tener el "antes")
-- ---------------------------------------------------------------------------
-- explain (analyze, buffers)
--   select activo, max(tipo), max(moneda), max(ticker), count(distinct fondo)::int
--   from public.fci_tenencias group by activo order by count(distinct fondo) desc, activo;


-- ---------------------------------------------------------------------------
-- 1) Vistas materializadas (misma proyección que los RPC actuales)
-- ---------------------------------------------------------------------------
drop materialized view if exists public.fci_bonos_mv;
create materialized view public.fci_bonos_mv as
  select activo,
         max(tipo)                  as tipo,
         max(moneda)                as moneda,
         max(ticker)                as ticker,
         count(distinct fondo)::int as n_fondos
  from public.fci_tenencias
  group by activo;

drop materialized view if exists public.fci_fondos_mv;
create materialized view public.fci_fondos_mv as
  select fondo,
         max(gerente)               as gerente,
         count(distinct fecha)::int as n_fechas
  from public.fci_tenencias
  group by fondo;

drop materialized view if exists public.fci_fechas_mv;
create materialized view public.fci_fechas_mv as
  select distinct fecha from public.fci_tenencias;


-- ---------------------------------------------------------------------------
-- 2) Índices
--    · El UNIQUE es obligatorio para poder usar REFRESH ... CONCURRENTLY
--      (sin él, el refresh bloquea lecturas y la app se cuelga mientras corre).
--    · El segundo índice de cada vista replica el ORDER BY del RPC, así el
--      limit/offset de la paginación se resuelve por índice y no re-ordena.
-- ---------------------------------------------------------------------------
create unique index if not exists fci_bonos_mv_pk   on public.fci_bonos_mv  (activo);
create        index if not exists fci_bonos_mv_ord  on public.fci_bonos_mv  (n_fondos desc, activo);

create unique index if not exists fci_fondos_mv_pk  on public.fci_fondos_mv (fondo);
create        index if not exists fci_fondos_mv_ord on public.fci_fondos_mv (gerente, fondo);

create unique index if not exists fci_fechas_mv_pk  on public.fci_fechas_mv (fecha);


-- ---------------------------------------------------------------------------
-- 3) Repuntar los RPC a las vistas
--    Misma firma y mismo ORDER BY -> el front no cambia.
-- ---------------------------------------------------------------------------
create or replace function public.fci_bonos()
returns table(activo text, tipo text, moneda text, ticker text, n_fondos int)
language sql stable as $$
  select activo, tipo, moneda, ticker, n_fondos
  from public.fci_bonos_mv
  order by n_fondos desc, activo
$$;

create or replace function public.fci_fondos()
returns table(fondo text, gerente text, n_fechas int)
language sql stable as $$
  select fondo, gerente, n_fechas
  from public.fci_fondos_mv
  order by gerente, fondo
$$;

create or replace function public.fci_fechas()
returns setof date language sql stable as $$
  select fecha from public.fci_fechas_mv order by 1
$$;


-- ---------------------------------------------------------------------------
-- 4) Permisos
--    Las funciones son SECURITY INVOKER, así que quien las llama necesita
--    poder leer la vista. Las MV no soportan RLS: exponen sólo agregados
--    (nombre de activo/fondo y conteos), que es lo que el RPC ya devolvía.
-- ---------------------------------------------------------------------------
grant select on public.fci_bonos_mv  to anon, authenticated;
grant select on public.fci_fondos_mv to anon, authenticated;
grant select on public.fci_fechas_mv to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4b) Función de refresco, para que el sync la llame al terminar de importar
--
--     SECURITY DEFINER es necesario: REFRESH MATERIALIZED VIEW exige ser dueño
--     de la vista, y quien llama (service_role) no lo es. Con SECURITY DEFINER
--     la función corre con los permisos de su dueño (postgres), que sí lo es.
--     `set search_path` es obligatorio en funciones SECURITY DEFINER.
--
--     Sólo service_role puede ejecutarla: la anon key está embebida en la
--     página pública, así que no debe poder disparar refrescos.
-- ---------------------------------------------------------------------------
create or replace function public.fci_refrescar_catalogos()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.fci_bonos_mv;
  refresh materialized view concurrently public.fci_fondos_mv;
  refresh materialized view concurrently public.fci_fechas_mv;
  return 'ok';
end $$;

revoke all on function public.fci_refrescar_catalogos() from public;
revoke all on function public.fci_refrescar_catalogos() from anon;
revoke all on function public.fci_refrescar_catalogos() from authenticated;
grant execute on function public.fci_refrescar_catalogos() to service_role;

notify pgrst, 'reload schema';   -- refrescar el cache de PostgREST


-- ============================================================================
--  5) REFRESCO — las MV NO se actualizan solas
--
--  Ya está resuelto de forma automática: `src/supabase_sync.py` llama a
--  fci_refrescar_catalogos() al terminar de subir tenencias. Los catálogos
--  quedan al día exactamente cuando cambian los datos, sin depender de que
--  alguien se acuerde.
--
--  Si alguna vez necesitás forzarlo a mano (SQL Editor):
--
--   refresh materialized view concurrently public.fci_bonos_mv;
--   refresh materialized view concurrently public.fci_fondos_mv;
--   refresh materialized view concurrently public.fci_fechas_mv;
--
--  Nota: el primer refresh de una MV recién creada no puede ser CONCURRENTLY
--  (ya queda poblada por el CREATE, así que no hace falta).
-- ============================================================================


-- ---------------------------------------------------------------------------
--  VERIFICACIÓN — debería devolver 2714 / ~1145 / ~16 y en milisegundos
-- ---------------------------------------------------------------------------
-- select count(*) from public.fci_bonos();
-- select count(*) from public.fci_fondos();
-- select count(*) from public.fci_fechas();
-- explain analyze select * from public.fci_bonos() limit 1000 offset 2000;


-- ---------------------------------------------------------------------------
--  ROLLBACK — vuelve a la definición original (agregación en vivo)
-- ---------------------------------------------------------------------------
-- create or replace function public.fci_bonos()
-- returns table(activo text, tipo text, moneda text, ticker text, n_fondos int)
-- language sql stable as $$
--   select activo, max(tipo), max(moneda), max(ticker), count(distinct fondo)::int
--   from public.fci_tenencias group by activo order by count(distinct fondo) desc, activo
-- $$;
--
-- create or replace function public.fci_fondos()
-- returns table(fondo text, gerente text, n_fechas int) language sql stable as $$
--   select fondo, max(gerente), count(distinct fecha)::int
--   from public.fci_tenencias group by fondo order by max(gerente), fondo
-- $$;
--
-- create or replace function public.fci_fechas()
-- returns setof date language sql stable as $$
--   select distinct fecha from public.fci_tenencias order by 1
-- $$;
--
-- drop materialized view if exists public.fci_bonos_mv;
-- drop materialized view if exists public.fci_fondos_mv;
-- drop materialized view if exists public.fci_fechas_mv;
-- notify pgrst, 'reload schema';
