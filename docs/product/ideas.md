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
- **AI cooking assistant (undecided)** — a conversational way to deliver
  pantry-aware suggestions: "I have chicken, rice, and bell peppers,
  what can I make?" pulling from real community recipes. Flagged, not
  committed: this would be the first feature needing a server-side
  piece (an LLM API key can't live in client-side code the way the
  Supabase publishable key does — needs a small Vercel serverless
  function) and it carries an ongoing per-message cost that could push
  past the ~$25/mo budget ceiling if it gets used a lot. Not slotted
  into the execution plan phases below until a build/no-build call is
  made.
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

## 2026-09-13 — Competitive research (web-researched, not just brainstormed)

Looked at 5 real platforms across cooking and adjacent categories to find
mechanics worth adapting, not copying. Recommendation at the bottom.

### Cookpad — world's largest UGC recipe community
What they do: users write and share their own recipes; the standout
mechanic is **Cooksnaps** — when you cook someone else's recipe, you post
a photo of your result directly attached to their original recipe, with
a comment. Also: AI photo-to-recipe (snap a handwritten recipe card, it
digitizes it), import-from-any-URL, ingredient-based search.
Source: [Cookpad](https://cookpad.com/us), [Cookpad Review 2026](https://www.pann-app.com/blog/cookpad-review)

- **Twist — Remakes, not just comments**: when you cook someone else's
  recipe, "Remake" it as a first-class post type that credits the
  original and feeds a "Most Remade" leaderboard. Recipe credit becomes
  a real status signal, like GitHub forks.

### TikTok / social food discovery
What they do: 37% of people now find food/recipes through social feeds;
algorithms surface *live trending dishes* (baked feta pasta, birria
tacos), not evergreen categories — freshness beats completeness.
Source: [Social Media Food Trends In 2026](https://tastewise.io/blog/social-media-food-trends)

- **Twist — Trend Radar challenges**: instead of one manually-curated
  weekly challenge, surface live trending dishes inside Cookzer itself
  ("12 people just posted feta pasta this week") and let a trend spawn
  its own mini-challenge automatically.

### Untappd — beer check-ins (not food, but the closest gamification model)
What they do: a low-friction "check-in" separate from a full review —
tap a beer, rate it, earn badges (styles tried, venues visited), see
friends' check-ins as a discovery feed. Two speeds of engagement: a full
review vs. a quick check-in.
Source: [Untappd — Wikipedia](https://en.wikipedia.org/wiki/Untappd)

- **Twist — Cook-ins**: a one-tap "I cooked this" separate from writing
  a full post — lower friction than posting, builds a streak, unlocks
  cuisine-exploration badges ("10 cuisines tried").

### Letterboxd — film logging/social
What they do: every film you watch goes into an automatic diary; you
curate public **Lists** (e.g. "Best heist movies") that others follow.
Weaker on gamification than Untappd, very strong on curation and
identity — "this is my taste," expressed through what you've logged.
Source: [Letterboxd: The future go-to app for film lovers?](https://medium.com/@krishnan357/letterboxd-the-future-go-to-app-for-film-lovers-d9db624d0948)

- **Twist — Cooking Diary + Lists**: evolve "My Cookbook" into a running
  diary of everything you've cooked (private by default) plus curatable
  public Lists ("My go-to weeknight dinners") that others can follow —
  identity through taste, not just posts.

### Culinary Agents — "LinkedIn for chefs"
What they do: a professional network + job board for hospitality, where
chef profiles double as a resume. Validates that Cookzer's own
"home cooks to industry pros" positioning is a real, served market.
Source: [Culinary Agents](https://culinaryagents.com/about)

- **Twist — Kitchen CV mode**: a toggleable professional profile for
  industry users — culinary background, signature dishes, an "open to
  work" flag — so a real post history doubles as a portfolio.

### Profile stats (decided 2026-09-13, user-approved)
Not a single composite "rating" score — that invites gaming and feels
judgmental for what's supposed to be a warm community. Instead: raw
stats on the profile page, like a game profile card — recipes shared,
challenges won, times remade by others (ties into the Remakes idea
above), current cook-in streak. Fits naturally alongside Kitchen CV mode
since both are profile-page additions once real data exists.

### Recommendation
Don't try to out-recipe Cookpad or out-import Samsung Food/SideChef —
that's a database-size and integrations war Cookzer can't win right now.
The real gap: **none of the pure recipe apps have Untappd/Letterboxd-style
logging, streaks, and identity-through-taste** — and Cookzer is already
social-first. **Cook-ins + Cooking Diary/Lists** are the highest-leverage
twist: cheap to build on the schema Phase 1/2 already require, and the
one thing none of these competitors do well. Slotted into the roadmap's
execution plan below.

### Technical foundation (from webdev/coder, not user-facing)
- **Shared stylesheet** — all 5 pages currently duplicate an identical
  embedded `<style>` block; extracting `styles.css` would make future
  visual changes 1 file instead of 5. Deliberately not done in this
  first pass to keep it small — worth doing before the shell diverges
  further across pages.
- **Real backend** — none of the data (posts, hearts, comments, challenge
  entries) persists anywhere yet; it's all hardcoded HTML. Any feature
  beyond static content needs this decided first (see `coder` skill).
