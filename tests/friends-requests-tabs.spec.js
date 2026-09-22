const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Friends page — Friends and Requests tabs', () => {
  test('Friends tab lists accepted friendships from either side of the pair', async ({ page }) => {
    const extraInit = `
      window.__STATE__.friendships.push(
        { user_id_1: 'alice-1', user_id_2: 'me-1' },
        { user_id_1: 'bob-1', user_id_2: 'me-1' }
      );
    `;
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js', extraInit);
    await page.click('#friendsTab');
    const rows = page.locator('#friendsList .person-row');
    await expect(rows).toHaveCount(2);
    await expect(rows).toContainText(['Alice Diaz', 'Bob Ortiz']);
    await expect(rows.first().locator('button')).toHaveText('Friends ✓');
  });

  test('unfriending from the Friends tab removes the row after confirming', async ({ page }) => {
    const extraInit = `
      window.__STATE__.friendships.push({ user_id_1: 'alice-1', user_id_2: 'me-1' });
    `;
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js', extraInit);
    await page.click('#friendsTab');
    await page.locator('#friendsList button', { hasText: 'Friends ✓' }).click();
    await page.locator('.cz-modal-btn.cz-danger, .cz-modal-btn.cz-primary').first().click();
    await expect(page.locator('#friendsList .person-row')).toHaveCount(0);
  });

  test('Requests tab shows incoming requests with Accept/Decline and outgoing with Cancel, in separate sections', async ({ page }) => {
    const extraInit = `
      window.__STATE__.friend_requests.push(
        { id: 'req-in', sender_id: 'alice-1', recipient_id: 'me-1', status: 'pending' },
        { id: 'req-out', sender_id: 'me-1', recipient_id: 'bob-1', status: 'pending' }
      );
    `;
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js', extraInit);
    await page.click('#requestsTab');

    const headings = page.locator('#friendsList .list-subheading');
    await expect(headings).toHaveText(['Requests to you', 'Sent requests']);

    const incomingRow = page.locator('#friendsList .person-row', { hasText: 'Alice Diaz' });
    await expect(incomingRow.locator('button')).toHaveText(['Accept', 'Decline']);

    const outgoingRow = page.locator('#friendsList .person-row', { hasText: 'Bob Ortiz' });
    await expect(outgoingRow.locator('button')).toHaveText('Cancel');
  });

  test('accepting an incoming request from the Requests tab moves it to accepted and creates a friendship', async ({ page }) => {
    const extraInit = `
      window.__STATE__.friend_requests.push({ id: 'req-in', sender_id: 'alice-1', recipient_id: 'me-1', status: 'pending' });
    `;
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js', extraInit);
    await page.click('#requestsTab');
    await page.locator('#friendsList button', { hasText: 'Accept' }).click();

    await expect(page.locator('#friendsList')).toContainText('No pending friend requests.');
    const friendships = await page.evaluate(() => window.__STATE__.friendships);
    expect(friendships).toEqual([{ user_id_1: 'alice-1', user_id_2: 'me-1' }]);
  });

  test('canceling an outgoing request from the Requests tab removes it', async ({ page }) => {
    const extraInit = `
      window.__STATE__.friend_requests.push({ id: 'req-out', sender_id: 'me-1', recipient_id: 'bob-1', status: 'pending' });
    `;
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js', extraInit);
    await page.click('#requestsTab');
    await page.locator('#friendsList button', { hasText: 'Cancel' }).click();
    await expect(page.locator('#friendsList')).toContainText('No pending friend requests.');
    const requests = await page.evaluate(() => window.__STATE__.friend_requests);
    expect(requests).toHaveLength(0);
  });

  test('no friends and no requests shows the right empty states', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    await page.click('#friendsTab');
    await expect(page.locator('#friendsList')).toContainText('No friends yet');
    await page.click('#requestsTab');
    await expect(page.locator('#friendsList')).toContainText('No pending friend requests.');
  });
});
