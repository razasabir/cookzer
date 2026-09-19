const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Convert page — category tabs', () => {
  test('Unit Converter is the default tab; switching shows the other panels', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await expect(page.locator('.convert-panel[data-panel="units"]')).toBeVisible();
    await expect(page.locator('.convert-panel[data-panel="pans"]')).toBeHidden();
    await expect(page.locator('.convert-panel[data-panel="oven"]')).toBeHidden();

    await page.click('.convert-tab[data-tab="pans"]');
    await expect(page.locator('.convert-panel[data-panel="pans"]')).toBeVisible();
    await expect(page.locator('.convert-panel[data-panel="units"]')).toBeHidden();
    await expect(page.locator('.convert-tab[data-tab="pans"]')).toHaveClass(/active/);

    await page.click('.convert-tab[data-tab="oven"]');
    await expect(page.locator('.convert-panel[data-panel="oven"]')).toBeVisible();
    await expect(page.locator('.convert-panel[data-panel="pans"]')).toBeHidden();
  });
});

test.describe('Convert page — fill graphic', () => {
  test('a volume result shows a fill graphic with a matching caption', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.fill('#convertAmount', '550');
    await page.selectOption('#convertFrom', 'g');
    await page.fill('#convertIngredient', 'sugar');
    // 550g sugar / 200g-per-cup = 2.75 cups.
    await expect(page.locator('#convertResultValue')).toContainText('2.75 cup');
    await expect(page.locator('#fillGraphicWrap')).toBeVisible();
    await expect(page.locator('#fillGraphicSvg svg')).toBeVisible();
    await expect(page.locator('#fillGraphicCaption')).toContainText('75% full');
    await expect(page.locator('#fillGraphicCaption')).toContainText('2 more full cups');
  });

  test('a mass ("to") result hides the fill graphic — no intuitive fill picture for a scale reading', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.fill('#convertAmount', '400');
    await page.selectOption('#convertFrom', 'g');
    await page.selectOption('#convertTo', 'kg');
    await expect(page.locator('#convertResultValue')).toContainText('400 g = 0.4 kg');
    await expect(page.locator('#fillGraphicWrap')).toBeHidden();
  });
});

test.describe('Convert page — pan quick picker', () => {
  test('tapping a pan icon filters the list to that pan; reset shows all again', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    await expect(page.locator('.pan-size-card')).toHaveCount(7);
    await expect(page.locator('#panPickerReset')).toBeHidden();

    const bundtIcon = page.locator('.pan-picker-btn').nth(5); // 6th entry = 10" Bundt Pan
    await bundtIcon.click();
    await expect(bundtIcon).toHaveClass(/active/);
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(1);
    await expect(page.locator('.pan-size-card:visible')).toContainText('Bundt Pan');
    await expect(page.locator('#panPickerReset')).toBeVisible();

    await page.click('#panPickerReset');
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(7);
    await expect(bundtIcon).not.toHaveClass(/active/);
  });

  test('tapping the same active icon again also resets the filter', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    const squareIcon = page.locator('.pan-picker-btn').first();
    await squareIcon.click();
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(1);
    await squareIcon.click();
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(7);
  });
});

test.describe('Convert page — oven temperatures', () => {
  test('editing °F live-updates °C, the thermometer, and the descriptor', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="oven"]');
    await expect(page.locator('#ovenC')).toHaveValue('177');
    await expect(page.locator('#ovenDescriptor')).toContainText('Moderate');

    await page.fill('#ovenF', '425');
    await expect(page.locator('#ovenC')).toHaveValue('218');
    await expect(page.locator('#ovenDescriptor')).toContainText('Hot');
    await expect(page.locator('#ovenThermoWrap svg')).toBeVisible();
  });

  test('editing °C live-updates °F', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="oven"]');
    await page.fill('#ovenC', '260');
    await expect(page.locator('#ovenF')).toHaveValue('500');
    await expect(page.locator('#ovenDescriptor')).toContainText('Broil');
  });

  test('the reference list shows all 7 common oven temperatures with a thermometer each', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="oven"]');
    await expect(page.locator('.oven-row')).toHaveCount(7);
    await expect(page.locator('.oven-row').first()).toContainText('Very Low');
    await expect(page.locator('.oven-row').first()).toContainText('250°F / 121°C');
    await expect(page.locator('.oven-row svg')).toHaveCount(7);
  });
});
