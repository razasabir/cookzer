const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Regression test for the shopping list's estimated total cost — sums
// each planned recipe's own ingredient cost (servings forced to 1) since
// the merged "2 cups + 1 cup" ingredient rows aren't in a form the
// lookup table can add together directly.
test.describe('shopping list estimated cost', () => {
  test('shows an estimated total covering only matched recipes', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'shopping-cost.js');

    await page.locator('#generateListBtn').click();

    const box = page.locator('#shoppingListBox');
    await expect(box.locator('.shopping-list-item')).toHaveCount(5); // 4 distinct ingredient rows + 1 total row
    const totalRow = box.locator('.shopping-list-item').last();
    await expect(totalRow).toContainText('Estimated total: ~$');
    await expect(totalRow).toContainText('not real prices');
  });
});
