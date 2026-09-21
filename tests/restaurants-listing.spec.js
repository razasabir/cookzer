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

test.describe('Restaurants listing — Trending and Cookzer vs Google tabs (Phase 5)', () => {
  test('Trending ranks by recent (30-day) ratings + tags, excludes restaurants with no recent activity, ignores old ratings', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');
    await page.click('.sort-tab[data-sort="trending"]');

    const names = await page.locator('.restaurant-name').allTextContents();
    expect(names[0]).toBe('Trusted Kitchen');
    expect(names).not.toContain('Old Standby');
  });

  test('the Trending tab shows a recent-activity count next to each listing', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');
    await page.click('.sort-tab[data-sort="trending"]');
    const top = page.locator('.restaurant-card').first();
    await expect(top).toContainText('recent activit');
  });

  test('Cookzer vs Google sorts by the size of the disagreement, biggest divergence first, and only lists restaurants with both ratings', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');
    await page.click('.sort-tab[data-sort="compare"]');

    const names = await page.locator('.restaurant-name').allTextContents();
    expect(names[0]).toBe('Boosted Bistro'); // Cookzer 3.0 vs Google 4.9 — biggest gap
    expect(names).not.toContain('Once Featured'); // no Cookzer ratings at all, excluded

    const top = page.locator('.restaurant-card').first();
    await expect(top.locator('.compare-row')).toContainText('Cookzer 3.0★');
    await expect(top.locator('.compare-row')).toContainText('vs Google 4.9★');
    await expect(top.locator('.compare-pill.lower')).toContainText('-1.9');
  });

  test('switching tabs and back to Recent restores the featured-first order', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');
    await page.click('.sort-tab[data-sort="compare"]');
    await page.click('.sort-tab[data-sort="recent"]');
    const names = await page.locator('.restaurant-name').allTextContents();
    expect(names[0]).toBe('Boosted Bistro');
  });
});

test.describe('Restaurants listing — reporting a review (Phase 6)', () => {
  test('reporting a review via a preset chip inserts into reports with target_type restaurant_rating', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');

    const card = page.locator('.restaurant-card').filter({ has: page.locator('.restaurant-name', { hasText: 'Boosted Bistro' }) });
    await card.locator('.restaurant-summary').click();
    await card.locator('.rating-row-report-btn').first().click();

    await expect(page.locator('#pickerOverlay')).toBeVisible();
    await page.locator('#pickerModal .cz2-chip', { hasText: 'Fake or edited receipt' }).click();

    await expect.poll(() => page.evaluate(() => window.__REPORT_INSERTS__.length)).toBe(1);
    const insert = await page.evaluate(() => window.__REPORT_INSERTS__[0]);
    expect(insert).toMatchObject({ reporter_id: 'me-1', target_type: 'restaurant_rating', target_id: 'rating-boosted-1', reason: 'Fake or edited receipt' });
    await expect(page.locator('#pickerOverlay')).toBeHidden();
  });

  test('your own review never shows the Report affordance', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurants.html', 'restaurants-listing.js');

    const card = page.locator('.restaurant-card').filter({ has: page.locator('.restaurant-name', { hasText: 'Trusted Kitchen' }) });
    await card.locator('.restaurant-summary').click();
    await expect(card).toContainText('My own take');
    const ownRow = card.locator('.rating-row').filter({ hasText: 'My own take' });
    await expect(ownRow.locator('.rating-row-report-btn')).toHaveCount(0);
  });
});
