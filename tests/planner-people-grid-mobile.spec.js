const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// The per-person suggestion row used to be a horizontally scrolling strip
// (overflow-x: auto, flex-nowrap) — on a phone, only the first 2-3 people
// were visible and the rest were clipped with no obvious way to reach
// them (reported directly: "I should be able to see all members in one
// go"). It's now a responsive grid that wraps every member into view,
// approved via a mockup before this change.
test.describe('Meal planner — per-person grid at a phone width', () => {
  test('every household member is visible at once, with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');

    const row = page.locator('.planner-people-row').first();
    await expect(row).toHaveCSS('display', 'grid');

    const metrics = await row.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

    // household_size 3 in the shared mock: You + Emma + 1 ghost column.
    const cols = row.locator('.planner-person-col');
    await expect(cols).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(cols.nth(i)).toBeInViewport();
    }
  });

  test('a larger household (6 people) still fits with no horizontal scroll — just more rows', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', `window.__TEST_HOUSEHOLD_SIZE__ = 6;`);

    const row = page.locator('.planner-people-row').first();
    const cols = row.locator('.planner-person-col');
    await expect(cols).toHaveCount(6); // You + Emma + 4 ghosts

    const metrics = await row.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

    // Wrapped onto more than one row, not one wide unscrollable line.
    const tops = await cols.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    expect(new Set(tops).size).toBeGreaterThan(1);
  });
});
