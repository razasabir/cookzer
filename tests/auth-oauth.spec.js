const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Google/Facebook sign-in on cookzer-auth.html. signInWithOAuth() redirects
// the whole browser away to the provider on success (never resolves this
// tab), so the only thing testable here is: the right provider + redirectTo
// get passed, and an error surfaces instead of silently doing nothing.
test.describe('OAuth sign-in buttons', () => {
  test('Google button calls signInWithOAuth with the right provider', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-auth.html', 'auth-oauth.js');
    await page.locator('#googleAuthBtn').click();
    await expect.poll(() => page.evaluate(() => window.__OAUTH_CALLS__.length)).toBe(1);
    const call = await page.evaluate(() => window.__OAUTH_CALLS__[0]);
    expect(call.provider).toBe('google');
    expect(call.options.redirectTo).toContain('cookzer-feed.html');
  });

  test('Facebook button calls signInWithOAuth with the right provider', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-auth.html', 'auth-oauth.js');
    await page.locator('#facebookAuthBtn').click();
    await expect.poll(() => page.evaluate(() => window.__OAUTH_CALLS__.length)).toBe(1);
    const call = await page.evaluate(() => window.__OAUTH_CALLS__[0]);
    expect(call.provider).toBe('facebook');
  });

  test('shows an error and re-enables the button if the provider call fails', async ({ page }) => {
    await page.addInitScript(() => {
      window.__AUTH_OAUTH_SEED__ = { oauthError: 'Unsupported provider: provider is not enabled' };
    });
    await loadPageWithMock(page, 'cookzer-auth.html', 'auth-oauth.js');
    await page.locator('#googleAuthBtn').click();
    await expect(page.locator('#message')).toContainText('provider is not enabled');
    await expect(page.locator('#googleAuthBtn')).toBeEnabled();
  });

  test('the Cookzer logo links back to the marketing home page', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-auth.html', 'auth-oauth.js');
    await expect(page.locator('.brand')).toHaveAttribute('href', 'index.html');
  });
});
