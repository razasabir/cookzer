-- Comment deletion: you can already delete your own comment (migration
-- 003), but there was no way for a post's author to remove someone
-- else's comment on their own post — the Facebook-style moderation case
-- ("I don't want this comment on my post"). Postgres ORs multiple
-- permissive policies for the same command together, so this adds a
-- second DELETE policy for the post owner alongside the existing one
-- rather than replacing it.
create policy "Post owner can delete any comment on their own post"
  on public.comments for delete
  using (
    exists (
      select 1 from public.posts p
      where p.id = comments.post_id and p.author_id = auth.uid()
    )
  );
