# Full-site QA audit — Sep 2026

Comprehensive end-to-end pass across all 11 pages plus the video upload
serverless endpoint, run after the video-posting and Profile Activity
work landed. No formal `docs/requirements/<feature>.md` acceptance
criteria exist for most of these features (they were built directly
from conversation, not a written PRD), so this audit checks against
what `docs/product/master-plan.html` claims as "shipped" instead, and
says so explicitly per finding rather than picking a silent
interpretation.

Method: static code review of every `.from()`/`.insert()`/`.update()`/
`.select()` call against the real schema in `supabase/migrations/*.sql`,
plus DOM/structural checks via Playwright (network calls to Supabase/
Bunny mocked or blocked — this sandbox has no live network access to
either, so no live data-flow test was possible; only structure, wiring,
and logic were checked).

## Schema mismatch check — PASS, no issues found

Exhaustively checked every table/column reference in all 11 pages plus
`api/create-video-upload.js` and `auth-guard.js` against migrations
001–009. No mismatches. One caveat: `profiles.display_name/initials`,
`messages.*`, `conversations.id`, `conversation_participants.last_read_at`
are used constantly but aren't defined in the provided migration set —
their `CREATE TABLE` predates migration 001. Usage is internally
consistent everywhere, so not flagged as a defect.

## Dead/incomplete UI

| # | Finding | Location | Status |
|---|---|---|---|
| 1 | 🔔 notification bell has no handler at all — clicking does nothing | `cookzer-feed.html`, `cookzer-cookbook.html`, `cookzer-planner.html`, `cookzer-challenges.html`, `cookzer-health.html`, `cookzer-profile.html`, `cookzer-messenger.html`, `cookzer-recipe.html` | **FIXED** — real "recent activity" dropdown wired centrally in `auth-guard.js` |
| 2 | Recipe gallery photo thumbnails have `cursor:pointer` but no click handler — can't view full-size | `cookzer-recipe.html` (`loadGallery()`) | **FIXED** — added a lightbox overlay |
| 3 | Feed search bar (`.search-bar`) never actually searches anything — `/` focuses it (via `shortcuts.js`) but there's no submit/Enter handling | `cookzer-feed.html` | **FIXED** — Enter now searches recipes + people, dropdown of results |

Checked and confirmed correctly wired (not a finding): header `.avatar`
sign-out (wired in `auth-guard.js`), `toggleTheme()`/`toggleSidebar()`,
all composer buttons, mood chips, restaurant check-in, challenge join/
leaderboard (on the Challenges page), folder/recipe management, meal
planner drag-and-drop, health range tabs, profile edit/banner/tabs/
follow, messenger conversation list/reactions/attachments, recipe
action row, photo-upload+filter modal, recipe-new form. No dead
`href="#"` links exist anywhere.

## Feature completeness spot-check (21 items from the Now-bucket + recent work)

19 of 21 items checked out as genuinely wired with no gap. Two had real
issues:

| # | Finding | Location | Status |
|---|---|---|---|
| 4 | Feed page's "Join challenge" button: the click listener is re-attached every time `loadChallenge()` re-runs (which the handler itself triggers), so repeated joins/reloads stack duplicate listeners. It also never checks whether the user already joined before showing "Join challenge" — unlike the dedicated Challenges page, which does both correctly. A returning user could re-trigger the join upsert and a duplicate confetti burst. | `cookzer-feed.html` | **FIXED** — mirrors the Challenges page's pattern: checks membership on load, uses `.onclick =` (replaces, never stacks) |
| 5 | Profile cover banner picker only writes to `localStorage`, keyed by viewer — not persisted to the backend. Other visitors, or the same user on a different device/browser, never see the banner. Functions like a personal preference, not a shared profile attribute. | `cookzer-profile.html` | **FIXED** — added `profiles.cover_gradient` column (migration 010), banner now reads/writes there |
| 6 | The composer's "Feeling:" mood tag isn't a real structured/filterable field — it's string-concatenated onto the plain `caption` text (`"Comfort food — actual caption"`) and renders identically to a caption a user typed themselves. No distinct storage, no distinct rendering. | `cookzer-feed.html` | **FIXED** — added `posts.mood` column (migration 010), rendered as a distinct badge on feed/activity cards |

All other 19 items (dark mode, recipe scaling, print/share, keyboard
shortcuts, welcome modal, skeleton loading, live countdown, cookbook
folders, read receipts + reactions, bookmarks, copy-last-week, drag-
and-drop planner, nutrition summary, milestones, past challenges
archive, restaurant check-in, Profile Activity tab, video posting
end-to-end) were confirmed genuinely wired with real data round-trips.
Two cosmetic/UX notes, not functional gaps: cookbook folder create/move
uses native `prompt()` dialogs rather than a proper modal (low-fidelity
but functional); messenger read receipts are read-on-open only, no
realtime push (documented limitation, not fake).

## Bonus finding: sitewide layout gap + messenger two-pane break

Found while investigating a user report that the Messenger page looked
"ugly" — not a styling nitpick, a real layout bug affecting every page:

- Every page's `.main` had `margin-left: 280px` stacked on top of
  `.sidebar` already occupying 280px of real space in `body`'s flex row
  (sidebar is `position: static`, not fixed, on desktop). This
  double-counted the offset, leaving a dead 280px gap of empty
  background between the sidebar and all content on every single page.
- `cookzer-messenger.html`'s two-pane wrapper (`class="messenger"`) had
  no CSS rule at all, so it fell back to default block behavior —
  shrink-to-fit width, children stacking vertically instead of side by
  side. Combined with the gap bug, the whole messenger UI rendered as a
  squished, stacked column floating in empty space.

**FIXED** — removed the redundant `margin-left` from `.main` on all 9
affected pages (`margin-top`, needed to clear the absolutely-positioned
header, was untouched; the mobile off-canvas breakpoint's own
`margin-left: 0` override is unaffected), and added the missing flex
rule for `.messenger` so the conversation list and thread render side
by side and fill the available width.

## What this audit could NOT verify

No live network access to Supabase or Bunny from this sandbox — every
finding above was verified by code/logic review and structural
Playwright checks, not by exercising a real logged-in session end to
end. The user has separately verified real login, real data reads, and
a real video upload against production via manual testing and
PowerShell REST calls (see conversation history) — that remains the
source of truth for actual live behavior.
