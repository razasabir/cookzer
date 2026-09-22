const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Migration 054: profile_views, insert-only-as-yourself / read-only-your-own.
test.describe('Profile view analytics', () => {
  test('visiting someone else\'s profile logs a view row, not a self-view', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js');
    await expect.poll(() => page.evaluate(() => window.__STATE__.profile_views.length)).toBe(1);
    const row = await page.evaluate(() => window.__STATE__.profile_views[0]);
    expect(row.viewer_id).toBe('me-1');
    expect(row.viewed_id).toBe('alice-1');
  });

  test('your own profile shows the distinct-viewer count for the last 7 days', async ({ page }) => {
    const extraInit = `
      const now = Date.now();
      window.__STATE__.profile_views = [
        { viewer_id: 'alice-1', viewed_id: 'me-1', created_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() },
        { viewer_id: 'bob-1', viewed_id: 'me-1', created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { viewer_id: 'alice-1', viewed_id: 'me-1', created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { viewer_id: 'carol-1', viewed_id: 'me-1', created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() },
      ];
    `;
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js', extraInit);
    await expect(page.locator('#profileViewsLine')).toBeVisible();
    await expect(page.locator('#profileViewsLine')).toContainText('2 people viewed your profile this week');
  });

  test('no recent views hides the line entirely', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await expect(page.locator('#profileViewsLine')).toBeHidden();
  });

  test('the line never shows on someone else\'s profile', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js');
    await expect(page.locator('#profileViewsLine')).toBeHidden();
  });
});
