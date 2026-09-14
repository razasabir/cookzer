-- Restaurant ratings, verified by a required receipt/invoice photo — every
-- rating must carry proof of an actual visit, so this can't be gamed with
-- text-only reviews. Run after 011.

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.restaurant_ratings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review text,
  receipt_photo_path text not null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create index restaurant_ratings_restaurant_id_idx on public.restaurant_ratings(restaurant_id);

alter table public.restaurants enable row level security;
alter table public.restaurant_ratings enable row level security;

create policy "restaurants are viewable by authenticated users"
  on public.restaurants for select
  to authenticated
  using (true);

create policy "authenticated users can add restaurants"
  on public.restaurants for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "restaurant ratings are viewable by authenticated users"
  on public.restaurant_ratings for select
  to authenticated
  using (true);

create policy "users can rate as themselves"
  on public.restaurant_ratings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update their own rating"
  on public.restaurant_ratings for update
  to authenticated
  using (user_id = auth.uid());

create policy "users can delete their own rating"
  on public.restaurant_ratings for delete
  to authenticated
  using (user_id = auth.uid());
