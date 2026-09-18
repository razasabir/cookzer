-- Real push notifications — an actual OS-level alert even when Cookzer
-- (the website or the Android app) isn't open, on top of the existing
-- in-app bell and email channels from migration 025. Firebase Cloud
-- Messaging (FCM) delivers to both: the native Android app and any
-- browser subscribed to web push, from one send call.
--
-- Mirrors the email channel's architecture exactly (see 025/026): the
-- recipient's push token and their notify_push preference are looked up
-- and stamped onto the notifications row at insert time, so the sending
-- function (api/send-notification-push.js) never needs service-role
-- Supabase access — it only trusts what the trigger already decided.
-- Fired the same way email is (026) — via a direct pg_net trigger, since
-- this Supabase project's Database Webhooks dashboard feature doesn't
-- work here (see 026's comment for the exact error).
--
-- Unlike email, a token only exists once the user has actually granted
-- OS/browser notification permission (there's no equivalent of "their
-- account email always exists"), so notify_push defaults to off and
-- push-notifications.js only ever requests permission after an explicit
-- toggle in Settings — never silently on page load.
--
-- Known simplification: one token per user (the most recently registered
-- device wins), not one row per device. Fine for how Cookzer is actually
-- used (one phone or one browser at a time); a multi-device table can
-- replace this later without changing the trigger's shape.
--
-- Run after 026.

alter table public.notification_prefs
  add column notify_push boolean not null default false,
  add column push_token text,
  add column push_platform text check (push_platform in ('web', 'android', 'ios'));

alter table public.notifications
  add column push_token text,
  add column should_push boolean not null default false;

create or replace function public.create_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_message text,
  p_link_url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_should_email boolean;
  v_push_token text;
  v_notify_push boolean;
begin
  if p_recipient_id is null or p_recipient_id = p_actor_id then
    return;
  end if;
  select email into v_email from auth.users where id = p_recipient_id;
  select notify_email, push_token, notify_push
    into v_should_email, v_push_token, v_notify_push
    from public.notification_prefs where user_id = p_recipient_id;
  insert into public.notifications (
    recipient_id, actor_id, type, message, link_url,
    recipient_email, should_email, push_token, should_push
  )
  values (
    p_recipient_id, p_actor_id, p_type, p_message, p_link_url,
    v_email, coalesce(v_should_email, true),
    v_push_token, coalesce(v_notify_push, false) and v_push_token is not null
  );
end;
$$;

create or replace function public.trigger_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://cookzer.com/api/send-notification-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'REPLACE_WITH_YOUR_WEBHOOK_SECRET'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_push on public.notifications;

create trigger trg_notify_push
  after insert on public.notifications
  for each row execute function public.trigger_notification_push();
