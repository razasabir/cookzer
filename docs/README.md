# Cookzer team workflow

Cookzer is a social platform for home cooks to share recipes, meals, and
compete in challenges. The repo currently holds static HTML mockups
(homepage, cookbook, planner, challenges, profile) with no backend.

To build this out, work flows through these roles (each is a Claude Code
skill under `.claude/skills/`, invoked with `/pm`, `/ba`, `/marketer`,
`/designer`, `/creative`, `/webdev`, `/coder`, `/tester`):

1. **creative** — throws out bold ideas, features, angles, names. Ad hoc,
   any time. Ideas land in `docs/product/ideas.md`.
2. **pm** — prioritizes ideas into a roadmap, writes PRDs, makes scope
   calls. Output: `docs/product/roadmap.md`, `docs/product/prd-*.md`.
3. **ba** — turns a PRD into detailed user stories, acceptance criteria,
   edge cases, data needs. Output: `docs/requirements/*.md`.
4. **designer** — turns requirements into visual/UX design (layout,
   flows, style). Output: `docs/design/*.md` and/or mockup artifacts.
5. **webdev** / **coder** — implement. `webdev` owns the actual site
   (HTML/CSS/JS pages, responsiveness, deployment). `coder` owns feature
   logic, data, and backend work as the product grows past static pages.
6. **tester** — verifies the implementation against the BA's acceptance
   criteria, files bugs. Output: `docs/qa/*.md`.
7. **marketer** — writes launch copy, positioning, growth ideas once a
   feature is ready. Output: `docs/marketing/*.md`.

Each skill reads what upstream roles already wrote before starting, so
context carries forward instead of getting re-decided at every step.
