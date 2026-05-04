-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  BonosCorp AR · Dollar Linked — Migración Supabase                  ║
-- ║  Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ────────── 1) Tabla principal ──────────
create table if not exists public.bonds (
  ticker            text primary key,
  emisor            text not null,
  sector            text not null,
  fecha_emision     date,
  fecha_inicio_int  date,
  venc              date not null,
  cupon             numeric(10,4) default 0,
  tipo_cupon        text default 'fijo',
  periodicidad      int default 6,
  base_dias         text default 'act365',
  amort             text default 'bullet',
  callable          text default 'No',
  moneda            text default 'DL',
  valor_residual    numeric(10,4) default 1,
  amort_sched       jsonb default '[]'::jsonb,
  isin              text,
  leg               text default 'Argentina',
  jur               text default 'Argentina',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists bonds_updated_idx on public.bonds(updated_at desc);

-- ────────── 2) Trigger para updated_at automático ──────────
create or replace function public.handle_bonds_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bonds_updated_at on public.bonds;
create trigger bonds_updated_at
  before update on public.bonds
  for each row execute function public.handle_bonds_updated_at();

-- ────────── 3) Row Level Security ──────────
alter table public.bonds enable row level security;

-- Lectura pública (cualquiera puede ver el catálogo)
drop policy if exists "anyone can read bonds" on public.bonds;
create policy "anyone can read bonds"
  on public.bonds for select
  to anon, authenticated
  using (true);

-- Escritura solo para usuarios autenticados (admins)
drop policy if exists "auth users can write bonds" on public.bonds;
create policy "auth users can write bonds"
  on public.bonds for insert
  to authenticated
  with check (true);

drop policy if exists "auth users can update bonds" on public.bonds;
create policy "auth users can update bonds"
  on public.bonds for update
  to authenticated
  using (true) with check (true);

drop policy if exists "auth users can delete bonds" on public.bonds;
create policy "auth users can delete bonds"
  on public.bonds for delete
  to authenticated
  using (true);

-- ────────── 4) Realtime — emitir cambios en vivo ──────────
alter publication supabase_realtime add table public.bonds;

-- ────────── 5) Insertar/upsert los 64 bonos del catálogo inicial ──────────

-- Total bonos a insertar: 64

insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('AER5O','AA 2000','Infraestructura','2022-02-21','2022-08-21','2032-02-21',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('AER9O','AA 2000','Infraestructura','2022-08-19','2023-02-19','2026-08-19',0,'fijo',6,'act365','bullet','Si','DL',0.6667,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CAC4O','Capex','Energía (otros)','2023-02-27','2023-08-27','2027-02-27',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CAC6O','Capex','Energía (otros)','2023-09-07','2024-03-07','2026-09-07',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CAC7O','Capex','Energía (otros)','2023-09-07','2024-03-07','2027-09-07',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CACAO','Capex','Energía (otros)','2024-07-05','2025-01-05','2027-07-05',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CP23O','CGC','Energía (otros)','2021-09-17','2022-03-17','2031-09-17',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CP27O','CGC','Energía (otros)','2022-06-07','2022-12-07','2029-06-07',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CP28O','CGC','Energía (otros)','2022-09-07','2023-03-07','2026-09-07',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CP29O','CGC','Energía (otros)','2023-01-19','2023-07-19','2027-01-19',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CP31O','CGC','Energía (otros)','2023-06-09','2023-12-09','2026-06-09',0,'fijo',6,'act365','bullet','No','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('CP39O','CGC','Energía (otros)','2025-12-29','2026-06-29','2027-03-29',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('EAC1O','MSU Green Energy','Energía (otros)','2023-10-12','2024-04-12','2026-10-12',1.0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('EAC2O','MSU Green Energy','Energía (otros)','2023-10-12','2024-04-12','2033-10-12',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('GN36O','Genneia','Energía (otros)','2021-12-23','2022-06-23','2031-12-23',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('GN37O','Genneia','Energía (otros)','2022-11-11','2023-05-11','2026-11-11',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('GN38O','Genneia','Energía (otros)','2023-02-10','2023-08-10','2033-02-10',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('GN39O','Genneia','Energía (otros)','2023-07-14','2024-01-14','2028-07-14',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('GN41O','Genneia','Energía (otros)','2023-07-14','2024-01-14','2026-07-14',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('GN42O','Genneia','Energía (otros)','2023-11-16','2024-05-16','2027-05-16',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('GN46O','Genneia','Energía (otros)','2024-06-27','2024-12-27','2026-06-27',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('LMS6O','Aluar','Consumo','2023-04-27','2023-10-27','2028-04-27',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('LUC3O','Luz de Tres Picos','Energía (otros)','2022-05-05','2022-11-05','2032-05-05',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('LUC4O','Luz de Tres Picos','Energía (otros)','2022-09-29','2023-03-29','2026-09-29',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('MGCEO','Pampa Energia','Energía (otros)','2022-12-19','2023-06-19','2027-12-19',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('MSSBO','MSU','Consumo','2022-11-14','2023-05-14','2026-11-14',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('MSSDO','MSU','Consumo','2022-11-14','2023-05-14','2032-11-14',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('OLC2O','Oleoductos del Valle','Infraestructura','2023-06-09','2023-12-09','2028-06-09',1.0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('OLC3O','Oleoductos del Valle','Infraestructura','2023-07-10','2024-01-10','2027-07-10',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('OLC4O','Oleoductos del Valle','Infraestructura','2024-06-14','2024-12-14','2026-06-14',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PN40O','Pan American Energy','Energía','2025-04-11','2025-10-11','2026-10-11',2.0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PNECO','Pan American Energy','Energía','2021-07-12','2022-01-12','2031-07-12',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PNFCO','Pan American Energy','Energía','2021-07-12','2022-01-12','2026-07-12',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PNICO','Pan American Energy','Energía','2022-02-07','2022-08-07','2032-02-07',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PNJCO','Pan American Energy','Energía','2022-02-07','2022-08-07','2027-02-07',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PNRCO','Pan American Energy','Energía','2023-08-07','2024-02-07','2028-08-07',1.0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PNZCO','Pan American Energy','Energía','2024-07-04','2025-01-04','2027-07-04',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PQCKO','PCR','Energía (otros)','2022-12-07','2023-06-07','2026-12-07',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PQCOO','PCR','Energía (otros)','2023-09-22','2024-03-22','2027-09-22',0,'fijo',6,'act365','bullet','No','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PQCQO','PCR','Energía (otros)','2024-07-16','2025-01-16','2027-07-16',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('PZCAO','Plaza Logistica','Infraestructura','2023-07-27','2024-01-27','2026-07-27',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('RZ8BO','Rizobacter','Consumo','2023-02-10','2023-08-10','2029-09-03',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('RZ9AO','Rizobacter','Consumo','2024-06-28','2024-12-28','2026-06-28',5.0,'fijo',6,'act365','bullet','No','DL',0.75,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('RZAAO','Rizobacter','Consumo','2024-11-28','2025-05-28','2026-11-28',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('TLCDO','Telecom Argentina','Infraestructura','2022-03-09','2022-09-09','2027-03-09',1.0,'fijo',6,'act365','bullet','No','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('TLCFO','Telecom Argentina','Infraestructura','2023-02-10','2023-08-10','2028-02-10',1.0,'fijo',6,'act365','bullet','No','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('TLCGO','Telecom Argentina','Infraestructura','2023-06-02','2023-12-02','2026-06-02',0,'fijo',6,'act365','bullet','No','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('TLCKO','Telecom Argentina','Infraestructura','2023-11-17','2024-05-17','2026-11-17',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('TLCLO','Telecom Argentina','Infraestructura','2024-06-06','2024-12-06','2026-06-06',5.0,'fijo',6,'act365','bullet','No','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('VSCDO','Vista Energy Argentina','Energía','2021-08-27','2022-02-27','2031-08-27',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('VSCHO','Vista Energy Argentina','Energía','2022-12-06','2023-06-06','2026-06-06',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('VSCIO','Vista Energy Argentina','Energía','2022-12-06','2023-06-06','2026-12-06',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('VSCJO','Vista Energy Argentina','Energía','2023-03-03','2023-09-03','2027-03-03',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('VSCKO','Vista Energy Argentina','Energía','2023-03-03','2023-09-03','2028-03-03',1.0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('VSCMO','Vista Energy Argentina','Energía','2023-08-11','2024-02-11','2028-08-11',0.99,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('VSCQO','Vista Energy Argentina','Energía','2024-07-08','2025-01-08','2028-07-08',3.0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('YFCAO','YPF Luz','Energía','2022-02-03','2022-08-03','2032-02-03',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('YFCDO','YPF Luz','Energía','2022-08-29','2023-02-28','2026-08-29',0,'fijo',6,'act365','bullet','No','DL',0.3334,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('YFCFO','YPF Luz','Energía','2024-02-27','2024-08-27','2027-02-27',0,'fijo',6,'act365','bullet','No','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('YMCLO','YPF','Energía','2021-07-22','2022-01-22','2032-07-22',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('YMCPO','YPF','Energía','2023-04-25','2023-10-25','2027-04-25',0,'fijo',6,'act365','bullet','Si','DL',1,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('YMCRO','YPF','Energía','2023-09-12','2024-03-12','2028-09-12',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('YMCTO','YPF','Energía','2023-10-10','2024-04-10','2026-10-10',0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;
insert into public.bonds (ticker,emisor,sector,fecha_emision,fecha_inicio_int,venc,cupon,tipo_cupon,periodicidad,base_dias,amort,callable,moneda,valor_residual,amort_sched,isin) values ('YMCWO','YPF','Energía','2024-07-01','2025-01-01','2026-07-01',1.0,'fijo',6,'act365','bullet','Si','DL',1.0,'[]'::jsonb,NULL) on conflict (ticker) do nothing;

-- ────────── 6) Crear cuenta admin (HACERLO MANUALMENTE) ──────────
-- Ir a: Authentication → Users → Add user
-- Email: tu-email@ejemplo.com
-- Password: (elegir una segura)

-- ✓ Listo. La app ya puede leer y vos podés escribir logueándote.
