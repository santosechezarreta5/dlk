-- ============================================================
-- Movimientos de FCI — esquema Supabase para la app dlk
-- Correr UNA vez en el SQL editor de Supabase (Dashboard → SQL).
-- Crea tablas + RLS (anon read/write, igual que bonds) + RPCs de agregación.
-- Los datos los publica el sync de FCIs (src/supabase_sync.py) con la anon key.
-- ============================================================

-- ---------- Tablas ----------
create table if not exists public.fci_tenencias (
  fecha   date    not null,
  gerente text,
  fondo   text    not null,
  activo  text    not null,
  codigo  text,
  moneda  text,
  ticker  text,
  tipo    text,
  monto   double precision,          -- en millones de ARS (pesificado)
  primary key (fecha, fondo, activo)
);
create index if not exists idx_fci_ten_fecha   on public.fci_tenencias(fecha);
create index if not exists idx_fci_ten_tipo    on public.fci_tenencias(tipo);
create index if not exists idx_fci_ten_gerente on public.fci_tenencias(gerente);
create index if not exists idx_fci_ten_activo  on public.fci_tenencias(activo);
create index if not exists idx_fci_ten_ticker  on public.fci_tenencias(ticker);

create table if not exists public.fci_dolar (
  fecha date primary key,
  venta double precision
);

-- ---------- Permisos + RLS (anon, como bonds) ----------
grant select, insert, update, delete on public.fci_tenencias to anon;
grant select, insert, update, delete on public.fci_dolar    to anon;

alter table public.fci_tenencias enable row level security;
alter table public.fci_dolar     enable row level security;

drop policy if exists fci_ten_anon on public.fci_tenencias;
create policy fci_ten_anon on public.fci_tenencias for all to anon using (true) with check (true);
drop policy if exists fci_dol_anon on public.fci_dolar;
create policy fci_dol_anon on public.fci_dolar for all to anon using (true) with check (true);

-- ---------- RPCs (agregación server-side) ----------
-- Fechas de cartera disponibles
create or replace function public.fci_fechas()
returns setof date language sql stable as $$
  select distinct fecha from public.fci_tenencias order by 1
$$;

-- Catálogo de fondos (con su gerente)
create or replace function public.fci_fondos()
returns table(fondo text, gerente text, n_fechas int) language sql stable as $$
  select fondo, max(gerente), count(distinct fecha)::int
  from public.fci_tenencias group by fondo order by max(gerente), fondo
$$;

-- Catálogo de activos/bonos
create or replace function public.fci_bonos()
returns table(activo text, tipo text, moneda text, ticker text, n_fondos int)
language sql stable as $$
  select activo, max(tipo), max(moneda), max(ticker), count(distinct fondo)::int
  from public.fci_tenencias group by activo order by count(distinct fondo) desc, activo
$$;

-- Movimiento agregado: por dimensión (gerente|fondo|bono|tipo) entre dos fechas.
-- target activos = p_activos ∪ (todos los de p_tipos). Si ambos vacíos => sin filas.
create or replace function public.fci_mov_consulta(
  p_ini date, p_fin date,
  p_tipos    text[] default '{}',
  p_activos  text[] default '{}',
  p_gerentes text[] default '{}',
  p_agrupar  text   default 'gerente')
returns table(clave text, monto_ini double precision, monto_fin double precision)
language sql stable as $$
  select
    case p_agrupar
      when 'fondo' then fondo
      when 'bono'  then activo
      when 'tipo'  then tipo
      else gerente
    end as clave,
    coalesce(sum(monto) filter (where fecha = p_ini), 0) as monto_ini,
    coalesce(sum(monto) filter (where fecha = p_fin), 0) as monto_fin
  from public.fci_tenencias
  where fecha in (p_ini, p_fin)
    and (activo = any(p_activos) or tipo = any(p_tipos))
    and (coalesce(array_length(p_gerentes,1),0) = 0 or gerente = any(p_gerentes))
  group by 1
  having coalesce(sum(monto) filter (where fecha = p_ini),0) <> 0
      or coalesce(sum(monto) filter (where fecha = p_fin),0) <> 0
  order by abs(coalesce(sum(monto) filter (where fecha = p_fin),0)
             - coalesce(sum(monto) filter (where fecha = p_ini),0)) desc,
           coalesce(sum(monto) filter (where fecha = p_fin),0) desc
$$;

-- Cartera completa de un fondo (por activo) entre dos fechas.
create or replace function public.fci_mov_fondo(
  p_fondo text, p_ini date, p_fin date)
returns table(activo text, tipo text, moneda text,
              monto_ini double precision, monto_fin double precision)
language sql stable as $$
  select activo, max(tipo), max(moneda),
    coalesce(sum(monto) filter (where fecha = p_ini), 0),
    coalesce(sum(monto) filter (where fecha = p_fin), 0)
  from public.fci_tenencias
  where fondo = p_fondo and fecha in (p_ini, p_fin)
  group by activo
  order by abs(coalesce(sum(monto) filter (where fecha = p_fin),0)
             - coalesce(sum(monto) filter (where fecha = p_ini),0)) desc,
           coalesce(sum(monto) filter (where fecha = p_fin),0) desc
$$;

grant execute on function public.fci_fechas()       to anon;
grant execute on function public.fci_fondos()       to anon;
grant execute on function public.fci_bonos()        to anon;
grant execute on function public.fci_mov_consulta(date,date,text[],text[],text[],text) to anon;
grant execute on function public.fci_mov_fondo(text,date,date) to anon;

-- (refrescar el cache de PostgREST)
notify pgrst, 'reload schema';
