-- Adds group conversation support to Messenger. conversation_participants
-- already allows more than 2 rows per conversation (no schema change
-- needed there), and its existing INSERT policy already lets a
-- conversation's creator add other participants (not just themselves) —
-- see migration 002. The only gap was a way to give a 3+-person thread
-- an optional display name instead of falling back to a joined list of
-- first names. Run after 014.

alter table public.conversations
  add column name text;
