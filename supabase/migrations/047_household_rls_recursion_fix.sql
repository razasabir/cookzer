-- Migration 046 gave household_members two policies whose USING clause
-- queries household_members itself (to find "my" household before
-- checking every other member's row) — a self-referencing RLS policy.
-- Postgres cannot resolve that and rejects the query at runtime with
-- "infinite recursion detected in policy for relation household_members"
-- (error 42P17). This broke every direct client query through the new
-- household tables (Meal Planner, Family Profiles, Settings) the moment
-- a real user's session evaluated the policy — the two RPCs
-- (get_or_create_my_household, add_household_co_admin) never hit it
-- since security-definer functions bypass RLS, which is exactly why
-- local testing (and testing that ran everything as the Postgres
-- superuser, which also bypasses RLS) never caught it.
--
-- Fix: a small security-definer helper that looks up the caller's
-- household_id. Called from a policy's USING clause, it does not
-- re-trigger that same policy — it runs as its owner (which bypasses
-- RLS), not as the querying user. Every policy repeating the same
-- "household_id in (select ... from household_members where user_id =
-- auth.uid())" subquery is simplified to use it too, since a user only
-- ever has one household (household_members.user_id is a primary key).

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

-- household_members: the two self-referencing policies that actually
-- caused the recursion.
drop policy if exists "Household members can see their household's other members" on public.household_members;
create policy "Household members can see their household's other members"
  on public.household_members for select
  using (household_id = public.my_household_id());

drop policy if exists "Household members can remove a member (leave, or remove a co-admin)" on public.household_members;
create policy "Household members can remove a member (leave, or remove a co-admin)"
  on public.household_members for delete
  using (household_id = public.my_household_id());

-- households: not self-referencing (queries household_members, a
-- different table), but simplified to the same helper for consistency.
drop policy if exists "Household members can view their household" on public.households;
create policy "Household members can view their household"
  on public.households for select
  using (id = public.my_household_id());

drop policy if exists "Household members can update household settings" on public.households;
create policy "Household members can update household settings"
  on public.households for update
  using (id = public.my_household_id())
  with check (id = public.my_household_id());

-- family_profiles
drop policy if exists "Household members manage their household's family profiles" on public.family_profiles;
create policy "Household members manage their household's family profiles"
  on public.family_profiles for all
  using (household_id = public.my_household_id())
  with check (household_id = public.my_household_id());

-- meal_plan_entries
drop policy if exists "Household members manage their household's meal plan" on public.meal_plan_entries;
create policy "Household members manage their household's meal plan"
  on public.meal_plan_entries for all
  using (household_id = public.my_household_id())
  with check (household_id = public.my_household_id());

-- meal_suggestions
drop policy if exists "View your household's suggestions or your group's" on public.meal_suggestions;
create policy "View your household's suggestions or your group's"
  on public.meal_suggestions for select
  using (
    household_id = public.my_household_id()
    or (group_id is not null and exists (select 1 from public.group_members gm where gm.group_id = meal_suggestions.group_id and gm.user_id = auth.uid()))
  );

drop policy if exists "Add a suggestion to your household's plan, or your group's, as yourself or a family profile" on public.meal_suggestions;
create policy "Add a suggestion to your household's plan, or your group's, as yourself or a family profile"
  on public.meal_suggestions for insert
  with check (
    (
      household_id = public.my_household_id()
      or (group_id is not null and exists (select 1 from public.group_members gm where gm.group_id = meal_suggestions.group_id and gm.user_id = auth.uid()))
    )
    and (
      suggested_by_user_id = auth.uid()
      or suggested_by_family_profile_id in (
        select id from public.family_profiles where household_id = public.my_household_id()
      )
    )
  );

drop policy if exists "Suggester (or their household) can delete it" on public.meal_suggestions;
create policy "Suggester (or their household) can delete it"
  on public.meal_suggestions for delete
  using (
    suggested_by_user_id = auth.uid()
    or suggested_by_family_profile_id in (
      select id from public.family_profiles where household_id = public.my_household_id()
    )
  );

drop policy if exists "Suggester (or their household) can update it" on public.meal_suggestions;
create policy "Suggester (or their household) can update it"
  on public.meal_suggestions for update
  using (
    suggested_by_user_id = auth.uid()
    or suggested_by_family_profile_id in (
      select id from public.family_profiles where household_id = public.my_household_id()
    )
  )
  with check (
    suggested_by_user_id = auth.uid()
    or suggested_by_family_profile_id in (
      select id from public.family_profiles where household_id = public.my_household_id()
    )
  );
