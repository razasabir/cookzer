# PRD: Backend (Supabase)

## Decision (from user)
- Target users: everyday home cooks, aspiring/semi-pro cooks, and
  professional chefs/industry — spans casual sharing to professional
  networking (the "LinkedIn for cooking" angle).
- Monetization: none yet — growth first.
- Budget: small but real — up to ~$25/mo.
- Backend: build now, don't wait for more UX validation.
- Database/auth: **Supabase** (Postgres + built-in auth + realtime).
- Auth methods: email/password **and** social login.
- Moderation: basic block/report from day one (not deferred).

## Why Supabase fits here
- Free tier covers early usage; paid tier fits inside the ~$25/mo ceiling
  as it grows.
- Postgres + row-level security handles user-scoped data (messages,
  posts, blocks) cleanly.
- Built-in auth supports email/password and OAuth providers (Google,
  etc.) without a separate auth service.
- Realtime subscriptions replace the messenger's current localStorage
  persistence with actual cross-device delivery — the biggest gap
  flagged when the messenger UI shipped.
- Works cleanly from Vercel (client-side SDK + optionally Vercel
  serverless functions for anything that shouldn't run in the browser).

## What this unblocks
- Direct messenger: real delivery between two different users' devices
  (today: localStorage, single-browser only)
- Real accounts or logging in as a specific existing persona (Sarah K.,
  Amina M., etc. become real, ownable accounts)
- Persistent posts, hearts, comments, saved recipes, challenge entries
- Block/report actions with real effect (hide content, flag for review)
- Follow graph for a personalized feed (idea backlog item)

## Schema sketch (first pass, subject to change once building)
- `users` (id, display_name, avatar_url, bio, created_at) — extends
  Supabase's built-in `auth.users`
- `posts` (id, author_id, title, description, image_url, tags, created_at)
- `hearts` (post_id, user_id) — composite unique key
- `comments` (id, post_id, author_id, text, created_at)
- `conversations` (id, created_at) + `conversation_participants`
  (conversation_id, user_id)
- `messages` (id, conversation_id, sender_id, text, created_at)
- `blocks` (blocker_id, blocked_id)
- `reports` (id, reporter_id, target_type, target_id, reason, created_at)

## What's needed to start (from the user)
This can't be wired up blind — it needs a real Supabase project:
1. Create a project at supabase.com (free tier to start).
2. In the project's API settings, get the **Project URL** and **anon
   public key**.
3. Add those as environment variables in the Vercel project (Settings →
   Environment Variables) rather than pasting them into chat or
   committing them to the repo:
   - `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `SUPABASE_ANON_KEY`)
4. Confirm which social login provider(s) to enable first (Google is
   the simplest to set up) — needs an OAuth app credential from that
   provider, configured inside Supabase's Auth settings.

Once the project exists and env vars are set, coder can wire up auth and
start migrating the messenger + feed off hardcoded/localStorage data.

## Scope note
The static-HTML-only architecture ends here — introducing Supabase means
the site needs a JS build step (or at minimum a bundled Supabase client)
across pages. This is a bigger structural shift than anything shipped so
far; flagging it explicitly rather than doing it silently mid-feature.
