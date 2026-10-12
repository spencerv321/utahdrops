-- DABS active licenses and permits (the public "Licensee List" report on
-- abs.utah.gov/licenses-permits/license-information/), refreshed weekly by
-- the licensees job (scripts/licensees.ts). Powers /bars. A license missing
-- from a later pull gets removed_at; it is never deleted.
create table if not exists licensees (
  license_number       text primary key,          -- e.g. BAR-101, TV-14
  category             text not null,             -- On-Premises Retail, Off-Premises Beer, ...
  type                 text not null,             -- Bar Establishment, Restaurant - Full Service, ...
  business_name        text not null,
  address              text,
  city                 text,                      -- parsed from address; null when DABS gives none
  county               text,
  original_issue_date  date,
  conditional_approval boolean,
  new_this_month       boolean not null default false,
  first_seen           timestamptz not null default now(),
  last_seen            timestamptz not null default now(),
  removed_at           timestamptz
);
create index if not exists licensees_type on licensees (type) where removed_at is null;
alter table licensees enable row level security;
