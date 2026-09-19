const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Regression test for the sidebar Friends widget that replaced the old
// hardcoded "Recently active: Sarah K., Amina M., Josh M." block.
test.describe('sidebar Friends widget', () => {
  test('renders real followed people as avatars, not the old fake names', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'friends-widget.js');

    const widget = page.locator('.sidebar-friends-widget');
    await expect(widget.locator('.sidebar-friend-avatar')).toHaveCount(2);
    await expect(widget.locator('.sidebar-friend-avatar').first()).toHaveText('SK');
    await expect(widget.locator('.sidebar-friends-settings')).toHaveCount(1);
    await expect(widget.locator('.sidebar-friends-settings')).toHaveAttribute('href', 'cookzer-friends.html');

    await expect(page.locator('body')).not.toContainText('Josh M.');
    await expect(page.locator('body')).not.toContainText('Recently active');
  });

  test('shows a follow-people hint when the user follows no one', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'friends-widget-empty.js');

    const widget = page.locator('.sidebar-friends-widget');
    await expect(widget.locator('.sidebar-friend-avatar')).toHaveCount(0);
    await expect(widget).toContainText('Follow people to see your Friends here');
  });
});
