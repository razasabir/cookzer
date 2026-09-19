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
  // GitHub-hosted runners default to a low CPU count; letting Playwright
  // pick a worker count off that (or running fully unbounded elsewhere)
  // was causing runs to start fine, then increasingly time out under
  // resource pressure as more workers/contexts piled up, cascading into
  // dozens of unrelated failures over a 15-26 minute run — a suite that
  // finishes in well under a minute locally. Capping workers keeps
  // concurrency within what the runner can actually sustain.
  workers: process.env.CI ? 2 : undefined,
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
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
});
