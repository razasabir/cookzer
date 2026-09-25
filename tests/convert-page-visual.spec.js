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
    await expect(page.locator('#fillGraphicCaption')).toHaveText('2 and ¾ cups');
  });

  test('a mass ("to") result hides the fill graphic — no intuitive fill picture for a scale reading', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.fill('#convertAmount', '400');
    await page.selectOption('#convertFrom', 'g');
    await page.selectOption('#convertTo', 'kg');
    await expect(page.locator('#convertResultValue')).toContainText('400 grams = 0.4 kilograms');
    await expect(page.locator('#fillGraphicWrap')).toBeHidden();
  });

  test('a clean whole number greater than one gets a multiplier sign', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.fill('#convertAmount', '6');
    await page.selectOption('#convertFrom', 'tsp');
    await page.selectOption('#convertTo', 'tbsp');
    await expect(page.locator('#fillGraphicCaption')).toHaveText('×2 tablespoons');
  });

  test('a half amount spells out the whole and the half separately', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.fill('#convertAmount', '1.5');
    await page.selectOption('#convertFrom', 'tsp');
    await page.selectOption('#convertTo', 'tsp');
    await expect(page.locator('#fillGraphicCaption')).toHaveText('1 and ½ teaspoons');
  });
});

test.describe('Convert page — unit picker icons', () => {
  test('teaspoons and tablespoons get distinct icons, not a shared spoon', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.selectOption('#convertFrom', 'tsp');
    await page.selectOption('#convertTo', 'tbsp');
    const tspIcon = await page.locator('#convertFromTrigger svg').innerHTML();
    const tbspIcon = await page.locator('#convertToTrigger svg').innerHTML();
    expect(tspIcon).not.toBe(tbspIcon);
  });

  test('milliliters and liters get distinct icons, not a shared glass', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.selectOption('#convertFrom', 'ml');
    await page.selectOption('#convertTo', 'l');
    const mlIcon = await page.locator('#convertFromTrigger svg').innerHTML();
    const lIcon = await page.locator('#convertToTrigger svg').innerHTML();
    expect(mlIcon).not.toBe(lIcon);
  });

  test('clicking a row in the unit picker dropdown selects that unit', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('#convertFromTrigger');
    await expect(page.locator('#convertFromDropdown')).toBeVisible();
    await page.locator('#convertFromDropdown .unit-picker-row', { hasText: /^Liters/ }).click();
    expect(await page.locator('#convertFrom').inputValue()).toBe('l');
    await expect(page.locator('#convertFromTrigger')).toContainText('Liters');
    await expect(page.locator('#convertFromDropdown')).toBeHidden();
  });
});

test.describe('Convert page — pan quick picker', () => {
  test('tapping a pan icon filters the list to that pan; reset shows all again', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    await expect(page.locator('.pan-size-card')).toHaveCount(8);
    await expect(page.locator('#panPickerReset')).toBeHidden();

    const bundtIcon = page.locator('.pan-picker-btn').nth(5); // 6th entry = 10" Bundt Pan
    await bundtIcon.click();
    await expect(bundtIcon).toHaveClass(/active/);
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(1);
    await expect(page.locator('.pan-size-card:visible')).toContainText('Bundt Pan');
    await expect(page.locator('#panPickerReset')).toBeVisible();
    await expect(page.locator('.pan-size-card:visible')).toContainText('10" x 4" Bundt Pan');

    await page.click('#panPickerReset');
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(8);
    await expect(bundtIcon).not.toHaveClass(/active/);
  });

  test('tapping the same active icon again also resets the filter', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    const squareIcon = page.locator('.pan-picker-btn').first();
    await squareIcon.click();
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(1);
    await squareIcon.click();
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(8);
  });

  test('the pie plate is browsable as its own shape', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    await page.locator('.pan-picker-btn').nth(7).click(); // 8th entry = 9" Pie Plate
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(1);
    await expect(page.locator('.pan-size-card:visible')).toContainText('9" Pie Plate');
    await expect(page.locator('.pan-size-card:visible')).toContainText('4 cups');
  });

  test('tapping a pan card itself (not just its icon above) filters the list and loads the calculator', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');

    const loafCard = page.locator('.pan-size-card', { hasText: '9" x 5" x 3" Loaf' });
    await loafCard.click();
    await expect(loafCard).toHaveClass(/active/);
    await expect(page.locator('.pan-picker-btn').nth(6)).toHaveClass(/active/); // loaf icon
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(1);
    await expect(page.locator('#customPanShapeLabel')).toHaveText('Loaf');

    await loafCard.click();
    await expect(loafCard).not.toHaveClass(/active/);
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(8);
  });
});

test.describe('Convert page — custom pan calculator', () => {
  // Picker icon order matches PAN_SIZES: 0 square, 1 round, 2 rectangle,
  // 3 springform, 4 muffin, 5 bundt, 6 loaf, 7 pie (see the pan quick
  // picker tests above, which already rely on this same order for the
  // bundt icon).
  const ICON = { square: 0, round: 1, rectangle: 2, springform: 3, muffin: 4, bundt: 5, loaf: 6, pie: 7 };

  test('picking a shape has no separate dropdown — tapping a picker icon drives both the reference list and the calculator', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    await expect(page.locator('#customPanShape')).toHaveCount(0); // the old dropdown is gone

    // Round is the calculator's default shape before anything is tapped.
    await expect(page.locator('#customPanShapeLabel')).toHaveText('Round');

    await page.locator('.pan-picker-btn').nth(ICON.bundt).click();
    await expect(page.locator('#customPanShapeLabel')).toHaveText('Bundt / Tube');
    // The same tap also filtered the reference list above, same as before.
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(1);
  });

  test('each shape shows the right dimension fields, depth always included', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');

    // Round is the default shape.
    await expect(page.locator('#customPanDims label')).toHaveText(['Diameter (in)', 'Depth (in)']);

    await page.locator('.pan-picker-btn').nth(ICON.bundt).click();
    await expect(page.locator('#customPanDims label')).toHaveText(['Outer diameter (in)', 'Center tube diameter (in)', 'Depth (in)']);

    await page.locator('.pan-picker-btn').nth(ICON.muffin).click();
    await expect(page.locator('#customPanDims label')).toHaveText(['Cavity diameter (in)', 'Cavity depth (in)', 'Number of cavities']);

    await page.locator('.pan-picker-btn').nth(ICON.rectangle).click();
    await expect(page.locator('#customPanDims label')).toHaveText(['Length (in)', 'Width (in)', 'Depth (in)']);

    await page.locator('.pan-picker-btn').nth(ICON.springform).click();
    await expect(page.locator('#customPanDims label')).toHaveText(['Diameter (in)', 'Depth (in)']);

    await page.locator('.pan-picker-btn').nth(ICON.pie).click();
    await expect(page.locator('#customPanDims label')).toHaveText(['Top diameter (in)', 'Bottom diameter (in)', 'Depth (in)']);
  });

  test('leaving a dimension blank (including depth) shows the incomplete state, not a wrong number', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    await page.fill('#customPan_diameter', '8');
    // depth left blank
    await expect(page.locator('#customPanResult')).toHaveClass(/unavailable/);
    await expect(page.locator('#customPanResultValue')).toHaveText('Enter all the dimensions above');
  });

  test('computes a round pan\'s volume from diameter and depth, and names the closest standard pan', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    await page.fill('#customPan_diameter', '8');
    await page.fill('#customPan_depth', '2');

    await expect(page.locator('#customPanResult')).not.toHaveClass(/unavailable/);
    await expect(page.locator('#customPanResultValue')).toHaveText('≈ 7 cups');
    await expect(page.locator('#customPanResultNote')).toHaveText('Closest standard pan: 9" x 9" x 2" Square (8 cups).');
  });

  test('a bundt pan\'s volume accounts for the center tube, not just the outer diameter', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    await page.locator('.pan-picker-btn').nth(ICON.bundt).click();
    await page.fill('#customPan_outerDiameter', '10');
    await page.fill('#customPan_innerDiameter', '3');
    await page.fill('#customPan_depth', '4');
    await expect(page.locator('#customPanResultValue')).toHaveText('≈ 19.75 cups');
  });

  test('muffin/cupcake shows both per-cavity and total volume', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    await page.locator('.pan-picker-btn').nth(ICON.muffin).click();
    await page.fill('#customPan_cavityDiameter', '2.5');
    await page.fill('#customPan_depth', '1.25');
    await page.fill('#customPan_count', '12');
    await expect(page.locator('#customPanResultValue')).toHaveText('≈ 0.5 cups per cavity');
    await expect(page.locator('#customPanResultNote')).toHaveText('≈ 5 cups total across 12 cavities.');
  });

  test('a pie plate\'s volume accounts for its taper (top and bottom diameter differ), not a plain cylinder', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');
    await page.locator('.pan-picker-btn').nth(ICON.pie).click();
    await page.fill('#customPan_topDiameter', '9');
    await page.fill('#customPan_bottomDiameter', '7');
    await page.fill('#customPan_depth', '1.25');
    await expect(page.locator('#customPanResultValue')).toHaveText('≈ 4.25 cups');
    await expect(page.locator('#customPanResultNote')).toHaveText('Closest standard pan: 9" Pie Plate (4 cups).');
  });

  test('"Enter length × width × height" covers any shape with no icon, flagged as an approximation', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-convert.html', 'convert-page.js');
    await page.click('.convert-tab[data-tab="pans"]');

    await page.click('#customPanGenericBtn');
    await expect(page.locator('#customPanShapeLabel')).toHaveText('Custom shape (L × W × H)');
    await expect(page.locator('#customPanDims label')).toHaveText(['Length (in)', 'Width (in)', 'Height (in)']);
    // No picker icon corresponds to "custom", so none should read as active,
    // and the reference list should show everything again.
    await expect(page.locator('.pan-picker-btn.active')).toHaveCount(0);
    await expect(page.locator('.pan-size-card:visible')).toHaveCount(8);

    await page.fill('#customPan_length', '10');
    await page.fill('#customPan_width', '6');
    await page.fill('#customPan_height', '3');
    await expect(page.locator('#customPanResultValue')).toHaveText('≈ 12.5 cups (approximate)');
    await expect(page.locator('#customPanResultNote')).toHaveText(
      'Based on its outer length × width × height — a curved or tapered pan will actually hold a bit less. Closest standard pan: 9" x 3" Springform (12 cups).'
    );

    // Tapping a real shape icon afterward switches back out of custom mode.
    await page.locator('.pan-picker-btn').nth(ICON.round).click();
    await expect(page.locator('#customPanShapeLabel')).toHaveText('Round');
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
