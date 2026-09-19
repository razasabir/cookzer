-- Family Profiles can now link to a real Cookzer account — the adults in
-- a household are often already on Cookzer themselves (as a friend/follow),
-- so adding them as a family member should pull in their real name and
-- avatar directly instead of retyping them as a fresh no-login profile.
-- linked_user_id is nullable: a plain named profile (e.g. a kid without
-- their own login) still works exactly as before.
alter table public.family_profiles add column linked_user_id uuid references public.profiles(id) on delete cascade;

alter table public.family_profiles
  add constraint family_profiles_no_self_link check (linked_user_id is distinct from owner_id);

-- One family-profile row per linked account per owner — re-picking the
-- same friend should not create a duplicate column.
create unique index family_profiles_owner_linked_user_uidx
  on public.family_profiles(owner_id, linked_user_id)
  where linked_user_id is not null;
