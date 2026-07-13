-- Convención de devengamiento por bono.
--
-- 'ajustado' (default): los intereses se devengan hasta la FECHA DE PAGO EFECTIVA
--   (corrida a día hábil). Es lo habitual en las ONs locales: si el cupón teórico
--   cae sábado y se paga el lunes, esos 2 días devengan.
-- 'teorico': se devenga hasta la fecha de cupón TEÓRICA; correr el pago a día hábil
--   no paga interés extra (convención "unadjusted", típica de bonos internacionales).
--
-- Correr una sola vez en el SQL editor de Supabase ANTES de guardar bonos desde la app
-- (si la columna no existe, el upsert del catálogo falla).

alter table public.bonds
  add column if not exists devengo text not null default 'ajustado';

alter table public.bonds
  drop constraint if exists bonds_devengo_chk;

alter table public.bonds
  add constraint bonds_devengo_chk check (devengo in ('ajustado','teorico'));

comment on column public.bonds.devengo is
  'Convención de devengamiento: ajustado (hasta fecha de pago hábil) | teorico (hasta cupón teórico)';
