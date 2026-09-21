const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Feed — Dining Out (search-first, location optional)', () => {
  test('opening Dining Out shows a search box immediately — no location prompt or fetch happens up front', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await expect(page.locator('#composerRestaurantSearchInput')).toBeVisible();
    await expect(page.locator('#composerUseLocationRow')).toContainText('Use my current location');
    expect(await page.evaluate(() => window.__PLACES_FETCH_BODIES__.length)).toBe(0);
  });

  test('typing a name searches Cookzer\'s own restaurants and shows Verified/Featured badges', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.fill('#composerRestaurantSearchInput', 'Casa');

    const results = page.locator('#composerRestaurantSearchResults');
    await expect(results).toContainText('Casa Elote');
    await expect(results).toContainText('1 Main St');
    await expect(results).toContainText('4.7★');
    await expect(results).toContainText('🏅');
    await expect(results).toContainText('⭐');
  });

  test('a matching restaurant with no badges shows none', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.fill('#composerRestaurantSearchInput', 'Plain');
    const row = page.locator('#composerRestaurantSearchResults div', { hasText: 'Plain Diner' });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText('🏅');
    await expect(row).not.toContainText('⭐');
  });

  test('selecting a search result tags the composer and closes the panel', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.fill('#composerRestaurantSearchInput', 'Casa');
    await page.locator('#composerRestaurantSearchResults div', { hasText: 'Casa Elote' }).click();
    await expect(page.locator('#restaurantTagName')).toHaveText('Casa Elote');
    await expect(page.locator('#restaurantPanel')).toBeHidden();
  });

  test('a name with no match offers to tag it as a brand-new restaurant', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.fill('#composerRestaurantSearchInput', "Grandma's Kitchen");
    const addRow = page.locator('#composerRestaurantSearchResults div', { hasText: 'not in Cookzer yet' });
    await expect(addRow).toContainText('Grandma\'s Kitchen');
    await addRow.click();
    await expect(page.locator('#restaurantTagName')).toHaveText("Grandma's Kitchen");
  });

  test('an exact-name match does not also offer the "tag as new" row', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.fill('#composerRestaurantSearchInput', 'Casa Elote');
    await expect(page.locator('#composerRestaurantSearchResults')).not.toContainText('not in Cookzer yet');
  });

  test('posting with a search-selected, already-known restaurant reuses its id — no restaurant row is created or upserted', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.fill('#composerRestaurantSearchInput', 'Casa');
    await page.locator('#composerRestaurantSearchResults div', { hasText: 'Casa Elote' }).click();
    await page.fill('#postCaption', 'Great lunch');
    await page.click('#composerPostBtn');

    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    const post = await page.evaluate(() => window.__INSERTED_POSTS__[0]);
    expect(post.restaurant_name).toBe('Casa Elote');
    expect(post.restaurant_id).toBe('rest-existing');
    expect(await page.evaluate(() => window.__RESTAURANT_UPSERTS__.length)).toBe(0);
  });

  test('posting with a manually-typed name not in Cookzer posts a restaurant_name with no restaurant_id and creates no row', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.fill('#composerRestaurantSearchInput', "Grandma's Kitchen");
    await page.locator('#composerRestaurantSearchResults div', { hasText: 'not in Cookzer yet' }).click();
    await page.fill('#postCaption', 'Home cooking away from home');
    await page.click('#composerPostBtn');

    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    const post = await page.evaluate(() => window.__INSERTED_POSTS__[0]);
    expect(post.restaurant_name).toBe("Grandma's Kitchen");
    expect(post.restaurant_id).toBeNull();
    expect(await page.evaluate(() => window.__RESTAURANT_UPSERTS__.length)).toBe(0);
  });

  test('"Use my current location" calls /api/places-nearby with the device coordinates, without disturbing the search box', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.click('#composerUseLocationRow');
    await expect(page.locator('#composerLocationResults')).toContainText('You might be at');

    const bodies = await page.evaluate(() => window.__PLACES_FETCH_BODIES__);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ lat: 30.27, lng: -97.74, radiusMeters: 1000 });
    await expect(page.locator('#composerRestaurantSearchInput')).toBeVisible();
  });

  test('the nearby list shows distance, Google rating, and Verified/Featured badges for a known place; an unknown one shows neither', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.click('#composerUseLocationRow');
    const results = page.locator('#composerLocationResults');
    await expect(results).toContainText('4.7★');
    await expect(results.locator('div', { hasText: 'Casa Elote' })).toContainText('🏅');
    await expect(results.locator('div', { hasText: 'Casa Elote' })).toContainText('⭐');
    await expect(results.locator('div', { hasText: 'Marfa Bowl Co.' })).not.toContainText('🏅');
    await expect(results.locator('div', { hasText: 'Marfa Bowl Co.' })).not.toContainText('⭐');
  });

  test('selecting a nearby place tags the composer with its name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.click('#composerUseLocationRow');
    await page.locator('#composerLocationResults div', { hasText: 'Casa Elote' }).click();
    await expect(page.locator('#restaurantTagName')).toHaveText('Casa Elote');
    await expect(page.locator('#restaurantPanel')).toBeHidden();
  });

  test('posting with a Google-sourced place Cookzer has never seen creates a new linked restaurant row', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js');
    await page.click('#composerRestaurantBtn');
    await page.click('#composerUseLocationRow');
    await page.locator('#composerLocationResults div', { hasText: 'Marfa Bowl Co.' }).click();
    await page.fill('#postCaption', 'New spot!');
    await page.click('#composerPostBtn');

    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    const post = await page.evaluate(() => window.__INSERTED_POSTS__[0]);
    expect(post.restaurant_id).toBe('rest-new-1');
    const upserts = await page.evaluate(() => window.__RESTAURANT_UPSERTS__);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ name: 'Marfa Bowl Co.', google_place_id: 'gp-marfa-bowl', google_rating: 4.6 });
  });

  test('when location is denied, the search box stays usable and still posts a restaurant_name with no restaurant_id', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js', "window.__GEO_MODE__ = 'denied';");
    await page.click('#composerRestaurantBtn');
    await page.click('#composerUseLocationRow');
    await expect(page.locator('#composerLocationResults')).toContainText('Location permission denied');
    // The search box above was never touched by the failure.
    await expect(page.locator('#composerRestaurantSearchInput')).toBeEnabled();

    await page.fill('#composerRestaurantSearchInput', "Grandma's Kitchen");
    await page.locator('#composerRestaurantSearchResults div', { hasText: 'not in Cookzer yet' }).click();

    await page.fill('#postCaption', 'Home cooking away from home');
    await page.click('#composerPostBtn');

    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    const post = await page.evaluate(() => window.__INSERTED_POSTS__[0]);
    expect(post.restaurant_name).toBe("Grandma's Kitchen");
    expect(post.restaurant_id).toBeNull();
  });

  test('when location is unavailable (not denied), the message says so instead of blaming a denied permission', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js', "window.__GEO_MODE__ = 'unavailable';");
    await page.click('#composerRestaurantBtn');
    await page.click('#composerUseLocationRow');
    const results = page.locator('#composerLocationResults');
    await expect(results).toContainText("Couldn't get your location");
    await expect(results).not.toContainText('permission denied');
  });

  test('when the location request times out, the message says so instead of blaming a denied permission', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js', "window.__GEO_MODE__ = 'timeout';");
    await page.click('#composerRestaurantBtn');
    await page.click('#composerUseLocationRow');
    const results = page.locator('#composerLocationResults');
    await expect(results).toContainText('took too long to respond');
    await expect(results).not.toContainText('permission denied');
  });

  test('when the places lookup fails server-side, the real reason (e.g. a missing API key) is shown, not a generic "couldn\'t reach" message', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-dining-out.js', "window.__PLACES_FETCH_MODE__ = 'server-error';");
    await page.click('#composerRestaurantBtn');
    await page.click('#composerUseLocationRow');
    const results = page.locator('#composerLocationResults');
    await expect(results).toContainText('Google Maps lookup is not configured yet.');
    await expect(results).not.toContainText("Couldn't reach the places lookup");
  });
});
