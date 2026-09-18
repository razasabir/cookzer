-- Family meal planning: private groups, Family Profiles (lightweight
-- named sub-identities for household members who don't want their own
-- login), meal suggestions, and sharing a week's meal plan with a group.
--
-- 1. Private groups. Migration 011's groups are all public (any
--    authenticated user can browse and join) — fine for open cooking
--    communities, wrong for a household's own space. Adds is_private +
--    a short invite_code; joining a private group goes through
--    join_private_group() (the code) rather than the open self-join
--    path 011 already allows for public groups.
alter table public.groups add column is_private boolean not null default false;
alter table public.groups add column invite_code text unique;

drop policy "Groups are viewable by any authenticated user" on public.groups;
create policy "Public groups viewable by anyone, private groups by members only"
  on public.groups for select
  using (
    not is_private
    or created_by = auth.uid()
    or exists (select 1 from public.group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid())
  );

drop policy "Users can join a group as themselves" on public.group_members;
create policy "Users can join a public group as themselves"
  on public.group_members for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.groups g where g.id = group_id and not g.is_private)
  );

create or replace function public.join_private_group(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where invite_code = p_invite_code and is_private;
  if v_group_id is null then
    raise exception 'That invite code doesn''t match a private group.';
  end if;
  insert into public.group_members (group_id, user_id) values (v_group_id, auth.uid())
    on conflict (group_id, user_id) do nothing;
  return v_group_id;
end;
$$;

-- 2. Family Profiles — no email/password of their own, just a name +
--    emoji a household's own account creates so a shared kitchen
--    device can attribute a meal suggestion to "Emma" or "Jake"
--    without treating them as full separate users.
create table public.family_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  avatar_emoji text not null default '🧑',
  created_at timestamptz not null default now()
);

alter table public.family_profiles enable row level security;

create policy "Family profiles are viewable by any authenticated user"
  on public.family_profiles for select
  using (auth.role() = 'authenticated');

create policy "Owner manages their own family profiles"
  on public.family_profiles for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create index family_profiles_owner_idx on public.family_profiles(owner_id);

-- 3. Meal suggestions — up to 5 per day per group (enforced client
--    side, same as the video-length cap elsewhere), from either a real
--    member of the group or one of their Family Profiles, never both.
create table public.meal_suggestions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  suggestion_date date not null,
  dish_text text not null,
  recipe_id uuid references public.recipes(id) on delete set null,
  suggested_by_user_id uuid references public.profiles(id) on delete cascade,
  suggested_by_family_profile_id uuid references public.family_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint meal_suggestions_one_suggester check (
    (suggested_by_user_id is not null and suggested_by_family_profile_id is null)
    or (suggested_by_user_id is null and suggested_by_family_profile_id is not null)
  )
);

alter table public.meal_suggestions enable row level security;

create policy "Group members view suggestions"
  on public.meal_suggestions for select
  using (exists (select 1 from public.group_members gm where gm.group_id = meal_suggestions.group_id and gm.user_id = auth.uid()));

create policy "Group members add a suggestion as themselves or their family profile"
  on public.meal_suggestions for insert
  with check (
    exists (select 1 from public.group_members gm where gm.group_id = meal_suggestions.group_id and gm.user_id = auth.uid())
    and (
      suggested_by_user_id = auth.uid()
      or suggested_by_family_profile_id in (select id from public.family_profiles where owner_id = auth.uid())
    )
  );

create policy "Suggester (or their family profile's owner) can delete it"
  on public.meal_suggestions for delete
  using (
    suggested_by_user_id = auth.uid()
    or suggested_by_family_profile_id in (select id from public.family_profiles where owner_id = auth.uid())
  );

create index meal_suggestions_group_date_idx on public.meal_suggestions(group_id, suggestion_date);

-- 4. Sharing a meal plan with a group — meal_plan_entries (migration
--    003) stayed strictly private (user_id = auth.uid() for every
--    operation, including select). Adding group_id and one extra
--    SELECT policy (Postgres OR's multiple permissive policies for the
--    same command together) makes an entry additionally visible to
--    that group's members once its owner sets it, without touching who
--    can edit it — still only its own owner.
alter table public.meal_plan_entries add column group_id uuid references public.groups(id) on delete set null;

create policy "Group members view meal plan entries shared with their group"
  on public.meal_plan_entries for select
  using (
    group_id is not null
    and exists (select 1 from public.group_members gm where gm.group_id = meal_plan_entries.group_id and gm.user_id = auth.uid())
  );

create index meal_plan_group_idx on public.meal_plan_entries(group_id) where group_id is not null;
