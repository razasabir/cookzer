const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Google and Facebook block OAuth sign-in inside an app's own embedded
// WebView, so inside the Android/iOS app (window.Capacitor present) the
// flow opens in the system browser instead and returns via a deep link
// (com.cookzer.app://auth-callback), caught by @capacitor/app's
// appUrlOpen listener. tests/mocks/auth-oauth-native.js stubs that native
// bridge so these can run without a real device.
test.describe('OAuth sign-in inside the native app', () => {
  test('opens the system browser instead of navigating the WebView away', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-auth.html', 'auth-oauth-native.js');
    await page.locator('#googleAuthBtn').click();

    await expect.poll(() => page.evaluate(() => window.__OAUTH_CALLS__.length)).toBe(1);
    const call = await page.evaluate(() => window.__OAUTH_CALLS__[0]);
    expect(call.provider).toBe('google');
    expect(call.options.redirectTo).toBe('com.cookzer.app://auth-callback');
    expect(call.options.skipBrowserRedirect).toBe(true);

    await expect.poll(() => page.evaluate(() => window.__BROWSER_OPEN_CALLS__.length)).toBe(1);
    const opened = await page.evaluate(() => window.__BROWSER_OPEN_CALLS__[0]);
    expect(opened.url).toBe('https://accounts.google.com/o/oauth2/fake-auth-url');
    await expect(page.locator('#googleAuthBtn')).toBeEnabled();
  });

  test('the app reopening via the deep link exchanges the code and lands on the feed', async ({ page }) => {
    const exchanged = [];
    // Survives the navigation to cookzer-feed.html, unlike a page global.
    await page.exposeFunction('__logExchange', (code) => exchanged.push(code));
    await loadPageWithMock(page, 'cookzer-auth.html', 'auth-oauth-native.js');
    await page.evaluate(() => window.__simulateAppUrlOpen('com.cookzer.app://auth-callback?code=abc123'));

    await page.waitForURL(/cookzer-feed\.html$/);
    expect(exchanged).toEqual(['abc123']);
  });

  test('an error exchanging the code shows a message instead of navigating', async ({ page }) => {
    await page.addInitScript(() => {
      window.__AUTH_OAUTH_SEED__ = { exchangeError: 'invalid or expired code' };
    });
    await loadPageWithMock(page, 'cookzer-auth.html', 'auth-oauth-native.js');
    await page.evaluate(() => window.__simulateAppUrlOpen('com.cookzer.app://auth-callback?code=abc123'));

    await expect(page.locator('#message')).toContainText('invalid or expired code');
    expect(page.url()).toContain('cookzer-auth.html');
  });
});
