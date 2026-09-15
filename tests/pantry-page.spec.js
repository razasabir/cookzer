const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Pantry Challenge page', () => {
  test('Pantry Challenge tab ranks recipes by ingredient coverage', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-pantry.html', 'pantry-page.js');

    await page.locator('#pantryChallengeInput').fill('chicken, rice, egg');
    await page.locator('#pantryChallengeBtn').click();

    const cards = page.locator('#pantryChallengeResults .pantry-match-card');
    await expect(cards).toHaveCount(3);
    // r3 (Chicken Fried Rice) matches all 3 of its own ingredients -> 100%, ranks first.
    await expect(cards.first()).toContainText('Chicken Fried Rice');
    await expect(cards.first()).toContainText('100%');
  });

  test('Leftovers tab strips filler words and still matches', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-pantry.html', 'pantry-page.js');

    await page.locator('#tabLeftoversBtn').click();
    await expect(page.locator('#panelLeftovers')).toBeVisible();
    await expect(page.locator('#panelPantry')).toBeHidden();

    await page.locator('#leftoversInput').fill('half a roast chicken, leftover rice');
    await page.locator('#leftoversBtn').click();

    const cards = page.locator('#leftoversResults .pantry-match-card');
    await expect(cards.first()).toContainText('Chicken Fried Rice');
  });

  test('shows a hint instead of searching when the input is empty', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-pantry.html', 'pantry-page.js');
    await page.locator('#pantryChallengeBtn').click();
    await expect(page.locator('#pantryChallengeResults')).toContainText('List a few ingredients');
    const calls = await page.evaluate(() => window.__CALLS__);
    expect(calls.filter((c) => c.table === 'recipes').length).toBe(0);
  });

  test('?tab=leftovers opens straight into the Leftovers tab — the sidebar Leftover Help link\'s target', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-pantry.html?tab=leftovers', 'pantry-page.js');
    await expect(page.locator('#panelLeftovers')).toBeVisible();
    await expect(page.locator('#panelPantry')).toBeHidden();
    await expect(page.locator('#tabLeftoversBtn')).toHaveClass(/active/);
  });

  test('sidebar groups Cooking Ideas, Leftover Help, and Health & Nutritions under a Cookzer+ label', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-pantry.html', 'pantry-page.js');
    const section = page.locator('.sidebar .sidebar-plus');
    await expect(section.locator('.sidebar-plus-label')).toHaveText('Cookzer+');
    const links = section.locator('a');
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toContainText('Cooking Ideas');
    await expect(links.nth(1)).toContainText('Leftover Help');
    await expect(links.nth(1)).toHaveAttribute('href', 'cookzer-pantry.html?tab=leftovers');
    await expect(links.nth(2)).toContainText('Health & Nutritions');
  });
});
