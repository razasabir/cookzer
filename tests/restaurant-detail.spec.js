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
    // Recency-weighted average of the two seeded ratings (5★ from Sep 15,
    // 4★ from Sep 10) — the 5-day-newer rating counts slightly more.
    await expect(stats.nth(1)).toContainText('4.5★');
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
    await expect(reviewsPanel.locator('.verified-badge').first()).toContainText('Receipt verified');
  });

  test('the Rate this restaurant button opens an inline panel with only the dish-name field, no restaurant search step', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await expect(page.locator('#ratePanel')).toBeHidden();
    await page.click('#rateBtn');
    await expect(page.locator('#ratePanel')).toBeVisible();
    await expect(page.locator('#ratePanel input[type="text"]')).toHaveCount(1);
    await expect(page.locator('#dishInput')).toBeVisible();
  });

  test('submitting a star rating with a receipt uploads the photo and upserts the rating, including the optional dish name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await page.click('#rateBtn');
    await page.locator('#starPicker .star[data-value="4"]').click();
    await page.fill('#dishInput', 'Lamb ragu');
    await page.fill('#reviewInput', 'Great bowls, would return.');
    await page.locator('#receiptInput').setInputFiles(path.join(__dirname, '..', 'icon-192.png'));
    await page.click('#submitRatingBtn');

    await expect.poll(() => page.evaluate(() => window.__RATING_UPSERTS__.length)).toBe(1);
    const upsert = await page.evaluate(() => window.__RATING_UPSERTS__[0]);
    expect(upsert).toMatchObject({ restaurant_id: 'rest-1', user_id: 'me-1', rating: 4, review: 'Great bowls, would return.', dish_name: 'Lamb ragu' });
    expect(await page.evaluate(() => window.__RECEIPT_UPLOADS__.length)).toBe(1);
  });

  test('cancelling the rate panel clears the dish-name field along with the rest', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await page.click('#rateBtn');
    await page.fill('#dishInput', 'Lamb ragu');
    await page.click('#cancelRateBtn');
    await page.click('#rateBtn');
    await expect(page.locator('#dishInput')).toHaveValue('');
  });

  test('shows friends who\'ve rated here ahead of the stat tiles, and a best-dish rollup from dish names', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    const friends = page.locator('.friends-here-section');
    await expect(friends).toContainText("Friends who've been here");
    await expect(friends).toContainText('Rae H.');

    const dishes = page.locator('.dish-rollup-section');
    await expect(dishes).toContainText('Best dish here');
    await expect(dishes).toContainText('Sunset Grain Bowl');
  });

  test('a reviewer with a high Foodie Score shows a credibility badge on their review', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await page.click('.tab-row .tab:has-text("Verified reviews")');
    const reviewsPanel = page.locator('#tab-reviews');
    await expect(reviewsPanel.locator('.credibility-badge').first()).toContainText('Trusted Foodie');
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

test.describe('Restaurant detail page — claimed business profiles', () => {
  test('an unclaimed restaurant shows a "Claim this restaurant" link and no verified badge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');
    await expect(page.locator('#claimBtn')).toBeVisible();
    await expect(page.locator('.business-verified-badge')).toHaveCount(0);
  });

  test('submitting a claim requires an email and a proof photo, then uploads the proof and inserts the claim request', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');

    await page.click('#claimBtn');
    await expect(page.locator('#claimPanel')).toBeVisible();

    await page.click('#submitClaimBtn');
    await expect(page.locator('.cz-modal-overlay')).toBeVisible();
    await page.click('.cz-modal-btn');

    await page.fill('#claimEmailInput', 'owner@marfabowl.com');
    await page.click('#submitClaimBtn');
    await expect(page.locator('.cz-modal-overlay')).toBeVisible();
    await page.click('.cz-modal-btn');

    await page.fill('#claimPhoneInput', '512-555-0199');
    await page.locator('#claimProofInput').setInputFiles(path.join(__dirname, '..', 'icon-192.png'));
    await page.click('#submitClaimBtn');
    await expect(page.locator('.cz-modal-overlay')).toBeVisible();
    await page.click('.cz-modal-btn');

    expect(await page.evaluate(() => window.__CLAIM_PROOF_UPLOADS__.length)).toBe(1);
    const insert = await page.evaluate(() => window.__CLAIM_INSERTS__[0]);
    expect(insert).toMatchObject({ restaurant_id: 'rest-1', user_id: 'me-1', business_email: 'owner@marfabowl.com', business_phone: '512-555-0199' });
  });

  test('an approved, owned listing shows a verified badge, business contact links, and lets the owner edit them', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-2', 'restaurant-detail.js');

    await expect(page.locator('.business-verified-badge')).toContainText('Verified business');
    await expect(page.locator('.business-info-row')).toContainText('512-555-0100');
    await expect(page.locator('.business-info-row a', { hasText: 'Website' })).toHaveAttribute('href', 'https://ownedeats.example');
    await expect(page.locator('.business-info-row a', { hasText: 'Menu' })).toHaveAttribute('href', 'https://ownedeats.example/menu');

    await page.click('#editBusinessBtn');
    await expect(page.locator('#bizPhoneInput')).toHaveValue('512-555-0100');
    await page.fill('#bizPhoneInput', '512-555-0111');
    await page.click('#saveBusinessBtn');

    await expect.poll(() => page.evaluate(() => window.__CLAIMED_DETAILS_RPCS__.length)).toBe(1);
    const rpcArgs = await page.evaluate(() => window.__CLAIMED_DETAILS_RPCS__[0]);
    expect(rpcArgs).toMatchObject({ p_restaurant_id: 'rest-2', p_phone: '512-555-0111' });
    await expect(page.locator('.business-info-row')).toContainText('512-555-0111');
  });

  test('a listing with someone else\'s claim pending shows a generic under-review note, not the claim button', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-3', 'restaurant-detail.js');
    await expect(page.locator('.claim-status-note')).toContainText('An ownership claim is under review');
    await expect(page.locator('#claimBtn')).toHaveCount(0);
  });

  test('a listing with your own claim pending tells you it\'s under review', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-4', 'restaurant-detail.js');
    await expect(page.locator('.claim-status-note')).toContainText('Your claim is under review');
  });
});

test.describe('Restaurant detail page — Cookzer Verified + Featured (Phase 4)', () => {
  test('a non-admin viewer sees the Verified and Featured badges but no admin tools', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-5', 'restaurant-detail.js');
    await expect(page.locator('.cookzer-verified-badge')).toContainText('Cookzer Verified');
    await expect(page.locator('.featured-badge')).toContainText('Featured');
    await expect(page.locator('.admin-tools-panel')).toHaveCount(0);
  });

  test('an unverified, unfeatured listing shows neither badge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js');
    await expect(page.locator('.cookzer-verified-badge')).toHaveCount(0);
    await expect(page.locator('.featured-badge')).toHaveCount(0);
  });

  test('a platform admin sees the admin tools panel and can toggle Cookzer Verified', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js', 'window.__IS_ADMIN__ = true;');

    await expect(page.locator('.admin-tools-panel')).toBeVisible();
    await expect(page.locator('#adminVerifiedCheck')).not.toBeChecked();

    await page.locator('#adminVerifiedCheck').check();
    await expect.poll(() => page.evaluate(() => window.__VERIFIED_RPCS__.length)).toBe(1);
    const args = await page.evaluate(() => window.__VERIFIED_RPCS__[0]);
    expect(args).toMatchObject({ p_restaurant_id: 'rest-1', p_verified: true });
    await expect(page.locator('.cookzer-verified-badge')).toContainText('Cookzer Verified');
  });

  test('a platform admin can feature a listing, then remove its featured placement', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant.html?id=rest-1', 'restaurant-detail.js', 'window.__IS_ADMIN__ = true;');

    await page.click('#adminFeatureBtn');
    await expect.poll(() => page.evaluate(() => window.__FEATURED_RPCS__.length)).toBe(1);
    expect(await page.evaluate(() => window.__FEATURED_RPCS__[0])).toMatchObject({ p_restaurant_id: 'rest-1', p_days: 30 });
    await expect(page.locator('.featured-badge')).toContainText('Featured');

    await page.click('#adminUnfeatureBtn');
    await expect.poll(() => page.evaluate(() => window.__FEATURED_RPCS__.length)).toBe(2);
    expect(await page.evaluate(() => window.__FEATURED_RPCS__[1])).toMatchObject({ p_restaurant_id: 'rest-1', p_days: null });
    await expect(page.locator('.featured-badge')).toHaveCount(0);
  });
});
