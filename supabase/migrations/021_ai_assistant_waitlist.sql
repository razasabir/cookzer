-- Cookzer+ AI Assistant — a paid chat feature across Pantry Challenge,
-- Leftovers, and Health (nutrition Q&A), per the user's decision that
-- this is the platform's next monetization driver. "Keep minimum for
-- now": no LLM is actually wired up (needs a server-side Anthropic API
-- key, an ongoing per-message cost, and a billing decision — none of
-- which exist yet, same blocker class as Google OAuth). What ships
-- instead is honest and real: a paid-feature teaser in all three spots
-- that captures genuine interest via a waitlist, so real demand exists
-- before the backend/billing work is scoped. Run after 020.

create table public.ai_assistant_waitlist (
  user_id uuid references public.profiles(id) on delete cascade,
  feature text not null check (feature in ('pantry', 'leftovers', 'health')),
  created_at timestamptz not null default now(),
  primary key (user_id, feature)
);

alter table public.ai_assistant_waitlist enable row level security;

create policy "Users can join the waitlist for themselves"
  on public.ai_assistant_waitlist for insert
  with check (user_id = auth.uid());

create policy "Users can see their own waitlist entries"
  on public.ai_assistant_waitlist for select
  using (user_id = auth.uid());

create policy "Users can leave the waitlist"
  on public.ai_assistant_waitlist for delete
  using (user_id = auth.uid());
