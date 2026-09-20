-- Lets someone pin one of their own recipes to the top of their profile
-- as a featured/spotlight recipe, distinct from the chronological
-- activity feed below it. Nullable, cleared automatically if the
-- pinned recipe is ever deleted.
alter table public.profiles
  add column pinned_recipe_id uuid references public.recipes(id) on delete set null;
