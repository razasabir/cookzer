-- Admin Portal: Platform Ops (feature flags, announcements, rate-limit
-- config, push broadcast), Support Tooling (tickets), a real permission
-- matrix on top of the existing is_platform_admin() gate, and mute
-- enforcement (the one suspension type from migration 056 that wasn't
-- actually enforced anywhere yet).

-- ===================== Permission matrix =====================
-- is_platform_admin() (migration 049) stays the base "is this person
-- staff at all" gate — nothing here removes it, and every RPC below
-- still checks it first. has_permission() adds a second, finer check on
-- top for actions where WHICH staff member matters. A null
-- platform_role (the pre-RBAC seed admin, or any future admin created
-- without one set) keeps full access — this only takes effect once a
-- role is actually assigned. super_admin always passes every check.
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false) then false
    when (select platform_role from public.profiles where id = auth.uid()) is null then true
    when (select platform_role from public.profiles where id = auth.uid()) = 'super_admin' then true
    else p_permission = any(
      case (select platform_role from public.profiles where id = auth.uid())
        when 'trust_safety' then array['moderate_reports', 'suspend_users', 'issue_strikes', 'view_users', 'view_audit_log']
        when 'support' then array['view_users', 'manage_tickets', 'warn_users']
        when 'finance' then array['manage_commercial', 'view_analytics']
        when 'content_marketing' then array['manage_commercial', 'broadcast_notifications', 'view_analytics']
        when 'analyst' then array['view_analytics', 'view_audit_log']
        else array[]::text[]
      end
    )
  end;
$$;

-- Applied to the actions where role should matter. Each still opens
-- with "only a platform admin" in its error for continuity with
-- migration 056/057's messages, but now via has_permission() so a
-- staff member without the right role is turned away the same as a
-- non-admin, not just anyone lacking the flag entirely.

create or replace function public.admin_resolve_report(p_report_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_type text;
begin
  if not public.has_permission('moderate_reports') then
    raise exception 'Only a platform admin can resolve reports';
  end if;
  if p_decision not in ('reviewed', 'dismissed') then
    raise exception 'Decision must be reviewed or dismissed';
  end if;

  select target_type into v_target_type from public.reports where id = p_report_id;
  if v_target_type is null then
    raise exception 'Report not found';
  end if;

  update public.reports
  set status = p_decision, resolution = p_note, resolved_by = auth.uid(), resolved_at = now()
  where id = p_report_id;

  perform public.log_admin_action('report_' || p_decision, 'report', p_report_id, v_target_type, p_note);
end;
$$;

create or replace function public.admin_assign_report(p_report_id uuid, p_assignee uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('moderate_reports') then
    raise exception 'Only a platform admin can assign reports';
  end if;

  update public.reports set assigned_to = p_assignee where id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  perform public.log_admin_action('report_assigned', 'report', p_report_id, null, null,
    jsonb_build_object('assignee', p_assignee));
end;
$$;

create or replace function public.admin_issue_strike(p_user_id uuid, p_reason text, p_severity text, p_report_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('issue_strikes') then
    raise exception 'Only a platform admin can issue a strike';
  end if;
  if p_severity not in ('low', 'medium', 'high') then
    raise exception 'Severity must be low, medium, or high';
  end if;

  insert into public.user_strikes (user_id, reason, severity, report_id, issued_by)
  values (p_user_id, p_reason, p_severity, p_report_id, auth.uid());

  perform public.log_admin_action('strike_issued', 'user', p_user_id, null, p_reason,
    jsonb_build_object('severity', p_severity));
end;
$$;

create or replace function public.admin_set_suspension(p_user_id uuid, p_type text, p_reason text, p_duration_days integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type in ('suspend', 'ban') and not public.has_permission('suspend_users') then
    raise exception 'Only a platform admin can take this action';
  end if;
  if p_type in ('warn', 'mute') and not public.has_permission('warn_users') and not public.has_permission('suspend_users') then
    raise exception 'Only a platform admin can take this action';
  end if;
  if p_type not in ('warn', 'mute', 'suspend', 'ban') then
    raise exception 'Type must be warn, mute, suspend, or ban';
  end if;
  if p_user_id = auth.uid() and p_type in ('suspend', 'ban') then
    raise exception 'You cannot suspend or ban your own account';
  end if;

  insert into public.user_suspensions (user_id, type, reason, issued_by, ends_at)
  values (
    p_user_id, p_type, p_reason, auth.uid(),
    case when p_type in ('suspend', 'ban') and p_duration_days is not null and p_duration_days > 0
      then now() + make_interval(days => p_duration_days) else null end
  );

  perform public.log_admin_action('suspension_' || p_type, 'user', p_user_id, null, p_reason,
    jsonb_build_object('duration_days', p_duration_days));
end;
$$;

create or replace function public.set_restaurant_verified(p_restaurant_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage_commercial') then
    raise exception 'Only a platform admin can set a restaurant''s verified status';
  end if;

  update public.restaurants set is_verified = p_verified where id = p_restaurant_id;
  if not found then
    raise exception 'Restaurant not found';
  end if;

  perform public.log_admin_action(case when p_verified then 'restaurant_verified' else 'restaurant_unverified' end,
    'restaurant', p_restaurant_id, null);
end;
$$;

create or replace function public.set_restaurant_featured(p_restaurant_id uuid, p_days integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage_commercial') then
    raise exception 'Only a platform admin can set a restaurant''s featured placement';
  end if;

  update public.restaurants
  set featured_until = case when p_days is null or p_days <= 0 then null else now() + make_interval(days => p_days) end
  where id = p_restaurant_id;
  if not found then
    raise exception 'Restaurant not found';
  end if;

  perform public.log_admin_action(case when p_days is null or p_days <= 0 then 'restaurant_unfeatured' else 'restaurant_featured' end,
    'restaurant', p_restaurant_id, null, null, jsonb_build_object('days', p_days));
end;
$$;

create or replace function public.review_restaurant_claim(p_claim_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_user_id uuid;
  v_restaurant_name text;
begin
  if not public.has_permission('manage_commercial') then
    raise exception 'Only a platform admin can review restaurant claims';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select restaurant_id, user_id into v_restaurant_id, v_user_id
  from public.restaurant_claim_requests
  where id = p_claim_id and status = 'pending';

  if v_restaurant_id is null then
    raise exception 'Claim not found or already reviewed';
  end if;

  update public.restaurant_claim_requests
  set status = p_decision, admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_claim_id;

  if p_decision = 'approved' then
    update public.restaurants
    set claimed_by = v_user_id, claim_status = 'approved'
    where id = v_restaurant_id;

    update public.restaurant_claim_requests
    set status = 'rejected',
        admin_note = coalesce(admin_note, 'Another claim for this restaurant was approved.'),
        reviewed_by = auth.uid(), reviewed_at = now()
    where restaurant_id = v_restaurant_id and status = 'pending' and id <> p_claim_id;
  else
    update public.restaurants
    set claim_status = case
      when exists (
        select 1 from public.restaurant_claim_requests
        where restaurant_id = v_restaurant_id and status = 'pending' and id <> p_claim_id
      ) then 'pending'
      else 'unclaimed'
    end
    where id = v_restaurant_id;
  end if;

  select name into v_restaurant_name from public.restaurants where id = v_restaurant_id;
  perform public.log_admin_action('claim_' || p_decision, 'restaurant_claim', p_claim_id, v_restaurant_name, p_note);
end;
$$;

-- ===================== Mute enforcement =====================
-- The one gap flagged in migration 056: 'mute' was logged but never
-- actually checked anywhere. Enforced at the RLS layer on the two
-- highest-traffic content-creation tables (posts, comments) — the
-- most robust place, since it can't be bypassed by any client. Messenger
-- messages, recipes, and restaurant reviews are NOT covered here; muting
-- someone still lets them message, publish a recipe, or leave a review.
-- Extending this to those surfaces is flagged as follow-up work, not
-- silently assumed done.
create or replace function public.is_muted()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_suspensions
    where user_id = auth.uid() and type = 'mute' and revoked_at is null
      and (ends_at is null or ends_at > now())
  );
$$;

drop policy if exists "Users can create posts as themselves" on public.posts;
create policy "Users can create posts as themselves"
  on public.posts for insert
  with check (author_id = auth.uid() and not public.is_muted());

drop policy if exists "Users can comment as themselves" on public.comments;
create policy "Users can comment as themselves"
  on public.comments for insert
  with check (author_id = auth.uid() and not public.is_muted());

-- ===================== Feature flags =====================

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  description text,
  rollout_percent integer not null default 100 check (rollout_percent between 0 and 100),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

-- Every signed-in user's client needs to read flags to know what to
-- show — this is the one Platform Ops table that isn't admin-only to
-- read (only to write).
create policy "Feature flags are readable by anyone signed in"
  on public.feature_flags for select
  to authenticated
  using (true);

create or replace function public.admin_set_feature_flag(p_key text, p_enabled boolean, p_description text default null, p_rollout_percent integer default 100)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can change a feature flag';
  end if;

  insert into public.feature_flags (key, enabled, description, rollout_percent, updated_by)
  values (p_key, p_enabled, p_description, coalesce(p_rollout_percent, 100), auth.uid())
  on conflict (key) do update set
    enabled = excluded.enabled,
    description = coalesce(excluded.description, public.feature_flags.description),
    rollout_percent = excluded.rollout_percent,
    updated_by = excluded.updated_by,
    updated_at = now();

  perform public.log_admin_action('feature_flag_set', 'feature_flag', null, p_key, null,
    jsonb_build_object('enabled', p_enabled, 'rollout_percent', p_rollout_percent));
end;
$$;

-- ===================== Announcements / maintenance banners =====================

create table public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  level text not null default 'info' check (level in ('info', 'warning', 'critical')),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.site_announcements enable row level security;

create policy "Active announcements are readable by anyone signed in"
  on public.site_announcements for select
  to authenticated
  using (active and starts_at <= now() and (ends_at is null or ends_at > now()));

create policy "Platform admins can see every announcement"
  on public.site_announcements for select
  using (public.is_platform_admin());

create or replace function public.admin_create_announcement(p_message text, p_level text default 'info', p_ends_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can post an announcement';
  end if;
  if p_level not in ('info', 'warning', 'critical') then
    raise exception 'Level must be info, warning, or critical';
  end if;

  insert into public.site_announcements (message, level, ends_at, created_by)
  values (p_message, p_level, p_ends_at, auth.uid())
  returning id into v_id;

  perform public.log_admin_action('announcement_created', 'site_announcement', v_id, p_message, null,
    jsonb_build_object('level', p_level));
  return v_id;
end;
$$;

create or replace function public.admin_deactivate_announcement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can take down an announcement';
  end if;

  update public.site_announcements set active = false where id = p_id;
  if not found then
    raise exception 'Announcement not found';
  end if;

  perform public.log_admin_action('announcement_deactivated', 'site_announcement', p_id, null);
end;
$$;

-- ===================== Rate-limit config =====================
-- Storage + an admin UI to set values only. No flow in the app actually
-- reads these yet (nothing is rate-limited today) — wiring signup/
-- report/message velocity checks to read this table is fast-follow
-- work, called out explicitly rather than implied by this table's
-- existence.

create table public.rate_limit_config (
  key text primary key,
  limit_per_hour integer not null check (limit_per_hour > 0),
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.rate_limit_config enable row level security;

create policy "Platform admins can view rate-limit config"
  on public.rate_limit_config for select
  using (public.is_platform_admin());

create or replace function public.admin_set_rate_limit(p_key text, p_limit_per_hour integer, p_description text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can change a rate limit';
  end if;

  insert into public.rate_limit_config (key, limit_per_hour, description, updated_by)
  values (p_key, p_limit_per_hour, p_description, auth.uid())
  on conflict (key) do update set
    limit_per_hour = excluded.limit_per_hour,
    description = coalesce(excluded.description, public.rate_limit_config.description),
    updated_by = excluded.updated_by,
    updated_at = now();

  perform public.log_admin_action('rate_limit_set', 'rate_limit_config', null, p_key, null,
    jsonb_build_object('limit_per_hour', p_limit_per_hour));
end;
$$;

-- ===================== Push / notification broadcast =====================
-- Reuses public.create_notification() (migration 027) row for row, so
-- the exact same email/push denormalization and the existing pg_net
-- trigger fire for a broadcast message with zero new sending
-- infrastructure. 'admin_broadcast' is a new notifications.type value.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow', 'heart', 'comment', 'remake', 'challenge_join', 'message', 'review', 'group_join', 'admin_broadcast'));

-- p_segment: 'all' is the only segment for now — a real saved-segment
-- system (from the Analytics module) can extend this later without
-- changing the notification-sending part at all.
create or replace function public.admin_broadcast_notification(p_message text, p_link_url text default null, p_segment text default 'all')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient record;
  v_count integer := 0;
begin
  if not public.has_permission('broadcast_notifications') then
    raise exception 'Only a platform admin can send a broadcast';
  end if;
  if p_segment <> 'all' then
    raise exception 'Unknown segment: % (only ''all'' is supported today)', p_segment;
  end if;

  for v_recipient in select id from public.profiles where id <> auth.uid() loop
    perform public.create_notification(v_recipient.id, auth.uid(), 'admin_broadcast', p_message, p_link_url);
    v_count := v_count + 1;
  end loop;

  perform public.log_admin_action('broadcast_sent', 'notification', null, p_segment,
    p_message, jsonb_build_object('recipient_count', v_count));
  return v_count;
end;
$$;

-- ===================== Support tickets =====================

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_status_idx on public.support_tickets(status);

alter table public.support_tickets enable row level security;

create policy "A user can see their own tickets; a platform admin sees all"
  on public.support_tickets for select
  using (user_id = auth.uid() or public.is_platform_admin());

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  is_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_id_idx on public.support_ticket_messages(ticket_id);

alter table public.support_ticket_messages enable row level security;

create policy "Ticket owner or a platform admin can read its messages"
  on public.support_ticket_messages for select
  using (
    exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
    or public.is_platform_admin()
  );

-- Self-service — any signed-in user can open a ticket about their own
-- account, and reply on it. Their first message doubles as the ticket
-- body so it shows up in the same thread as staff replies.
create or replace function public.file_support_ticket(p_subject text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.support_tickets (user_id, subject) values (auth.uid(), p_subject) returning id into v_id;
  insert into public.support_ticket_messages (ticket_id, author_id, is_staff, body) values (v_id, auth.uid(), false, p_message);
  return v_id;
end;
$$;

create or replace function public.post_ticket_message(p_ticket_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_staff boolean;
  v_owner uuid;
begin
  select user_id into v_owner from public.support_tickets where id = p_ticket_id;
  if v_owner is null then
    raise exception 'Ticket not found';
  end if;

  v_is_staff := public.has_permission('manage_tickets');
  if not v_is_staff and v_owner <> auth.uid() then
    raise exception 'You can only reply on your own tickets';
  end if;

  insert into public.support_ticket_messages (ticket_id, author_id, is_staff, body)
  values (p_ticket_id, auth.uid(), v_is_staff, p_body);

  -- A staff reply reopens a resolved ticket into "pending" (waiting on
  -- the user); a user reply on a pending ticket puts it back to "open"
  -- (waiting on staff) — status always reflects who owes the next
  -- response.
  update public.support_tickets
  set status = case when v_is_staff then 'pending' else 'open' end, updated_at = now()
  where id = p_ticket_id;
end;
$$;

create or replace function public.admin_assign_ticket(p_ticket_id uuid, p_assignee uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage_tickets') then
    raise exception 'Only a platform admin can assign a ticket';
  end if;

  update public.support_tickets set assigned_to = p_assignee, updated_at = now() where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found';
  end if;

  perform public.log_admin_action('ticket_assigned', 'support_ticket', p_ticket_id, null, null,
    jsonb_build_object('assignee', p_assignee));
end;
$$;

create or replace function public.admin_resolve_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage_tickets') then
    raise exception 'Only a platform admin can resolve a ticket';
  end if;

  update public.support_tickets set status = 'resolved', updated_at = now() where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found';
  end if;

  perform public.log_admin_action('ticket_resolved', 'support_ticket', p_ticket_id, null);
end;
$$;
