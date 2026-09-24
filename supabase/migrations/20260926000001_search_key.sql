-- Search that matches how people type bottle names (see lib/search-key.ts,
-- which mirrors public.search_key exactly; scripts/search-check.ts compares
-- them over the whole catalog). DABS names are left untouched; this only adds
-- a normalized copy to search against:
--   BLANTON'S → blanton · E.H. TAYLOR → eh taylor · SNGL BRRL → single barrel
--   12YR → 12 yr
create or replace function public.search_key(name text)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(string_agg(coalesce(a.canonical, t.w), ' ' order by t.i), '')
  from unnest(string_to_array(nullif(
    regexp_replace(
      btrim(
        regexp_replace(regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(coalesce(name, '')), '[''’`]', '', 'g'),
              '(?<![0-9])\.|\.(?![0-9])', ' ', 'g'),
            '[^a-z0-9.]+', ' ', 'g'),
          '([a-z])([0-9])', '\1 \2', 'g'),
        '([0-9])([a-z])', '\1 \2', 'g')),
      '\m([a-z]) (?=[a-z]\M)', '\1', 'g'),
    ''), ' ')) with ordinality as t(w, i)
  left join (values
    ('sngl', 'single'), ('sgl', 'single'), ('brrl', 'barrel'), ('brl', 'barrel'), ('bbl', 'barrel'),
    ('brbn', 'bourbon'), ('bbn', 'bourbon'), ('whsky', 'whiskey'), ('whisky', 'whiskey'),
    ('yrs', 'yr'), ('year', 'yr'), ('years', 'yr'), ('rsv', 'reserve'), ('rsrv', 'reserve'),
    ('blnc', 'blanc'), ('sauv', 'sauvignon'), ('cab', 'cabernet'), ('chard', 'chardonnay'),
    ('slct', 'select'), ('blnd', 'blend'), ('dbl', 'double'), ('dble', 'double'),
    ('ltd', 'limited'), ('edtn', 'edition'), ('prf', 'proof'), ('teq', 'tequila'),
    ('spcl', 'special'), ('zin', 'zinfandel'), ('repo', 'reposado'), ('liq', 'liqueur'),
    ('orig', 'original'), ('btch', 'batch'), ('blantons', 'blanton')
  ) as a(abbrev, canonical) on a.abbrev = t.w
$$;

alter table products
  add column if not exists search_key text
  generated always as (public.search_key(name)) stored;

create index if not exists products_search_key_trgm
  on products using gin (search_key gin_trgm_ops);
