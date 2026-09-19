const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Covers the feed filter bar's categories beyond Tips (already covered
// by feed-tips-filter.spec.js) — Recipes, Dining out, and Challenges
// (the one that needs a challenge_entries join rather than a plain
// column filter). The mood chips (Comfort food/Quick & easy/Fancy
// tonight) were removed — mood hasn't been settable from the composer
// for a while, so they had nothing left to filter by.
test.describe('Feed filter bar', () => {
  test('All shows every post and is active by default', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await expect(page.locator('.feed-filter-chip[data-filter="all"]')).toHaveClass(/active/);
    await expect(page.locator('.feed-card')).toHaveCount(4);
  });

  test('Recipes narrows to posts with an attached recipe', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="recipes"]');
    await expect(page.locator('.feed-filter-chip[data-filter="recipes"]')).toHaveClass(/active/);
    await expect(page.locator('.feed-card')).toHaveCount(2);
    await expect(page.locator('.feed-card')).toContainText(['Lemon Herb Chicken', 'Garlic Naan']);
  });

  test('Dining out narrows to posts with a restaurant tagged', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="dining"]');
    await expect(page.locator('.feed-card')).toHaveCount(1);
    await expect(page.locator('.feed-card')).toContainText('Cook C');
  });

  test('no mood chips are rendered', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await expect(page.locator('.feed-filter-chip[data-filter^="mood-"]')).toHaveCount(0);
  });

  test('Challenges narrows to posts entered in a challenge, via challenge_entries', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="challenges"]');
    await expect(page.locator('.feed-card')).toHaveCount(1);
    await expect(page.locator('.feed-card')).toContainText('Cook A');
  });

  test('switching filters updates the URL and empty-state message', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="dining"]');
    await expect(page).toHaveURL(/filter=dining/);
    await page.click('.feed-filter-chip[data-filter="all"]');
    await expect(page).not.toHaveURL(/filter=/);
  });
});

// The recipe tags typed into the recipe creation wizard (distinct from
// the fixed kind/mood chips above) become their own filter chips too —
// one per most-used tag among posted recipes — so a tag is actually
// something you can filter the feed by, not just search one recipe with.
test.describe('Feed filter bar — recipe tag chips', () => {
  test('the most-used recipe tags appear as extra chips after the fixed ones', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    const tagChips = page.locator('.feed-filter-chip[data-filter^="tag:"]');
    await expect(tagChips).toHaveCount(2);
    await expect(page.locator('.feed-filter-chip[data-filter="tag:quick"]')).toHaveText('#quick');
    await expect(page.locator('.feed-filter-chip[data-filter="tag:weeknight"]')).toHaveText('#weeknight');
  });

  test('clicking a tag chip narrows the feed to posts whose recipe carries that tag', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="tag:weeknight"]');
    await expect(page.locator('.feed-filter-chip[data-filter="tag:weeknight"]')).toHaveClass(/active/);
    await expect(page.locator('.feed-card')).toHaveCount(1);
    await expect(page.locator('.feed-card')).toContainText('Lemon Herb Chicken');

    // "quick" is on both recipe posts.
    await page.click('.feed-filter-chip[data-filter="tag:quick"]');
    await expect(page.locator('.feed-card')).toHaveCount(2);
  });

  test('a tag filter updates the URL and shows a tag-specific empty state', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await page.click('.feed-filter-chip[data-filter="tag:weeknight"]');
    await expect(page).toHaveURL(/filter=tag%3Aweeknight/);

    await page.reload();
    await expect(page.locator('.feed-filter-chip[data-filter="tag:weeknight"]')).toHaveClass(/active/);
    await expect(page.locator('.feed-card')).toHaveCount(1);
  });
});
