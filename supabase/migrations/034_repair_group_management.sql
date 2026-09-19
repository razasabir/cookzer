-- Repairs a gap the automated migration runner introduced: it assumed
-- migrations 001-029 were all already applied by hand before it
-- existed, but 029_group_management.sql was actually never run against
-- the live database. This re-applies exactly what 029 does, written
-- defensively (IF NOT EXISTS / DROP POLICY IF EXISTS + recreate) so it's
-- safe to run regardless of whether any part of 029 partially applied.
-- See 029_group_management.sql for the original intent/comments.

alter table public.groups add column if not exists cover_photo_path text;

drop policy if exists "Group creator or admin can add a member directly" on public.group_members;
create policy "Group creator or admin can add a member directly"
  on public.group_members for insert
  with check (
    exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
    or exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_members.group_id and gm2.user_id = auth.uid() and gm2.role = 'admin'
    )
  );

drop policy if exists "Group creator or admin can remove a member" on public.group_members;
create policy "Group creator or admin can remove a member"
  on public.group_members for delete
  using (
    exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
    or exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_members.group_id and gm2.user_id = auth.uid() and gm2.role = 'admin'
    )
  );

drop policy if exists "Group creator can change a member's role" on public.group_members;
create policy "Group creator can change a member's role"
  on public.group_members for update
  using (exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()))
  with check (exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));
