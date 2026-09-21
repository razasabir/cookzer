-- Restaurant module Phase 4: a Cookzer-granted "Verified" trust mark
-- (distinct from Phase 3's "claimed business" — a restaurant can be
-- Cookzer Verified without anyone having claimed it, e.g. a well-
-- established place an admin has vetted by hand) and time-boxed
-- sponsored placement. Both are admin-only, schema/UI only for now —
-- what actually grants "featured" (a real payment) is future work that
-- needs Stripe credentials the app doesn't have yet; this just gives
-- an admin a lever to set it by hand in the meantime.

alter table public.restaurants
  add column if not exists is_verified boolean not null default false,
  add column if not exists featured_until timestamptz;

create index if not exists restaurants_featured_until_idx on public.restaurants(featured_until) where featured_until is not null;

-- Neither column is in the authenticated column-level UPDATE grant from
-- migration 049 (name, address, lat, lng, google_place_id, google_rating,
-- created_by only), so they're already unwritable by direct client
-- update — only reachable through these two RPCs, same defense-in-depth
-- pattern as claimed_by/claim_status.

create or replace function public.set_restaurant_verified(p_restaurant_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can set a restaurant''s verified status';
  end if;

  update public.restaurants set is_verified = p_verified where id = p_restaurant_id;
  if not found then
    raise exception 'Restaurant not found';
  end if;
end;
$$;

-- p_days null (or <= 0) clears featured placement; otherwise sets
-- featured_until to p_days from now, extending or shortening whatever
-- window (if any) is already active rather than stacking on top of it.
create or replace function public.set_restaurant_featured(p_restaurant_id uuid, p_days integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can set a restaurant''s featured placement';
  end if;

  update public.restaurants
  set featured_until = case when p_days is null or p_days <= 0 then null else now() + make_interval(days => p_days) end
  where id = p_restaurant_id;
  if not found then
    raise exception 'Restaurant not found';
  end if;
end;
$$;
