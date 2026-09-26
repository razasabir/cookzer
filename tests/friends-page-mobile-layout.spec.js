const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// The Following/Followers/Friends/Requests/Blocked tab row had gap: 8px
// on the flex row AND margin-right: 20px on every .tab-btn — both rules
// applying spacing at once, overflowing the row at a phone width.
//
// That overflow didn't show up as page-level horizontal scroll: .main
// only sets overflow-y: auto, but per the CSS overflow spec, setting one
// axis to anything but visible forces the other axis's *used* value to
// auto too when it would otherwise be visible — so .main silently became
// its own horizontally-scrollable region, swallowing the tab row's
// overflow instead of the document. That's a scroll gesture nothing
// prompts a user to try (its neighbor is a vertical list), which is
// exactly why "Requests" and "Blocked" read as cut off with no visible
// way to reach them, even though document.documentElement.scrollWidth
// (and page.locator(...).scrollIntoViewIfNeeded(), which will silently
// scroll *any* ancestor) both stayed clean throughout.
test.describe('Friends page — mobile layout', () => {
  test('the main content pane has no hidden horizontal scroll region at a phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    const metrics = await page.locator('.main').evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  });

  test('the tabs row itself is the (intentional) horizontally-scrollable element, not clipped', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    const overflowX = await page.locator('.tabs-row').evaluate((el) => getComputedStyle(el).overflowX);
    expect(overflowX).toBe('auto');
  });

  test('scrolling the tabs row by touch reaches and can select the last tab (Blocked)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');

    // Scroll only .tabs-row directly (not via scrollIntoViewIfNeeded,
    // which would scroll any ancestor and mask the original bug) to
    // mirror an actual swipe on the tab strip itself.
    await page.locator('.tabs-row').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await expect(page.locator('#blockedTab')).toBeInViewport();
    await page.click('#blockedTab');
    await expect(page.locator('#blockedTab')).toHaveClass(/active/);
  });
});
