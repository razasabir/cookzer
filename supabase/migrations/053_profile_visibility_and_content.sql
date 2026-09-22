-- Profile module batch, phase A: schema foundation for profile visibility,
-- social links, dietary tags, and a verified-creator flag, plus the
-- anonymous-readable RPC the public logged-out profile preview (phase B)
-- calls instead of reading public.profiles directly.

alter table public.profiles
  add column if not exists profile_visibility text not null default 'public',
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists dietary_tags text[] not null default '{}'::text[],
  add column if not exists is_verified_creator boolean not null default false;

do $$ begin
  alter table public.profiles
    add constraint profiles_visibility_check
    check (profile_visibility in ('public', 'followers'));
exception when duplicate_object then null;
end $$;

-- The bootstrap policy ("viewable by any authenticated user") never
-- enforced followers-only, because the concept didn't exist. Replace it
-- so an authenticated viewer sees a profile when it's public, it's their
-- own, or they already follow the owner. Anonymous (anon-role) access is
-- deliberately NOT granted here — profiles carries internal columns
-- (referred_by, is_platform_admin, household_size, notifications_read_at)
-- that a raw table read shouldn't hand to a logged-out visitor. Anonymous
-- preview access goes through get_public_profile_preview() below instead,
-- which returns a hand-picked column whitelist.
drop policy if exists "Profiles are viewable by any authenticated user" on public.profiles;
drop policy if exists "Authenticated users can view visible profiles" on public.profiles;
create policy "Authenticated users can view visible profiles"
  on public.profiles for select
  to authenticated
  using (
    profile_visibility = 'public'
    or auth.uid() = id
    or exists (
      select 1 from public.follows
      where follower_id = auth.uid() and followee_id = profiles.id
    )
  );

-- Public logged-out profile preview: a security-definer RPC (bypasses
-- RLS as its owner) rather than an anon RLS policy, so the anon role only
-- ever gets exactly these columns, never a raw table read. Returns null
-- for a followers-only profile — the page shows a "sign in to see more"
-- state instead of a preview in that case.
create or replace function public.get_public_profile_preview(p_id uuid)
returns table (
  id uuid,
  display_name text,
  initials text,
  avatar_url text,
  bio text,
  location text,
  cover_gradient text,
  is_kitchen_cv boolean,
  cv_title text,
  is_verified_creator boolean,
  follower_count bigint,
  recipe_count bigint,
  pinned_recipe_id uuid,
  pinned_recipe_title text,
  pinned_recipe_hero_photo_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.display_name, p.initials, p.avatar_url, p.bio, p.location,
    p.cover_gradient, p.is_kitchen_cv, p.cv_title, p.is_verified_creator,
    (select count(*) from public.follows f where f.followee_id = p.id),
    (select count(*) from public.recipes r where r.author_id = p.id),
    p.pinned_recipe_id, pr.title, pr.hero_photo_path
  from public.profiles p
  left join public.recipes pr on pr.id = p.pinned_recipe_id
  where p.id = p_id and p.profile_visibility = 'public';
$$;

grant execute on function public.get_public_profile_preview(uuid) to anon, authenticated;
