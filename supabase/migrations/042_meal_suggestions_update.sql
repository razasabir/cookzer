-- meal_suggestions (migration 028, extended by 035) never got an update
-- policy — only select/insert/delete — so a suggestion (e.g. one made
-- for a kid's Family Profile) could never be edited once added, only
-- deleted and re-added. Same "who can touch this" rule as delete: the
-- suggester themselves, or whoever owns the Family Profile it was made
-- for.
create policy "Suggester (or their family profile's owner) can update it"
  on public.meal_suggestions for update
  using (
    suggested_by_user_id = auth.uid()
    or suggested_by_family_profile_id in (select id from public.family_profiles where owner_id = auth.uid())
  )
  with check (
    suggested_by_user_id = auth.uid()
    or suggested_by_family_profile_id in (select id from public.family_profiles where owner_id = auth.uid())
  );
