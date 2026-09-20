const path = require('path');
const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Restaurant detail page', () => {
  test('shows the restaurant name, address, Google Maps link, and stat tiles from real data', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await expect(page.locator('.restaurant-title')).toHaveText('Marfa Bowl Co.');
    await expect(page.locator('.address-line')).toContainText('1108 S Congress Ave');
    await expect(page.locator('.maps-link')).toHaveAttribute('href', /place_id:gp-marfa-bowl/);

    const stats = page.locator('.stat-tile');
    await expect(stats.nth(0)).toContainText('4.6★');
    await expect(stats.nth(1)).toContainText('5.0★');
    await expect(stats.nth(2)).toContainText('3');
  });

  test('renders the community photo grid from tagged posts, linking each card back to the feed post', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await expect(page.locator('.tab-row .tab').first()).toContainText('From the community (3)');
    const cards = page.locator('.community-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toHaveAttribute('href', 'cookzer-feed.html?post=post-1');
    await expect(cards.nth(0)).toContainText('Jordan C.');
    await expect(cards.nth(0)).toContainText('Sunday reset bowl');
    // The post with no photo still appears, with a placeholder instead of a broken image.
    await expect(cards.nth(2).locator('.community-photo')).toContainText('🍽️');

    await expect(page.locator('.taggers-row')).toContainText('JC');
    await expect(page.locator('.taggers-row')).toContainText('RH');
  });

  test('switching to Verified reviews shows receipt-verified ratings with stars and review text', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await page.click('.tab-row .tab:has-text("Verified reviews")');
    const reviewsPanel = page.locator('#tab-reviews');
    await expect(reviewsPanel).toContainText('Rae H.');
    await expect(reviewsPanel).toContainText('★★★★★');
    await expect(reviewsPanel).toContainText('Best grain bowl in South Austin.');
    await expect(reviewsPanel.locator('.verified-badge')).toContainText('Receipt verified');
  });

  test('the Rate this restaurant button opens an inline panel with no restaurant search step', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await expect(page.locator('#ratePanel')).toBeHidden();
    await page.click('#rateBtn');
    await expect(page.locator('#ratePanel')).toBeVisible();
    await expect(page.locator('#ratePanel input[type="text"]')).toHaveCount(0);
  });

  test('submitting a star rating with a receipt uploads the photo and upserts the rating for this restaurant', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await page.click('#rateBtn');
    await page.locator('#starPicker .star[data-value="4"]').click();
    await page.fill('#reviewInput', 'Great bowls, would return.');
    await page.locator('#receiptInput').setInputFiles(path.join(__dirname, '..', 'icon-192.png'));
    await page.click('#submitRatingBtn');

    await expect.poll(() => page.evaluate(() => window.__RATING_UPSERTS__.length)).toBe(1);
    const upsert = await page.evaluate(() => window.__RATING_UPSERTS__[0]);
    expect(upsert).toMatchObject({ restaurant_id: 'rest-1', user_id: 'me-1', rating: 4, review: 'Great bowls, would return.' });
    expect(await page.evaluate(() => window.__RECEIPT_UPLOADS__.length)).toBe(1);
  });

  test('submitting without a receipt is rejected and does not upsert', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await page.click('#rateBtn');
    await page.locator('#starPicker .star[data-value="5"]').click();
    await page.click('#submitRatingBtn');

    await expect(page.locator('.cz-modal-overlay')).toBeVisible();
    expect(await page.evaluate(() => window.__RATING_UPSERTS__.length)).toBe(0);
  });

  test('an unknown restaurant id shows a not-found message instead of a blank page', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=does-not-exist', 'restaurant-detail.js');
    await expect(page.locator('.not-found-note')).toContainText("couldn't be found");
  });
});
