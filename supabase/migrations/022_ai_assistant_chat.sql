-- Cookzer+ AI Assistant — real backend. Replaces the 021 waitlist teaser
-- with actual chat storage for Pantry Challenge, Leftovers, and Health.
-- The waitlist table (021) is left in place untouched (real signal, real
-- rows) but is no longer written to by the UI.
--
-- Message-cap enforcement (500/user/month, matching the Cookzer+ pricing
-- model) happens in api/ai-chat.js by counting this month's role='user'
-- rows — no separate counter table, so the count can never drift from
-- the actual message history. Run after 021.

create table public.ai_assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null check (feature in ('pantry', 'leftovers', 'health')),
  created_at timestamptz not null default now(),
  unique (user_id, feature)
);

create table public.ai_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_assistant_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index ai_assistant_messages_conversation_idx on public.ai_assistant_messages (conversation_id, created_at);
create index ai_assistant_messages_usage_idx on public.ai_assistant_messages (user_id, role, created_at);

alter table public.ai_assistant_conversations enable row level security;
alter table public.ai_assistant_messages enable row level security;

create policy "Users manage their own conversations"
  on public.ai_assistant_conversations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage their own messages"
  on public.ai_assistant_messages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
