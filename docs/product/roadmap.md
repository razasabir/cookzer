# Cookzer roadmap

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
