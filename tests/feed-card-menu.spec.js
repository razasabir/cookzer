const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// A bare flag (🚩) or bin (🗑) icon sitting alone in the card header read
// as clutter and doesn't scale past one action — replaced with a "⋮"
// kebab menu, the standard place for a post's secondary actions.
test.describe('Feed — post card kebab menu', () => {
  test('your own post shows a kebab menu with only "Delete post"', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const mineCard = page.locator('.feed-card', { hasText: 'My own post.' });

    await expect(mineCard.locator('.card-menu-btn')).toHaveCount(1);
    await expect(mineCard.locator('.card-menu-dropdown')).toBeHidden();

    await mineCard.locator('.card-menu-btn').click();
    const dropdown = mineCard.locator('.card-menu-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('.card-menu-item')).toHaveCount(1);
    await expect(dropdown.locator('.card-menu-item')).toHaveText('Delete post');
  });

  test('someone else\'s post shows a kebab menu with only "Report post"', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const otherCard = page.locator('.feed-card', { hasText: "Someone else's post." });

    await otherCard.locator('.card-menu-btn').click();
    const dropdown = otherCard.locator('.card-menu-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('.card-menu-item')).toHaveCount(1);
    await expect(dropdown.locator('.card-menu-item')).toHaveText('Report post');
  });

  test('picking "Delete post" from the menu confirms (danger) and removes the card', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const mineCard = page.locator('.feed-card', { hasText: 'My own post.' });

    await mineCard.locator('.card-menu-btn').click();
    await mineCard.locator('.card-menu-item').click();
    await expect(page.locator('.cz-modal-message')).toContainText("Delete this post");
    await page.locator('.cz-modal-btn.cz-danger').click();

    await expect.poll(() => page.evaluate(() => window.__DELETED_POST_IDS__)).toContain('post-mine');
    await expect(page.locator('.feed-card', { hasText: 'My own post.' })).toHaveCount(0);
  });

  test('picking "Report post" from the menu asks why and submits a report', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const otherCard = page.locator('.feed-card', { hasText: "Someone else's post." });

    await otherCard.locator('.card-menu-btn').click();
    await otherCard.locator('.card-menu-item').click();
    await expect(page.locator('.cz-modal-input')).toBeVisible();
    await page.locator('.cz-modal-input').fill('spam');
    await page.locator('.cz-modal-btn.cz-primary').click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_REPORTS__)).toHaveLength(1);
    const report = await page.evaluate(() => window.__INSERTED_REPORTS__[0]);
    expect(report.target_type).toBe('post');
    expect(report.target_id).toBe('post-other');
    expect(report.reason).toBe('spam');
  });

  test('opening one card\'s menu closes another that was already open', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const mineCard = page.locator('.feed-card', { hasText: 'My own post.' });
    const otherCard = page.locator('.feed-card', { hasText: "Someone else's post." });

    await mineCard.locator('.card-menu-btn').click();
    await expect(mineCard.locator('.card-menu-dropdown')).toBeVisible();

    await otherCard.locator('.card-menu-btn').click();
    await expect(otherCard.locator('.card-menu-dropdown')).toBeVisible();
    await expect(mineCard.locator('.card-menu-dropdown')).toBeHidden();
  });

  test('clicking outside closes an open menu without taking any action', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-comments.js');
    const mineCard = page.locator('.feed-card', { hasText: 'My own post.' });

    await mineCard.locator('.card-menu-btn').click();
    await expect(mineCard.locator('.card-menu-dropdown')).toBeVisible();

    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await expect(mineCard.locator('.card-menu-dropdown')).toBeHidden();
  });
});
