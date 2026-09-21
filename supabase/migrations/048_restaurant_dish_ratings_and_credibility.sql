-- Restaurant module Phase 1+2: dish-level ratings and a reviewer-
-- credibility signal, so a rating carries more than a bare star count.
--
-- dish_name is optional free text on the same receipt-verified rating
-- row (no new table) — "what did you order" alongside "was it worth
-- it," aggregated client-side into a "best dish here" rollup the same
-- way the existing Cookzer-rating average is already computed live
-- rather than stored (see cookzer-restaurant.html).
alter table public.restaurant_ratings add column if not exists dish_name text;

-- reviewer_credibility: a lightweight, read-only aggregate ("Foodie
-- score") from signals this app already tracks — receipt-verified
-- ratings left (weighted highest, since that's the hardest-to-fake
-- signal), follower count, and post count. This continues the existing
-- "compute live, don't persist a score" convention already used by
-- cookzer-profile.html's MILESTONES (no new stored/trigger-maintained
-- column), just as a single efficient view instead of N client queries
-- per reviewer. The underlying tables (restaurant_ratings, follows,
-- posts) are already readable by any authenticated user, so this view
-- exposes no data beyond what a client could already compute itself
-- from three separate queries.
create or replace view public.reviewer_credibility as
select
  p.id as user_id,
  (
    coalesce((select count(*) from public.restaurant_ratings rr where rr.user_id = p.id), 0) * 5
    + coalesce((select count(*) from public.follows f where f.followee_id = p.id), 0)
    + coalesce((select count(*) from public.posts po where po.author_id = p.id), 0)
  )::int as foodie_score
from public.profiles p;

grant select on public.reviewer_credibility to authenticated;
