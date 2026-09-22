-- Profile module batch, phase G: real bidirectional friend requests.
-- Cookzer's only relationship today is public.follows (migration
-- 003_platform_tables.sql) — one-way, no approval. "Mutual friends" on
-- the profile page is just a client-side intersection of two follow
-- sets, not a real friendship. This adds an actual request/accept flow,
-- additive alongside follows (following someone and being their friend
-- stay independent — accepting a friend request does not touch follows).

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);

do $$ begin
  alter table public.friend_requests
    add constraint friend_requests_status_check
    check (status in ('pending', 'accepted', 'declined'));
exception when duplicate_object then null;
end $$;

-- One outstanding (pending) request per direction at a time — resending
-- while already pending would just spam the recipient. A declined or
-- accepted request no longer blocks a fresh one (e.g. re-requesting after
-- a decline, or after unfriending — see the friendships delete policy).
create unique index if not exists friend_requests_one_pending_idx
  on public.friend_requests(sender_id, recipient_id) where status = 'pending';

alter table public.friend_requests enable row level security;

drop policy if exists "You can see friend requests you sent or received" on public.friend_requests;
create policy "You can see friend requests you sent or received"
  on public.friend_requests for select
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "You can send a friend request" on public.friend_requests;
create policy "You can send a friend request"
  on public.friend_requests for insert
  to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "You can cancel your own pending request" on public.friend_requests;
create policy "You can cancel your own pending request"
  on public.friend_requests for delete
  to authenticated
  using (sender_id = auth.uid() and status = 'pending');

-- No client-side UPDATE policy: accepting/declining only happens through
-- respond_friend_request() below, which also has to insert into
-- friendships atomically on accept — a security-definer RPC does both in
-- one transaction rather than requiring two round-trips the client could
-- fail between.

create table if not exists public.friendships (
  user_id_1 uuid not null references public.profiles(id) on delete cascade,
  user_id_2 uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id_1, user_id_2),
  check (user_id_1 < user_id_2)
);

alter table public.friendships enable row level security;

drop policy if exists "You can see your own friendships" on public.friendships;
create policy "You can see your own friendships"
  on public.friendships for select
  to authenticated
  using (user_id_1 = auth.uid() or user_id_2 = auth.uid());

drop policy if exists "You can end your own friendship" on public.friendships;
create policy "You can end your own friendship"
  on public.friendships for delete
  to authenticated
  using (user_id_1 = auth.uid() or user_id_2 = auth.uid());

-- No client-side INSERT policy on friendships — only reachable through
-- respond_friend_request(), same reasoning as above.

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
  v_recipient_id uuid;
begin
  select sender_id, recipient_id into v_sender_id, v_recipient_id
  from public.friend_requests
  where id = p_request_id and status = 'pending';

  if v_sender_id is null then
    raise exception 'Friend request not found or already responded to';
  end if;
  if v_recipient_id <> auth.uid() then
    raise exception 'Only the recipient can respond to this friend request';
  end if;

  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_request_id;

  if p_accept then
    insert into public.friendships (user_id_1, user_id_2)
    values (least(v_sender_id, v_recipient_id), greatest(v_sender_id, v_recipient_id))
    on conflict (user_id_1, user_id_2) do nothing;
  end if;
end;
$$;

grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Notifications: two new types alongside the 8 from migration 025,
-- reusing create_notification() so both render in the existing bell/page
-- with zero client changes there. No notify_* preference gate (unlike
-- the existing 8) — friend requests are infrequent and directly
-- actionable, not worth a dedicated Settings toggle for this batch.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow', 'heart', 'comment', 'remake', 'challenge_join', 'message', 'review', 'group_join', 'friend_request', 'friend_accept'));

create or replace function public.notify_on_friend_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
begin
  select display_name into v_actor_name from public.profiles where id = new.sender_id;
  perform public.create_notification(
    new.recipient_id, new.sender_id, 'friend_request',
    coalesce(v_actor_name, 'Someone') || ' sent you a friend request',
    'cookzer-friends.html'
  );
  return new;
end;
$$;

create trigger trg_notify_on_friend_request
  after insert on public.friend_requests
  for each row execute function public.notify_on_friend_request();

create or replace function public.notify_on_friend_accept() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    select display_name into v_actor_name from public.profiles where id = new.recipient_id;
    perform public.create_notification(
      new.sender_id, new.recipient_id, 'friend_accept',
      coalesce(v_actor_name, 'Someone') || ' accepted your friend request',
      'cookzer-profile.html?id=' || new.recipient_id
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_on_friend_accept
  after update on public.friend_requests
  for each row execute function public.notify_on_friend_accept();
