-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Subsector por emisor + fin del sector "Energía (otros)"              ║
-- ║  Ejecutar UNA VEZ en el SQL Editor de Supabase                        ║
-- ║  https://supabase.com/dashboard/project/wctnzrceulkskucejwjo/sql/new  ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- El sector es propiedad del emisor (issuer_ratings) y el subsector también: se edita en
-- el editor de Emisores, al lado del sector y el rating. La app funciona sin esta columna
-- (muestra "Sin subsector" y no la escribe) hasta que se corra este script.

-- ────────── 1) Columna ──────────
alter table public.issuer_ratings
  add column if not exists subsector text not null default '';

comment on column public.issuer_ratings.subsector is
  'Subsector del emisor dentro de su sector (ej: Petróleo y gas). Vacío = sin subsector';

-- ────────── 2) Precarga de los emisores de Energía (solo si no tienen uno) ──────────
update public.issuer_ratings r
   set subsector = v.subsector
  from (values
    ('ypf',               'Petróleo y gas'),
    ('panamericanenergy', 'Petróleo y gas'),
    ('pluspetrol',        'Petróleo y gas'),
    ('tecpetrol',         'Petróleo y gas'),
    ('vista',             'Petróleo y gas'),
    ('cgc',               'Petróleo y gas'),
    ('capex',             'Petróleo y gas'),
    ('pecom',             'Petróleo y gas'),
    ('ypfluz',            'Generación eléctrica'),
    ('cepu',              'Generación eléctrica'),
    ('aes',               'Generación eléctrica'),
    ('pampa',             'Generación eléctrica'),
    ('genneia',           'Generación eléctrica'),
    ('luzdetrespicos',    'Generación eléctrica'),
    ('pcr',               'Generación eléctrica'),
    ('msu',               'Generación eléctrica'),
    ('msugreenenergy',    'Generación eléctrica'),
    ('edenor',            'Distribución (electricidad y gas)'),
    ('edemsa',            'Distribución (electricidad y gas)'),
    ('camuzzi',           'Distribución (electricidad y gas)'),
    ('oiltanking',        'Transporte y almacenamiento'),
    ('otamericaebytem',   'Transporte y almacenamiento'),
    ('vmos',              'Transporte y almacenamiento'),
    ('mineraexar',        'Minería')
  ) as v(issuer_key, subsector)
 where r.issuer_key = v.issuer_key
   and coalesce(r.subsector, '') = '';

-- ────────── 3) "Energía (otros)" pasa a "Energía" ──────────
-- En los bonos (lo usa el catálogo cuando el emisor no tiene sector propio) y en el
-- histórico de operaciones de BYMA, para que el sector no reaparezca en los reportes.
update public.bonds      set sector = 'Energía' where sector = 'Energía (otros)';
update public.market_ops set sector = 'Energía' where sector = 'Energía (otros)';
