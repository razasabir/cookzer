const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Feed comments — deleting', () => {
  test('on your own post, you can delete both your own and someone else\'s comment', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const mineCard = page.locator('.feed-card', { hasText: 'My own post.' });
    await mineCard.locator('.action-btn', { hasText: 'Comment' }).click();

    const box = page.locator('#commentBox-post-mine');
    await expect(box.locator('.comment-row')).toHaveCount(2);
    const otherRow = box.locator('.comment-row[data-comment-id="c-other-on-mine"]');
    await expect(otherRow.locator('.comment-delete-btn')).toHaveCount(1);

    await otherRow.locator('.comment-delete-btn').click();
    await expect(page.locator('.cz-modal-message')).toContainText('Delete this comment');
    await page.locator('.cz-modal-btn.cz-danger').click();

    await expect.poll(() => page.evaluate(() => window.__DELETED_COMMENT_IDS__)).toContain('c-other-on-mine');
    await expect(box.locator('.comment-row[data-comment-id="c-other-on-mine"]')).toHaveCount(0);
    await expect(box.locator('.comment-row[data-comment-id="c-mine-on-mine"]')).toHaveCount(1);
  });

  test('on someone else\'s post, you can delete only your own comment', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const otherCard = page.locator('.feed-card', { hasText: "Someone else's post." });
    await otherCard.locator('.action-btn', { hasText: 'Comment' }).click();

    const box = page.locator('#commentBox-post-other');
    await expect(box.locator('.comment-row')).toHaveCount(2);

    const myRow = box.locator('.comment-row[data-comment-id="c-mine-on-other"]');
    const otherRow = box.locator('.comment-row[data-comment-id="c-other-on-other"]');
    await expect(myRow.locator('.comment-delete-btn')).toHaveCount(1);
    await expect(otherRow.locator('.comment-delete-btn')).toHaveCount(0);

    await myRow.locator('.comment-delete-btn').click();
    await page.locator('.cz-modal-btn.cz-danger').click();

    await expect.poll(() => page.evaluate(() => window.__DELETED_COMMENT_IDS__)).toContain('c-mine-on-other');
    await expect(box.locator('.comment-row[data-comment-id="c-mine-on-other"]')).toHaveCount(0);
    await expect(box.locator('.comment-row[data-comment-id="c-other-on-other"]')).toHaveCount(1);
  });

  test('canceling the confirm leaves the comment in place', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const mineCard = page.locator('.feed-card', { hasText: 'My own post.' });
    await mineCard.locator('.action-btn', { hasText: 'Comment' }).click();

    const box = page.locator('#commentBox-post-mine');
    await box.locator('.comment-row[data-comment-id="c-mine-on-mine"] .comment-delete-btn').click();
    await page.locator('.cz-modal-btn.cz-ghost').click();

    expect(await page.evaluate(() => window.__DELETED_COMMENT_IDS__.length)).toBe(0);
    await expect(box.locator('.comment-row[data-comment-id="c-mine-on-mine"]')).toHaveCount(1);
  });

  test('posting a new comment inserts with the current user as author', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const mineCard = page.locator('.feed-card', { hasText: 'My own post.' });
    await mineCard.locator('.action-btn', { hasText: 'Comment' }).click();

    const box = page.locator('#commentBox-post-mine');
    await box.locator('input[type="text"]').fill('Nice recipe!');
    await box.locator('button', { hasText: 'Send' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_COMMENTS__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_COMMENTS__[0]);
    expect(inserted.post_id).toBe('post-mine');
    expect(inserted.author_id).toBe('me-1');
    expect(inserted.text).toBe('Nice recipe!');
    await expect(box.locator('.comment-row')).toHaveCount(3);
  });
});
