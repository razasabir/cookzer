const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Friends — Invite link Share popup', () => {
  test('clicking Share opens the Reshare/Group/External picker, not the share dialog directly', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    await page.locator('#shareInviteLinkBtn').click();
    await expect(page.locator('.cz2-modal h3')).toHaveText('Share');
    await expect(page.locator('.cz2-row')).toHaveCount(3);
  });

  test('Reshare to your feed posts a caption-only invite post', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    await page.locator('#shareInviteLinkBtn').click();
    await page.locator('.cz2-row', { hasText: 'Reshare to your feed' }).click();
    await page.locator('.cz-modal-btn.cz-primary').click();

    const calls = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'insert' && c.table === 'posts'));
    expect(calls).toHaveLength(1);
    expect(calls[0].payload.kind).toBe('share');
    expect(calls[0].payload.author_id).toBe('me-1');
    expect(calls[0].payload.caption).toContain('Come cook with me on Cookzer');
  });

  test('Share externally reaches the existing in-app share-link popup', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    await page.locator('#shareInviteLinkBtn').click();
    await page.locator('.cz2-row', { hasText: 'Share externally' }).click();
    await expect(page.locator('.cz-share-link-row input')).toHaveValue(/cookzer-auth\.html/);
  });
});
