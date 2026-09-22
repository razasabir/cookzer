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

// Every other authenticated content page gets the same treatment — this
// just confirms attach() was actually called against each page's real
// scroll container (the .cz-ptr-indicator it inserts is proof), not that
// the touch-gesture mechanics themselves work (already covered above
// against the shared module directly). Skipped: cookzer-auth.html and
// cookzer-privacy.html (no data to refresh), index.html (unauthenticated
// landing page), cookzer-recipe-new.html (a multi-step wizard — reloading
// would discard whatever the author hasn't saved yet), cookzer-settings.html
// (a big edit form with the same unsaved-changes risk), cookzer-pantry.html
// (mounts an AI chat widget with no safe reload — remounting risks losing
// the conversation), and cookzer-list.html (no test mock exists yet for it).
test.describe('Pull-to-refresh — wired into every other content page', () => {
  const pages = [
    { url: 'cookzer-cookbook.html', mock: 'cookbook-tags.js', selector: '.main' },
    { url: 'cookzer-group.html', mock: 'group-admin.js', selector: '.main', extraQuery: '?id=g1' },
    { url: 'cookzer-friends.html', mock: 'friends-page.js', selector: '.main' },
    { url: 'cookzer-recipe.html?id=r1', mock: 'recipe-page.js', selector: '.main' },
    { url: 'cookzer-planner.html', mock: 'planner-family.js', selector: '.main' },
    { url: 'cookzer-challenges.html', mock: 'challenges-page.js', selector: '.main' },
    { url: 'cookzer-health.html', mock: 'ai-chat.js', selector: '.main' },
    { url: 'cookzer-notifications.html', mock: 'notifications-page.js', selector: '.main' },
    { url: 'cookzer-messenger.html', mock: 'profile-activity.js', selector: '.msg-list' },
    { url: 'cookzer-restaurant.html?id=rest-1', mock: 'restaurant-detail.js', selector: '.main' },
    { url: 'cookzer-restaurant-claims.html', mock: 'restaurant-claims-admin.js', selector: '.main' },
    { url: 'cookzer-group-polls.html', mock: 'group-polls.js', selector: '.main', extraQuery: '?id=g1' },
    { url: 'cookzer-group-events.html', mock: 'group-events.js', selector: '.main', extraQuery: '?id=g1' },
    { url: 'cookzer-groups.html', mock: 'groups-private.js', selector: '.main' },
    { url: 'cookzer-group-challenges.html', mock: 'group-challenges.js', selector: '.main', extraQuery: '?id=group-1' },
    { url: 'cookzer-restaurants.html', mock: 'restaurants-listing.js', selector: '.main' },
    { url: 'cookzer-profile.html', mock: 'profile-page.js', selector: '.main' },
  ];

  for (const { url, mock, selector, extraQuery } of pages) {
    test(`${url} attaches pull-to-refresh to ${selector}`, async ({ page }) => {
      await loadPageWithMock(page, url, mock);
      if (extraQuery) await page.goto(page.url() + extraQuery);
      await expect(page.locator(selector + ' > .cz-ptr-indicator').first()).toBeAttached();
    });
  }
});
