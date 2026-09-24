-- Admin Portal, Governance & Policy module: versioned Terms/Privacy
-- documents with consent tracking, a real GDPR/CCPA data-subject-request
-- queue (self-filed by any user, worked by staff), legal holds that
-- block deletion, and a CSAM escalation log.
--
-- Scope note on CSAM: this is a tracking/escalation workflow only —
-- automated image-hash matching (PhotoDNA, Thorn, or similar) needs a
-- real vendor account and API credentials that only the business can
-- obtain. What's built here is the part that doesn't depend on that:
-- a staff member (or, in the future, an automated scanner once one is
-- wired up) can flag a piece of content, track its status through
-- escalation, and record when/whether it was reported to NCMEC's
-- CyberTipline. Do not represent this as automated detection — it isn't.

-- ===================== Policy documents & consent =====================

create table public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms', 'privacy', 'community_guidelines')),
  version integer not null,
  content text not null,
  is_current boolean not null default false,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (type, version)
);

create index policy_documents_current_idx on public.policy_documents(type) where is_current;

alter table public.policy_documents enable row level security;

-- Anyone signed in can read the current version of any policy (the
-- consent banner and the static legal pages both need this); only a
-- platform admin can read draft/past versions.
create policy "Current policy is visible to everyone signed in"
  on public.policy_documents for select
  to authenticated
  using (is_current or public.is_platform_admin());

create table public.policy_consents (
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_type text not null,
  version integer not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_type, version)
);

alter table public.policy_consents enable row level security;

create policy "A user can see their own consent history"
  on public.policy_consents for select
  using (user_id = auth.uid() or public.is_platform_admin());

-- Publishing a new version un-sets is_current on the previous one for
-- that type in the same transaction, so exactly one row is ever current.
create or replace function public.admin_publish_policy(p_type text, p_content text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can publish a policy document';
  end if;
  if p_type not in ('terms', 'privacy', 'community_guidelines') then
    raise exception 'Unknown policy type: %', p_type;
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.policy_documents where type = p_type;

  update public.policy_documents set is_current = false where type = p_type and is_current;

  insert into public.policy_documents (type, version, content, is_current, published_by, published_at)
  values (p_type, v_next_version, p_content, true, auth.uid(), now());

  perform public.log_admin_action('policy_published', 'policy_document', null, p_type,
    null, jsonb_build_object('version', v_next_version));

  return v_next_version;
end;
$$;

-- Called by the client once per policy type per session (cheap: one
-- upsert) whenever the user is shown and accepts the current version —
-- e.g. a "we've updated our Terms" banner. Silently no-ops if they've
-- already accepted this exact version.
create or replace function public.record_policy_consent(p_type text, p_version integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.policy_consents (user_id, policy_type, version)
  values (auth.uid(), p_type, p_version)
  on conflict (user_id, policy_type, version) do nothing;
$$;

-- ===================== Data Subject Requests (GDPR/CCPA) =====================

create table public.dsar_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('export', 'delete')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  note text,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index dsar_requests_status_idx on public.dsar_requests(status);

alter table public.dsar_requests enable row level security;

create policy "A user can see their own requests; a platform admin sees all"
  on public.dsar_requests for select
  using (user_id = auth.uid() or public.is_platform_admin());

-- Self-service — any signed-in user can file a request about their own
-- account. One pending request of a given type at a time (no spamming
-- the queue by clicking twice).
create or replace function public.file_dsar_request(p_type text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_type not in ('export', 'delete') then
    raise exception 'Type must be export or delete';
  end if;
  if exists (select 1 from public.dsar_requests where user_id = auth.uid() and type = p_type and status in ('pending', 'processing')) then
    raise exception 'You already have a % request in progress', p_type;
  end if;

  insert into public.dsar_requests (user_id, type) values (auth.uid(), p_type) returning id into v_id;
  return v_id;
end;
$$;

-- Returns the requesting user's own data as one JSON bundle — the
-- "export my data" fulfillment. Deliberately excludes other people's
-- data even where it references them (e.g. who they follow, not those
-- people's own profiles). Callable by the user themselves; staff use it
-- via admin_export_user_data below.
create or replace function public.export_my_data()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'is_platform_admin' from public.profiles p where id = auth.uid()),
    'recipes', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.recipes r where r.author_id = auth.uid()),
    'posts', (select coalesce(jsonb_agg(to_jsonb(po)), '[]'::jsonb) from public.posts po where po.author_id = auth.uid()),
    'comments', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.comments c where c.author_id = auth.uid()),
    'following', (select coalesce(jsonb_agg(followee_id), '[]'::jsonb) from public.follows where follower_id = auth.uid()),
    'exported_at', now()
  );
$$;

create or replace function public.admin_export_user_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can export another user''s data';
  end if;

  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'is_platform_admin' from public.profiles p where id = p_user_id),
    'recipes', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.recipes r where r.author_id = p_user_id),
    'posts', (select coalesce(jsonb_agg(to_jsonb(po)), '[]'::jsonb) from public.posts po where po.author_id = p_user_id),
    'comments', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.comments c where c.author_id = p_user_id),
    'exported_at', now()
  ) into v_bundle;

  perform public.log_admin_action('dsar_data_exported', 'user', p_user_id, null);
  return v_bundle;
end;
$$;

-- Marks a request processing/completed/rejected. Does not itself perform
-- the deletion for a 'delete' request — that's a distinct, deliberate
-- action (admin_fulfill_deletion_request below) so a status update can
-- never accidentally cascade-delete an account.
create or replace function public.admin_update_dsar_status(p_request_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can update a data request';
  end if;
  if p_status not in ('pending', 'processing', 'completed', 'rejected') then
    raise exception 'Unknown status: %', p_status;
  end if;

  update public.dsar_requests
  set status = p_status, note = coalesce(p_note, note),
      completed_by = case when p_status in ('completed', 'rejected') then auth.uid() else completed_by end,
      completed_at = case when p_status in ('completed', 'rejected') then now() else completed_at end
  where id = p_request_id;
  if not found then
    raise exception 'Request not found';
  end if;

  perform public.log_admin_action('dsar_status_' || p_status, 'dsar_request', p_request_id, null, p_note);
end;
$$;

-- Actually deletes the account, honoring an active legal hold (see
-- below) by refusing rather than silently skipping it. Cascades via the
-- existing foreign keys' on-delete rules; auth.users itself is left
-- alone (Supabase Auth user deletion needs the service-role key, which
-- client-side RPCs never have — deleting the auth user is a manual or
-- service-role-backed follow-up step once this returns).
create or replace function public.admin_fulfill_deletion_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can fulfill a deletion request';
  end if;

  select user_id into v_user_id from public.dsar_requests where id = p_request_id and type = 'delete' and status <> 'completed';
  if v_user_id is null then
    raise exception 'Request not found, not a deletion request, or already completed';
  end if;
  if exists (select 1 from public.legal_holds where target_type = 'user' and target_id = v_user_id and released_at is null) then
    raise exception 'This account is under an active legal hold and cannot be deleted';
  end if;

  delete from public.profiles where id = v_user_id;

  update public.dsar_requests set status = 'completed', completed_by = auth.uid(), completed_at = now() where id = p_request_id;

  perform public.log_admin_action('dsar_deletion_fulfilled', 'user', v_user_id, null);
end;
$$;

-- ===================== Legal holds =====================

create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('user', 'post', 'recipe')),
  target_id uuid not null,
  reason text not null,
  placed_by uuid references public.profiles(id) on delete set null,
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null
);

create index legal_holds_target_idx on public.legal_holds(target_type, target_id) where released_at is null;

alter table public.legal_holds enable row level security;

create policy "Platform admins can view legal holds"
  on public.legal_holds for select
  using (public.is_platform_admin());

create or replace function public.admin_place_legal_hold(p_target_type text, p_target_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can place a legal hold';
  end if;
  insert into public.legal_holds (target_type, target_id, reason, placed_by)
  values (p_target_type, p_target_id, p_reason, auth.uid())
  returning id into v_id;

  perform public.log_admin_action('legal_hold_placed', p_target_type, p_target_id, null, p_reason);
  return v_id;
end;
$$;

create or replace function public.admin_release_legal_hold(p_hold_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_type text;
  v_target_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can release a legal hold';
  end if;

  update public.legal_holds set released_at = now(), released_by = auth.uid()
  where id = p_hold_id and released_at is null
  returning target_type, target_id into v_target_type, v_target_id;
  if v_target_type is null then
    raise exception 'Hold not found or already released';
  end if;

  perform public.log_admin_action('legal_hold_released', v_target_type, v_target_id, null);
end;
$$;

-- admin_remove_content (migration 056) must also refuse to delete
-- content under an active hold — same principle as the deletion-request
-- guard above.
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
  if v_target_type not in ('post', 'comment', 'recipe', 'restaurant_rating') then
    raise exception 'Removing % content isn''t supported yet — resolve the report instead', v_target_type;
  end if;
  if exists (select 1 from public.legal_holds where target_type = v_target_type and target_id = v_target_id and released_at is null) then
    raise exception 'This content is under an active legal hold and cannot be removed';
  end if;

  if v_target_type = 'post' then
    select left(coalesce(caption, ''), 80) into v_label from public.posts where id = v_target_id;
    delete from public.posts where id = v_target_id;
  elsif v_target_type = 'comment' then
    select left(text, 80) into v_label from public.comments where id = v_target_id;
    delete from public.comments where id = v_target_id;
  elsif v_target_type = 'recipe' then
    select left(title, 80) into v_label from public.recipes where id = v_target_id;
    delete from public.recipes where id = v_target_id;
  else
    select left(coalesce(review, ''), 80) into v_label from public.restaurant_ratings where id = v_target_id;
    delete from public.restaurant_ratings where id = v_target_id;
  end if;

  update public.reports
  set status = 'reviewed', resolution = 'removed', resolved_by = auth.uid(), resolved_at = now()
  where id = p_report_id;

  perform public.log_admin_action('content_removed', v_target_type, v_target_id, v_label, p_reason);
end;
$$;

-- ===================== CSAM escalation log =====================
-- See the module-level scope note at the top of this file: tracking and
-- escalation only, no automated detection.

create table public.csam_reports (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('post', 'comment', 'recipe', 'profile_photo', 'message')),
  content_id uuid,
  status text not null default 'flagged' check (status in ('flagged', 'escalated', 'reported_to_ncmec', 'cleared')),
  notes text,
  flagged_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.csam_reports enable row level security;

create policy "Platform admins can view CSAM escalation log"
  on public.csam_reports for select
  using (public.is_platform_admin());

create or replace function public.admin_flag_csam(p_content_type text, p_content_id uuid, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can flag content for CSAM review';
  end if;

  insert into public.csam_reports (content_type, content_id, notes, flagged_by, updated_by)
  values (p_content_type, p_content_id, p_notes, auth.uid(), auth.uid())
  returning id into v_id;

  -- Immediately place a legal hold on the flagged content so it can't be
  -- deleted out from under an active escalation — findable by the same
  -- content_type/content_id pair; not every csam_reports content_type
  -- maps to a legal_holds target_type (profile_photo/message don't), so
  -- only hold the ones that do.
  if p_content_type in ('post', 'comment', 'recipe') then
    insert into public.legal_holds (target_type, target_id, reason, placed_by)
    values (p_content_type, p_content_id, 'CSAM review in progress (csam_reports.id=' || v_id || ')', auth.uid());
  end if;

  perform public.log_admin_action('csam_flagged', p_content_type, p_content_id, null, p_notes);
  return v_id;
end;
$$;

create or replace function public.admin_update_csam_status(p_report_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform admin can update a CSAM escalation';
  end if;
  if p_status not in ('flagged', 'escalated', 'reported_to_ncmec', 'cleared') then
    raise exception 'Unknown status: %', p_status;
  end if;

  update public.csam_reports
  set status = p_status, notes = coalesce(p_notes, notes), updated_by = auth.uid(), updated_at = now()
  where id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;

  perform public.log_admin_action('csam_status_' || p_status, 'csam_report', p_report_id, null, p_notes);
end;
$$;
