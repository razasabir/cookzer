const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Inline unit converter on recipe ingredients', () => {
  test('a quantity with a recognized unit is marked convertible; one without a unit is not', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe.html?id=r1', 'recipe-inline-convert.js');
    await expect(page.locator('.ingredient-row', { hasText: 'Spaghetti' }).locator('.qty')).toHaveClass(/convertible/);
    await expect(page.locator('.ingredient-row', { hasText: 'Black pepper' }).locator('.qty')).not.toHaveClass(/convertible/);
  });

  test('clicking a convertible quantity opens a popover with alternate units', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe.html?id=r1', 'recipe-inline-convert.js');
    await page.locator('.ingredient-row', { hasText: 'Spaghetti' }).locator('.qty').click();
    const popover = page.locator('.qty-convert-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('kg');
    await expect(popover).toContainText('oz');
  });

  test('cross-category (mass<->volume) alternates show up for an ingredient with known density', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe.html?id=r1', 'recipe-inline-convert.js');
    // "Butter" has a known density in unit-convert.js, so its volume qty
    // ("1/2 cup") should offer a gram reading too.
    await page.locator('.ingredient-row', { hasText: 'Butter' }).locator('.qty').click();
    await expect(page.locator('.qty-convert-popover')).toContainText('g');
  });

  test('clicking the same quantity again closes the popover', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe.html?id=r1', 'recipe-inline-convert.js');
    const qty = page.locator('.ingredient-row', { hasText: 'Spaghetti' }).locator('.qty');
    await qty.click();
    await expect(page.locator('.qty-convert-popover')).toBeVisible();
    await qty.click();
    await expect(page.locator('.qty-convert-popover')).toHaveCount(0);
  });

  test('clicking outside the popover closes it', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe.html?id=r1', 'recipe-inline-convert.js');
    await page.locator('.ingredient-row', { hasText: 'Spaghetti' }).locator('.qty').click();
    await expect(page.locator('.qty-convert-popover')).toBeVisible();
    await page.locator('#rTitle').click();
    await expect(page.locator('.qty-convert-popover')).toHaveCount(0);
  });

  test('the popover still reflects the current (rescaled) quantity, not the original', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe.html?id=r1', 'recipe-inline-convert.js');
    await page.click('#scaleUpBtn'); // 4 -> 5 servings, 400g -> 500g
    const qty = page.locator('.ingredient-row', { hasText: 'Spaghetti' }).locator('.qty');
    await expect(qty).toContainText('500');
    await qty.click();
    await expect(page.locator('.qty-convert-popover')).toContainText('0.5 kg');
  });
});
