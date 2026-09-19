const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// "My Recipes" already had a "Filter by hashtag" row, but it only read
// the saver's own personal tags (saved_recipes.tags) — the recipe
// author's own free-text tags (recipes.tags, what the feed's tag filter
// chips read) weren't part of it at all. Now both feed the same row.
test.describe('My Recipes — filter by hashtag (personal + recipe-authored tags)', () => {
  test('the hashtag row is the union of personal tags and the recipes\' own tags', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-cookbook.html', 'cookbook-tags.js');
    const chips = page.locator('.hashtag-chip');
    await expect(chips).toHaveCount(4);
    await expect(page.locator('.hashtag-chip', { hasText: '#comfort' })).toHaveCount(1); // personal
    await expect(page.locator('.hashtag-chip', { hasText: '#weekend' })).toHaveCount(1); // personal
    await expect(page.locator('.hashtag-chip', { hasText: '#quick' })).toHaveCount(1); // recipe-authored
    await expect(page.locator('.hashtag-chip', { hasText: '#weeknight' })).toHaveCount(1); // recipe-authored
  });

  test('clicking a recipe-authored tag narrows to every saved recipe carrying it, even across different savers\' personal tags', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-cookbook.html', 'cookbook-tags.js');
    await page.click('.hashtag-chip:has-text("#quick")');
    await expect(page.locator('.hashtag-chip:has-text("#quick")')).toHaveClass(/active/);
    const items = page.locator('.recipe-item');
    await expect(items).toHaveCount(2);
    await expect(items).toContainText(['Lemon Herb Chicken', 'Garlic Naan']);
  });

  test('clicking a personal-only tag still narrows correctly (no regression)', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-cookbook.html', 'cookbook-tags.js');
    await page.click('.hashtag-chip:has-text("#weekend")');
    await expect(page.locator('.recipe-item')).toHaveCount(1);
    await expect(page.locator('.recipe-item')).toContainText('Lemon Herb Chicken');
  });

  test('a personal tag on a recipe with no author tags of its own still filters fine', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-cookbook.html', 'cookbook-tags.js');
    await page.click('.hashtag-chip:has-text("#comfort")');
    await expect(page.locator('.recipe-item')).toHaveCount(1);
    await expect(page.locator('.recipe-item')).toContainText('Beef Stew');
  });

  test('clicking the same tag again clears the filter', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-cookbook.html', 'cookbook-tags.js');
    await page.click('.hashtag-chip:has-text("#quick")');
    await expect(page.locator('.recipe-item')).toHaveCount(2);
    await page.click('.hashtag-chip:has-text("#quick")');
    await expect(page.locator('.hashtag-chip:has-text("#quick")')).not.toHaveClass(/active/);
    await expect(page.locator('.recipe-item')).toHaveCount(3);
  });
});
