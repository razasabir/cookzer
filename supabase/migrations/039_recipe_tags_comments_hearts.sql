-- 1. Free-form recipe tags — searchable keywords the author types in
--    (e.g. "quick", "spicy", "one-pot"), distinct from dietary_tags
--    (a fixed checklist of dietary restrictions) and category (a
--    single dropdown value). Used to widen recipe search beyond
--    title-only matching.
alter table public.recipes add column tags text[] not null default '{}';

-- 2. Recipes get their own comment thread — the same table, shape, and
--    moderation rules as a post's comments (migration 003/038), not a
--    duplicate system. Sharing a recipe to the feed is optional at
--    creation time, so a recipe can't always be commented on via its
--    (possibly nonexistent) post — comments now point at either a post
--    or a recipe, never both.
alter table public.comments
  add column recipe_id uuid references public.recipes(id) on delete cascade;

alter table public.comments
  add constraint comments_one_target check (
    (post_id is not null and recipe_id is null)
    or (post_id is null and recipe_id is not null)
  );

create index comments_recipe_idx on public.comments(recipe_id);

create policy "Recipe owner can delete any comment on their own recipe"
  on public.comments for delete
  using (
    exists (
      select 1 from public.recipes r
      where r.id = comments.recipe_id and r.author_id = auth.uid()
    )
  );

-- 3. Recipes get hearts too, same table as post hearts. hearts' primary
--    key was (post_id, user_id) with post_id implicitly not-null (PK
--    columns can't be null) — replace that with a nullable post_id/
--    recipe_id pair plus a check constraint, and a separate partial
--    unique index per target instead of one shared PK, mirroring the
--    comments approach above.
alter table public.hearts
  add column recipe_id uuid references public.recipes(id) on delete cascade;

alter table public.hearts drop constraint hearts_pkey;

alter table public.hearts alter column post_id drop not null;

alter table public.hearts
  add constraint hearts_one_target check (
    (post_id is not null and recipe_id is null)
    or (post_id is null and recipe_id is not null)
  );

create unique index hearts_post_user_uidx on public.hearts(post_id, user_id) where post_id is not null;
create unique index hearts_recipe_user_uidx on public.hearts(recipe_id, user_id) where recipe_id is not null;
create index hearts_recipe_idx on public.hearts(recipe_id);
