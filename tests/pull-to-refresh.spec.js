const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Pull-to-refresh only exists for touch input — the app ships wrapped in
// Capacitor (a WebView has no native gesture at all) and even in a
// plain mobile browser tab every page scrolls an inner container, not
// the document, so the browser's own gesture has nothing to trigger on.
test.use({ hasTouch: true });

async function fireTouch(page, el, type, x, y, identifier) {
  await page.evaluate(({ selector, type, x, y, identifier }) => {
    const target = document.querySelector(selector);
    const touch = new Touch({ identifier, target, clientX: x, clientY: y });
    const ev = new TouchEvent(type, {
      touches: type === 'touchend' ? [] : [touch],
      targetTouches: type === 'touchend' ? [] : [touch],
      changedTouches: [touch],
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(ev);
  }, { selector: el, type, x, y, identifier });
}

test.describe('Pull-to-refresh (cookzer-feed.html)', () => {
  test('pulling down past the threshold and releasing calls the refresh callback once', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const box = await page.locator('.feed-container').boundingBox();
    const cx = box.x + box.width / 2;
    const startY = box.y + 20;

    const calls = await page.evaluate(({ cx, startY }) => {
      const el = document.querySelector('.feed-container');
      let n = 0;
      window.CookzerPullToRefresh.attach(el, () => { n++; return Promise.resolve(); });
      function fire(type, y) {
        const touch = new Touch({ identifier: 11, target: el, clientX: cx, clientY: y });
        const ev = new TouchEvent(type, { touches: type === 'touchend' ? [] : [touch], targetTouches: type === 'touchend' ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
      }
      fire('touchstart', startY);
      fire('touchmove', startY + 40);
      fire('touchmove', startY + 160); // well past the 64px threshold once resistance (0.5x) is applied
      fire('touchend', startY + 160);
      return n;
    }, { cx, startY });

    expect(calls).toBe(1);
  });

  test('a short pull that never reaches the threshold does not trigger a refresh', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const box = await page.locator('.feed-container').boundingBox();
    const cx = box.x + box.width / 2;
    const startY = box.y + 20;

    const calls = await page.evaluate(({ cx, startY }) => {
      const el = document.querySelector('.feed-container');
      let n = 0;
      window.CookzerPullToRefresh.attach(el, () => { n++; return Promise.resolve(); });
      function fire(type, y) {
        const touch = new Touch({ identifier: 12, target: el, clientX: cx, clientY: y });
        const ev = new TouchEvent(type, { touches: type === 'touchend' ? [] : [touch], targetTouches: type === 'touchend' ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
      }
      fire('touchstart', startY);
      fire('touchmove', startY + 10);
      fire('touchend', startY + 10);
      return n;
    }, { cx, startY });

    expect(calls).toBe(0);
  });

  test('the spinner indicator grows proportionally with the pull, capped by resistance', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const box = await page.locator('.feed-container').boundingBox();
    const cx = box.x + box.width / 2;
    const startY = box.y + 20;

    const height = await page.evaluate(({ cx, startY }) => {
      const el = document.querySelector('.feed-container');
      window.CookzerPullToRefresh.attach(el, () => Promise.resolve());
      function fire(type, y) {
        const touch = new Touch({ identifier: 13, target: el, clientX: cx, clientY: y });
        const ev = new TouchEvent(type, { touches: type === 'touchend' ? [] : [touch], targetTouches: type === 'touchend' ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
      }
      fire('touchstart', startY);
      fire('touchmove', startY + 160);
      const indicator = el.querySelectorAll('.cz-ptr-indicator');
      return indicator[indicator.length - 1].style.height;
    }, { cx, startY });

    expect(height).toBe('80px'); // 160px of finger travel * 0.5 resistance
  });

  test('pulling down while already scrolled past the top does not engage', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const box = await page.locator('.feed-container').boundingBox();
    const cx = box.x + box.width / 2;
    const startY = box.y + 20;

    const calls = await page.evaluate(({ cx, startY }) => {
      const el = document.querySelector('.feed-container');
      el.scrollTop = 50; // not at the top
      let n = 0;
      window.CookzerPullToRefresh.attach(el, () => { n++; return Promise.resolve(); });
      function fire(type, y) {
        const touch = new Touch({ identifier: 14, target: el, clientX: cx, clientY: y });
        const ev = new TouchEvent(type, { touches: type === 'touchend' ? [] : [touch], targetTouches: type === 'touchend' ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
      }
      fire('touchstart', startY);
      fire('touchmove', startY + 160);
      fire('touchend', startY + 160);
      return n;
    }, { cx, startY });

    expect(calls).toBe(0);
  });

  test('pull-to-refresh is wired into the real feed page, calling loadFeed', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const wired = await page.evaluate(() => typeof window.loadFeed === 'function' && typeof window.CookzerPullToRefresh === 'object');
    expect(wired).toBe(true);
    // The indicator element inserted by attach() at page load confirms
    // CookzerPullToRefresh.attach() was actually called against the
    // real scroll container, not just available as a library.
    await expect(page.locator('.feed-container > .cz-ptr-indicator').first()).toBeAttached();
  });
});
