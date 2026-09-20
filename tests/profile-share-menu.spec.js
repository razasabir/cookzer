const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Profile — Share popup', () => {
  test('clicking Share opens the Reshare/Group/External picker, not the share dialog directly', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await page.locator('#profileActions button', { hasText: 'Share' }).click();
    await expect(page.locator('.cz2-modal h3')).toHaveText('Share');
    await expect(page.locator('.cz2-row')).toHaveCount(3);
  });

  test('Reshare to your feed posts a share referencing this profile', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await page.locator('#profileActions button', { hasText: 'Share' }).click();
    await page.locator('.cz2-row', { hasText: 'Reshare to your feed' }).click();
    await page.locator('.cz-modal-btn.cz-primary').click();

    const calls = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'insert' && c.table === 'posts'));
    expect(calls).toHaveLength(1);
    expect(calls[0].payload).toMatchObject({ kind: 'share', author_id: 'me-1', shared_profile_id: 'me-1' });
  });

  test('Share externally reaches the existing in-app share-link popup', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await page.locator('#profileActions button', { hasText: 'Share' }).click();
    await page.locator('.cz2-row', { hasText: 'Share externally' }).click();
    await expect(page.locator('.cz-share-link-row input')).toHaveValue(/cookzer-profile\.html/);
  });
});
