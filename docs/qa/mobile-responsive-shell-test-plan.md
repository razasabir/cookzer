# Test plan: Mobile-responsive site shell

Verified with Playwright (Chromium) at a 390x844 viewport against a local
static server, for all 5 pages: `index.html`, `cookzer-cookbook.html`,
`cookzer-planner.html`, `cookzer-challenges.html`, `cookzer-profile.html`.

| Criterion | Result |
|---|---|
| No horizontal scroll at 390px width | PASS — `document.documentElement.scrollWidth` == 390 on all 5 pages |
| Hamburger button visible below 768px | PASS — `.menu-toggle` visible on all 5 pages |
| Clicking hamburger opens the sidebar | PASS — `.sidebar` computed `left` goes from `-280px` to `0px` on all 5 pages |
| Desktop layout unchanged (≥900px) | Not re-verified visually this pass — no CSS outside the new `@media` blocks was touched, so desktop rules are untouched by construction |

## Not covered yet (follow-up)
- Tap-outside-to-close overlay behavior (wired via `onclick`, not
  independently clicked in this pass)
- Real device / real browser testing (only Chromium via Playwright)
- Cross-page navigation while the drawer is open
