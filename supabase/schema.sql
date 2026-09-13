-- Cookzer database schema (Supabase / Postgres)
-- Run this once in the Supabase SQL Editor: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run only if the tables don't already exist (no "if not exists" guards below,
-- so re-running after a partial failure means dropping the created objects first).

-- ============================================================
-- profiles: one row per signed-up user, auto-created on signup
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  initials text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by any authenticated user"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
create function public.handle_new_user()
returns trigger as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));
  insert into public.profiles (id, display_name, initials)
  values (new.id, chosen_name, upper(left(chosen_name, 2)));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- conversations + participants
-- ============================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;

create policy "Participants can view their conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.role() = 'authenticated' and created_by = auth.uid());

-- A plain "exists (select ... from conversation_participants)" here would
-- make Postgres re-evaluate this same policy while evaluating itself,
-- causing "infinite recursion detected in policy for relation
-- conversation_participants". A SECURITY DEFINER function breaks the loop
-- by checking membership with RLS bypassed for that one lookup.
create function public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = _conversation_id and user_id = _user_id
  );
$$;

create policy "Participants can view participant rows for their conversations"
  on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id, auth.uid()));

-- A plain "exists (select ... from conversations where created_by = ...)"
-- here runs into the same chicken-and-egg problem as the participant
-- recursion above: conversations' own SELECT policy hides the row from
-- the creator until they're already a participant of it - which is
-- exactly what this insert is trying to establish. A SECURITY DEFINER
-- function checks created_by with RLS bypassed, breaking the deadlock.
create function public.is_conversation_creator(_conversation_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversations
    where id = _conversation_id and created_by = _user_id
  );
$$;

-- A user can add themself, or the conversation's creator can add the other party.
create policy "Add self or add participants to a conversation you created"
  on public.conversation_participants for insert
  with check (
    user_id = auth.uid()
    or public.is_conversation_creator(conversation_id, auth.uid())
  );

create policy "Participants can update their own last_read_at"
  on public.conversation_participants for update
  using (user_id = auth.uid());

-- ============================================================
-- messages
-- ============================================================

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Participants can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "Participants can send messages in their conversations"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

-- Enable Realtime change events on messages so open threads update live.
alter publication supabase_realtime add table public.messages;
