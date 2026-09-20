-- Phase 1 of the restaurant-tagging rework: unifies the two previously
-- separate restaurant concepts (posts.restaurant_name, a free-text string
-- set from the feed composer's OSM-based "Dining Out" check-in, and the
-- public.restaurants/restaurant_ratings tables used by the receipt-verified
-- ratings page) so a "Dining Out" post can link to a real, stable
-- restaurant record instead of just carrying a name string nothing else
-- can aggregate against.
--
-- google_place_id is what makes this stable: two different people typing
-- "Marfa Bowl" and "Marfa Bowl Co." would otherwise never be recognized as
-- the same place, but Google's place_id is the same for both once the
-- composer looks the place up via Places API (see cookzer-feed.html's
-- swap from Overpass to /api/places-nearby). tag_count is maintained by
-- trigger below rather than computed live, since the whole point of this
-- column is to answer "which restaurants keep getting tagged" cheaply
-- from a leaderboard/map query without a COUNT(*) join every time.

alter table public.restaurants
  add column if not exists google_place_id text unique,
  add column if not exists address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists google_rating numeric(2,1),
  add column if not exists tag_count integer not null default 0;

alter table public.posts
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null;

create index if not exists posts_restaurant_id_idx on public.posts(restaurant_id);
create index if not exists restaurants_tag_count_idx on public.restaurants(tag_count desc);

-- Any authenticated user needs to be able to create-or-reuse a restaurant
-- row by google_place_id from the composer (an upsert, not just their own
-- inserts) — the existing "authenticated users can add restaurants" policy
-- only covers insert; this adds the update half so an upsert's conflict
-- branch (touching created_by-owned-by-someone-else rows) doesn't get
-- silently blocked by RLS. Nothing sensitive lives on this row, so
-- allowing any authenticated user to fill in the Google-sourced fields
-- (which never change based on who's asking) is safe.
drop policy if exists "authenticated users can update google-sourced fields" on public.restaurants;
create policy "authenticated users can update google-sourced fields"
  on public.restaurants for update
  to authenticated
  using (true)
  with check (true);

create or replace function public.update_restaurant_tag_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.restaurant_id is not null then
      update public.restaurants set tag_count = tag_count + 1 where id = new.restaurant_id;
    end if;
  elsif TG_OP = 'DELETE' then
    if old.restaurant_id is not null then
      update public.restaurants set tag_count = greatest(tag_count - 1, 0) where id = old.restaurant_id;
    end if;
  elsif TG_OP = 'UPDATE' then
    if old.restaurant_id is distinct from new.restaurant_id then
      if old.restaurant_id is not null then
        update public.restaurants set tag_count = greatest(tag_count - 1, 0) where id = old.restaurant_id;
      end if;
      if new.restaurant_id is not null then
        update public.restaurants set tag_count = tag_count + 1 where id = new.restaurant_id;
      end if;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_update_restaurant_tag_count_ins on public.posts;
drop trigger if exists trg_update_restaurant_tag_count_del on public.posts;
drop trigger if exists trg_update_restaurant_tag_count_upd on public.posts;
create trigger trg_update_restaurant_tag_count_ins
  after insert on public.posts
  for each row execute function public.update_restaurant_tag_count();
create trigger trg_update_restaurant_tag_count_del
  after delete on public.posts
  for each row execute function public.update_restaurant_tag_count();
create trigger trg_update_restaurant_tag_count_upd
  after update of restaurant_id on public.posts
  for each row execute function public.update_restaurant_tag_count();

-- Backfill: best-effort link existing posts to an existing restaurants row
-- by exact (case-insensitive) name match, and seed a tag_count from
-- whatever's already linked. A post whose restaurant_name doesn't match
-- any existing restaurants row is left alone (restaurant_id stays null) —
-- there's no reliable place_id to dedupe it against retroactively, so it's
-- not worth guessing.
update public.posts p
set restaurant_id = r.id
from public.restaurants r
where p.restaurant_id is null
  and p.restaurant_name is not null
  and lower(r.name) = lower(p.restaurant_name);

update public.restaurants r
set tag_count = coalesce((select count(*) from public.posts p where p.restaurant_id = r.id), 0);
