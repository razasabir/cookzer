const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// theme.js stamps <html data-native-app> before first paint when running
// inside the packaged Android/iOS app — never on the real website. Detected
// two independent ways: window.Capacitor.isNativePlatform() (which isn't
// guaranteed to fire for an app pointed at a remote URL rather than bundled
// assets) and Android's own "wv" user-agent marker for an embedded WebView
// (needs no bridge injection at all). styles.css gives scroll containers a
// much bigger safe-area-inset-bottom fallback under that attribute, since a
// WebView that doesn't resolve env(safe-area-inset-bottom) to a real value
// still left content hidden behind the system nav bar even with the
// smaller per-page padding-bottom fallback alone.
const NATIVE_INIT = 'window.Capacitor = { isNativePlatform: () => true };';
const ANDROID_WEBVIEW_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.0.0 Mobile Safari/537.36';
const ANDROID_CHROME_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36';

test.describe('Native-app safe-area fallback', () => {
  test('stamps data-native-app and widens .main padding-bottom inside the packaged app', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', NATIVE_INIT);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-native-app'))).toBe(true);
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.main')).paddingBottom);
    expect(padding).toBe('72px');
  });

  test('leaves the website unaffected — no attribute, small fallback stays', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-native-app'))).toBe(false);
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.main')).paddingBottom);
    expect(padding).toBe('24px');
  });

  test('also widens the feed page\'s .feed-container scroll pane', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js', NATIVE_INIT);
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.feed-container')).paddingBottom);
    expect(padding).toBe('72px');
  });

  test('also widens the mobile sidebar drawer', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-cookbook.html', 'cookbook-tags.js', NATIVE_INIT);
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).paddingBottom);
    expect(padding).toBe('72px');
  });

  test('detects an embedded Android WebView by user-agent alone, with no window.Capacitor at all', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: ANDROID_WEBVIEW_UA });
    const page = await ctx.newPage();
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-native-app'))).toBe(true);
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.main')).paddingBottom);
    expect(padding).toBe('72px');
    await ctx.close();
  });

  test('a real Android Chrome tab (no "wv" marker) is not mistaken for the app', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: ANDROID_CHROME_UA });
    const page = await ctx.newPage();
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-native-app'))).toBe(false);
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.main')).paddingBottom);
    expect(padding).toBe('24px');
    await ctx.close();
  });
});
