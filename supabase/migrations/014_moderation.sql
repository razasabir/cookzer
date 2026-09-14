-- Basic block/report moderation. Purely additive — does not touch any
-- existing table or policy from prior migrations. Run after 013.
--
-- Scope of this pass: blocking is enforced client-side (hides a blocked
-- user's content from your feed/group/profile views, stops you from
-- starting a new Messenger conversation with them, and disables the
-- message box in any existing thread with them) rather than at the RLS
-- layer — the safer additive option given how easily an RLS policy on an
-- existing table can introduce a recursion bug (see the two prior
-- incidents logged in the master plan). Reports have no admin UI yet;
-- query the `reports` table directly in the Supabase dashboard to review
-- them for now.

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create policy "Users can view their own block list"
  on public.user_blocks for select
  using (auth.uid() = blocker_id);

create policy "Users can block others"
  on public.user_blocks for insert
  with check (auth.uid() = blocker_id);

create policy "Users can unblock others"
  on public.user_blocks for delete
  using (auth.uid() = blocker_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'recipe')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Users can file reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can see their own filed reports"
  on public.reports for select
  using (auth.uid() = reporter_id);
