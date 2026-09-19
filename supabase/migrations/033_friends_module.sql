-- Friends module upgrade: mutual friends (pure client-side query, no
-- schema needed), People You May Know (+ dismissals so "not interested"
-- sticks), Kitchen CV skill endorsements, Kitchen CV written
-- recommendations, birthdays, and invite-link referral tracking.

-- ============================================================
-- 1. Birthdays — month/day only, no year, so nobody's age is stored or
--    shown. Two plain ints rather than a `date` column: it sidesteps
--    Feb-29-in-a-non-leap-year validation entirely, which a real date
--    column would force us to deal with for no benefit here.
-- ============================================================

alter table public.profiles
  add column birthday_month smallint check (birthday_month between 1 and 12),
  add column birthday_day smallint check (birthday_day between 1 and 31);

-- ============================================================
-- 2. Invite-link referrals — set once, client-side, right after a new
--    user's first sign-in if they arrived via someone's `?ref=` link
--    (see auth-guard.js). Deliberately not wired into the signup
--    trigger: that would only cover email/password signup, while doing
--    it post-login covers Google/Facebook OAuth the same way.
-- ============================================================

alter table public.profiles
  add column referred_by uuid references public.profiles(id) on delete set null;

-- ============================================================
-- 3. People You May Know — dismissals. Suggestions themselves are
--    computed client-side from the existing follows/group_members
--    tables (see people-you-may-know.js); this table only needs to
--    remember who you've said "not interested" to so it stays hidden.
-- ============================================================

create table public.pymk_dismissals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  dismissed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dismissed_id)
);

alter table public.pymk_dismissals enable row level security;

create policy "Users manage their own PYMK dismissals"
  on public.pymk_dismissals for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- 4. Kitchen CV skills + endorsements (LinkedIn's skills/endorsements,
--    repurposed for cooking techniques). A skill is added by its
--    owner; anyone else can endorse it once.
-- ============================================================

create table public.kitchen_cv_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, skill)
);

alter table public.kitchen_cv_skills enable row level security;

create policy "Skills are viewable by any authenticated user"
  on public.kitchen_cv_skills for select
  using (auth.role() = 'authenticated');

create policy "Users manage the skills on their own Kitchen CV"
  on public.kitchen_cv_skills for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create table public.kitchen_cv_endorsements (
  skill_id uuid not null references public.kitchen_cv_skills(id) on delete cascade,
  endorser_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (skill_id, endorser_id)
);

alter table public.kitchen_cv_endorsements enable row level security;

create policy "Endorsements are viewable by any authenticated user"
  on public.kitchen_cv_endorsements for select
  using (auth.role() = 'authenticated');

create policy "Users can endorse someone else's skill"
  on public.kitchen_cv_endorsements for insert
  with check (
    endorser_id = auth.uid()
    and exists (select 1 from public.kitchen_cv_skills s where s.id = skill_id and s.profile_id <> auth.uid())
  );

create policy "Endorser can retract their own endorsement"
  on public.kitchen_cv_endorsements for delete
  using (endorser_id = auth.uid());

create policy "CV owner can remove an endorsement from their skill"
  on public.kitchen_cv_endorsements for delete
  using (exists (select 1 from public.kitchen_cv_skills s where s.id = skill_id and s.profile_id = auth.uid()));

-- ============================================================
-- 5. Kitchen CV written recommendations — a short testimonial from
--    another user. Mirrors LinkedIn's approve-before-it-shows flow:
--    a new one starts 'pending' and is invisible to everyone but its
--    author and the profile owner until the owner sets it 'visible'
--    (or 'hidden', if they'd rather not show it at all).
-- ============================================================

create table public.kitchen_cv_recommendations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'visible', 'hidden')),
  created_at timestamptz not null default now(),
  unique (profile_id, author_id)
);

alter table public.kitchen_cv_recommendations enable row level security;

create policy "Visible recommendations are public; pending ones are private to author/owner"
  on public.kitchen_cv_recommendations for select
  using (status = 'visible' or profile_id = auth.uid() or author_id = auth.uid());

create policy "Users can write a recommendation for someone else"
  on public.kitchen_cv_recommendations for insert
  with check (author_id = auth.uid() and profile_id <> auth.uid());

create policy "CV owner can approve or hide a recommendation"
  on public.kitchen_cv_recommendations for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "Author can retract their own recommendation"
  on public.kitchen_cv_recommendations for delete
  using (author_id = auth.uid());

-- ============================================================
-- 6. Notifications for the two new social actions. Both reuse the
--    existing notify_reviews preference rather than adding two more
--    toggles to Settings — an endorsement or a recommendation is the
--    same "someone vouched for you" category as a recipe review.
-- ============================================================

create or replace function public.notify_on_cv_endorsement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_skill text;
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
begin
  select profile_id, skill into v_recipient, v_skill from public.kitchen_cv_skills where id = new.skill_id;
  select * into v_prefs from public.notification_prefs where user_id = v_recipient;
  if v_prefs.user_id is not null and not v_prefs.notify_reviews then
    return new;
  end if;
  select display_name into v_actor_name from public.profiles where id = new.endorser_id;
  perform public.create_notification(
    v_recipient, new.endorser_id, 'cv_endorsement',
    coalesce(v_actor_name, 'Someone') || ' endorsed you for ' || coalesce(v_skill, 'a skill'),
    'cookzer-profile.html?id=' || v_recipient
  );
  return new;
end;
$$;

create trigger trg_notify_on_cv_endorsement
  after insert on public.kitchen_cv_endorsements
  for each row execute function public.notify_on_cv_endorsement();

create or replace function public.notify_on_cv_recommendation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prefs public.notification_prefs%rowtype;
  v_actor_name text;
begin
  select * into v_prefs from public.notification_prefs where user_id = new.profile_id;
  if v_prefs.user_id is not null and not v_prefs.notify_reviews then
    return new;
  end if;
  select display_name into v_actor_name from public.profiles where id = new.author_id;
  perform public.create_notification(
    new.profile_id, new.author_id, 'cv_recommendation',
    coalesce(v_actor_name, 'Someone') || ' wrote you a Kitchen CV recommendation',
    'cookzer-profile.html?id=' || new.profile_id
  );
  return new;
end;
$$;

create trigger trg_notify_on_cv_recommendation
  after insert on public.kitchen_cv_recommendations
  for each row execute function public.notify_on_cv_recommendation();
