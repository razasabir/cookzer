-- Meal Planner restructure: one column per person you cook for, plus a
-- household-size setting that controls how many columns show.

-- 1. How many people you usually cook for — drives the Meal Planner's
--    column count independent of how many named Family Profiles exist
--    yet, so the planner can show "add a family member" placeholder
--    columns up to that count as a hint to go create them, rather than
--    just silently matching whatever's already in family_profiles.
alter table public.profiles
  add column household_size integer not null default 4
  check (household_size between 1 and 12);

-- 2. Meal suggestions assumed a suggestion is always shared with a real
--    group (group_id not null) — but the common case is a single
--    household with no group at all: a parent adds "Emma"/"Jake" Family
--    Profiles and wants a suggestion column for each on their own
--    private weekly plan. Adds owner_id (whose plan a suggestion
--    belongs to) and makes group_id optional: a suggestion is either
--    private (owner_id set, group_id null) or shared with a group
--    (group_id set, existing sharing behavior unchanged).
alter table public.meal_suggestions add column owner_id uuid references public.profiles(id) on delete cascade;
alter table public.meal_suggestions alter column group_id drop not null;
alter table public.meal_suggestions add constraint meal_suggestions_owner_or_group check (owner_id is not null or group_id is not null);

drop policy "Group members view suggestions" on public.meal_suggestions;
create policy "View your own plan's suggestions or your group's"
  on public.meal_suggestions for select
  using (
    owner_id = auth.uid()
    or (group_id is not null and exists (select 1 from public.group_members gm where gm.group_id = meal_suggestions.group_id and gm.user_id = auth.uid()))
  );

drop policy "Group members add a suggestion as themselves or their family profile" on public.meal_suggestions;
create policy "Add a suggestion to your own plan, or your group's, as yourself or your family profile"
  on public.meal_suggestions for insert
  with check (
    (
      owner_id = auth.uid()
      or (group_id is not null and exists (select 1 from public.group_members gm where gm.group_id = meal_suggestions.group_id and gm.user_id = auth.uid()))
    )
    and (
      suggested_by_user_id = auth.uid()
      or suggested_by_family_profile_id in (select id from public.family_profiles where owner_id = auth.uid())
    )
  );
