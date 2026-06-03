-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  issuer_ratings — Rating crediticio por EMISOR (escala nacional AR)   ║
-- ║  Ejecutar UNA VEZ en el SQL Editor de Supabase                        ║
-- ║  https://supabase.com/dashboard/project/wctnzrceulkskucejwjo/sql/new  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ────────── 1) Tabla ──────────
create table if not exists public.issuer_ratings (
  issuer_key   text primary key,    -- clave canónica (normEmisor del front)
  issuer_label text not null,        -- nombre para mostrar/editar
  rating       text default '',      -- único rating por emisor (ej: 'AAA(arg)')
  updated_at   timestamptz default now()
);

-- ────────── 2) Trigger updated_at ──────────
create or replace function public.handle_issuer_ratings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists issuer_ratings_updated_at on public.issuer_ratings;
create trigger issuer_ratings_updated_at
  before update on public.issuer_ratings
  for each row execute function public.handle_issuer_ratings_updated_at();

-- ────────── 3) Row Level Security ──────────
alter table public.issuer_ratings enable row level security;

drop policy if exists "anyone can read issuer_ratings" on public.issuer_ratings;
create policy "anyone can read issuer_ratings"
  on public.issuer_ratings for select
  to anon, authenticated
  using (true);

drop policy if exists "auth users can write issuer_ratings" on public.issuer_ratings;
create policy "auth users can write issuer_ratings"
  on public.issuer_ratings for insert
  to authenticated
  with check (true);

drop policy if exists "auth users can update issuer_ratings" on public.issuer_ratings;
create policy "auth users can update issuer_ratings"
  on public.issuer_ratings for update
  to authenticated
  using (true) with check (true);

drop policy if exists "auth users can delete issuer_ratings" on public.issuer_ratings;
create policy "auth users can delete issuer_ratings"
  on public.issuer_ratings for delete
  to authenticated
  using (true);

-- ────────── 4) Realtime ──────────
alter publication supabase_realtime add table public.issuer_ratings;

-- ────────── 5) Seed: 46 emisores canónicos (rating preliminar Fitch/FIX donde se halló) ──────────
insert into public.issuer_ratings (issuer_key, issuer_label, rating) values
  ('aa2000', 'Aeropuertos Argentina 2000', 'AA+(arg)'),
  ('capex', 'CAPEX', ''),
  ('cgc', 'CGC', ''),
  ('msugreenenergy', 'MSU Green Energy', ''),
  ('genneia', 'Genneia', ''),
  ('aluar', 'Aluar', ''),
  ('luzdetrespicos', 'Luz de Tres Picos', ''),
  ('pampa', 'Pampa Energía', 'AAA(arg)'),
  ('msu', 'MSU', ''),
  ('oleoductosdelvalle', 'Oleoductos del Valle', 'AAA(arg)'),
  ('panamericanenergy', 'Pan American Energy', 'AAA(arg)'),
  ('pcr', 'PCR', ''),
  ('plazalogistica', 'Plaza Logística', ''),
  ('rizobacter', 'Rizobacter', 'A(arg)'),
  ('telecom', 'Telecom Argentina', 'AA+(arg)'),
  ('vista', 'Vista Energía Argentina', ''),
  ('ypfluz', 'YPF Luz', ''),
  ('ypf', 'YPF', ''),
  ('comafi', 'Banco Comafi', ''),
  ('cmf', 'Banco CMF', ''),
  ('bbva', 'BBVA Argentina', ''),
  ('galicia', 'Banco Galicia', 'AAA(arg)'),
  ('cnh', 'CNH Industrial', ''),
  ('cresud', 'Cresud', 'A(arg)'),
  ('edenor', 'Edenor', 'A(arg)'),
  ('johndeere', 'John Deere', ''),
  ('irsa', 'IRSA', 'AAA(arg)'),
  ('ledesma', 'Ledesma', ''),
  ('lomanegra', 'Loma Negra', ''),
  ('pecom', 'PECOM', ''),
  ('cepu', 'Central Puerto', 'AA(arg)'),
  ('otamericaebytem', 'OTAMERICA EBYTEM', ''),
  ('oiltanking', 'OilTanking', ''),
  ('edemsa', 'EDEMSA', ''),
  ('pluspetrol', 'Pluspetrol', 'AAA(arg)'),
  ('arcor', 'Arcor', ''),
  ('sanmiguel', 'San Miguel', ''),
  ('mercadopago', 'Mercado Pago / Crédito', ''),
  ('tarjetanaranja', 'Tarjeta Naranja', ''),
  ('tecpetrol', 'Tecpetrol', 'AAA(arg)'),
  ('mineraexar', 'Minera EXAR', ''),
  ('camuzzi', 'Camuzzi', ''),
  ('aes', 'AES Argentina', ''),
  ('macro', 'Banco Macro', 'AAA(arg)'),
  ('tgs', 'TGS', ''),
  ('supervielle', 'Banco Supervielle', '')
on conflict (issuer_key) do update set
  issuer_label = excluded.issuer_label,
  rating = case when excluded.rating <> '' then excluded.rating else public.issuer_ratings.rating end,
  updated_at = now();
