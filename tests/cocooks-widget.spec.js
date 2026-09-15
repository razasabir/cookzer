const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Regression test for the sidebar Co-Cooks widget that replaced the old
// hardcoded "Recently active: Sarah K., Amina M., Josh M." block.
test.describe('sidebar Co-Cooks widget', () => {
  test('renders real followed people as avatars, not the old fake names', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'cocooks-widget.js');

    const widget = page.locator('.sidebar-cocooks-widget');
    await expect(widget.locator('.sidebar-cocook-avatar')).toHaveCount(2);
    await expect(widget.locator('.sidebar-cocook-avatar').first()).toHaveText('SK');
    await expect(widget.locator('.sidebar-cocooks-settings')).toHaveCount(1);
    await expect(widget.locator('.sidebar-cocooks-settings')).toHaveAttribute('href', 'cookzer-cocooks.html');

    await expect(page.locator('body')).not.toContainText('Josh M.');
    await expect(page.locator('body')).not.toContainText('Recently active');
  });

  test('shows a follow-people hint when the user follows no one', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'cocooks-widget-empty.js');

    const widget = page.locator('.sidebar-cocooks-widget');
    await expect(widget.locator('.sidebar-cocook-avatar')).toHaveCount(0);
    await expect(widget).toContainText('Follow people to see your Co-Cooks here');
  });
});
