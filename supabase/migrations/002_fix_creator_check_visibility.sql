-- Fixes: "new row violates row-level security policy for table
-- conversation_participants" when starting a new conversation, hit
-- right after migration 001's fix.
--
-- Root cause: the conversation_participants INSERT policy checks
-- whether the requester created the conversation via a subquery against
-- `conversations` - but conversations' own SELECT policy hides that row
-- from the creator until they're already a participant of it, which is
-- exactly what this insert is trying to establish. Same chicken-and-egg
-- shape as migration 001, different table. Run this once in the
-- Supabase SQL Editor.

create or replace function public.is_conversation_creator(_conversation_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversations
    where id = _conversation_id and created_by = _user_id
  );
$$;

drop policy if exists "Add self or add participants to a conversation you created" on public.conversation_participants;

create policy "Add self or add participants to a conversation you created"
  on public.conversation_participants for insert
  with check (
    user_id = auth.uid()
    or public.is_conversation_creator(conversation_id, auth.uid())
  );
