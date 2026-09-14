-- Restaurant check-ins: a post can optionally be tagged with a restaurant
-- name, looked up client-side via OpenStreetMap's free Overpass API (no key,
-- no billing account — see docs/product/master-plan.html for why this was
-- picked over Google Places/Foursquare). Run after 005.

alter table public.posts
  add column restaurant_name text;
