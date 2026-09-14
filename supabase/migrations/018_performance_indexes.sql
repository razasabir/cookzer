-- Architecture pass: Postgres auto-indexes primary keys and unique
-- constraints, but NOT plain foreign-key columns, and a composite
-- primary key only helps lookups on its leading column — queries
-- filtering by the trailing column alone get no benefit from it. A grep
-- of every .eq()/.in() the client actually runs against these tables
-- turned up 5 real gaps as usage has grown. Purely additive — no data
-- or behavior change, safe to run any time. Run after 017.

-- conversation_participants' PK is (conversation_id, user_id) —
-- conversation_id-leading, so it does nothing for loadConversations()'s
-- "which conversations is this user in" lookup, which filters by
-- user_id alone. This is the one that actually matters most: every
-- Messenger page load hits it.
create index if not exists conversation_participants_user_idx on public.conversation_participants(user_id);

-- messages has no index at all beyond its own id — every open
-- conversation queries by conversation_id.
create index if not exists messages_conversation_idx on public.messages(conversation_id);

-- challenge_entries' FK columns (challenge_id, user_id) are unindexed —
-- hit by the leaderboard, "did I already join", and the badge/stat
-- counts on Profile.
create index if not exists challenge_entries_challenge_idx on public.challenge_entries(challenge_id);
create index if not exists challenge_entries_user_idx on public.challenge_entries(user_id);

-- recipe_photos already has an index on recipe_id but not user_id,
-- which the Shutterbug achievement badge now queries directly.
create index if not exists recipe_photos_user_idx on public.recipe_photos(user_id);
