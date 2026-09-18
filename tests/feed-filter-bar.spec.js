const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Covers the feed filter bar's new categories beyond Tips (already
// covered by feed-tips-filter.spec.js) — Recipes, Dining out, the 3
// mood chips, and Challenges (the one that needs a challenge_entries
// join rather than a plain column filter).
test.describe('Feed filter bar', () => {
  test('All shows every post and is active by default', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await expect(page.locator('.feed-filter-chip[data-filter="all"]')).toHaveClass(/active/);
    await expect(page.locator('.feed-card')).toHaveCount(6);
  });

  test('Recipes narrows to posts with an attached recipe', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="recipes"]');
    await expect(page.locator('.feed-filter-chip[data-filter="recipes"]')).toHaveClass(/active/);
    await expect(page.locator('.feed-card')).toHaveCount(1);
    await expect(page.locator('.feed-card')).toContainText('Lemon Herb Chicken');
  });

  test('Dining out narrows to posts with a restaurant tagged', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="dining"]');
    await expect(page.locator('.feed-card')).toHaveCount(1);
    await expect(page.locator('.feed-card')).toContainText('Cook C');
  });

  test('a mood chip narrows to that exact mood', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="mood-comfort"]');
    await expect(page.locator('.feed-card')).toHaveCount(1);
    await expect(page.locator('.feed-card')).toContainText('Cook D');
  });

  test('Challenges narrows to posts entered in a challenge, via challenge_entries', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="challenges"]');
    await expect(page.locator('.feed-card')).toHaveCount(1);
    await expect(page.locator('.feed-card')).toContainText('Cook A');
  });

  test('switching filters updates the URL and empty-state message', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="mood-fancy"]');
    await expect(page).toHaveURL(/filter=mood-fancy/);
    await page.click('.feed-filter-chip[data-filter="all"]');
    await expect(page).not.toHaveURL(/filter=/);
  });
});
