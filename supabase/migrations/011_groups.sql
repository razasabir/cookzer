-- Groups (Facebook-style communities): create/browse/join a group, post
-- within it. Kept simple to match the rest of the platform — all groups
-- are public (any authenticated user can see and join), no private/
-- invite-only groups yet. Group posts reuse the existing posts table
-- (a post with group_id set belongs to that group instead of the main
-- feed), so hearts/comments/bookmarks all work on group posts for free.
-- Run after 010.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_gradient text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

create policy "Groups are viewable by any authenticated user"
  on public.groups for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can create a group"
  on public.groups for insert
  with check (auth.role() = 'authenticated' and created_by = auth.uid());

create policy "Group creator can update their group"
  on public.groups for update
  using (created_by = auth.uid());

create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "Group members are viewable by any authenticated user"
  on public.group_members for select
  using (auth.role() = 'authenticated');

create policy "Users can join a group as themselves"
  on public.group_members for insert
  with check (user_id = auth.uid());

create policy "Users can leave a group as themselves"
  on public.group_members for delete
  using (user_id = auth.uid());

create index group_members_group_idx on public.group_members(group_id);
create index group_members_user_idx on public.group_members(user_id);

alter table public.posts
  add column group_id uuid references public.groups(id) on delete cascade;

create index posts_group_idx on public.posts(group_id);
