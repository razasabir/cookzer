-- Reporting a restaurant rating (e.g. a fake/edited receipt, or proof from
-- an unrelated purchase) reuses the existing public.reports table from
-- migration 014, but its target_type check constraint only allows
-- 'post' | 'comment' | 'user' | 'recipe'. Add 'restaurant_rating'.

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'user', 'recipe', 'restaurant_rating'));
