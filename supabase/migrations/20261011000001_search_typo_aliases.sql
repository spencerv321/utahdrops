-- Spelling aliases for zero-result searches seen in production (report.yml
-- deepdive, 2026-10-11): each maps one misspelling to the word DABS uses.
-- Mirrors SEARCH_ALIASES in lib/search-key.ts; run scripts/search-check.ts.
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
    ('orig', 'original'), ('btch', 'batch'), ('blantons', 'blanton'),
    ('macallen', 'macallan'), ('mcallen', 'macallan'), ('glendronaugh', 'glendronach'),
    ('meszcal', 'mezcal'), ('iichika', 'iichiko'), ('franciscorta', 'franciacorta')
  ) as a(abbrev, canonical) on a.abbrev = t.w
$$;

-- search_key is a stored generated column: recompute any row whose name
-- contains a newly aliased word (normally none). Idempotent.
update products set name = name
where search_key ~ '\m(macallen|mcallen|glendronaugh|meszcal|iichika|franciscorta)\M';
