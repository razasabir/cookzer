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
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
});
