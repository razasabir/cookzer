# PRD: Mobile-responsive site shell

## Problem
All 5 pages (`index.html`, cookbook, planner, challenges, profile) share
one desktop-only layout: a fixed 280px sidebar, a header offset by
`left: 280px`, and (on the feed) a fixed 320px right sidebar — with zero
`@media` queries anywhere in the codebase. On a phone-width screen the
sidebar alone would eat most of the viewport; the site was effectively
unusable below ~900px.

## Team input (gathered before scoping)
- **Creative**: mobile is where people actually browse/share food photos
  — this isn't optional polish, it's table stakes.
- **Designer**: the visual identity (cream/olive/mustard/brick palette,
  Fraunces + Work Sans) is already strong and shouldn't change. The gap
  is purely structural — the shell doesn't adapt, not that it looks bad.
- **Web Developer**: the sidebar/header/margin shell is byte-for-byte
  identical across all 5 files, so one shared fix pattern (CSS + a small
  JS toggle) applies cleanly everywhere without touching page-specific
  content (feed cards, cookbook grid, planner, challenges, profile stats
  already use `auto-fit`/`auto-fill` grids that reflow fine on their own).
- **BA**: acceptance criteria should be concrete and checkable, not
  "looks fine" — see below.
- **Tester**: plan is to verify at a real narrow viewport (390px) rather
  than eyeballing desktop devtools.

## Decision (PM)
Ship the responsive shell fix first, before any new feature or visual
redesign. Nothing else "looks great" if the site can't be used on a
phone, the fix is low-risk (additive CSS/JS, no visual changes to the
existing design), and it removes a problem every future feature would
otherwise have to work around individually.

## Scope
**In**: sidebar becomes an off-canvas drawer (hamburger toggle + overlay)
below 768px; header collapses to full width; right sidebar (feed page)
hides below 900px; small icon/spacing adjustments below 480px.
**Out**: any change to colors, type, or the desktop layout; a shared CSS
file (each page still has its own embedded `<style>` — flagged as a
follow-up idea, not done here to keep this change small and low-risk).

## Acceptance criteria
- At 390px viewport width, no page has horizontal scroll.
- A hamburger button appears below 768px and toggles the sidebar drawer
  open/closed, with a tap-outside overlay to close it.
- All 5 pages behave identically (same breakpoints, same toggle).
- Desktop layout (≥900px) is visually unchanged.

## Status
Shipped. Verified with Playwright at a 390px viewport on all 5 pages —
no overflow, hamburger toggle opens/closes the sidebar correctly. See
`docs/qa/mobile-responsive-shell-test-plan.md`.
