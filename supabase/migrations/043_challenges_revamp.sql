-- Reworks Challenges from "one global slot, usually empty" into an
-- always-something-running, browsable feature:
--   - category: a theme icon/label (speed, budget, dietary, cuisine,
--     pantry, leftovers) for the client's weekly auto-rotation and for
--     a user picking a flavor when starting their own. Null for an
--     older/freeform challenge.
--   - group_id: null = sitewide (visible to everyone), set = scoped to
--     one group's own members, mirroring group_polls/group_events.
--   - winner_user_id / winner_computed_at: once a challenge ends, the
--     client lazily computes the top-hearts entrant and writes it here
--     (see cookzer-challenges.html loadPastChallenges) — computed once,
--     not on every page load, and only usable to *set* a currently-null
--     winner on an already-ended challenge (see the update policy below).
alter table public.challenges
  add column category text,
  add column group_id uuid references public.groups(id) on delete cascade,
  add column winner_user_id uuid references public.profiles(id) on delete set null,
  add column winner_computed_at timestamptz,
  -- True for the client's own weekly auto-seeded challenge (see
  -- ensureWeeklyChallenge in challenges-shared.js) — labeled "This
  -- week's featured challenge" rather than "Started by <whoever's
  -- browser happened to trigger it>".
  add column is_auto_generated boolean not null default false;

create index challenges_group_idx on public.challenges(group_id);
create index challenges_ends_at_idx on public.challenges(ends_at);

-- Sitewide challenges (group_id null) stay visible to any authenticated
-- user, same as before; a group challenge is only visible to that
-- group's members.
drop policy "Challenges are viewable by any authenticated user" on public.challenges;
create policy "Sitewide challenges viewable by anyone; group challenges by members"
  on public.challenges for select
  using (
    group_id is null
    or exists (select 1 from public.group_members gm where gm.group_id = challenges.group_id and gm.user_id = auth.uid())
  );

-- Creating a challenge for a group now requires being a member of it
-- (sitewide creation is unchanged — any authenticated user, as before).
drop policy "Authenticated users can create a challenge" on public.challenges;
create policy "Create a sitewide challenge, or one for a group you're in"
  on public.challenges for insert
  with check (
    created_by = auth.uid()
    and (
      group_id is null
      or exists (select 1 from public.group_members gm where gm.group_id = challenges.group_id and gm.user_id = auth.uid())
    )
  );

-- Lazily finalizing a winner is the one update this table needs: any
-- authenticated user can set winner_user_id/winner_computed_at on an
-- already-ended challenge that doesn't have one yet (whoever's Past
-- Challenges list loads first does the computing) — never on a still-
-- running challenge, and never overwriting one already set.
create policy "Anyone can finalize an ended challenge's winner once"
  on public.challenges for update
  using (ends_at < now() and winner_user_id is null)
  with check (ends_at < now());

-- A new notification type: the challenge's winner gets told, the same
-- way every other event type here does (a security-definer trigger, not
-- a client-side insert — public.notifications still has no insert
-- policy of its own; see migration 025).
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow', 'heart', 'comment', 'remake', 'challenge_join', 'message', 'review', 'group_join', 'challenge_winner'));

create or replace function public.notify_on_challenge_winner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.winner_user_id is null or old.winner_user_id is not distinct from new.winner_user_id then
    return new;
  end if;
  perform public.create_notification(
    new.winner_user_id, new.created_by, 'challenge_winner',
    'You won "' || new.title || '"! 🏆',
    'cookzer-challenges.html'
  );
  return new;
end;
$$;

create trigger trg_notify_on_challenge_winner
  after update on public.challenges
  for each row execute function public.notify_on_challenge_winner();
