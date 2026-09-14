# Cookzer tests

Playwright tests for a static, zero-build site. There's no dev server —
each spec loads the real page straight off disk via a `file://` URL and
stubs `window.supabase` before the page's own scripts run, so nothing
here touches the network or the real Supabase project.

## Running

```
npm install
npm test          # headless, all specs
npm run test:ui    # interactive UI mode
npm run test:headed
```

Chromium ships pre-installed in this project's dev sandbox
(`PLAYWRIGHT_BROWSERS_PATH`/`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` already set
via the environment) — `npx playwright install` is unnecessary there. On a
normal machine without that env var set, run `npx playwright install
chromium` once after `npm install`.

## Layout

- `helpers/loadPage.js` — loads a real HTML page via `file://` with a mock
  injected first.
- `mocks/*.js` — per-scenario `window.supabase` stubs (a hand-built
  chainable query builder covering `select/eq/in/order/range/single/…`).
  Add a new one whenever a new spec needs different fake data.
- `*.spec.js` — the actual tests.

## Adding a test for a new feature

1. Write a mock in `mocks/` that returns the fake rows your scenario
   needs from `sb.from('table')...`. Copy an existing mock as a starting
   point — the query builder shape is the same everywhere.
2. Write a `*.spec.js` that calls `loadPageWithMock(page, 'cookzer-x.html',
   'your-mock.js')` and asserts against real DOM selectors/IDs from that
   page.
3. `npm test` to confirm it passes before committing.
