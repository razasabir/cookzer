const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Feed — Dining Out via Google Places', () => {
  test('finding nearby places calls /api/places-nearby with the device coordinates', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await expect(page.locator('#restaurantPanelBody')).toContainText('You might be at');

    const bodies = await page.evaluate(() => window.__PLACES_FETCH_BODIES__);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ lat: 30.27, lng: -97.74 });
  });

  test('the nearby list shows distance and Google rating, not just a name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    const body = page.locator('#restaurantPanelBody');
    await expect(body).toContainText('Casa Elote');
    await expect(body).toContainText('4.7★');
  });

  test('selecting a nearby place tags the composer with its name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.locator('#restaurantPanelBody div', { hasText: 'Casa Elote' }).click();
    await expect(page.locator('#restaurantTagName')).toHaveText('Casa Elote');
    await expect(page.locator('#restaurantPanel')).toBeHidden();
  });

  test('posting with a Google-sourced place reuses the existing linked restaurant row instead of creating a duplicate', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.locator('#restaurantPanelBody div', { hasText: 'Casa Elote' }).click();
    await page.fill('#postCaption', 'Great lunch');
    await page.click('#composerPostBtn');

    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    const post = await page.evaluate(() => window.__INSERTED_POSTS__[0]);
    expect(post.restaurant_name).toBe('Casa Elote');
    expect(post.restaurant_id).toBe('rest-existing');
    // Casa Elote's google_place_id already exists — no new restaurants row.
    expect(await page.evaluate(() => window.__RESTAURANT_UPSERTS__.length)).toBe(0);
  });

  test('posting with a place Google knows but Cookzer has never seen creates a new linked restaurant row', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.locator('#restaurantPanelBody div', { hasText: 'Marfa Bowl Co.' }).click();
    await page.fill('#postCaption', 'New spot!');
    await page.click('#composerPostBtn');

    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    const post = await page.evaluate(() => window.__INSERTED_POSTS__[0]);
    expect(post.restaurant_id).toBe('rest-new-1');
    const upserts = await page.evaluate(() => window.__RESTAURANT_UPSERTS__);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ name: 'Marfa Bowl Co.', google_place_id: 'gp-marfa-bowl', google_rating: 4.6 });
  });

  test('when location is denied, the manual fallback still posts a restaurant_name with no restaurant_id', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js', "window.__GEO_MODE__ = 'denied';");
    await page.click('#composerRestaurantBtn');
    await expect(page.locator('#restaurantPanelBody')).toContainText('Location permission denied');
    await page.fill('#restaurantPanelBody input[type="text"]', "Grandma's Kitchen");
    await page.click('#restaurantPanelBody button');

    await page.fill('#postCaption', 'Home cooking away from home');
    await page.click('#composerPostBtn');

    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    const post = await page.evaluate(() => window.__INSERTED_POSTS__[0]);
    expect(post.restaurant_name).toBe("Grandma's Kitchen");
    expect(post.restaurant_id).toBeNull();
    expect(await page.evaluate(() => window.__RESTAURANT_UPSERTS__.length)).toBe(0);
  });

  test('when location is unavailable (not denied), the fallback message says so instead of blaming a denied permission', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js', "window.__GEO_MODE__ = 'unavailable';");
    await page.click('#composerRestaurantBtn');
    const body = page.locator('#restaurantPanelBody');
    await expect(body).toContainText("Couldn't get your location");
    await expect(body).not.toContainText('permission denied');
  });

  test('when the location request times out, the fallback message says so instead of blaming a denied permission', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js', "window.__GEO_MODE__ = 'timeout';");
    await page.click('#composerRestaurantBtn');
    const body = page.locator('#restaurantPanelBody');
    await expect(body).toContainText('took too long to respond');
    await expect(body).not.toContainText('permission denied');
  });
});
