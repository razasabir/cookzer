const path = require('path');
const fs = require('fs');

// Every page's <head> also loads real external scripts (the Supabase JS
// CDN build, tus-js-client on the feed page) and Google Fonts links —
// mocking window.supabase doesn't stop those real network requests from
// firing on every single test's navigation. Blocking everything but
// file:// makes tests actually network-free: real (uncached, CI-runner)
// CDN latency was the confirmed cause of this suite's CI-only (never
// local) mass-timeout flakiness, and it's dead weight for every test
// regardless, since none of them test fonts or exercise the real
// supabase-js build. Any test that navigates without going through
// loadPageWithMock below (a handful need a second/third addInitScript
// it doesn't support, or skip the mock file entirely) must call this
// itself before its own page.goto() — two tests that didn't were the
// only two failures once the rest of the suite stopped being masked by
// the same CDN latency finally being blocked everywhere else.
async function blockExternalRequests(page) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://')) return route.continue();
    return route.abort();
  });
}

// Cookzer has no dev server — pages are loaded straight off disk via
// file:// URLs, same as every throwaway verification done while building
// this site. `mockFile` is a path (relative to tests/mocks/) to a script
// that stubs window.supabase before the page's own scripts run, so tests
// never touch the real Supabase project or the network.
// `extraInit`, when given, is a raw JS source string run right after the
// mock and before any of the page's own scripts — e.g. to seed localStorage
// state (like Kid Mode) that must already exist when auth-guard.js runs.
async function loadPageWithMock(page, htmlFile, mockFile, extraInit) {
  await blockExternalRequests(page);

  const mockPath = path.join(__dirname, '..', 'mocks', mockFile);
  const mockSrc = fs.readFileSync(mockPath, 'utf8');
  await page.addInitScript({ content: mockSrc });
  if (extraInit) await page.addInitScript({ content: extraInit });
  const filePath = path.join(__dirname, '..', '..', htmlFile);
  await page.goto('file://' + filePath);
}

module.exports = { loadPageWithMock, blockExternalRequests };
