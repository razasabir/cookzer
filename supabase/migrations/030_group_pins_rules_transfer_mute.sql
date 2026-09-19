-- Pinned posts, group rules, ownership transfer, and per-group mute.
-- (Events and polls are separate migrations — enough surface area on
-- their own that mixing them in here would make this one unreadable.)

-- 1. Pinned posts. No UPDATE policy on posts existed at all before this
--    (nothing has ever let anyone edit a post, including its own
--    author) — this adds one narrowly scoped to pinning, not general
--    post editing.
alter table public.posts add column pinned_at timestamptz;

create policy "Group creator or admin can pin/unpin a group post"
  on public.posts for update
  using (
    group_id is not null
    and (
      exists (select 1 from public.groups g where g.id = posts.group_id and g.created_by = auth.uid())
      or exists (select 1 from public.group_members gm where gm.group_id = posts.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
    )
  )
  with check (
    group_id is not null
    and (
      exists (select 1 from public.groups g where g.id = posts.group_id and g.created_by = auth.uid())
      or exists (select 1 from public.group_members gm where gm.group_id = posts.group_id and gm.user_id = auth.uid() and gm.role = 'admin')
    )
  );

-- 2. Group rules — plain text, shown on the group page, editable
--    through the same edit-group form as name/description/cover.
alter table public.groups add column rules text;

-- 3. Ownership transfer + widening groups' UPDATE policy to admins too
--    (matches real Facebook Groups admin permissions — an admin can
--    already add/remove members and pin posts as of migration 029,
--    editing the group's own details is the same tier of trust).
--    RLS alone can't compare a row's old vs. new column values within
--    one policy expression, so the actual "only the current owner may
--    reassign created_by, and only to an existing member" rule lives
--    in a trigger instead — robust regardless of which policy let the
--    UPDATE through.
drop policy "Group creator can update their group" on public.groups;

create policy "Group creator or admin can update their group"
  on public.groups for update
  using (
    created_by = auth.uid()
    or exists (select 1 from public.group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid() and gm.role = 'admin')
  );

create or replace function public.enforce_group_owner_transfer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by then
    if auth.uid() <> old.created_by then
      raise exception 'Only the current owner can transfer ownership.';
    end if;
    if not exists (select 1 from public.group_members gm where gm.group_id = new.id and gm.user_id = new.created_by) then
      raise exception 'Ownership can only be transferred to an existing member.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_group_owner_transfer
  before update on public.groups
  for each row execute function public.enforce_group_owner_transfer();

-- 4. Per-group mute — self-serve, applies to this account only. Right
--    now the only notification type scoped to a specific group is
--    "someone joined your group" (migration 025, sent to the group's
--    creator only); this is checked there, and will automatically
--    cover any future group-scoped notification type without needing
--    its own opt-out.
alter table public.group_members add column muted boolean not null default false;

create policy "Users can mute/unmute their own membership"
  on public.group_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.notify_on_group_join() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_name text;
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
  v_muted boolean;
begin
  select created_by, name into v_recipient, v_name from public.groups where id = new.group_id;
  select * into v_prefs from public.notification_prefs where user_id = v_recipient;
  if v_prefs.user_id is not null and not v_prefs.notify_group_joins then
    return new;
  end if;
  select muted into v_muted from public.group_members where group_id = new.group_id and user_id = v_recipient;
  if coalesce(v_muted, false) then
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
