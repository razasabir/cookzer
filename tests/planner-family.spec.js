const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Meal planner — sharing and family suggestions', () => {
  test('picking a group in the share selector reveals the suggestions strip', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await expect(page.locator('#shareGroupSelect option')).toHaveCount(2); // "Just me" + "The Smiths"
    await expect(page.locator('.day-suggestions')).toHaveCount(0);

    await page.selectOption('#shareGroupSelect', 'group-1');
    await expect(page.locator('.day-suggestions').first()).toBeVisible();
    await expect(page.locator('.suggestion-chip', { hasText: 'Tacos' })).toBeVisible();
  });

  test('adding a suggestion as a Family Profile prompts for the suggester, then the dish', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.selectOption('#shareGroupSelect', 'group-1');
    await page.locator('.add-suggestion-btn').first().click();

    await expect(page.locator('.cz-modal-message')).toContainText("Who's suggesting?");
    await expect(page.locator('.cz-modal-message')).toContainText('Emma');
    await page.locator('.cz-modal-input').fill('2');
    await page.locator('.cz-modal-btn.cz-primary').click();

    await expect(page.locator('.cz-modal-message')).toContainText('What do you want to eat');
    await page.locator('.cz-modal-input').fill('Pizza night');
    await page.locator('.cz-modal-btn.cz-primary').click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_SUGGESTIONS__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_SUGGESTIONS__[0]);
    expect(inserted.group_id).toBe('group-1');
    expect(inserted.dish_text).toBe('Pizza night');
    expect(inserted.suggested_by_family_profile_id).toBe('fam-1');
    expect(inserted.suggested_by_user_id).toBeUndefined();
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

  test('leaving the share selector on "Just me" hides suggestions and shares nothing', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await expect(page.locator('#shareGroupSelect')).toHaveValue('');
    await expect(page.locator('.day-suggestions')).toHaveCount(0);
    await expect(page.locator('#shareApplyBtn')).toBeHidden();
  });
});
