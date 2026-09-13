-- Adds a dedicated cover/hero photo to recipes, set at creation time.
-- Run in the Supabase SQL Editor after 003_platform_tables.sql.

alter table public.recipes
  add column hero_photo_path text;
