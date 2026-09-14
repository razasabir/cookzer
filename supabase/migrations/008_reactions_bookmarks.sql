-- Message emoji reactions + "save for later" post bookmarks
-- (Now-bucket items #12 and #13). Run after 007.

create table public.message_reactions (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reactions enable row level security;

create policy "Reactions are viewable by any authenticated user"
  on public.message_reactions for select
  using (auth.role() = 'authenticated');

create policy "Users can react as themselves"
  on public.message_reactions for insert
  with check (user_id = auth.uid());

create policy "Users can update their own reaction"
  on public.message_reactions for update
  using (user_id = auth.uid());

create policy "Users can remove their own reaction"
  on public.message_reactions for delete
  using (user_id = auth.uid());

create table public.post_bookmarks (
  user_id uuid references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.post_bookmarks enable row level security;

create policy "Users manage their own bookmarks"
  on public.post_bookmarks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
