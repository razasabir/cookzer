-- Public curatable Lists (Letterboxd-style) on top of My Recipes. The
-- "diary" half of this backlog item is already covered by Profile's
-- Activity tab (a real reverse-chronological log of cook-ins/remakes/
-- posts) — this migration adds the genuinely missing piece: a named,
-- shareable collection of recipes a user curates on purpose, separate
-- from the freeform hashtags on saved_recipes. Run after 015.

create table public.recipe_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.recipe_lists enable row level security;

create policy "Anyone can view public lists, owners can view their own"
  on public.recipe_lists for select
  using (is_public or owner_id = auth.uid());

create policy "Users manage their own lists"
  on public.recipe_lists for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table public.recipe_list_items (
  list_id uuid not null references public.recipe_lists(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, recipe_id)
);

alter table public.recipe_list_items enable row level security;

create policy "List items are visible wherever the list is visible"
  on public.recipe_list_items for select
  using (
    exists (
      select 1 from public.recipe_lists l
      where l.id = list_id and (l.is_public or l.owner_id = auth.uid())
    )
  );

create policy "List owners manage their list's items"
  on public.recipe_list_items for all
  using (exists (select 1 from public.recipe_lists l where l.id = list_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.recipe_lists l where l.id = list_id and l.owner_id = auth.uid()));
