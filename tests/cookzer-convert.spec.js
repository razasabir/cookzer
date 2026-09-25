const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Convert tool page', () => {
  test('converts grams to cups for a known ingredient by default inputs', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    // Defaults: amount 1, from g, to cup, no ingredient — cross-category
    // needs an ingredient, so it should prompt for one rather than guess.
    await expect(page.locator('#convertResultValue')).toContainText('Enter an ingredient');

    await page.fill('#convertAmount', '200');
    await page.fill('#convertIngredient', 'sugar');
    await expect(page.locator('#convertResultValue')).toContainText('200 grams = 1 cup');
  });

  test('same-category conversion works without an ingredient', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.fill('#convertAmount', '400');
    await page.selectOption('#convertFrom', 'g');
    await page.selectOption('#convertTo', 'kg');
    await expect(page.locator('#convertResultValue')).toContainText('400 grams = 0.4 kilograms');
  });

  test('the result headline spells out unit names instead of ambiguous codes (e.g. "l" reading as "1")', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.fill('#convertAmount', '100');
    await page.selectOption('#convertFrom', 'kg');
    await page.selectOption('#convertTo', 'l');
    await page.fill('#convertIngredient', 'butter');
    await expect(page.locator('#convertResultValue')).toContainText('100 kilograms = 104.22 liters');
  });

  test('the swap button exchanges the from/to units', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.selectOption('#convertFrom', 'tbsp');
    await page.selectOption('#convertTo', 'tsp');
    await page.click('#convertSwapBtn');
    expect(await page.locator('#convertFrom').inputValue()).toBe('tsp');
    expect(await page.locator('#convertTo').inputValue()).toBe('tbsp');
  });

  test('an unrecognized amount shows a helpful message instead of NaN', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.fill('#convertAmount', '');
    await expect(page.locator('#convertResultValue')).toContainText('Enter an amount');
  });
});
