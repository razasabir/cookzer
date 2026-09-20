const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// profile-hover-card.js: hovering a link to someone's profile shows a
// quick peek (avatar, bio/location, recipes/followers/streak) without
// navigating away. Wired into cookzer-feed.html for now (post authors,
// commenters, search results, etc. all link to cookzer-profile.html).
test.describe('Profile hover card', () => {
  test('hovering a post author link shows their photo and quick stats after a short delay', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'profile-hover-card.js');
    const authorLink = page.locator('#post-post-1 .card-author-link');
    await expect(authorLink).toBeVisible();

    const card = page.locator('.cz-hovercard');
    await expect(card).toHaveCount(0);

    await authorLink.hover();
    await expect(card).toBeVisible();

    await expect(card.locator('.cz-hovercard-name')).toHaveText('Alice Diaz');
    await expect(card.locator('.cz-hovercard-meta')).toHaveText('Baker from Austin');
    const stats = card.locator('.cz-hovercard-stat-num');
    await expect(stats.nth(0)).toHaveText('3'); // recipes
    await expect(stats.nth(1)).toHaveText('2'); // followers
    await expect(stats.nth(2)).toHaveText('2'); // day streak
  });

  test('moving the mouse away hides the card', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'profile-hover-card.js');
    const authorLink = page.locator('#post-post-1 .card-author-link');
    await authorLink.hover();
    const card = page.locator('.cz-hovercard');
    await expect(card).toBeVisible();

    await page.mouse.move(5, 5);
    await expect(card).toBeHidden();
  });

  test('does not show for a brief hover (avoids flicker while scrolling past)', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'profile-hover-card.js');
    const authorLink = page.locator('#post-post-1 .card-author-link');
    await authorLink.hover();
    await page.waitForTimeout(100); // well under the show delay
    await page.mouse.move(5, 5);

    await page.waitForTimeout(500);
    await expect(page.locator('.cz-hovercard')).toHaveCount(0);
  });

  test('caches a repeat hover instead of refetching', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'profile-hover-card.js');
    const authorLink = page.locator('#post-post-1 .card-author-link');
    const card = page.locator('.cz-hovercard');

    await authorLink.hover();
    await expect(card).toBeVisible();
    await expect(card.locator('.cz-hovercard-name')).toHaveText('Alice Diaz');

    await page.mouse.move(5, 5);
    await expect(card).toBeHidden();

    await authorLink.hover();
    await expect(card).toBeVisible();
    await expect(card.locator('.cz-hovercard-name')).toHaveText('Alice Diaz');
  });
});
