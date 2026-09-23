const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage.js');

test.describe('Suspension enforcement (auth-guard.js)', () => {
  test('a suspended user is redirected off an ordinary page to the lockout page', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'suspension-enforcement.js', `
      window.__SUSPENSION__ = { id: 'susp-1', type: 'suspend', reason: 'Repeated spam', ends_at: '2026-10-01T00:00:00Z', created_at: '2026-09-20T00:00:00Z' };
    `);
    await page.waitForURL(/cookzer-suspended\.html/);
    await expect(page.locator('#title')).toHaveText('Your account is suspended');
    await expect(page.locator('#reasonText')).toHaveText('Repeated spam');
  });

  test('a banned user sees the ban-specific title with no end date', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'suspension-enforcement.js', `
      window.__SUSPENSION__ = { id: 'susp-2', type: 'ban', reason: 'Severe harassment', ends_at: null, created_at: '2026-09-20T00:00:00Z' };
    `);
    await page.waitForURL(/cookzer-suspended\.html/);
    await expect(page.locator('#title')).toHaveText('Your account has been banned');
    await expect(page.locator('#detail')).toHaveText('This does not have an end date.');
  });

  test('an unsuspended user is not redirected and the page loads normally', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'suspension-enforcement.js', `
      window.__SUSPENSION__ = null;
    `);
    await page.waitForTimeout(300);
    expect(page.url()).not.toContain('cookzer-suspended.html');
  });

  test('a page whose mock has no rpc() at all still loads (fails open, never throws)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadPageWithMock(page, 'cookzer-feed.html', 'avatar-menu.js');
    await page.waitForTimeout(300);
    expect(page.url()).not.toContain('cookzer-suspended.html');
    // The suspension check itself must never throw "rpc is not a
    // function" — any other, unrelated error this particular mock
    // produces (it predates this feature) isn't what this test covers.
    expect(errors.some((e) => e.includes('.rpc is not a function'))).toBe(false);
  });

  test('visiting cookzer-suspended.html directly with no active suspension bounces to the feed', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-suspended.html', 'suspension-enforcement.js', `
      window.__SUSPENSION__ = null;
    `);
    await page.waitForURL(/cookzer-feed\.html/);
  });
});
