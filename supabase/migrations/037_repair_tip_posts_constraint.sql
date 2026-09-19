-- Repairs the same gap 034_repair_group_management.sql fixed for 029: the
-- automated migration runner assumed 001-029 were all already applied by
-- hand before it existed, but 024_tip_posts.sql's widened kind check
-- apparently never actually ran against the live database — posting a
-- Tip fails with "new row for relation posts violates check constraint
-- posts_kind_check" since the live constraint still only allows
-- ('post', 'cook_in', 'remake'). Re-applies exactly what 024 does,
-- written defensively (drop if exists + recreate) so it's safe to run
-- regardless of whether 024 partially applied. See 024_tip_posts.sql
-- for the original intent/comments.

alter table public.posts
  drop constraint if exists posts_kind_check;

alter table public.posts
  add constraint posts_kind_check check (kind in ('post', 'cook_in', 'remake', 'tip'));
