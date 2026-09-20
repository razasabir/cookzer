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
