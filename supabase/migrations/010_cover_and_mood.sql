-- Turns two client-side-only conveniences into real shared/structured
-- data (found during the full-site QA audit — see
-- docs/qa/full-site-audit-test-plan.md):
--   1. Profile cover banner was localStorage-only, so nobody but the
--      same browser ever saw it. Now a real profile column.
--   2. The composer's "Feeling:" mood tag was just string-concatenated
--      onto the caption with no distinct storage or rendering. Now a
--      real column, rendered as its own badge.
-- Run after 009.

alter table public.profiles
  add column cover_gradient text;

alter table public.posts
  add column mood text;
