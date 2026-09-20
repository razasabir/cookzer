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
    await expect(unreadRow.locator('.notif-link')).toHaveAttribute('href', 'cookzer-feed.html?post=p1');

    const readRow = rows.filter({ hasText: 'Alex commented' });
    await expect(readRow).not.toHaveClass(/unread/);
    await expect(readRow.locator('.notif-avatar')).toHaveText('💬');
  });

  test('does not mark anything read just from loading the page', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__MARKED_READ__.length)).toBe(0);
    await expect(page.locator('.notif-row').filter({ hasText: 'Sarah K. hearted your post' })).toHaveClass(/unread/);
  });

  test('a per-notification mark-read button clears just that one, without navigating', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    const unreadRow = page.locator('.notif-row').filter({ hasText: 'Sarah K. hearted your post' });
    await expect(unreadRow).toHaveClass(/unread/);

    await unreadRow.locator('.notif-mark-read').click();

    await expect(unreadRow).not.toHaveClass(/unread/);
    await expect(unreadRow.locator('.notif-mark-read')).toHaveCount(0);
    expect(page.url()).toContain('cookzer-notifications.html');
    await expect(page.locator('#markAllReadBtn')).toBeHidden();
  });

  test('"Mark all read" button clears every unread notification', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    const markAllBtn = page.locator('#markAllReadBtn');
    await expect(markAllBtn).toBeVisible();

    await markAllBtn.click();

    await expect(page.locator('.notif-row.unread')).toHaveCount(0);
    await expect(markAllBtn).toBeHidden();
  });

  test('shows the empty state when there is no activity', async ({ page }) => {
    await page.addInitScript(() => { window.__SEED_NOTIFICATIONS__ = []; });
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    await expect(page.locator('#notifEmpty')).toBeVisible();
    await expect(page.locator('.notif-row')).toHaveCount(0);
    await expect(page.locator('#markAllReadBtn')).toBeHidden();
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

  test('opening the panel does not silently mark anything read', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    await page.click('#notifBellBtn');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__MARKED_READ__.length)).toBe(0);
    const dot = page.locator('#notifBellBtn div');
    await expect(dot).toHaveCSS('display', 'block');
  });

  test('a mark-read button in the panel clears just that notification\'s highlight and the dot', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-notifications.html', 'notifications-page.js');
    await page.click('#notifBellBtn');
    const panel = page.locator('#notifPanel');
    const markBtn = panel.locator('button[aria-label="Mark as read"]');
    await expect(markBtn).toHaveCount(1);

    await markBtn.click();

    await expect(markBtn).toHaveCount(0);
    const dot = page.locator('#notifBellBtn div');
    await expect(dot).toHaveCSS('display', 'none');
  });
});
