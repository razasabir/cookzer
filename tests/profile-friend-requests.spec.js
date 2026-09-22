const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Migration 055: real bidirectional friend requests, additive alongside
// the existing one-way follows. Covers cookzer-profile.html's
// friendActionWrap state machine (Add Friend / Request Sent /
// Accept+Decline / Friends ✓) and the mutual-friends line now reading
// from friendships instead of a mutual-follow approximation.
test.describe('Profile page — friend requests', () => {
  test('a stranger shows "+ Add Friend"; clicking sends a request and the button becomes "Request Sent"', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js');
    const wrap = page.locator('#friendActionWrap');
    await expect(wrap.locator('button')).toHaveText('+ Add Friend');

    await wrap.locator('button').click();
    await expect(wrap.locator('button')).toHaveText('Request Sent');
    const requests = await page.evaluate(() => window.__STATE__.friend_requests);
    expect(requests).toHaveLength(1);
    expect(requests[0].sender_id).toBe('me-1');
    expect(requests[0].recipient_id).toBe('alice-1');
  });

  test('clicking "Request Sent" cancels the pending request', async ({ page }) => {
    const extraInit = `
      window.__STATE__.friend_requests.push({ id: 'req-1', sender_id: 'me-1', recipient_id: 'alice-1', status: 'pending' });
    `;
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js', extraInit);
    const wrap = page.locator('#friendActionWrap');
    await expect(wrap.locator('button')).toHaveText('Request Sent');

    await wrap.locator('button').click();
    await expect(wrap.locator('button')).toHaveText('+ Add Friend');
    const requests = await page.evaluate(() => window.__STATE__.friend_requests);
    expect(requests).toHaveLength(0);
  });

  test('an incoming request shows Accept/Decline; accepting creates a friendship', async ({ page }) => {
    const extraInit = `
      window.__STATE__.friend_requests.push({ id: 'req-2', sender_id: 'alice-1', recipient_id: 'me-1', status: 'pending' });
    `;
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js', extraInit);
    const wrap = page.locator('#friendActionWrap');
    await expect(wrap.locator('button')).toHaveText(['Accept', 'Decline']);

    await wrap.locator('button', { hasText: 'Accept' }).click();
    await expect(wrap.locator('button')).toHaveText('Friends ✓');
    const friendships = await page.evaluate(() => window.__STATE__.friendships);
    expect(friendships).toEqual([{ user_id_1: 'alice-1', user_id_2: 'me-1' }]);
    const req = await page.evaluate(() => window.__STATE__.friend_requests[0]);
    expect(req.status).toBe('accepted');
  });

  test('declining an incoming request creates no friendship and reverts to Add Friend', async ({ page }) => {
    const extraInit = `
      window.__STATE__.friend_requests.push({ id: 'req-3', sender_id: 'alice-1', recipient_id: 'me-1', status: 'pending' });
    `;
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js', extraInit);
    const wrap = page.locator('#friendActionWrap');
    await wrap.locator('button', { hasText: 'Decline' }).click();
    await expect(wrap.locator('button')).toHaveText('+ Add Friend');
    const friendships = await page.evaluate(() => window.__STATE__.friendships);
    expect(friendships).toHaveLength(0);
  });

  test('already-friends shows "Friends ✓"; confirming removal deletes the friendship', async ({ page }) => {
    const extraInit = `
      window.__STATE__.friendships.push({ user_id_1: 'alice-1', user_id_2: 'me-1' });
    `;
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js', extraInit);
    const wrap = page.locator('#friendActionWrap');
    await expect(wrap.locator('button')).toHaveText('Friends ✓');

    await wrap.locator('button').click();
    await page.locator('.cz-modal-btn.cz-danger, .cz-modal-btn.cz-primary').first().click();
    await expect(wrap.locator('button')).toHaveText('+ Add Friend');
    const friendships = await page.evaluate(() => window.__STATE__.friendships);
    expect(friendships).toHaveLength(0);
  });

  test('mutual friends reads from real friendships, not mutual-follow', async ({ page }) => {
    const extraInit = `
      // me-1 and alice-1 are both friends with bob-1, but only me-1
      // follows bob-1 in this mock's default follows — the old
      // mutual-follow approximation would have shown 0 mutual friends.
      window.__STATE__.friendships.push(
        { user_id_1: 'bob-1', user_id_2: 'me-1' },
        { user_id_1: 'alice-1', user_id_2: 'bob-1' }
      );
    `;
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js', extraInit);
    await expect(page.locator('#mutualFriendsLine')).toBeVisible();
    await expect(page.locator('#mutualFriendsLine')).toContainText('Bob Ortiz');
  });
});
