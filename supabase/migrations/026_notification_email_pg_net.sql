-- Fallback for the email side of migration 025: this project's Dashboard
-- "Database Webhooks" feature fails on create with
-- `ERROR: 3F000: schema "supabase_functions" does not exist` — a known gap
-- where that internal schema was never provisioned on this project, even
-- with pg_net enabled and the project restarted. Rather than depend on
-- that broken dashboard feature, this does the exact same job directly:
-- an after-insert trigger on notifications that POSTs the new row to the
-- email endpoint via pg_net (already enabled, and unaffected by the
-- missing schema — pg_net's own `net` schema is separate).
--
-- Sends the same payload shape api/send-notification-email.js already
-- expects from a real Supabase Database Webhook ({type, table, record}),
-- so the endpoint itself needed zero changes.
--
-- Before running: replace REPLACE_WITH_YOUR_WEBHOOK_SECRET below with the
-- exact same value you set as NOTIFICATION_WEBHOOK_SECRET in Vercel — do
-- this in the SQL Editor just before running, never commit the real value
-- to this file.
--
-- Run after 025.

create or replace function public.trigger_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://cookzer.com/api/send-notification-email',
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

create trigger trg_notify_email
  after insert on public.notifications
  for each row execute function public.trigger_notification_email();
