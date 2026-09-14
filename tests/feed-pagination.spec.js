const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Regression test for the feed's range()-based pagination — the mock
// serves 45 fake posts, 20 per page (FEED_PAGE_SIZE in cookzer-feed.html).
test.describe('feed pagination', () => {
  test('loads pages of 20 and hides Load more once the last page is short', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-pagination.js');

    const posts = page.locator('#feedList > *');
    const loadMoreBtn = page.locator('#loadMoreBtn');

    await expect(posts).toHaveCount(20);
    await expect(loadMoreBtn).toBeVisible();

    await loadMoreBtn.click();
    await expect(posts).toHaveCount(40);
    await expect(loadMoreBtn).toBeVisible();

    await loadMoreBtn.click();
    await expect(posts).toHaveCount(45);
    await expect(loadMoreBtn).toBeHidden();
  });

  test('batches hearts/comments into one query per page instead of one per post', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-pagination.js');
    await expect(page.locator('#feedList > *')).toHaveCount(20);

    const calls = await page.evaluate(() => window.__CALLS__);
    // N+1 would mean one hearts/comments call per rendered post (20+).
    // The sidebar's Top Recipes / leaderboard widgets also query hearts
    // separately, so look specifically for the one batched call covering
    // this page's full set of 20 post IDs, not the total call count.
    const batchedHearts = calls.filter((c) => c.table === 'hearts' && c.inArgs && c.inArgs.length === 20);
    const batchedComments = calls.filter((c) => c.table === 'comments' && c.inArgs && c.inArgs.length === 20);
    expect(batchedHearts.length).toBe(1);
    expect(batchedComments.length).toBe(1);
  });
});
