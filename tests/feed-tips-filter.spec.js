const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Tips & Tricks composer toggle', () => {
  test('posting with the Tip toggle active inserts kind: "tip"', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-tips-filter.js');
    await page.click('#composerTipBtn');
    await expect(page.locator('#composerTipBtn')).toHaveClass(/active-tip-tag/);
    await page.fill('#postCaption', 'Room-temp butter creams faster.');
    await page.click('#composerPostBtn');
    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_POSTS__[0]);
    expect(inserted.kind).toBe('tip');
  });

  test('posting without the toggle inserts the ordinary kind: "post"', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-tips-filter.js');
    await page.fill('#postCaption', 'Just a regular update.');
    await page.click('#composerPostBtn');
    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    expect(await page.evaluate(() => window.__INSERTED_POSTS__[0].kind)).toBe('post');
  });

  test('the toggle resets after a successful post', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-tips-filter.js');
    await page.click('#composerTipBtn');
    await page.fill('#postCaption', 'A tip.');
    await page.click('#composerPostBtn');
    await expect.poll(() => page.evaluate(() => window.__INSERTED_POSTS__.length)).toBe(1);
    await expect(page.locator('#composerTipBtn')).not.toHaveClass(/active-tip-tag/);
  });
});

test.describe('Tips & Tricks filtered feed view', () => {
  test('the unfiltered feed shows every post kind', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-tips-filter.js');
    await expect(page.locator('.feed-card')).toHaveCount(4);
    await expect(page.locator('#tipsFilterBanner')).toBeHidden();
  });

  test('?filter=tips shows the banner and only kind=tip posts', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html?filter=tips', 'feed-tips-filter.js');
    await expect(page.locator('#tipsFilterBanner')).toBeVisible();
    await expect(page.locator('.feed-card')).toHaveCount(2);
    await expect(page.locator('.feed-card').first()).toContainText('shared a tip');
    await expect(page.locator('.feed-card').first()).toContainText('Tips & Tricks');
  });

  test('a tip post card is labeled "shared a tip" with a Tips & Tricks badge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-tips-filter.js');
    const tipCard = page.locator('.feed-card', { hasText: 'Cook A' });
    await expect(tipCard).toContainText('shared a tip');
    await expect(tipCard.locator('.tip-badge')).toContainText('Tips & Tricks');
  });
});

test.describe('Recipe posts are visually distinct from plain posts', () => {
  test('a post with an attached recipe gets the has-recipe accent and a Recipe badge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-tips-filter.js');
    const recipeCard = page.locator('.feed-card', { hasText: 'Cook D' });
    await expect(recipeCard).toHaveClass(/has-recipe/);
    await expect(recipeCard.locator('.recipe-badge')).toContainText('Recipe');
    await expect(recipeCard).toContainText('Lemon Herb Chicken');
  });

  test('a plain post has neither the accent class nor a Recipe badge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-tips-filter.js');
    const plainCard = page.locator('.feed-card', { hasText: 'Cook B' });
    await expect(plainCard).not.toHaveClass(/has-recipe/);
    await expect(plainCard.locator('.recipe-badge')).toHaveCount(0);
  });
});
