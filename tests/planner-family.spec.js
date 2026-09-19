const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Meal planner — sharing and family suggestions', () => {
  test('picking a group in the share selector reveals the suggestions strip', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await expect(page.locator('#shareGroupSelect option')).toHaveCount(2); // "Just me" + "The Smiths"
    await expect(page.locator('.day-suggestions')).toHaveCount(0);

    await page.selectOption('#shareGroupSelect', 'group-1');
    const monday = page.locator('.day-suggestions').first();
    await expect(monday).toBeVisible();
    await expect(monday.locator('.suggestion-chip', { hasText: 'Tacos' })).toBeVisible();

    // Always exactly 5 slots per day — 1 filled + 4 open on the day with
    // a seeded suggestion, all 5 open on a day with none.
    await expect(monday.locator('.suggestion-chip, .suggestion-slot-empty')).toHaveCount(5);
    await expect(monday.locator('.suggestion-slot-empty')).toHaveCount(4);
    const tuesday = page.locator('.day-suggestions').nth(1);
    await expect(tuesday.locator('.suggestion-slot-empty')).toHaveCount(5);
  });

  test('adding a suggestion as a Family Profile — click their chip, type the dish', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.selectOption('#shareGroupSelect', 'group-1');
    await page.locator('.suggestion-slot-empty').first().click();

    await expect(page.locator('#pickerModal h3')).toContainText('Suggest a meal');
    await expect(page.locator('.cz2-chip', { hasText: 'You' })).toHaveClass(/selected/);
    await page.locator('.cz2-chip', { hasText: 'Emma' }).click();
    await expect(page.locator('.cz2-chip', { hasText: 'Emma' })).toHaveClass(/selected/);
    await expect(page.locator('.cz2-chip', { hasText: 'You' })).not.toHaveClass(/selected/);

    await page.fill('#pickerModal input[type="text"]', 'Pizza night');
    await page.locator('#pickerModal button', { hasText: 'Suggest' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_SUGGESTIONS__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_SUGGESTIONS__[0]);
    expect(inserted.group_id).toBe('group-1');
    expect(inserted.dish_text).toBe('Pizza night');
    expect(inserted.suggested_by_family_profile_id).toBe('fam-1');
    expect(inserted.suggested_by_user_id).toBeUndefined();
    await expect(page.locator('#pickerOverlay')).toBeHidden();
  });

  test('"Use this" on a suggestion schedules it as that day\'s planned meal', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.selectOption('#shareGroupSelect', 'group-1');
    await page.locator('.suggestion-chip .use-btn').first().click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_ENTRIES__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_ENTRIES__[0]);
    expect(inserted.free_text).toBe('Tacos');
    expect(inserted.group_id).toBe('group-1');
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

  test('leaving the share selector on "Just me" hides suggestions and shares nothing', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await expect(page.locator('#shareGroupSelect')).toHaveValue('');
    await expect(page.locator('.day-suggestions')).toHaveCount(0);
    await expect(page.locator('#shareApplyBtn')).toBeHidden();
  });
});
