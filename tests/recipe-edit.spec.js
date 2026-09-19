const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

async function load(page) {
  await loadPageWithMock(page, 'cookzer-recipe-new.html?edit=r1', 'recipe-edit.js');
}

test.describe('Recipe wizard — edit mode', () => {
  test('editing an existing recipe pre-fills its fields and switches the wizard into edit mode', async ({ page }) => {
    await load(page);

    await expect(page.locator('#formTitle')).toHaveText('Edit recipe');
    await expect(page.locator('#importField')).toBeHidden();
    await expect(page.locator('#shareToggleRow')).toBeHidden();
    await expect(page.locator('#submitBtn')).toHaveText('Save changes');

    await expect(page.locator('#rTitle')).toHaveValue('Spaghetti Carbonara');
    await expect(page.locator('#rDescription')).toHaveValue('A classic.');
    await expect(page.locator('#rCategory')).toHaveValue('Dinner');
    await expect(page.locator('#rSpice')).toHaveValue('Mild');
    await expect(page.locator('#rTags')).toHaveValue('quick, weeknight');
    await expect(page.locator('#rPrep')).toHaveValue('10');
    await expect(page.locator('#rCook')).toHaveValue('15');
    await expect(page.locator('#rServings')).toHaveValue('4');
    await expect(page.locator('#rCost')).toHaveValue('3.5');
    await expect(page.locator('.chip-toggle[data-tag="Vegetarian"]')).toHaveClass(/active/);
  });

  test('ingredients and steps are pre-filled, including an already-uploaded step photo', async ({ page }) => {
    await load(page);
    await expect(page.locator('#rTitle')).toHaveValue('Spaghetti Carbonara');

    await page.click('#nextBtn'); // -> step 2 (ingredients)
    const ingredientRows = page.locator('#ingredientRows .dynamic-row');
    await expect(ingredientRows).toHaveCount(2);
    await expect(ingredientRows.nth(0).locator('.ing-name')).toHaveValue('Spaghetti');
    await expect(ingredientRows.nth(0).locator('.ing-qty')).toHaveValue('400g');
    await expect(ingredientRows.nth(1).locator('.ing-name')).toHaveValue('Eggs');
    await expect(page.locator('#rCalories')).toHaveValue('520');
    await expect(page.locator('#rProtein')).toHaveValue('22');

    await page.click('#nextBtn'); // -> step 3 (steps & photos)
    const stepRows = page.locator('#stepRows .step-row');
    await expect(stepRows).toHaveCount(2);
    await expect(stepRows.nth(0).locator('.step-text-input')).toHaveValue('Boil the pasta.');
    await expect(stepRows.nth(0).locator('.step-photo-thumb')).toBeVisible();
    await expect(stepRows.nth(0).locator('.step-photo-thumb')).toHaveAttribute('src', /step1\.jpg/);
    await expect(stepRows.nth(0).locator('.step-photo-btn')).toHaveText('📷 Change photo');
    await expect(stepRows.nth(1).locator('.step-text-input')).toHaveValue('Toss with egg and cheese.');
    await expect(stepRows.nth(1).locator('.step-photo-btn')).toHaveText('📷 Add photo for this step');
  });

  test('extra photos are pre-filled from the gallery, minus whatever is already shown as a step photo', async ({ page }) => {
    await load(page);
    await page.click('#nextBtn'); // -> step 2
    await page.click('#nextBtn'); // -> step 3

    // Only extra1.jpg should show as an extra tile — step1.jpg is already
    // pictured against the first step above, so it isn't duplicated here.
    const extraTiles = page.locator('#extraPhotosGrid .extra-photo-tile');
    await expect(extraTiles).toHaveCount(1);
    await expect(extraTiles.locator('img')).toHaveAttribute('src', /extra1\.jpg/);
  });

  test('the cover picker pre-selects the recipe\'s current cover photo', async ({ page }) => {
    await load(page);
    await page.click('#nextBtn'); // -> step 2
    await page.click('#nextBtn'); // -> step 3
    await page.click('#nextBtn'); // -> step 4 (cover)

    const selected = page.locator('.cover-option.selected');
    await expect(selected).toHaveCount(1);
    const bg = await selected.evaluate((el) => el.style.backgroundImage);
    expect(bg).toContain('step1.jpg');
  });

  test('saving updates the existing recipe instead of creating a new one, and returns to it', async ({ page }) => {
    // The mock reports its update/insert calls through this bridge, into a
    // plain Node-side array — the page redirects right after saving, and
    // that navigation would otherwise wipe any tracking kept on `window`
    // before the test gets a chance to read it back.
    const calls = [];
    await page.exposeFunction('__reportTestHook__', (kind, payload) => { calls.push({ kind, payload }); });

    await load(page);
    await expect(page.locator('#rTitle')).toHaveValue('Spaghetti Carbonara');

    // Block the post-save redirect request itself so it doesn't actually
    // navigate away mid-test; we only care where it was headed.
    let redirectedTo = null;
    await page.route('**/cookzer-recipe.html*', (route) => {
      redirectedTo = route.request().url();
      route.abort();
    });

    await page.click('#nextBtn'); // step 2
    await page.click('#nextBtn'); // step 3
    await page.click('#nextBtn'); // step 4
    await page.click('#nextBtn'); // step 5 (review)
    await page.click('#submitBtn');

    await expect.poll(() => calls.some((c) => c.kind === 'recipes.update')).toBe(true);
    const update = calls.find((c) => c.kind === 'recipes.update');
    expect(update.payload.id).toBe('r1');
    expect(update.payload.payload.title).toBe('Spaghetti Carbonara');
    expect(update.payload.payload.hero_photo_path).toBe('me-1/step1.jpg');

    // The step/extra photos carried over from editing are already in the
    // gallery — only brand-new uploads (none, in this test) should re-insert.
    expect(calls.some((c) => c.kind === 'recipe_photos.insert')).toBe(false);

    await expect.poll(() => redirectedTo).toContain('cookzer-recipe.html?id=r1');
  });
});
