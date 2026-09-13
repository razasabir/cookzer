-- Cookzer platform tables: real feed, real recipes, cookbook, planner,
-- social graph, challenges, and reviews (roadmap Phases 1-5).
-- Run this once in the Supabase SQL Editor: Dashboard -> SQL Editor -> New
-- query -> paste -> Run. Depends on 001 and 002 already being applied.

-- ============================================================
-- profiles additions: bio/location/avatar + Kitchen CV mode
-- ============================================================

alter table public.profiles
  add column bio text,
  add column location text,
  add column avatar_url text,
  add column is_kitchen_cv boolean not null default false,
  add column cv_title text,
  add column cv_bio text,
  add column open_to_work boolean not null default false;

-- ============================================================
-- follows: the social graph
-- ============================================================

create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  followee_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

create policy "Follow rows are viewable by any authenticated user"
  on public.follows for select
  using (auth.role() = 'authenticated');

create policy "Users can follow as themselves"
  on public.follows for insert
  with check (follower_id = auth.uid());

create policy "Users can unfollow as themselves"
  on public.follows for delete
  using (follower_id = auth.uid());

create index follows_follower_idx on public.follows(follower_id);
create index follows_followee_idx on public.follows(followee_id);

-- ============================================================
-- recipes
-- ============================================================

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text,
  dietary_tags text[] not null default '{}',
  prep_time_minutes int,
  cook_time_minutes int,
  servings int,
  spice_level text,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  nutrition jsonb not null default '{}',
  cost_per_serve numeric,
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "Recipes are viewable by any authenticated user"
  on public.recipes for select
  using (auth.role() = 'authenticated');

create policy "Users can create their own recipes"
  on public.recipes for insert
  with check (author_id = auth.uid());

create policy "Users can update their own recipes"
  on public.recipes for update
  using (author_id = auth.uid());

create policy "Users can delete their own recipes"
  on public.recipes for delete
  using (author_id = auth.uid());

create index recipes_author_idx on public.recipes(author_id);
create index recipes_category_idx on public.recipes(category);

-- ============================================================
-- recipe_photos: the gallery on a recipe page (Supabase Storage-backed)
-- ============================================================

create table public.recipe_photos (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  storage_path text not null,
  filter text not null default 'original',
  created_at timestamptz not null default now()
);

alter table public.recipe_photos enable row level security;

create policy "Recipe photos are viewable by any authenticated user"
  on public.recipe_photos for select
  using (auth.role() = 'authenticated');

create policy "Users can add their own recipe photos"
  on public.recipe_photos for insert
  with check (user_id = auth.uid());

create policy "Users can delete their own recipe photos"
  on public.recipe_photos for delete
  using (user_id = auth.uid());

create index recipe_photos_recipe_idx on public.recipe_photos(recipe_id);

-- ============================================================
-- posts: the real feed. kind='post'|'cook_in'|'remake'
-- ============================================================

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade,
  kind text not null default 'post' check (kind in ('post', 'cook_in', 'remake')),
  recipe_id uuid references public.recipes(id) on delete set null,
  remake_of_post_id uuid references public.posts(id) on delete set null,
  caption text,
  photo_path text,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Posts are viewable by any authenticated user"
  on public.posts for select
  using (auth.role() = 'authenticated');

create policy "Users can create their own posts"
  on public.posts for insert
  with check (author_id = auth.uid());

create policy "Users can delete their own posts"
  on public.posts for delete
  using (author_id = auth.uid());

create index posts_author_idx on public.posts(author_id);
create index posts_created_idx on public.posts(created_at desc);
create index posts_remake_of_idx on public.posts(remake_of_post_id);

alter publication supabase_realtime add table public.posts;

-- ============================================================
-- hearts + comments on posts
-- ============================================================

create table public.hearts (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.hearts enable row level security;

create policy "Hearts are viewable by any authenticated user"
  on public.hearts for select
  using (auth.role() = 'authenticated');

create policy "Users can heart as themselves"
  on public.hearts for insert
  with check (user_id = auth.uid());

create policy "Users can unheart as themselves"
  on public.hearts for delete
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.hearts;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Comments are viewable by any authenticated user"
  on public.comments for select
  using (auth.role() = 'authenticated');

create policy "Users can comment as themselves"
  on public.comments for insert
  with check (author_id = auth.uid());

create policy "Users can delete their own comments"
  on public.comments for delete
  using (author_id = auth.uid());

create index comments_post_idx on public.comments(post_id);

alter publication supabase_realtime add table public.comments;

-- ============================================================
-- cookbook: folders + saved recipes (private per-user)
-- ============================================================

create table public.cookbook_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  emoji text not null default '📁',
  created_at timestamptz not null default now()
);

alter table public.cookbook_folders enable row level security;

create policy "Users manage their own cookbook folders"
  on public.cookbook_folders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.saved_recipes (
  user_id uuid references public.profiles(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete cascade,
  folder_id uuid references public.cookbook_folders(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.saved_recipes enable row level security;

create policy "Users manage their own saved recipes"
  on public.saved_recipes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- meal_plan_entries (private per-user)
-- ============================================================

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  plan_date date not null,
  meal_slot text not null default 'dinner',
  recipe_id uuid references public.recipes(id) on delete set null,
  free_text text,
  source_note text,
  created_at timestamptz not null default now()
);

alter table public.meal_plan_entries enable row level security;

create policy "Users manage their own meal plan entries"
  on public.meal_plan_entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index meal_plan_user_date_idx on public.meal_plan_entries(user_id, plan_date);

-- ============================================================
-- challenges + entries
-- ============================================================

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

create policy "Challenges are viewable by any authenticated user"
  on public.challenges for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can create a challenge"
  on public.challenges for insert
  with check (auth.role() = 'authenticated' and created_by = auth.uid());

create table public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

alter table public.challenge_entries enable row level security;

create policy "Challenge entries are viewable by any authenticated user"
  on public.challenge_entries for select
  using (auth.role() = 'authenticated');

create policy "Users can enter a challenge as themselves"
  on public.challenge_entries for insert
  with check (user_id = auth.uid());

-- Seed this week's challenge so Join/leaderboard have something real to attach to.
insert into public.challenges (title, description, ends_at)
values ('Under $10 a serve', 'Cook a full serve for under $10 and share it.', now() + interval '7 days');

-- ============================================================
-- recipe_reviews: "I made this" stamp + star rating
-- ============================================================

create table public.recipe_reviews (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (recipe_id, user_id)
);

alter table public.recipe_reviews enable row level security;

create policy "Reviews are viewable by any authenticated user"
  on public.recipe_reviews for select
  using (auth.role() = 'authenticated');

create policy "Users can review as themselves"
  on public.recipe_reviews for insert
  with check (user_id = auth.uid());

create policy "Users can update their own review"
  on public.recipe_reviews for update
  using (user_id = auth.uid());

-- ============================================================
-- Storage buckets: post photos, recipe gallery photos, avatars
-- ============================================================

insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true),
       ('recipe-photos', 'recipe-photos', true),
       ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Public read of Cookzer media"
  on storage.objects for select
  using (bucket_id in ('post-photos', 'recipe-photos', 'avatars'));

create policy "Authenticated users can upload Cookzer media"
  on storage.objects for insert
  with check (
    bucket_id in ('post-photos', 'recipe-photos', 'avatars')
    and auth.role() = 'authenticated'
    and owner = auth.uid()
  );

create policy "Users can delete their own uploaded media"
  on storage.objects for delete
  using (
    bucket_id in ('post-photos', 'recipe-photos', 'avatars')
    and owner = auth.uid()
  );
