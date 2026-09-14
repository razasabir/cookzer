const path = require('path');
const fs = require('fs');

// Cookzer has no dev server — pages are loaded straight off disk via
// file:// URLs, same as every throwaway verification done while building
// this site. `mockFile` is a path (relative to tests/mocks/) to a script
// that stubs window.supabase before the page's own scripts run, so tests
// never touch the real Supabase project or the network.
async function loadPageWithMock(page, htmlFile, mockFile) {
  const mockPath = path.join(__dirname, '..', 'mocks', mockFile);
  const mockSrc = fs.readFileSync(mockPath, 'utf8');
  await page.addInitScript({ content: mockSrc });
  const filePath = path.join(__dirname, '..', '..', htmlFile);
  await page.goto('file://' + filePath);
}

module.exports = { loadPageWithMock };
