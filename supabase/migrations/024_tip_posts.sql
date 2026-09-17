-- Tips & Tricks: a new post kind so a tip reads as its own thing in the
-- feed ("shared a tip" vs "posted"/"cooked this"/"remade this"), same
-- semantic role kind already plays for cook_in/remake. Reuses all of the
-- feed's existing posting/hearting/commenting infrastructure — no new
-- table, just a widened kind check and a filtered feed view (?filter=tips).
-- Run after 023.

alter table public.posts
  drop constraint posts_kind_check;

alter table public.posts
  add constraint posts_kind_check check (kind in ('post', 'cook_in', 'remake', 'tip'));
