const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

async function load(page) {
  await loadPageWithMock(page, 'cookzer-feed.html', 'avatar-menu.js');
}

test.describe('Header avatar menu', () => {
  test('clicking the avatar opens a menu with your name, Profile, Settings, Cookzer+ AI, and Log Out', async ({ page }) => {
    await load(page);
    const avatar = page.locator('.avatar');
    await expect(page.locator('.avatar-menu-panel')).toBeHidden();

    await avatar.click();
    const panel = page.locator('.avatar-menu-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.avatar-menu-name')).toHaveText('Me Cook');
    await expect(panel.locator('.avatar-menu-email')).toHaveText('me@example.com');
    await expect(panel.locator('a', { hasText: 'Profile' })).toHaveAttribute('href', 'cookzer-profile.html');
    await expect(panel.locator('a', { hasText: 'Settings' })).toHaveAttribute('href', 'cookzer-settings.html');
    await expect(panel.locator('a', { hasText: 'Cookzer+ AI' })).toHaveAttribute('href', 'cookzer-pantry.html');
    await expect(panel.locator('a', { hasText: 'Log Out' })).toHaveCount(1);
  });

  test('clicking the avatar again, or clicking outside, closes the menu', async ({ page }) => {
    await load(page);
    const avatar = page.locator('.avatar');
    const panel = page.locator('.avatar-menu-panel');

    await avatar.click();
    await expect(panel).toBeVisible();
    await avatar.click();
    await expect(panel).toBeHidden();

    await avatar.click();
    await expect(panel).toBeVisible();
    await page.mouse.click(10, 10); // anywhere outside the panel
    await expect(panel).toBeHidden();
  });

  test('shows the real Cookzer+ AI usage count out of the monthly cap', async ({ page }) => {
    await load(page);
    await page.locator('.avatar').click();
    await expect(page.locator('#avatarMenuAiUsage')).toHaveText('42 / 500 AI messages this month');
  });

  test('Log Out asks for confirmation through the in-app modal, not a native browser dialog', async ({ page }) => {
    await page.addInitScript(() => {
      window.confirm = () => { window.__NATIVE_CONFIRM_CALLED__ = true; return true; };
    });
    await load(page);

    await page.locator('.avatar').click();
    await page.locator('.avatar-menu-panel a', { hasText: 'Log Out' }).click();

    await expect(page.locator('.cz-modal-message')).toHaveText('Sign out of Cookzer?');
    const nativeConfirmCalled = await page.evaluate(() => !!window.__NATIVE_CONFIRM_CALLED__);
    expect(nativeConfirmCalled).toBe(false);
  });

  test('canceling the sign-out confirm keeps the session; confirming redirects to the auth page', async ({ page }) => {
    await load(page);
    await page.locator('.avatar').click();
    await page.locator('.avatar-menu-panel a', { hasText: 'Log Out' }).click();
    await page.locator('.cz-modal-btn.cz-ghost').click();
    await expect(page.locator('.cz-modal-overlay')).toHaveCount(0);
    expect(page.url()).toContain('cookzer-feed.html');

    await page.locator('.avatar').click();
    await page.locator('.avatar-menu-panel a', { hasText: 'Log Out' }).click();
    await page.locator('.cz-modal-btn.cz-primary').click();
    await page.waitForURL(/cookzer-auth\.html/);
  });
});
