const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// theme.js sets --cz-viewport-inset-fix from window.visualViewport before
// first paint. On a real Android device that reported the bug, .main's
// scrollHeight and clientHeight were exactly equal — the WebView genuinely
// believed there was nothing left to scroll, because window.innerHeight
// included pixels actually covered by the system nav bar. That ruled out
// two earlier fixes gated behind "is this the native app" detection
// (window.Capacitor.isNativePlatform(), then a WebView user-agent check) —
// a follow-up diagnostic showed both returning false on that device, so
// neither ever fired. visualViewport measures the truly-visible area
// directly and needs no such detection.
//
// A real browser never has a genuine gap between window.innerHeight and
// window.visualViewport.height, so it's mocked here via an init script —
// window.visualViewport is read-only in real browsers, hence
// Object.defineProperty rather than a plain assignment.
function mockViewportGap(gapPx, offsetTopPx) {
  return `
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: Object.assign(Object.create(EventTarget.prototype), {
        height: window.innerHeight - ${gapPx},
        width: window.innerWidth,
        offsetTop: ${offsetTopPx || 0},
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  `;
}

test.describe('visualViewport-based safe-area fix', () => {
  test('a real gap between innerHeight and visualViewport widens .main padding-bottom', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', mockViewportGap(48));
    const fixVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cz-viewport-inset-fix').trim());
    expect(fixVar).toBe('48px');
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.main')).paddingBottom);
    expect(padding).toBe('48px');
  });

  test('no gap (the normal case, every real browser) leaves the small 24px fallback untouched', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    const fixVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cz-viewport-inset-fix').trim());
    expect(fixVar).toBe('0px');
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.main')).paddingBottom);
    expect(padding).toBe('24px');
  });

  test('a gap smaller than 24px does not shrink the existing fallback', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', mockViewportGap(10));
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.main')).paddingBottom);
    expect(padding).toBe('24px');
  });

  test('also widens the feed page\'s .feed-container scroll pane', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js', mockViewportGap(48));
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.feed-container')).paddingBottom);
    expect(padding).toBe('48px');
  });

  test('also widens the mobile sidebar drawer', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-cookbook.html', 'cookbook-tags.js', mockViewportGap(48));
    const padding = await page.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).paddingBottom);
    expect(padding).toBe('48px');
  });

  test('the fix actually restores true scrollability — scrolling to the bottom reaches the real end', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', mockViewportGap(48));
    await page.waitForTimeout(100);
    const info = await page.evaluate(() => {
      const main = document.querySelector('.main');
      main.scrollTop = 999999;
      return { scrollTop: main.scrollTop, scrollHeight: main.scrollHeight, clientHeight: main.clientHeight };
    });
    expect(info.scrollTop + info.clientHeight).toBeGreaterThanOrEqual(info.scrollHeight - 1);
  });

  test('a gap that is actually a status-bar overlap at the top (visualViewport.offsetTop > 0) grows .header instead of .main padding-bottom', async ({ page }) => {
    // Reported after the nav-bar fix shipped: on one device the status bar
    // still overlapped the header, even though the native
    // decorFitsSystemWindows fix was supposed to reserve that space too.
    // A pure top overlap reports the same innerHeight/visualViewport.height
    // gap as the nav-bar case, but visualViewport.offsetTop says where it
    // actually is — here, entirely at the top.
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', mockViewportGap(32, 32));
    const topVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cz-viewport-inset-fix-top').trim());
    expect(topVar).toBe('32px');
    const bottomVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cz-viewport-inset-fix').trim());
    expect(bottomVar).toBe('0px');
    const header = await page.evaluate(() => getComputedStyle(document.querySelector('.header')));
    expect(header.height).toBe('92px');
    expect(header.paddingTop).toBe('32px');
    const mainMarginTop = await page.evaluate(() => getComputedStyle(document.querySelector('.main')).marginTop);
    expect(mainMarginTop).toBe('92px');
  });

  test('a gap split between top and bottom (status bar and nav bar both overlapping) attributes each portion correctly', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', mockViewportGap(48, 20));
    const topVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cz-viewport-inset-fix-top').trim());
    expect(topVar).toBe('20px');
    const bottomVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cz-viewport-inset-fix').trim());
    expect(bottomVar).toBe('28px');
  });
});
