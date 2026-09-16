-- Google/Facebook sign-in: the profile-creation trigger only ever checked
-- raw_user_meta_data->>'display_name' (the key our own email/password
-- signup form sets explicitly). An OAuth signup never sets that key —
-- Supabase normalizes Google/Facebook profile data into 'full_name' and
-- 'name' instead — so without this, every OAuth signup fell through
-- straight to the email-local-part fallback instead of using the name
-- Google/Facebook actually gave us. Also carries over avatar_url from
-- the OAuth provider when one wasn't set another way, since it's the
-- same column the manual avatar-upload flow already writes full URLs
-- into (not a Storage path), so an external Google/Facebook photo URL
-- fits it with no other code changes needed. Run after 022.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  insert into public.profiles (id, display_name, initials, avatar_url)
  values (
    new.id,
    chosen_name,
    upper(left(chosen_name, 2)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
