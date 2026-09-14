-- Settings page + a real Notifications center. Run after 016.

-- When the user last opened notifications (bell dropdown or the full
-- page) — drives the unread dot on the bell icon.
alter table public.profiles
  add column notifications_read_at timestamptz;

-- Per-user toggles for which notification types show up at all (bell +
-- full page). No email/push infrastructure exists yet, so these are
-- honestly scoped to in-app visibility only — not a promise to send
-- anything outside the site.
create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notify_follows boolean not null default true,
  notify_hearts boolean not null default true,
  notify_comments boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

create policy "Users manage their own notification preferences"
  on public.notification_prefs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
