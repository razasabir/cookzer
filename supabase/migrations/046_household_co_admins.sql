-- Household co-admins: today every part of the family-planning system
-- (family_profiles, meal_plan_entries, meal_suggestions, household_size)
-- is hard-wired to a single owning account (owner_id/user_id = you).
-- A spouse literally cannot add a meal for a kid's profile the other
-- spouse created, or edit the same weekly plan — not a missing button,
-- a database rule. This introduces a first-class Household that
-- multiple real accounts can jointly belong to, with equal rights (no
-- admin/member tier — "full options" for every co-admin), and re-points
-- family_profiles / meal_plan_entries / meal_suggestions at it.
--
-- Every existing planner-using account keeps working exactly as before:
-- the backfill below gives each one its own household (itself as sole
-- member), so nothing changes until someone actually adds a co-admin.
-- Run after 045.
--
-- Every statement below is written to be safely re-run (IF [NOT]
-- EXISTS guards throughout, same convention as 043's fix) — a first
-- attempt at this file failed partway through (households' own RLS
-- policies referenced household_members before that table existed yet,
-- a plain ordering bug), which left households created but empty and
-- would otherwise block every retry.

-- ============================================================
-- 1. households + household_members — both tables fully created
--    before either one's policies, since households' policies need
--    to reference household_members.
-- ============================================================

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text,
  household_size integer not null default 4 check (household_size between 1 and 12),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;

-- One row per user (not a composite key) — a person belongs to exactly
-- one household at a time, so "my household" is always a single lookup
-- by primary key, and joining a new one (via the RPC below) is a plain
-- upsert rather than a multi-row cleanup.
create table if not exists public.household_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  joined_at timestamptz not null default now()
);

alter table public.household_members enable row level security;
create index if not exists household_members_household_idx on public.household_members(household_id);

drop policy if exists "Household members can view their household" on public.households;
create policy "Household members can view their household"
  on public.households for select
  using (id in (select household_id from public.household_members where user_id = auth.uid()));

drop policy if exists "Household members can update household settings" on public.households;
create policy "Household members can update household settings"
  on public.households for update
  using (id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (id in (select household_id from public.household_members where user_id = auth.uid()));

drop policy if exists "Household members can see their household's other members" on public.household_members;
create policy "Household members can see their household's other members"
  on public.household_members for select
  using (household_id in (select hm.household_id from public.household_members hm where hm.user_id = auth.uid()));

drop policy if exists "Household members can remove a member (leave, or remove a co-admin)" on public.household_members;
create policy "Household members can remove a member (leave, or remove a co-admin)"
  on public.household_members for delete
  using (household_id in (select hm.household_id from public.household_members hm where hm.user_id = auth.uid()));

-- No insert/update policy: membership is only ever created or moved by
-- the security-definer functions below, never by a direct client
-- insert — the same pattern migration 028's join_private_group() already
-- uses. That also means a client can never insert themselves straight
-- into someone else's household, bypassing the merge logic that keeps
-- an invitee's existing kids/plan data attached to them.

-- ============================================================
-- 2. RPCs: create-on-first-use, and inviting a co-admin
-- ============================================================

create or replace function public.get_or_create_my_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id from public.household_members where user_id = auth.uid();
  if v_household_id is null then
    insert into public.households (created_by) values (auth.uid()) returning id into v_household_id;
    insert into public.household_members (household_id, user_id) values (v_household_id, auth.uid());
  end if;
  return v_household_id;
end;
$$;

-- Adding a co-admin moves their existing family profiles / meal plan /
-- suggestions into the inviter's household rather than leaving them
-- attached to a household the invitee just left (which would make that
-- data silently disappear from their own view). Their old, now-empty
-- household is cleaned up in the same transaction.
create or replace function public.add_household_co_admin(p_invitee_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_household_id uuid;
  v_invitee_household_id uuid;
begin
  if p_invitee_user_id = auth.uid() then
    raise exception 'You are already in your own household.';
  end if;

  v_my_household_id := public.get_or_create_my_household();

  select household_id into v_invitee_household_id from public.household_members where user_id = p_invitee_user_id;

  if v_invitee_household_id is not null then
    if v_invitee_household_id = v_my_household_id then
      raise exception 'That person is already in your household.';
    end if;
    update public.family_profiles set household_id = v_my_household_id where household_id = v_invitee_household_id;
    update public.meal_plan_entries set household_id = v_my_household_id where household_id = v_invitee_household_id;
    update public.meal_suggestions set household_id = v_my_household_id where household_id = v_invitee_household_id;
    delete from public.household_members where household_id = v_invitee_household_id;
    delete from public.households where id = v_invitee_household_id;
  end if;

  insert into public.household_members (household_id, user_id) values (v_my_household_id, p_invitee_user_id)
    on conflict (user_id) do update set household_id = v_my_household_id, joined_at = now();

  return v_my_household_id;
end;
$$;

-- ============================================================
-- 3. family_profiles: household_id replaces owner_id as the
--    permission boundary (owner_id stays, now just "who added this").
-- ============================================================

alter table public.family_profiles add column if not exists household_id uuid references public.households(id) on delete cascade;

drop policy if exists "Owner manages their own family profiles" on public.family_profiles;
drop policy if exists "Household members manage their household's family profiles" on public.family_profiles;
create policy "Household members manage their household's family profiles"
  on public.family_profiles for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

drop index if exists family_profiles_owner_linked_user_uidx;

-- ============================================================
-- 4. meal_plan_entries: same swap — the weekly grid becomes a shared
--    household plan (user_id stays, now just "who added this row").
-- ============================================================

alter table public.meal_plan_entries add column if not exists household_id uuid references public.households(id) on delete cascade;

drop policy if exists "Users manage their own meal plan entries" on public.meal_plan_entries;
drop policy if exists "Household members manage their household's meal plan" on public.meal_plan_entries;
create policy "Household members manage their household's meal plan"
  on public.meal_plan_entries for all
  using (household_id in (select household_id from public.household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from public.household_members where user_id = auth.uid()));

-- ============================================================
-- 5. meal_suggestions: household_id replaces owner_id as the "private
--    plan" boundary; group_id-based sharing (migration 028/035) is
--    untouched.
-- ============================================================

alter table public.meal_suggestions add column if not exists household_id uuid references public.households(id) on delete cascade;

-- The household_or_group replacement constraint is added further down,
-- *after* the backfill has populated household_id — added here, it
-- would reject every existing owner_id-only row on production (nullable
-- household_id, not yet backfilled) the instant it's declared.

drop policy if exists "View your own plan's suggestions or your group's" on public.meal_suggestions;
drop policy if exists "View your household's suggestions or your group's" on public.meal_suggestions;
create policy "View your household's suggestions or your group's"
  on public.meal_suggestions for select
  using (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
    or (group_id is not null and exists (select 1 from public.group_members gm where gm.group_id = meal_suggestions.group_id and gm.user_id = auth.uid()))
  );

drop policy if exists "Add a suggestion to your own plan, or your group's, as yourself or your family profile" on public.meal_suggestions;
drop policy if exists "Add a suggestion to your household's plan, or your group's, as yourself or a family profile" on public.meal_suggestions;
create policy "Add a suggestion to your household's plan, or your group's, as yourself or a family profile"
  on public.meal_suggestions for insert
  with check (
    (
      household_id in (select household_id from public.household_members where user_id = auth.uid())
      or (group_id is not null and exists (select 1 from public.group_members gm where gm.group_id = meal_suggestions.group_id and gm.user_id = auth.uid()))
    )
    and (
      suggested_by_user_id = auth.uid()
      or suggested_by_family_profile_id in (
        select id from public.family_profiles
        where household_id in (select household_id from public.household_members where user_id = auth.uid())
      )
    )
  );

drop policy if exists "Suggester (or their family profile's owner) can delete it" on public.meal_suggestions;
drop policy if exists "Suggester (or their household) can delete it" on public.meal_suggestions;
create policy "Suggester (or their household) can delete it"
  on public.meal_suggestions for delete
  using (
    suggested_by_user_id = auth.uid()
    or suggested_by_family_profile_id in (
      select id from public.family_profiles
      where household_id in (select household_id from public.household_members where user_id = auth.uid())
    )
  );

drop policy if exists "Suggester (or their family profile's owner) can update it" on public.meal_suggestions;
drop policy if exists "Suggester (or their household) can update it" on public.meal_suggestions;
create policy "Suggester (or their household) can update it"
  on public.meal_suggestions for update
  using (
    suggested_by_user_id = auth.uid()
    or suggested_by_family_profile_id in (
      select id from public.family_profiles
      where household_id in (select household_id from public.household_members where user_id = auth.uid())
    )
  )
  with check (
    suggested_by_user_id = auth.uid()
    or suggested_by_family_profile_id in (
      select id from public.family_profiles
      where household_id in (select household_id from public.household_members where user_id = auth.uid())
    )
  );

-- ============================================================
-- 6. Backfill: one household per existing planner-using account (itself
--    as sole member), so nothing breaks for anyone who hasn't added a
--    co-admin yet. "on conflict do nothing" on the membership insert
--    makes this safe to re-run — a user who already has a household
--    (from an earlier run, or from already using get_or_create_my_household)
--    is simply left alone.
-- ============================================================

with planner_users as (
  select distinct owner_id as user_id from public.family_profiles where owner_id is not null
  union
  select distinct user_id from public.meal_plan_entries where user_id is not null
  union
  select distinct owner_id as user_id from public.meal_suggestions where owner_id is not null
),
users_needing_household as (
  select pu.user_id from planner_users pu
  where not exists (select 1 from public.household_members hm where hm.user_id = pu.user_id)
),
new_households as (
  insert into public.households (created_by, household_size)
  select u.user_id, coalesce(p.household_size, 4)
  from users_needing_household u
  join public.profiles p on p.id = u.user_id
  returning id, created_by
)
insert into public.household_members (household_id, user_id)
select id, created_by from new_households
on conflict (user_id) do nothing;

update public.family_profiles fp
set household_id = hm.household_id
from public.household_members hm
where hm.user_id = fp.owner_id
and fp.household_id is distinct from hm.household_id;

update public.meal_plan_entries mpe
set household_id = hm.household_id
from public.household_members hm
where hm.user_id = mpe.user_id
and mpe.household_id is distinct from hm.household_id;

update public.meal_suggestions ms
set household_id = hm.household_id
from public.household_members hm
where hm.user_id = ms.owner_id
and ms.owner_id is not null
and ms.household_id is distinct from hm.household_id;

-- Every existing row now satisfies this: a group_id-only row already
-- did, and an owner_id-only row just got its household_id backfilled
-- above (the old constraint made "neither" impossible to begin with).
alter table public.meal_suggestions drop constraint if exists meal_suggestions_owner_or_group;
alter table public.meal_suggestions drop constraint if exists meal_suggestions_household_or_group;
alter table public.meal_suggestions add constraint meal_suggestions_household_or_group check (household_id is not null or group_id is not null);

-- owner_id on family_profiles was already not null, so every row above
-- is guaranteed a household_id now. meal_plan_entries.user_id and
-- meal_suggestions.owner_id are both nullable, so household_id stays
-- nullable on those two rather than risk a failed constraint on a
-- stray row — RLS and the application already require it going forward.
-- (Postgres treats SET NOT NULL on an already-NOT-NULL column as a
-- no-op, so this line alone is already safe to re-run.)
alter table public.family_profiles alter column household_id set not null;

create unique index if not exists family_profiles_household_linked_user_uidx
  on public.family_profiles(household_id, linked_user_id)
  where linked_user_id is not null;

create index if not exists meal_plan_household_date_idx on public.meal_plan_entries(household_id, plan_date);
