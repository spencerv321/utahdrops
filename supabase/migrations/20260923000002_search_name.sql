-- Punctuation-insensitive search: "makers mark" must find MAKER'S MARK.
-- Apostrophes are dropped (MAKER'S → makers), other punctuation becomes a
-- space, so matching and A→Z sorting ignore leading "-" / "#" junk.
alter table products
  add column if not exists search_name text
  generated always as (
    btrim(regexp_replace(
      regexp_replace(lower(name), '[''’`]', '', 'g'),
      '[^a-z0-9.]+', ' ', 'g'))
  ) stored;

create index if not exists products_search_name_trgm
  on products using gin (search_name gin_trgm_ops);
