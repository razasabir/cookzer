# Cookzer roadmap

## Execution plan (current)
1. **Shared stylesheet** — extract `styles.css` before more features pile onto 8 duplicated `<style>` blocks.
2. **Real feed** — `posts`/`hearts`/`comments` tables + RLS. The composer creates real posts, hearts persist, comments work. Everything else in the backlog depends on this. Ship **Cook-ins** alongside (one-tap "I cooked this," lower friction than a full post, builds a streak) — see competitive research below for why this is prioritized over pure recipe-database features.
3. **Real recipes** — `recipes` table, dynamic recipe detail page, posts attach real recipes, cookbook pulls real saved recipes. Ship **Remakes** (cooking someone else's recipe as a first-class credited post type, feeds a "Most Remade" leaderboard), **Cooking Diary + Lists** (evolve My Cookbook into a running diary + curatable public Lists), **Recipe categories** (Breakfast/Dinner/Dessert/etc. — the primary browse mechanism), and **Dietary filters** (vegan/vegetarian/gluten-free as multi-select search tags) alongside, since all four need the same `recipes` table fields.
4. **Social graph** — follow/unfollow, personalized feed, real profile page. Ship **Kitchen CV mode** and **Profile stats** alongside (recipes shared, challenges won, times remade, cook-in streak — raw stats, not a single composite rating score) since both are profile-page extensions.
5. **Shopping list from Meal Planner** — contained, high value, independent of the social graph.
6. **Engagement extras** — ratings/reviews, recipe import from URL, badges, **Trend Radar challenges** (live trending-dish detection spawning mini-challenges, instead of one manually-curated weekly challenge).
7. **Parked** (needs a business decision, not just build time): marketplace (payments), sponsored challenges (sales motion), video posts (storage/bandwidth cost), groups (bigger scope).

Items 2-6's new additions (Cook-ins, Remakes, Cooking Diary + Lists,
Kitchen CV mode, Trend Radar) come from competitive research across
Cookpad, TikTok food discovery, Untappd, Letterboxd, and Culinary Agents
— see `docs/product/ideas.md` for what each platform does and the full
reasoning behind each twist.


## Positioning
Cookzer is a social network for cooks — Facebook/LinkedIn, vertical to
cooking. Identity, connections, and communication between users are core
infrastructure, not bolt-on features. This reframes priority: anything
that lets cooks connect and talk to each other outranks pure content
features.

Status legend: shipped / next / idea

| Feature | Status | Notes |
|---|---|---|
| Mobile-responsive site shell | shipped | `docs/product/prd-mobile-responsive-shell.md` |
| Direct messenger | shipped | `docs/product/prd-messenger.md` — full UI + local persistence, real cross-user delivery needs a backend (see below) |
| Recipe detail / cook mode | idea | biggest gap — recipes don't exist as real objects yet, only feed captions |
| Comments on posts | idea | UI shows counts, no read/write yet |
| Shopping list from Meal Planner | idea | high value, purely additive to existing planner page |
| Follow / friend system + personalized feed | idea | needs a backend decision first |
| Real backend (data persistence) | idea | blocks messenger actually delivering cross-device, and most of the above — needs a stack decision, see `coder` skill |
| Shared stylesheet (styles.css) | idea | technical debt cleanup, not user-facing |

Full raw list, uncategorized by priority: `docs/product/ideas.md`.

## Why mobile-responsive shipped first
Nothing else matters if the site is unusable on a phone — see
`docs/product/prd-mobile-responsive-shell.md` for the full reasoning and
what each role weighed in on before this was scoped.
