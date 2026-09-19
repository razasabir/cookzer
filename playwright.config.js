// @ts-check
const fs = require('fs');
const { defineConfig, devices } = require('@playwright/test');

// This dev sandbox pre-installs a specific Chromium build outside of
// Playwright's normal version-pinned download path (see the sandbox's
// own PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD note). When that exact build is
// present, point at it directly so `npm test` works without a download;
// on any other machine (a real dev laptop, CI) this path won't exist and
// Playwright falls back to its own normally-installed browser.
const sandboxChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = fs.existsSync(sandboxChromium) ? sandboxChromium : undefined;

// Cookzer has no build step and no dev server — tests load the real
// static HTML pages directly via file:// URLs and mock window.supabase
// before navigation (see tests/helpers/mockSupabase.js). This mirrors
// the throwaway verification approach used to build every feature in
// this repo, just checked in and repeatable instead of scratch scripts.
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // CI runs took 15-30 minutes and mass-timed-out on dozens of unrelated
  // tests, for weeks, unaffected by a worker cap or --disable-dev-shm-usage
  // (both tried and ruled out first). The real cause turned out to be
  // nothing to do with worker count: every test page's <head> loads real
  // external scripts (the Supabase JS CDN build, Google Fonts) that the
  // window.supabase mock never actually blocked at the network level —
  // see tests/helpers/loadPage.js's blockExternalRequests(). Once that
  // was fixed, a full run dropped to under a minute even serialized.
  // Left at 1 rather than restored to parallel, since this is already
  // fast and a from-scratch browser launch per worker was real CI-only
  // overhead of its own; revisit if the suite grows enough for this to
  // matter again.
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    // Full trace-on-failure retention adds per-test overhead that's fine
    // for one-off local debugging but compounds under the CI worker cap
    // above; first-failure-only keeps the essential debugging artifact
    // without paying that cost on every retry.
    trace: process.env.CI ? 'retain-on-first-failure' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // The worker cap above didn't change the failure count at all
        // (identical "62 passed" both with and without it) — that rules
        // out worker-count contention as the cause. --disable-dev-shm-usage
        // is the standard fix for the next most common CI-only Chromium
        // failure mode: the runner's /dev/shm is too small for Chrome's
        // default shared-memory usage, so it degrades (and eventually
        // hangs new pages/contexts until they time out) well before any
        // OS-visible crash or error message shows up in the job log.
        launchOptions: { executablePath, args: ['--disable-dev-shm-usage'] },
      },
    },
  ],
});
