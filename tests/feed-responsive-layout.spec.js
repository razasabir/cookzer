const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// A phone's landscape width (e.g. a 412x915 portrait phone becomes
// 915x412 rotated) used to land in the gap between the old off-canvas
// drawer breakpoint (768px) and the width the docked desktop sidebar's
// header content actually needs (~993px) — the header would overflow
// past the right edge of the screen, and since it's position:absolute
// off the initial containing block rather than a clipped ancestor, the
// overflow wasn't contained by body's overflow:hidden either. Rotating
// back to portrait didn't self-heal on a real device: the page keeps
// whatever horizontal scroll offset the overflow produced.
test.describe('Feed — responsive layout across rotation', () => {
  test('no horizontal overflow at a phone landscape width', async ({ page }) => {
    await page.setViewportSize({ width: 915, height: 412 });
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowing).toBe(false);
  });

  test('rotating landscape then back to portrait leaves no residual overflow', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');

    await page.setViewportSize({ width: 915, height: 412 });
    await page.setViewportSize({ width: 412, height: 915 });

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  });

  test('the off-canvas drawer sidebar (not the docked desktop layout) still applies at a phone landscape width', async ({ page }) => {
    await page.setViewportSize({ width: 915, height: 412 });
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    await expect(page.locator('.menu-toggle')).toBeVisible();
    const headerLeft = await page.locator('.header').evaluate((el) => getComputedStyle(el).left);
    expect(headerLeft).toBe('0px');
  });
});

// On a wide monitor the app used to stretch edge-to-edge — the left
// sidebar sat flush against the browser's left edge, with everything
// else stretching to fill however wide the window happened to be. Real
// social apps (Facebook, etc.) cap their content width and center it,
// leaving symmetric margins on both sides instead.
test.describe('Feed — capped and centered on wide screens', () => {
  test('leaves equal margins on both sides past the app\'s max width', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    const metrics = await page.evaluate(() => {
      const b = document.body.getBoundingClientRect();
      return { left: b.left, right: window.innerWidth - b.right, width: b.width };
    });
    expect(metrics.left).toBeGreaterThan(0);
    expect(Math.abs(metrics.left - metrics.right)).toBeLessThan(1);
  });

  test('still fills the full width on an ordinary laptop screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    const bodyWidth = await page.evaluate(() => document.body.getBoundingClientRect().width);
    expect(bodyWidth).toBe(1280);
  });

  // The feed column and right sidebar used to be centered together as
  // one block within .main, which left a wide dead-space gap between
  // the right sidebar and the header's right edge instead of the
  // sidebar sitting flush against it (Facebook's own right rail always
  // touches the frame's edge, with generous padding around the middle
  // column instead).
  test('the right sidebar sits flush against the header\'s right edge, not centered with dead space beside it', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    const rects = await page.evaluate(() => ({
      headerRight: document.querySelector('.header').getBoundingClientRect().right,
      rightSidebarRight: document.querySelector('.right-sidebar').getBoundingClientRect().right,
    }));
    expect(Math.abs(rects.headerRight - rects.rightSidebarRight)).toBeLessThan(1);
  });

  test('the feed column widened and centers within the space left of the right sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-filter-bar.js');
    const rects = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
      const feed = document.querySelector('.feed-container').getBoundingClientRect();
      const right = document.querySelector('.right-sidebar').getBoundingClientRect();
      return { leftGap: feed.left - sidebar.right, rightGap: right.left - feed.right, feedWidth: feed.width };
    });
    expect(rects.feedWidth).toBeGreaterThan(600);
    expect(Math.abs(rects.leftGap - rects.rightGap)).toBeLessThan(1);
  });
});
