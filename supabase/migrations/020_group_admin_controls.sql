-- Group admin controls (Facebook-inspired gap): the creator could
-- already update a group's name/description at the RLS layer (migration
-- 011's "Group creator can update their group" policy), but there was
-- no way to remove another member or delete the group at all — neither
-- had a client UI, and group_members only allowed removing yourself,
-- groups had no delete policy whatsoever. Run after 019.

create policy "Group creator can remove members"
  on public.group_members for delete
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_members.group_id and g.created_by = auth.uid()
    )
  );

create policy "Group creator can delete their group"
  on public.groups for delete
  using (created_by = auth.uid());
