-- Group management: a real cover photo, direct add/remove of members by
-- the creator or an admin, and an admin role actually usable from the UI.
--
-- Fixes a real bug found while building this: migration 011 only ever
-- added a "leave as yourself" DELETE policy on group_members — nothing
-- let the creator remove someone ELSE, even though cookzer-group.html
-- has shipped a "Remove" button since before this migration. That
-- button's delete call has been silently no-op'ing under RLS (no error
-- surfaced, the member just never disappears) since the day it shipped.

alter table public.groups add column cover_photo_path text;

-- Direct add: a creator/admin can insert a membership row for someone
-- else outright (mirrors real Facebook Groups admin behavior for a
-- closed group), rather than only the invite-code or self-join paths
-- migration 028 added. Postgres OR's multiple permissive policies for
-- the same command, so this is additive to those, not a replacement.
create policy "Group creator or admin can add a member directly"
  on public.group_members for insert
  with check (
    exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
    or exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_members.group_id and gm2.user_id = auth.uid() and gm2.role = 'admin'
    )
  );

-- The missing removal policy described above.
create policy "Group creator or admin can remove a member"
  on public.group_members for delete
  using (
    exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
    or exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_members.group_id and gm2.user_id = auth.uid() and gm2.role = 'admin'
    )
  );

-- Promoting/demoting admins — creator only, so an admin can't promote
-- their own replacement and lock the creator out.
create policy "Group creator can change a member's role"
  on public.group_members for update
  using (exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()))
  with check (exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));
