const path = require('path');
const fs = require('fs');

// Cookzer has no dev server — pages are loaded straight off disk via
// file:// URLs, same as every throwaway verification done while building
// this site. `mockFile` is a path (relative to tests/mocks/) to a script
// that stubs window.supabase before the page's own scripts run, so tests
// never touch the real Supabase project or the network.
// `extraInit`, when given, is a raw JS source string run right after the
// mock and before any of the page's own scripts — e.g. to seed localStorage
// state (like Kid Mode) that must already exist when auth-guard.js runs.
async function loadPageWithMock(page, htmlFile, mockFile, extraInit) {
  const mockPath = path.join(__dirname, '..', 'mocks', mockFile);
  const mockSrc = fs.readFileSync(mockPath, 'utf8');
  await page.addInitScript({ content: mockSrc });
  if (extraInit) await page.addInitScript({ content: extraInit });
  const filePath = path.join(__dirname, '..', '..', htmlFile);
  await page.goto('file://' + filePath);
}

module.exports = { loadPageWithMock };
