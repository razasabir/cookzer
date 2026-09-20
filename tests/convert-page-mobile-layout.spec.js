const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// This page was missing two things every other page has: (1) the
// off-canvas drawer sidebar media query, so the full 280px desktop
// sidebar tried to render on a phone width; (2) the hidden native
// <select> that backs the custom unit picker (kept in the DOM for its
// value, collapsed to a point visually) was actually rendering at full
// width, because ".convert-field select { width: 100% }" outranks a
// bare ".unit-native-select" on CSS specificity. Together these blew
// the page out to roughly double a phone's width.
test.describe('Convert page — mobile layout', () => {
  test('no horizontal overflow at a phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  });

  test('the sidebar is off-canvas (hamburger menu) rather than docked, at a phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await expect(page.locator('.menu-toggle')).toBeVisible();
    const sidebarLeft = await page.locator('.sidebar').evaluate((el) => getComputedStyle(el).left);
    expect(sidebarLeft).toBe('-280px');
  });

  test('the hidden native <select> backing the unit picker stays collapsed, not full width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    const width = await page.locator('#convertFrom').evaluate((el) => parseFloat(getComputedStyle(el).width));
    expect(width).toBeLessThan(10);
  });
});
