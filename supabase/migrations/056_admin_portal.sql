-- Admin Portal, first real slice: Foundation (audit log — the staff
-- access gate itself, public.is_platform_admin(), already existed since
-- migration 049), Trust & Safety (a working queue for the reports table
-- that's had zero admin UI since migration 014), User Management
-- (account actions with real enforcement), and Commercial (folding the
-- existing restaurant-claim review and verified/featured RPCs into one
-- portal alongside the new pieces).
--
-- Scope note: this does NOT build a multi-role RBAC system. There is
-- exactly one real role today (public.is_platform_admin, seeded to one
-- account) and every RPC below gates on that same flag, matching the
-- existing convention from migrations 049/050. A `platform_role` label
-- column is added purely for display (the portal shows a role badge)
-- — it carries no enforcement of its own yet. Splitting is_platform_admin
-- into real per-role permissions is future work once there's more than
-- one staff account to differentiate.

-- public.profiles has never tracked its own signup date — every join
-- date shown anywhere in the app today is really auth.users.created_at
-- fetched separately. The admin dashboard needs a real "signups today/
-- this week" numbers, so add the column here and backfill it from
-- auth.users (a one-time join only a migration can do — a client query
-- can't read auth.users directly) rather than defaulting every existing
-- row to today, which would fabricate a signup date for years of real
-- accounts.
alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

update public.profiles p
set created_at = u.created_at
from auth.users u
where u.id = p.id and p.created_at is distinct from u.created_at;

alter table public.profiles
  add column if not exists platform_role text;

do $$ begin
  alter table public.profiles
    add constraint profiles_platform_role_check
    check (platform_role is null or platform_role in ('super_admin', 'trust_safety', 'support', 'finance', 'content_marketing', 'analyst'));
exception when duplicate_object then null;
end $$;

update public.profiles set platform_role = 'super_admin' where is_platform_admin = true and platform_role is null;

-- A platform admin needs to see any user's row for moderation/support —
-- the visibility policy from migration 053 only covers public/own/
-- followers-only. Extend it rather than add a second overlapping policy.
drop policy if exists "Authenticated users can view visible profiles" on public.profiles;
create policy "Authenticated users can view visible profiles"
  on public.profiles for select
  to authenticated
  using (
    profile_visibility = 'public'
    or auth.uid() = id
    or public.is_platform_admin()
    or exists (
      select 1 from public.follows
      where follower_id = auth.uid() and followee_id = profiles.id
    )
  );

-- ===================== Audit log =====================
-- Immutable by construction: no insert/update/delete policy is granted
-- to `authenticated` at all. Every row is written by a SECURITY DEFINER
-- function below (running as its owner, so it bypasses RLS entirely),
-- never directly by a client.

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete set null,
  action_type text not null,
  target_type text not null,
  target_id uuid,
  target_label text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_created_at_idx on public.admin_actions(created_at desc);
create index admin_actions_target_idx on public.admin_actions(target_type, target_id);

alter table public.admin_actions enable row level security;

create policy "Platform admins can view the audit log"
  on public.admin_actions for select
  using (public.is_platform_admin());

create or replace function public.log_admin_action(
  p_action_type text, p_target_type text, p_target_id uuid, p_target_label text,
  p_reason text default null, p_metadata jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_actions (actor_id, action_type, target_type, target_id, target_label, reason, metadata)
  values (auth.uid(), p_action_type, p_target_type, p_target_id, p_target_label, p_reason, p_metadata);
$$;

-- ===================== Trust & Safety: reports queue =====================

alter table public.reports
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution text,
  add column if not exists severity text not null default 'medium';

do $$ begin
  alter table public.reports
    add constraint reports_severity_check
    check (severity in ('low', 'medium', 'high'));
exception when duplicate_object then null;
end $$;

-- The existing status check already allows 'reviewed' — that value is
-- kept and repurposed as "resolved" (a decision was made and acted on)
-- so the existing 'open' | 'reviewed' | 'dismissed' contract is
-- unchanged for any code that already reads it.
create policy "Platform admins can view every report"
  on public.reports for select
  using (public.is_platform_admin());

create policy "Platform admins can assign a report"
  on public.reports for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Resolves or dismisses a report. Does not touch the underlying content
-- — that's admin_remove_content below, called separately when the
-- decision is to take content down.
create or replace function public.admin_resolve_report(p_report_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_type text;
begin
  if not public.is_platform_admin() then
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
  if not public.is_platform_admin() then
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

-- Removes the reported content itself. Only 'post' and 'comment' are
-- supported — the two moderation-queue target types where a delete is
-- unambiguous and low-risk. 'recipe', 'user', and 'restaurant_rating'
-- reports still resolve through admin_resolve_report above; deleting a
-- recipe (cascades into meal plans, shopping lists, cook-ins) or a user
-- needs its own reviewed flow, not a generic content-removal RPC.
create or replace function public.admin_remove_content(p_report_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_type text;
  v_target_id uuid;
  v_label text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can remove content';
  end if;

  select target_type, target_id into v_target_type, v_target_id
  from public.reports where id = p_report_id;

  if v_target_type is null then
    raise exception 'Report not found';
  end if;
  if v_target_type not in ('post', 'comment') then
    raise exception 'Removing % content isn''t supported yet — resolve the report instead', v_target_type;
  end if;

  if v_target_type = 'post' then
    select left(coalesce(caption, ''), 80) into v_label from public.posts where id = v_target_id;
    delete from public.posts where id = v_target_id;
  else
    select left(text, 80) into v_label from public.comments where id = v_target_id;
    delete from public.comments where id = v_target_id;
  end if;

  update public.reports
  set status = 'reviewed', resolution = 'removed', resolved_by = auth.uid(), resolved_at = now()
  where id = p_report_id;

  perform public.log_admin_action('content_removed', v_target_type, v_target_id, v_label, p_reason);
end;
$$;

-- ===================== Strikes =====================

create table public.user_strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  report_id uuid references public.reports(id) on delete set null,
  issued_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index user_strikes_user_id_idx on public.user_strikes(user_id);

alter table public.user_strikes enable row level security;

create policy "A user can see their own strikes; a platform admin sees all"
  on public.user_strikes for select
  using (user_id = auth.uid() or public.is_platform_admin());

create or replace function public.admin_issue_strike(p_user_id uuid, p_reason text, p_severity text, p_report_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
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

-- ===================== Suspensions (warn / mute / suspend / ban) =====================
-- 'suspend' and 'ban' are the two types with real enforcement: any page
-- can call public.my_active_suspension() (see below) to find out if the
-- signed-in user is currently locked out, and auth-guard.js does exactly
-- that on every page load. 'warn' and 'mute' are logged here for a
-- complete history but are not enforced anywhere yet — a mute would need
-- to be checked at every content-creation point (feed composer, comments,
-- Messenger, recipes, restaurant reviews) and that enforcement is future
-- work, not something to fake here.

create table public.user_suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('warn', 'mute', 'suspend', 'ban')),
  reason text not null,
  issued_by uuid references public.profiles(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index user_suspensions_user_id_idx on public.user_suspensions(user_id);

alter table public.user_suspensions enable row level security;

create policy "Own or admin can view suspension history"
  on public.user_suspensions for select
  using (user_id = auth.uid() or public.is_platform_admin());

-- p_duration_days null means indefinite (used for a ban, or an
-- open-ended suspend) — otherwise ends_at is p_duration_days from now.
create or replace function public.admin_set_suspension(p_user_id uuid, p_type text, p_reason text, p_duration_days integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
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

create or replace function public.admin_revoke_suspension(p_suspension_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can revoke a suspension';
  end if;

  update public.user_suspensions
  set revoked_at = now(), revoked_by = auth.uid()
  where id = p_suspension_id and revoked_at is null
  returning user_id into v_user_id;

  if v_user_id is null then
    raise exception 'Suspension not found or already revoked';
  end if;

  perform public.log_admin_action('suspension_revoked', 'user', v_user_id, null, null,
    jsonb_build_object('suspension_id', p_suspension_id));
end;
$$;

-- Called by auth-guard.js on every page load for the signed-in user
-- (not admin-gated — anyone can check their own status). Returns the
-- single active suspend/ban row, if any: not revoked and either
-- permanent (ends_at null) or still within its window.
create or replace function public.my_active_suspension()
returns table (id uuid, type text, reason text, ends_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select id, type, reason, ends_at, created_at
  from public.user_suspensions
  where user_id = auth.uid()
    and type in ('suspend', 'ban')
    and revoked_at is null
    and (ends_at is null or ends_at > now())
  order by created_at desc
  limit 1;
$$;

-- ===================== Commercial: featured placement log =====================
-- migrations 049/050 already have the claim-review and verified/featured
-- RPCs; this just makes those actions show up in the same audit trail as
-- everything else, without changing their existing behavior or signature.

create or replace function public.set_restaurant_verified(p_restaurant_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
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
  if not public.is_platform_admin() then
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
  if not public.is_platform_admin() then
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
