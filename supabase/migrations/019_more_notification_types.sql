-- Extends notification_prefs (017) with two more event types the
-- notification center didn't cover yet: someone remaking your recipe,
-- and someone joining a challenge you created. Existing rows default
-- both to true (opt-out, matching the existing three columns). Run
-- after 018.

alter table public.notification_prefs
  add column notify_remakes boolean not null default true,
  add column notify_challenge_joins boolean not null default true;
