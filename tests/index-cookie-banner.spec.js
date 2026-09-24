const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Landing page — cookie consent banner', () => {
  test('shows on first visit and links to the Privacy Policy', async ({ page }) => {
    await loadPageWithMock(page, 'index.html', 'index-logged-out.js');
    await expect(page.locator('#cookieBanner')).toBeVisible();
    await expect(page.locator('#cookieBanner a')).toHaveAttribute('href', 'cookzer-privacy.html');
  });

  test('clicking "Got it" hides it and persists the choice for future visits', async ({ page }) => {
    await loadPageWithMock(page, 'index.html', 'index-logged-out.js');
    await expect(page.locator('#cookieBanner')).toBeVisible();
    await page.click('#cookieAcceptBtn');
    await expect(page.locator('#cookieBanner')).toBeHidden();

    const stored = await page.evaluate(() => localStorage.getItem('cookzer-cookie-consent'));
    expect(stored).toBe('1');
  });

  test('does not show again on a later visit once consent is stored', async ({ page }) => {
    await loadPageWithMock(page, 'index.html', 'index-logged-out.js', `
      try { localStorage.setItem('cookzer-cookie-consent', '1'); } catch (e) {}
    `);
    await expect(page.locator('#cookieBanner')).toBeHidden();
  });
});
