-- Resharing: the Share button's "Reshare to your feed" / "Share on a
-- group" options both work by inserting a new post of kind='share',
-- authored by the resharer (with group_id set for a group share, same
-- as any other group post). What's being shared is recorded on that new
-- row rather than a separate table, reusing the posts row shape the
-- feed already knows how to render:
--   - resharing a post          -> shared_post_id set
--   - resharing a recipe        -> recipe_id set (renders exactly like
--                                  any other recipe post already does)
--   - resharing a profile       -> shared_profile_id set
--   - resharing an invite link  -> just a caption, no extra reference
-- Run after 044.

alter table public.posts
  drop constraint if exists posts_kind_check;
alter table public.posts
  add constraint posts_kind_check check (kind in ('post', 'cook_in', 'remake', 'tip', 'share'));

alter table public.posts
  add column if not exists shared_post_id uuid references public.posts(id) on delete set null,
  add column if not exists shared_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists posts_shared_post_idx on public.posts(shared_post_id);
create index if not exists posts_shared_profile_idx on public.posts(shared_profile_id);
