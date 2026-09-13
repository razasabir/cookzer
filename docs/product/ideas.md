# Idea backlog

Raw ideas for Cookzer modules/features, not yet scoped into PRDs. PM
triages these into `roadmap.md` when it's time to build one.

## 2026-09-13 — Creative + PM brainstorm

### Core engagement
- **Recipe detail / cook mode** — tapping a feed post's recipe opens a
  full step-by-step view (ingredients checklist, numbered steps, a
  screen-stays-on "cook mode"). Right now recipes only exist as feed
  post captions — there's no actual recipe object.
- **Comments & replies on posts** — feed cards show comment counts but
  there's no way to actually read/write one yet.
- **Recipe ratings & reviews** — "I made this" stamp + a star rating on
  recipes people cooked from someone else's post.
- **Video posts** — short cook-along clips alongside photo posts; food
  content performs very differently as video.

### Utility / planning
- **Shopping list generator** — turn a week in the Meal Planner into a
  consolidated grocery list, one tap.
- **Recipe import from URL** — paste a link to any recipe blog, Cookzer
  parses it into a structured recipe on your profile/cookbook.
- **Pantry-aware suggestions** — tell Cookzer what's in your fridge, get
  recipe matches from the community.
- **Nutrition & cost-per-serve info** — auto-estimate calories and cost
  per serving on a recipe (ties nicely into challenges like "Under $10").

### Social / growth
- **Follow / friend system** — right now the sidebar shows "recently
  active" people but there's no real follow graph or personalized feed.
- **Cooking clubs / groups** — small communities around a cuisine, diet,
  or skill level (e.g. "Vegan Beginners", "Pakistani home cooking").
- **Direct messaging** — the header already has a message icon with no
  destination — an obvious next build.
- **Badges beyond challenges** — streaks, "tried 10 cuisines," "first
  post," etc. for lighter-weight recognition than the weekly challenge.

### Monetization / long-term
- **Home-cook marketplace** — let top-rated home cooks sell meals or
  meal kits locally (bigger bet, needs payments + logistics — flag to
  the user before scoping).
- **Sponsored/branded challenges** — a grocery or kitchenware brand
  sponsors a themed challenge (revenue idea, needs a sales motion, not
  just product).

### Technical foundation (from webdev/coder, not user-facing)
- **Shared stylesheet** — all 5 pages currently duplicate an identical
  embedded `<style>` block; extracting `styles.css` would make future
  visual changes 1 file instead of 5. Deliberately not done in this
  first pass to keep it small — worth doing before the shell diverges
  further across pages.
- **Real backend** — none of the data (posts, hearts, comments, challenge
  entries) persists anywhere yet; it's all hardcoded HTML. Any feature
  beyond static content needs this decided first (see `coder` skill).
