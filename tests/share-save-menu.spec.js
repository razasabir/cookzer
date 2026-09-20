const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Feed — Share popup (Reshare / Share on a group / Share externally)', () => {
  test('clicking Share opens a real picker, not the external-share dialog directly', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-plain .action-btn[title="Share"]').click();
    await expect(page.locator('.cz2-modal h3')).toHaveText('Share');
    await expect(page.locator('.cz2-row')).toHaveCount(3);
    await expect(page.locator('.cz2-row').nth(0)).toContainText('Reshare to your feed');
    await expect(page.locator('.cz2-row').nth(1)).toContainText('Share on a group');
    await expect(page.locator('.cz2-row').nth(2)).toContainText('Share externally');
  });

  test('Reshare to your feed inserts a kind=share post referencing the original, then confirms', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-plain .action-btn[title="Share"]').click();
    await page.locator('.cz2-row', { hasText: 'Reshare to your feed' }).click();

    await expect(page.locator('.cz-modal-message')).toContainText('Reshared to your feed');
    await page.locator('.cz-modal-btn.cz-primary').click();

    const inserted = await page.evaluate(() => window.__INSERTED_POSTS__);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ kind: 'share', author_id: 'me-1', shared_post_id: 'post-plain', group_id: null });
  });

  test('Share on a group lists the groups you belong to, and picking one shares it there', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-plain .action-btn[title="Share"]').click();
    await page.locator('.cz2-row', { hasText: 'Share on a group' }).click();

    await expect(page.locator('.cz2-modal h3')).toHaveText('Share to which group?');
    await expect(page.locator('.cz2-row', { hasText: 'Weeknight Cooks' })).toBeVisible();
    await page.locator('.cz2-row', { hasText: 'Weeknight Cooks' }).click();

    await expect(page.locator('.cz-modal-message')).toContainText('Shared to the group');
    await page.locator('.cz-modal-btn.cz-primary').click();

    const inserted = await page.evaluate(() => window.__INSERTED_POSTS__);
    expect(inserted[0]).toMatchObject({ kind: 'share', shared_post_id: 'post-plain', group_id: 'g1' });
  });

  test('the group picker has a Back option that returns to the top-level Share menu', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-plain .action-btn[title="Share"]').click();
    await page.locator('.cz2-row', { hasText: 'Share on a group' }).click();
    await expect(page.locator('.cz2-modal h3')).toHaveText('Share to which group?');

    await page.locator('.csm-btn', { hasText: 'Back' }).click();
    await expect(page.locator('.cz2-modal h3')).toHaveText('Share');
    await expect(page.locator('.cz2-row')).toHaveCount(3);
  });

  test('Share externally reaches the existing in-app share-link popup', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-plain .action-btn[title="Share"]').click();
    await page.locator('.cz2-row', { hasText: 'Share externally' }).click();
    await expect(page.locator('.cz-share-link-row input')).toHaveValue(/post=post-plain/);
  });
});

test.describe('Feed — Save popup (Save as a Recipe / Save to Meal Planner / Save to Device)', () => {
  test('clicking Save opens a real picker; Save to Device is hidden when the post has no photo', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    // post-recipe has neither its own photo nor a recipe hero photo in this fixture.
    await page.locator('#post-post-recipe .action-btn[title="Save"]').click();
    await expect(page.locator('.cz2-modal h3')).toHaveText('Save');
    await expect(page.locator('.cz2-row')).toHaveCount(2);
    await expect(page.locator('.cz2-row').nth(0)).toContainText('Save as a Recipe');
    await expect(page.locator('.cz2-row').nth(1)).toContainText('Save to Meal Planner');
  });

  test('Save to Device appears once the post has a photo to download', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-recipe-photo .action-btn[title="Save"]').click();
    await expect(page.locator('.cz2-row')).toHaveCount(3);
    await expect(page.locator('.cz2-row').nth(2)).toContainText('Save to Device');
  });

  test('Save as a Recipe still bookmarks the post exactly like before', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-recipe .action-btn[title="Save"]').click();
    await page.locator('.cz2-row', { hasText: 'Save as a Recipe' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_BOOKMARKS__.length)).toBe(1);
    const bookmarked = await page.evaluate(() => window.__INSERTED_BOOKMARKS__[0]);
    expect(bookmarked).toMatchObject({ post_id: 'post-recipe', user_id: 'me-1' });
    expect(await page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(0); // no reshare happened
  });

  test('Save to Meal Planner shows a conflict-aware week list and adds the recipe to a free day', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-recipe .action-btn[title="Save"]').click();
    await page.locator('.cz2-row', { hasText: 'Save to Meal Planner' }).click();

    await expect(page.locator('.cz2-modal h3')).toHaveText('Add to Meal Planner');
    await expect(page.locator('.cz2-row')).toHaveCount(7);

    await page.locator('.cz2-row').first().click();
    await expect(page.locator('.cz-modal-message')).toContainText('Added to your Meal Planner for');
    await page.locator('.cz-modal-btn.cz-primary').click();

    const inserted = await page.evaluate(() => window.__INSERTED_PLANNER_ENTRIES__);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ user_id: 'me-1', recipe_id: 'r1' });
  });
});

test.describe('Feed — rendering a reshared post', () => {
  test('a post reshared from another post shows "shared this" and an embedded preview linking back to the original', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const card = page.locator('#post-post-reshare');
    await expect(card.locator('.card-name')).toContainText('shared this');

    const embed = card.locator('.shared-embed');
    await expect(embed.locator('.shared-embed-header')).toContainText('Cook D'); // post-plain's author
    await expect(embed.locator('.shared-embed-caption')).toContainText('Made dinner tonight.');
    await expect(embed.locator('.shared-embed-link')).toHaveAttribute('href', 'cookzer-feed.html?post=post-plain');
  });

  test('a post reshared from a profile shows an embedded profile chip', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const card = page.locator('#post-post-profile-share');
    await expect(card.locator('.card-description')).toContainText('Check out');

    const embed = card.locator('.shared-embed');
    await expect(embed.locator('.shared-embed-profile')).toContainText('Cook B');
    await expect(embed.locator('.shared-embed-link')).toHaveAttribute('href', 'cookzer-profile.html?id=user-2');
  });
});
