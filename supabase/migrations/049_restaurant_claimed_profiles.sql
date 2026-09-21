-- Restaurant module Phase 3: claimed business profiles. A restaurant
-- owner can claim their listing (with proof), a platform admin approves
-- or rejects it, and only the approved claimant can then edit their own
-- contact details (phone/website/menu). This is the first site-wide
-- admin concept in the app (every other "role" so far is per-group), so
-- it gets its own narrow column rather than reusing group_members.role.

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

-- One-time grant: the account that requested this feature is the only
-- admin for now. A real admin-management UI is future work; for now
-- this is the one seed an operator needs to run by hand for anyone else.
update public.profiles p
set is_platform_admin = true
from auth.users u
where u.id = p.id and u.email = 'razasabir@gmail.com';

-- Security-definer helper, same pattern as public.my_household_id() from
-- migration 047 — called from a policy's USING/WITH CHECK clause, it
-- reads profiles as its owner (bypassing RLS) rather than re-triggering
-- whatever policy is checking it.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false);
$$;

alter table public.restaurants
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claim_status text not null default 'unclaimed',
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists menu_url text;

do $$ begin
  alter table public.restaurants
    add constraint restaurants_claim_status_check
    check (claim_status in ('unclaimed', 'pending', 'approved', 'rejected'));
exception when duplicate_object then null;
end $$;

-- Migration 044 left restaurants' UPDATE policy wide open (using(true)
-- with check(true)) so anyone can refresh a Google-sourced listing's
-- public fields. RLS restricts which ROWS a policy allows, not which
-- COLUMNS an allowed row-level update may touch — so left as-is, that
-- same policy would let any authenticated user hand themselves
-- claimed_by/claim_status directly. Column-level grants are the actual
-- column boundary: revoke the blanket UPDATE grant Supabase's bootstrap
-- gives `authenticated`, then grant back only the Google-sourced fields
-- a client legitimately upserts. claimed_by/claim_status/phone/website/
-- menu_url become unwritable by direct client update — only reachable
-- through the security-definer RPCs below, which run as the function
-- owner and so aren't subject to these grants.
revoke update on public.restaurants from authenticated;
grant update (name, address, lat, lng, google_place_id, google_rating, created_by)
  on public.restaurants to authenticated;

create table if not exists public.restaurant_claim_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_email text not null,
  business_phone text,
  proof_photo_path text not null,
  status text not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.restaurant_claim_requests
    add constraint restaurant_claim_requests_status_check
    check (status in ('pending', 'approved', 'rejected'));
exception when duplicate_object then null;
end $$;

create index if not exists restaurant_claim_requests_restaurant_id_idx on public.restaurant_claim_requests(restaurant_id);
create index if not exists restaurant_claim_requests_user_id_idx on public.restaurant_claim_requests(user_id);
-- Only one pending claim per (restaurant, user) at a time — resubmitting
-- while a claim is already under review would just spam the admin queue.
create unique index if not exists restaurant_claim_requests_one_pending_idx
  on public.restaurant_claim_requests(restaurant_id, user_id) where status = 'pending';

alter table public.restaurant_claim_requests enable row level security;

drop policy if exists "Claimant or a platform admin can view a claim request" on public.restaurant_claim_requests;
create policy "Claimant or a platform admin can view a claim request"
  on public.restaurant_claim_requests for select
  using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists "A user can claim an unclaimed or rejected restaurant" on public.restaurant_claim_requests;
create policy "A user can claim an unclaimed or rejected restaurant"
  on public.restaurant_claim_requests for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.claim_status in ('unclaimed', 'rejected')
    )
  );

drop policy if exists "A user can withdraw their own still-pending claim" on public.restaurant_claim_requests;
create policy "A user can withdraw their own still-pending claim"
  on public.restaurant_claim_requests for delete
  using (user_id = auth.uid() and status = 'pending');

-- No UPDATE policy: approving/rejecting a claim only happens through
-- review_restaurant_claim() below, which is security definer and so
-- isn't gated by this table's RLS at all.

-- Any INSERT into restaurant_claim_requests immediately marks the
-- restaurant "pending" so the "Claim this restaurant" button can hide
-- itself right away, without waiting on the admin's decision.
create or replace function public.mark_restaurant_claim_pending() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.restaurants
  set claim_status = 'pending'
  where id = new.restaurant_id and claim_status in ('unclaimed', 'rejected');
  return new;
end;
$$;

drop trigger if exists trg_mark_restaurant_claim_pending on public.restaurant_claim_requests;
create trigger trg_mark_restaurant_claim_pending
  after insert on public.restaurant_claim_requests
  for each row execute function public.mark_restaurant_claim_pending();

-- Admin decision. Approving hands the restaurant to the claimant and
-- auto-rejects any other still-pending claims on the same restaurant
-- (only one owner at a time); rejecting reverts the restaurant to
-- 'pending' if another claim is still queued, or 'unclaimed' if not, so
-- someone else can claim it.
create or replace function public.review_restaurant_claim(p_claim_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_user_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can review restaurant claims';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select restaurant_id, user_id into v_restaurant_id, v_user_id
  from public.restaurant_claim_requests
  where id = p_claim_id and status = 'pending';

  if v_restaurant_id is null then
    raise exception 'Claim not found or already reviewed';
  end if;

  update public.restaurant_claim_requests
  set status = p_decision, admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_claim_id;

  if p_decision = 'approved' then
    update public.restaurants
    set claimed_by = v_user_id, claim_status = 'approved'
    where id = v_restaurant_id;

    update public.restaurant_claim_requests
    set status = 'rejected',
        admin_note = coalesce(admin_note, 'Another claim for this restaurant was approved.'),
        reviewed_by = auth.uid(), reviewed_at = now()
    where restaurant_id = v_restaurant_id and status = 'pending' and id <> p_claim_id;
  else
    update public.restaurants
    set claim_status = case
      when exists (
        select 1 from public.restaurant_claim_requests
        where restaurant_id = v_restaurant_id and status = 'pending' and id <> p_claim_id
      ) then 'pending'
      else 'unclaimed'
    end
    where id = v_restaurant_id;
  end if;
end;
$$;

-- Lets an approved claimant edit their own restaurant's contact details
-- without a broad client-side UPDATE grant on those columns (see the
-- revoke/grant above) — this function runs as its owner, so it can
-- write claimed-owner-only columns after checking the claim itself.
create or replace function public.update_restaurant_claimed_details(p_restaurant_id uuid, p_phone text, p_website text, p_menu_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.restaurants
  set phone = nullif(trim(p_phone), ''),
      website = nullif(trim(p_website), ''),
      menu_url = nullif(trim(p_menu_url), '')
  where id = p_restaurant_id and claimed_by = auth.uid() and claim_status = 'approved';

  if not found then
    raise exception 'You do not have an approved claim on this restaurant';
  end if;
end;
$$;

-- Claim proof photos (business license, utility bill, ID — whatever
-- shows the claimant actually runs the place) are private: only the
-- uploader and a platform admin can view them, unlike the app's public
-- post/recipe photo buckets.
insert into storage.buckets (id, name, public)
values ('restaurant-claim-proofs', 'restaurant-claim-proofs', false)
on conflict (id) do nothing;

drop policy if exists "Claim proof uploader or a platform admin can view it" on storage.objects;
create policy "Claim proof uploader or a platform admin can view it"
  on storage.objects for select
  using (
    bucket_id = 'restaurant-claim-proofs'
    and (owner = auth.uid() or public.is_platform_admin())
  );

drop policy if exists "Authenticated users can upload their own claim proof" on storage.objects;
create policy "Authenticated users can upload their own claim proof"
  on storage.objects for insert
  with check (
    bucket_id = 'restaurant-claim-proofs'
    and auth.role() = 'authenticated'
    and owner = auth.uid()
  );
