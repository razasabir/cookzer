-- Replaces the cookbook folder system with freeform hashtags on each
-- saved recipe — a recipe can carry more than one tag, unlike a
-- single folder. cookbook_folders / saved_recipes.folder_id are left
-- in place (unused going forward) rather than dropped, so no data is
-- destroyed. Run after 012.

alter table public.saved_recipes
  add column tags text[] not null default '{}';
