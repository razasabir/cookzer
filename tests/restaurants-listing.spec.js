const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Restaurants listing — Cookzer Verified + Featured (Phase 4)', () => {
  test('a featured listing sorts to the top even though it is not the newest', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');
    const names = await page.locator('.restaurant-name').allTextContents();
    expect(names[0]).toBe('Boosted Bistro');
  });

  test('an actively featured listing shows the Featured pill; an expired one does not', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');

    const cards = page.locator('.restaurant-card');
    const boosted = cards.filter({ has: page.locator('.restaurant-name', { hasText: 'Boosted Bistro' }) });
    await expect(boosted.locator('.featured-pill')).toContainText('Featured');

    const onceFeatured = cards.filter({ has: page.locator('.restaurant-name', { hasText: 'Once Featured' }) });
    await expect(onceFeatured.locator('.featured-pill')).toHaveCount(0);
  });

  test('a Cookzer Verified listing shows the verified pill', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');
    const cards = page.locator('.restaurant-card');
    const verified = cards.filter({ has: page.locator('.restaurant-name', { hasText: 'Trusted Kitchen' }) });
    await expect(verified.locator('.cookzer-verified-pill')).toContainText('Cookzer Verified');
  });

  test('an unfeatured, unverified listing shows neither pill, only receipt-verified when it has ratings', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');
    const cards = page.locator('.restaurant-card');
    const old = cards.filter({ has: page.locator('.restaurant-name', { hasText: 'Old Standby' }) });
    await expect(old.locator('.featured-pill')).toHaveCount(0);
    await expect(old.locator('.cookzer-verified-pill')).toHaveCount(0);
    await expect(old.locator('.verified-pill')).toContainText('Receipt-verified');
  });
});
