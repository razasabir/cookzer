const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Settings — self-service data requests (DSAR)', () => {
  test('Download my data calls file_dsar_request with type export and shows a confirmation', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-profile-details.js');

    await page.click('#exportDataBtn');
    await expect(page.locator('#dataRequestStatus')).toContainText('Request received');

    const call = await page.evaluate(() => window.__RPC_CALLS__.find((c) => c.fn === 'file_dsar_request'));
    expect(call.args.p_type).toBe('export');
  });

  test('Delete my account requires a real picker-free confirm (not a native dialog), then files the request', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-profile-details.js');

    await page.click('#deleteAccountBtn');
    // CookzerModal is an in-page overlay, never window.confirm().
    await expect(page.locator('.cz-modal-overlay')).toBeVisible();
    await page.locator('.cz-modal-overlay .cz-modal-btn.cz-danger').click();

    await expect(page.locator('#dataRequestStatus')).toContainText('Deletion requested');
    const call = await page.evaluate(() => window.__RPC_CALLS__.find((c) => c.fn === 'file_dsar_request' && c.args.p_type === 'delete'));
    expect(call).toBeTruthy();
  });

  test('cancelling the delete confirmation does not file a request', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-profile-details.js');

    await page.click('#deleteAccountBtn');
    await page.locator('.cz-modal-overlay .cz-modal-btn.cz-ghost').click();

    await expect(page.locator('#dataRequestStatus')).toHaveText('');
    const calls = await page.evaluate(() => window.__RPC_CALLS__.filter((c) => c.fn === 'file_dsar_request'));
    expect(calls.length).toBe(0);
  });
});
