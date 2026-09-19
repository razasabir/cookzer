-- Group polls — general-purpose group decisions ("pizza or tacos
-- Friday?", "6pm or 7pm?"), distinct from the meal_suggestions
-- nomination system (migration 028), which is specifically about
-- proposing a dish for a specific planner day. A poll is single-choice,
-- 2-5 options, one vote per member, re-votable (voting again just
-- moves your vote rather than rejecting it).

create table public.group_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  question text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.group_polls enable row level security;

create policy "Group members view polls"
  on public.group_polls for select
  using (exists (select 1 from public.group_members gm where gm.group_id = group_polls.group_id and gm.user_id = auth.uid()));

create policy "Group members create a poll"
  on public.group_polls for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.group_members gm where gm.group_id = group_id and gm.user_id = auth.uid())
  );

create policy "Poll creator or group admin/owner can delete a poll"
  on public.group_polls for delete
  using (
    created_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
    or exists (select 1 from public.group_members gm where gm.group_id = group_polls.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
  );

create table public.group_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  option_text text not null,
  position int not null default 0
);

alter table public.group_poll_options enable row level security;

create policy "Group members view poll options"
  on public.group_poll_options for select
  using (
    exists (
      select 1 from public.group_polls gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = group_poll_options.poll_id and gm.user_id = auth.uid()
    )
  );

create policy "Poll creator adds its options"
  on public.group_poll_options for insert
  with check (exists (select 1 from public.group_polls gp where gp.id = poll_id and gp.created_by = auth.uid()));

create table public.group_poll_votes (
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  option_id uuid not null references public.group_poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.group_poll_votes enable row level security;

create policy "Group members view votes"
  on public.group_poll_votes for select
  using (
    exists (
      select 1 from public.group_polls gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = group_poll_votes.poll_id and gm.user_id = auth.uid()
    )
  );

create policy "Group members cast or change their own vote"
  on public.group_poll_votes for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_polls gp
      join public.group_members gm on gm.group_id = gp.group_id
      where gp.id = poll_id and gm.user_id = auth.uid()
    )
  );
