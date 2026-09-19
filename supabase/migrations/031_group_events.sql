-- Group events — "what's happening" for a group, positioned as a
-- shared family planner: a Sunday roast, a grocery run, a birthday
-- dinner. Any member can post one; a lightweight RSVP (going/maybe/
-- can't go) shows who's actually coming, which is the whole point for
-- a household coordinating around meals.

create table public.group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  event_at timestamptz not null,
  location text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.group_events enable row level security;

create policy "Group members view events"
  on public.group_events for select
  using (exists (select 1 from public.group_members gm where gm.group_id = group_events.group_id and gm.user_id = auth.uid()));

create policy "Group members create events"
  on public.group_events for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.group_members gm where gm.group_id = group_id and gm.user_id = auth.uid())
  );

create policy "Event creator or group admin/owner can delete an event"
  on public.group_events for delete
  using (
    created_by = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
    or exists (select 1 from public.group_members gm where gm.group_id = group_events.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
  );

create index group_events_group_date_idx on public.group_events(group_id, event_at);

create table public.group_event_rsvps (
  event_id uuid not null references public.group_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.group_event_rsvps enable row level security;

create policy "Group members view RSVPs"
  on public.group_event_rsvps for select
  using (
    exists (
      select 1 from public.group_events ge
      join public.group_members gm on gm.group_id = ge.group_id
      where ge.id = group_event_rsvps.event_id and gm.user_id = auth.uid()
    )
  );

create policy "Group members set their own RSVP"
  on public.group_event_rsvps for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_events ge
      join public.group_members gm on gm.group_id = ge.group_id
      where ge.id = event_id and gm.user_id = auth.uid()
    )
  );
