-- Profile module batch, phase F: profile-view analytics for the owner.
-- No existing analytics/event-tracking table in the app — this is
-- net-new. Insert-only from the viewer's side, read-only for the
-- profile owner, so a visitor can't see who else viewed a profile and
-- can't forge a view attributed to someone else.

create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists profile_views_viewed_id_created_at_idx on public.profile_views(viewed_id, created_at);

alter table public.profile_views enable row level security;

drop policy if exists "You can log your own profile views" on public.profile_views;
create policy "You can log your own profile views"
  on public.profile_views for insert
  to authenticated
  with check (viewer_id = auth.uid());

drop policy if exists "You can see who viewed your own profile" on public.profile_views;
create policy "You can see who viewed your own profile"
  on public.profile_views for select
  to authenticated
  using (viewed_id = auth.uid());
