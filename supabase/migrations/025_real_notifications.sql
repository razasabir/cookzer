-- Real notifications: until now, the bell/notifications page had no
-- backing table at all — every open re-queried 5 source tables live and
-- merged the results in JS (see notifications-shared.js), which only
-- ever showed something if you were actively looking right then, covered
-- just 5 of the platform's event types, and had no way to also deliver
-- anything outside the site (no row = nothing to hang an email off of).
--
-- This adds a real `notifications` table, written by a database trigger
-- on each source table (so it fires no matter what client did the
-- action, unlike a client-side "also insert a notification" call that
-- silently never happens if the tab closes first) — covering the
-- original 5 types (follow, heart, comment, remake, challenge join) plus
-- 3 that were missing entirely (new message, recipe review, group join).
-- Each trigger builds the full display message once, in one place, so
-- both the in-app bell/page and the notification email (item below) read
-- the exact same text instead of two copies of "how do I phrase this."
--
-- Run after 024.

-- Two new user-facing toggles: 3 more per-category switches (messages/
-- reviews/group joins), matching the existing 5, plus one channel-level
-- switch — "also email me" — since a category being on already governs
-- whether a notification is created at all; this just additionally gates
-- whether create_notification() cc's it to email.
alter table public.notification_prefs
  add column notify_messages boolean not null default true,
  add column notify_reviews boolean not null default true,
  add column notify_group_joins boolean not null default true,
  add column notify_email boolean not null default true;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('follow', 'heart', 'comment', 'remake', 'challenge_join', 'message', 'review', 'group_join')),
  message text not null,
  link_url text,
  -- Denormalized from auth.users/notification_prefs at insert time so the
  -- email-sending webhook (a Vercel function with only the anon key)
  -- never needs service-role access just to decide who/whether to email.
  recipient_email text,
  should_email boolean not null default true,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users see their own notifications"
  on public.notifications for select
  using (recipient_id = auth.uid());

create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- No insert policy: rows are only ever written by the security-definer
-- trigger functions below, which run as the function owner and bypass
-- RLS — regular users (anon/authenticated roles) can never insert one
-- directly, including for someone else.

create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications(recipient_id) where read_at is null;

-- Shared insert path for every trigger below: never notifies yourself,
-- and stamps the recipient's current email onto the row.
create or replace function public.create_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_message text,
  p_link_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_should_email boolean;
begin
  if p_recipient_id is null or p_recipient_id = p_actor_id then
    return;
  end if;
  select email into v_email from auth.users where id = p_recipient_id;
  select notify_email into v_should_email from public.notification_prefs where user_id = p_recipient_id;
  insert into public.notifications (recipient_id, actor_id, type, message, link_url, recipient_email, should_email)
  values (p_recipient_id, p_actor_id, p_type, p_message, p_link_url, v_email, coalesce(v_should_email, true));
end;
$$;

-- 1. New follower
create or replace function public.notify_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
begin
  select * into v_prefs from public.notification_prefs where user_id = new.followee_id;
  if v_prefs.user_id is not null and not v_prefs.notify_follows then
    return new;
  end if;
  select display_name into v_actor_name from public.profiles where id = new.follower_id;
  perform public.create_notification(
    new.followee_id, new.follower_id, 'follow',
    coalesce(v_actor_name, 'Someone') || ' followed you',
    'cookzer-profile.html?id=' || new.follower_id
  );
  return new;
end;
$$;

create trigger trg_notify_on_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- 2. Heart on your post
create or replace function public.notify_on_heart() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
begin
  select author_id into v_recipient from public.posts where id = new.post_id;
  select * into v_prefs from public.notification_prefs where user_id = v_recipient;
  if v_prefs.user_id is not null and not v_prefs.notify_hearts then
    return new;
  end if;
  select display_name into v_actor_name from public.profiles where id = new.user_id;
  perform public.create_notification(
    v_recipient, new.user_id, 'heart',
    coalesce(v_actor_name, 'Someone') || ' hearted your post',
    'cookzer-feed.html?post=' || new.post_id
  );
  return new;
end;
$$;

create trigger trg_notify_on_heart
  after insert on public.hearts
  for each row execute function public.notify_on_heart();

-- 3. Comment on your post
create or replace function public.notify_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
  v_snippet text;
begin
  select author_id into v_recipient from public.posts where id = new.post_id;
  select * into v_prefs from public.notification_prefs where user_id = v_recipient;
  if v_prefs.user_id is not null and not v_prefs.notify_comments then
    return new;
  end if;
  select display_name into v_actor_name from public.profiles where id = new.author_id;
  v_snippet := left(new.text, 80);
  perform public.create_notification(
    v_recipient, new.author_id, 'comment',
    coalesce(v_actor_name, 'Someone') || ' commented: "' || v_snippet || '"',
    'cookzer-feed.html?post=' || new.post_id
  );
  return new;
end;
$$;

create trigger trg_notify_on_comment
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- 4. Someone remade your recipe
create or replace function public.notify_on_remake() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_recipe_title text;
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
begin
  if new.kind <> 'remake' or new.recipe_id is null then
    return new;
  end if;
  select author_id, title into v_recipient, v_recipe_title from public.recipes where id = new.recipe_id;
  select * into v_prefs from public.notification_prefs where user_id = v_recipient;
  if v_prefs.user_id is not null and not v_prefs.notify_remakes then
    return new;
  end if;
  select display_name into v_actor_name from public.profiles where id = new.author_id;
  perform public.create_notification(
    v_recipient, new.author_id, 'remake',
    coalesce(v_actor_name, 'Someone') || ' remade your recipe "' || coalesce(v_recipe_title, 'a recipe') || '"',
    'cookzer-feed.html?post=' || new.id
  );
  return new;
end;
$$;

create trigger trg_notify_on_remake
  after insert on public.posts
  for each row execute function public.notify_on_remake();

-- 5. Someone joined your challenge
create or replace function public.notify_on_challenge_join() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_title text;
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
begin
  select created_by, title into v_recipient, v_title from public.challenges where id = new.challenge_id;
  select * into v_prefs from public.notification_prefs where user_id = v_recipient;
  if v_prefs.user_id is not null and not v_prefs.notify_challenge_joins then
    return new;
  end if;
  select display_name into v_actor_name from public.profiles where id = new.user_id;
  perform public.create_notification(
    v_recipient, new.user_id, 'challenge_join',
    coalesce(v_actor_name, 'Someone') || ' joined your challenge "' || coalesce(v_title, 'a challenge') || '"',
    'cookzer-challenges.html?id=' || new.challenge_id
  );
  return new;
end;
$$;

create trigger trg_notify_on_challenge_join
  after insert on public.challenge_entries
  for each row execute function public.notify_on_challenge_join();

-- 6. New message — notifies every other participant in the conversation
-- (not just 1:1 DMs, group conversations too). Doesn't try to suppress
-- this for someone with the thread already open (last_read_at hasn't
-- advanced yet at insert time regardless), same trade-off most chat
-- apps make for a still-open tab.
create or replace function public.notify_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
  v_snippet text;
  v_recipient record;
  v_prefs public.notification_prefs%rowtype;
begin
  select display_name into v_actor_name from public.profiles where id = new.sender_id;
  v_snippet := left(new.text, 80);
  for v_recipient in
    select user_id from public.conversation_participants
    where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    select * into v_prefs from public.notification_prefs where user_id = v_recipient.user_id;
    if v_prefs.user_id is not null and not v_prefs.notify_messages then
      continue;
    end if;
    perform public.create_notification(
      v_recipient.user_id, new.sender_id, 'message',
      coalesce(v_actor_name, 'Someone') || ' sent you a message: "' || v_snippet || '"',
      'cookzer-messenger.html?conversation=' || new.conversation_id
    );
  end loop;
  return new;
end;
$$;

create trigger trg_notify_on_message
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- 7. Recipe review
create or replace function public.notify_on_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_title text;
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
begin
  select author_id, title into v_recipient, v_title from public.recipes where id = new.recipe_id;
  select * into v_prefs from public.notification_prefs where user_id = v_recipient;
  if v_prefs.user_id is not null and not v_prefs.notify_reviews then
    return new;
  end if;
  select display_name into v_actor_name from public.profiles where id = new.user_id;
  perform public.create_notification(
    v_recipient, new.user_id, 'review',
    coalesce(v_actor_name, 'Someone') || ' rated your recipe "' || coalesce(v_title, 'a recipe') || '" ' || new.rating || ' star' || (case when new.rating = 1 then '' else 's' end),
    'cookzer-recipe.html?id=' || new.recipe_id
  );
  return new;
end;
$$;

create trigger trg_notify_on_review
  after insert on public.recipe_reviews
  for each row execute function public.notify_on_review();

-- 8. Someone joined your group
create or replace function public.notify_on_group_join() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_name text;
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
begin
  select created_by, name into v_recipient, v_name from public.groups where id = new.group_id;
  select * into v_prefs from public.notification_prefs where user_id = v_recipient;
  if v_prefs.user_id is not null and not v_prefs.notify_group_joins then
    return new;
  end if;
  select display_name into v_actor_name from public.profiles where id = new.user_id;
  perform public.create_notification(
    v_recipient, new.user_id, 'group_join',
    coalesce(v_actor_name, 'Someone') || ' joined your group "' || coalesce(v_name, 'a group') || '"',
    'cookzer-group.html?id=' || new.group_id
  );
  return new;
end;
$$;

create trigger trg_notify_on_group_join
  after insert on public.group_members
  for each row execute function public.notify_on_group_join();
