const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Notifications page', () => {
  test('renders each notification with its type emoji, text, and unread styling', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    const rows = page.locator('.notif-row');
    await expect(rows).toHaveCount(2);

    const unreadRow = rows.filter({ hasText: 'Sarah K. hearted your post' });
    await expect(unreadRow).toHaveClass(/unread/);
    await expect(unreadRow.locator('.notif-avatar')).toHaveText('❤️');
    await expect(unreadRow).toHaveAttribute('href', 'cookzer-feed.html?post=p1');

    const readRow = rows.filter({ hasText: 'Alex commented' });
    await expect(readRow).not.toHaveClass(/unread/);
    await expect(readRow.locator('.notif-avatar')).toHaveText('💬');
  });

  test('marks everything read on load', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    await expect.poll(() => page.evaluate(() => window.__MARKED_READ__.length)).toBeGreaterThan(0);
  });

  test('shows the empty state when there is no activity', async ({ page }) => {
    await page.addInitScript(() => { window.__SEED_NOTIFICATIONS__ = []; });
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    await expect(page.locator('#notifEmpty')).toBeVisible();
    await expect(page.locator('.notif-row')).toHaveCount(0);
  });
});

test.describe('Notification bell (auth-guard.js, shared across every page)', () => {
  test('shows the unread dot when there is unread activity', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    const dot = page.locator('#notifBellBtn div');
    await expect(dot).toHaveCSS('display', 'block');
  });

  test('hides the unread dot when nothing is unread', async ({ page }) => {
    await page.addInitScript(() => {
      window.__SEED_NOTIFICATIONS__ = [
        { id: 'n1', type: 'follow', message: 'Someone followed you', link_url: 'cookzer-profile.html?id=u1', actor_id: 'u1', read_at: new Date().toISOString(), created_at: new Date().toISOString() },
      ];
    });
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    const dot = page.locator('#notifBellBtn div');
    await expect(dot).toHaveCSS('display', 'none');
  });

  test('clicking the bell opens a panel listing recent notifications', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    await page.click('#notifBellBtn');
    const panel = page.locator('#notifPanel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Sarah K. hearted your post');
    await expect(panel).toContainText('See all notifications');
  });
});
