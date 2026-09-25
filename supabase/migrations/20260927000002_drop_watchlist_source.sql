-- The taste-picks branch briefly added watchlist.source; watch attribution
-- lives in watch_intents.source and discover_events instead (surface
-- "taste"). Nothing reads or writes this column.
alter table watchlist drop column if exists source;
