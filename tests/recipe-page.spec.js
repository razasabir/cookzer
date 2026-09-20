const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

async function load(page) {
  await loadPageWithMock(page, 'cookzer-recipe.html?id=r1', 'recipe-page.js');
}

test.describe('Recipe page — search tags', () => {
  test('shows the recipe\'s free-form tags as hashtag pills, distinct from dietary tags', async ({ page }) => {
    await load(page);
    await expect(page.locator('.search-tag-pill')).toHaveCount(2);
    await expect(page.locator('.search-tag-pill').nth(0)).toHaveText('#quick');
    await expect(page.locator('.search-tag-pill').nth(1)).toHaveText('#weeknight');
    await expect(page.locator('.dietary-pill')).toHaveText('Vegetarian');
  });
});

test.describe('Recipe page — action buttons', () => {
  test('Edit, Share, Save, and Heart appear first, in that order, for the recipe\'s own author', async ({ page }) => {
    await load(page);
    const pills = page.locator('.actions-row .action-pill');
    await expect(pills.nth(0)).toContainText('Edit Recipe');
    await expect(pills.nth(1)).toContainText('Share');
    await expect(pills.nth(2)).toContainText('Save to Cookbook');
    await expect(pills.nth(3)).toContainText('Heart');
  });

  test('the Edit Recipe pill links to the wizard in edit mode for this recipe', async ({ page }) => {
    await load(page);
    const editBtn = page.locator('#editRecipeBtn');
    await expect(editBtn).toBeVisible();
    await expect(editBtn).toHaveAttribute('href', 'cookzer-recipe-new.html?edit=r1');
  });
});

test.describe('Recipe page — heart', () => {
  test('toggling the heart button updates the count and label', async ({ page }) => {
    await load(page);
    const heartBtn = page.locator('#heartBtn');
    await expect(heartBtn).toContainText('❤️ Heart (1)');

    await heartBtn.click();
    await expect(heartBtn).toContainText('❤️ Hearted (2)');
    await expect(heartBtn).toHaveClass(/active/);

    await heartBtn.click();
    await expect(heartBtn).toContainText('❤️ Heart (1)');
    await expect(heartBtn).not.toHaveClass(/active/);
  });
});

test.describe('Recipe page — save to cookbook', () => {
  test('clicking Save opens a real folder picker, not a numbered-list prompt', async ({ page }) => {
    await load(page);
    await page.locator('#saveBtn').click();
    await expect(page.locator('.cz-modal-overlay')).toHaveCount(0);
    // Save now opens a Save-as-Recipe/Meal-Planner/Device picker first —
    // "Save as a Recipe" is the option that reaches the folder picker.
    await page.locator('.cz2-row', { hasText: 'Save as a Recipe' }).click();
    await expect(page.locator('#pickerOverlay')).toBeVisible();
    await expect(page.locator('#pickerOverlay .cz2-row')).toHaveCount(2);
    await expect(page.locator('#pickerOverlay .cz2-row').nth(0)).toContainText('No folder');
    await expect(page.locator('#pickerOverlay .cz2-row').nth(1)).toContainText('Weeknights');

    await page.locator('.cz2-row', { hasText: 'Weeknights' }).click();
    await expect(page.locator('#pickerOverlay')).toBeHidden();
    await expect(page.locator('#saveBtn')).toContainText('Saved');
    const upserts = await page.evaluate(() => window.__SAVED_UPSERTS__);
    expect(upserts[0].folder_id).toBe('f1');
  });
});

test.describe('Recipe page — comments', () => {
  test('shows existing comments, and the recipe owner can delete both their own and someone else\'s', async ({ page }) => {
    await load(page);
    const box = page.locator('#rCommentsBox');
    await expect(box.locator('.comment-row')).toHaveCount(2);

    const otherRow = box.locator('.comment-row[data-comment-id="c2"]');
    await expect(otherRow.locator('.comment-delete-btn')).toHaveCount(1);
    await otherRow.locator('.comment-delete-btn').click();
    await expect(page.locator('.cz-modal-message')).toContainText('Delete this comment');
    await page.locator('.cz-modal-btn.cz-danger').click();

    await expect.poll(() => page.evaluate(() => window.__DELETED_COMMENT_IDS__)).toContain('c2');
    await expect(box.locator('.comment-row[data-comment-id="c2"]')).toHaveCount(0);
    await expect(box.locator('.comment-row[data-comment-id="c1"]')).toHaveCount(1);
  });

  test('posting a new comment inserts it against the recipe, not a post', async ({ page }) => {
    await load(page);
    const box = page.locator('#rCommentsBox');
    await box.locator('input[type="text"]').fill('Great recipe!');
    await box.locator('button', { hasText: 'Send' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_COMMENTS__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_COMMENTS__[0]);
    expect(inserted.recipe_id).toBe('r1');
    expect(inserted.author_id).toBe('me-1');
    expect(inserted.text).toBe('Great recipe!');
    await expect(box.locator('.comment-row')).toHaveCount(3);
  });
});

test.describe('Recipe page — Share popup', () => {
  test('clicking Share opens the Reshare/Group/External picker, not the share dialog directly', async ({ page }) => {
    await load(page);
    await page.locator('#shareBtn').click();
    await expect(page.locator('.cz2-modal h3')).toHaveText('Share');
    await expect(page.locator('.cz2-row')).toHaveCount(3);
  });

  test('Reshare to your feed posts a share referencing this recipe', async ({ page }) => {
    await load(page);
    await page.locator('#shareBtn').click();
    await page.locator('.cz2-row', { hasText: 'Reshare to your feed' }).click();
    await page.locator('.cz-modal-btn.cz-primary').click();

    const inserted = await page.evaluate(() => window.__INSERTED_POSTS__);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ kind: 'share', author_id: 'me-1', recipe_id: 'r1' });
  });

  test('Share externally reaches the existing in-app share-link popup', async ({ page }) => {
    await load(page);
    await page.locator('#shareBtn').click();
    await page.locator('.cz2-row', { hasText: 'Share externally' }).click();
    await expect(page.locator('.cz-share-link-row input')).toHaveValue(/id=r1/);
  });
});

test.describe('Recipe page — Save popup reuses the existing Meal Planner picker', () => {
  test('Save > Save to Meal Planner opens the exact same conflict-aware day picker as the dedicated button', async ({ page }) => {
    await load(page);
    await page.locator('#saveBtn').click();
    await page.locator('.cz2-row', { hasText: 'Save to Meal Planner' }).click();

    await expect(page.locator('#pickerOverlay')).toBeVisible();
    await expect(page.locator('#pickerModal h3')).toHaveText('Add "Spaghetti Carbonara" to which day?');
    await expect(page.locator('.cz2-row')).toHaveCount(7);
  });
});

test.describe('Recipe page — add to meal planner', () => {
  test('clicking the button opens a real day picker, not a numbered-list prompt', async ({ page }) => {
    await load(page);
    await page.locator('#addToPlannerBtn').click();
    await expect(page.locator('.cz-modal-overlay')).toHaveCount(0);
    await expect(page.locator('#pickerOverlay')).toBeVisible();
    await expect(page.locator('#pickerModal h3')).toHaveText('Add "Spaghetti Carbonara" to which day?');
    await expect(page.locator('.cz2-row')).toHaveCount(7);
  });

  test('the already-planned day shows as disabled with what\'s already there', async ({ page }) => {
    await load(page);
    await page.locator('#addToPlannerBtn').click();
    const takenRow = page.locator('.cz2-row', { hasText: 'already planned: Leftover Pasta' });
    await expect(takenRow).toHaveCount(1);
    await expect(takenRow).toHaveCSS('opacity', '0.5');
  });

  test('clicking a free day inserts the recipe link, confirms, and closes the picker', async ({ page }) => {
    await load(page);
    await page.locator('#addToPlannerBtn').click();
    const freeRow = page.locator('.cz2-row').filter({ hasNotText: 'already planned' }).first();
    await freeRow.click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_PLANNER_ENTRIES__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_PLANNER_ENTRIES__[0]);
    expect(inserted.recipe_id).toBe('r1');
    expect(inserted.user_id).toBe('me-1');
    expect(typeof inserted.plan_date).toBe('string');

    await expect(page.locator('.cz-modal-message')).toContainText('Added to your Meal Planner for');
    await page.locator('.cz-modal-btn.cz-primary').click();
    await expect(page.locator('#pickerOverlay')).toBeHidden();
  });
});
