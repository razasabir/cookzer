-- Fixes: "infinite recursion detected in policy for relation
-- conversation_participants" when starting a new conversation.
--
-- Root cause: the original SELECT policy on conversation_participants
-- queried conversation_participants itself inside an EXISTS subquery.
-- Postgres has to re-apply that same policy to evaluate the subquery,
-- which re-triggers the policy, forever. Run this once in the Supabase
-- SQL Editor to replace it with a SECURITY DEFINER function that checks
-- membership with RLS bypassed for that one internal lookup.

create or replace function public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = _conversation_id and user_id = _user_id
  );
$$;

drop policy if exists "Participants can view participant rows for their conversations" on public.conversation_participants;

create policy "Participants can view participant rows for their conversations"
  on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id, auth.uid()));
