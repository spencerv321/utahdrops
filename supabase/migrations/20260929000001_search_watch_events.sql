-- Search and product-page actions join the discovery actions in
-- discover_events (same beacon, same admin/test exclusion, same attribution
-- through sign-in). New surfaces:
--   search   view exact | rough | browse (which result list was shown)
--   product  view page (the product page's Watch button)
-- New kind:
--   shown    a search result list was displayed (results = total matches,
--            0 = a zero-result search)
-- Columns, named as in taste_events:
--   rank     1-based position of a clicked result across pages
--   results  total matches for the list the action came from
--   query    the search words, trimmed to 200 chars (page_events already
--            keeps the same text for /search views)
alter table discover_events add column if not exists rank int;
alter table discover_events add column if not exists results int;
alter table discover_events add column if not exists query text;
