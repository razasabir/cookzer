const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Meal planner — per-person suggestion columns', () => {
  test('each day shows You + named Family Profiles + ghost columns up to your household size', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    const monday = page.locator('.planner-day-card').first();
    const cols = monday.locator('.planner-person-col');
    await expect(cols).toHaveCount(3); // You + Emma + 1 ghost (household_size 3)
    await expect(cols.nth(0)).toContainText('You');
    await expect(cols.nth(1)).toContainText('Emma');
    await expect(cols.nth(2)).toHaveClass(/ghost/);
    await expect(cols.nth(2)).toContainText('Add a family member');
  });

  test('Monday shows Emma\'s seeded suggestion with "Use this"; Tuesday is all open', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    const monday = page.locator('.planner-day-card').first();
    const emmaCol = monday.locator('.planner-person-col').nth(1);
    await expect(emmaCol.locator('.planner-person-suggestion')).toHaveText('Tacos');
    await expect(emmaCol.locator('.planner-person-use-btn')).toBeVisible();

    const tuesday = page.locator('.planner-day-card').nth(1);
    const tuesdayRealCols = tuesday.locator('.planner-person-col:not(.ghost)');
    await expect(tuesdayRealCols).toHaveCount(2);
    await expect(tuesdayRealCols.nth(0).locator('.planner-person-add-btn')).toContainText('Add Meal');
    await expect(tuesdayRealCols.nth(1).locator('.planner-person-add-btn')).toContainText('Add Meal');
  });

  test('adding a suggestion for a specific column skips the "who\'s suggesting?" step entirely', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    const tuesday = page.locator('.planner-day-card').nth(1);
    await tuesday.locator('.planner-person-col', { hasText: 'Emma' }).locator('.planner-person-add-btn').click();

    await expect(page.locator('#pickerModal h3')).toContainText('Suggest a meal for');
    await expect(page.locator('#pickerModal h3')).toContainText('Emma');
    await expect(page.locator('.cz2-chip')).toHaveCount(0);

    await page.fill('#pickerModal input[type="text"]', 'Pizza night');
    await page.locator('#pickerModal button', { hasText: 'Suggest' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_SUGGESTIONS__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_SUGGESTIONS__[0]);
    expect(inserted.owner_id).toBe('me-1');
    expect(inserted.dish_text).toBe('Pizza night');
    expect(inserted.suggested_by_family_profile_id).toBe('fam-1');
    expect(inserted.suggested_by_user_id).toBeUndefined();
    await expect(page.locator('#pickerOverlay')).toBeHidden();

    // The column itself must reflect the save — not just the insert
    // call — otherwise a saved suggestion looks like nothing happened.
    const emmaCol = tuesday.locator('.planner-person-col', { hasText: 'Emma' });
    await expect(emmaCol.locator('.planner-person-suggestion')).toHaveText('Pizza night');
    await expect(emmaCol.locator('.planner-person-use-btn')).toBeVisible();
    await expect(emmaCol.locator('.planner-person-add-btn')).toHaveCount(0);
  });

  test('the ghost column links to Settings instead of opening the suggestion picker', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    const monday = page.locator('.planner-day-card').first();
    const ghostLink = monday.locator('.planner-person-col.ghost a');
    await expect(ghostLink).toHaveAttribute('href', 'cookzer-settings.html');
  });

  test('"Use this" on a suggestion schedules it as that day\'s planned meal', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    const monday = page.locator('.planner-day-card').first();
    await monday.locator('.planner-person-use-btn').first().click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_ENTRIES__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_ENTRIES__[0]);
    expect(inserted.free_text).toBe('Tacos');
    expect(inserted.source_note).toContain('Emma');
  });

  test('"+ Add meal" opens a searchable recipe list — clicking one inserts its recipe_id', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.locator('.meal-add-btn', { hasText: '+ Add meal' }).first().click();

    await expect(page.locator('#pickerModal h3')).toContainText('What are you cooking?');
    await expect(page.locator('.cz2-row')).toHaveCount(2);

    await page.fill('#pickerModal input[type="text"]', 'carbonara');
    await expect(page.locator('.cz2-row')).toHaveCount(1);
    await page.locator('.cz2-row', { hasText: 'Spaghetti Carbonara' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_ENTRIES__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_ENTRIES__[0]);
    expect(inserted.recipe_id).toBe('r2');
    await expect(page.locator('#pickerOverlay')).toBeHidden();
  });

  test('"+ Add meal" also accepts a plain meal name with no recipe attached', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.locator('.meal-add-btn', { hasText: '+ Add meal' }).first().click();
    await page.fill('.cz2-free-row input[type="text"]', 'Taco Tuesday');
    await page.locator('#pickerModal button', { hasText: 'Add' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_ENTRIES__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_ENTRIES__[0]);
    expect(inserted.free_text).toBe('Taco Tuesday');
    expect(inserted.recipe_id).toBeUndefined();
  });

  test('the "Final approved dish" label appears above the planned-meal slot', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    const monday = page.locator('.planner-day-card').first();
    await expect(monday.locator('.meal-slot-label')).toHaveText('Final approved dish');
  });
});
