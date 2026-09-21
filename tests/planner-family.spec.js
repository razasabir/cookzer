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

  test('an existing suggestion can be edited in place instead of only used or left as-is', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    const monday = page.locator('.planner-day-card').first();
    const emmaCol = monday.locator('.planner-person-col', { hasText: 'Emma' });

    await emmaCol.locator('.planner-person-edit-btn').click();

    await expect(page.locator('#pickerModal h3')).toContainText('Edit suggestion for');
    await expect(page.locator('#pickerModal h3')).toContainText('Emma');
    const input = page.locator('#pickerModal input[type="text"]');
    await expect(input).toHaveValue('Tacos');

    await input.fill('Fajitas');
    await page.locator('#pickerModal button', { hasText: 'Save' }).click();

    await expect.poll(() => page.evaluate(() => window.__UPDATED_SUGGESTIONS__.length)).toBe(1);
    const updated = await page.evaluate(() => window.__UPDATED_SUGGESTIONS__[0]);
    expect(updated.id).toBe('sugg-1');
    expect(updated.payload.dish_text).toBe('Fajitas');

    // No duplicate insert — this replaced the existing suggestion in place.
    expect(await page.evaluate(() => window.__INSERTED_SUGGESTIONS__.length)).toBe(0);
    await expect(emmaCol.locator('.planner-person-suggestion')).toHaveText('Fajitas');
    await expect(page.locator('#pickerOverlay')).toBeHidden();
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

  test('the recipe search also matches on tags, not just the title', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.locator('.meal-add-btn', { hasText: '+ Add meal' }).first().click();

    // "weeknight" matches Lemon Herb Chicken's tags, not its title.
    await page.fill('#pickerModal input[type="text"]', 'weeknight');
    await expect(page.locator('.cz2-row')).toHaveCount(1);
    await expect(page.locator('.cz2-row')).toContainText('Lemon Herb Chicken');
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

test.describe('Meal planner — week navigation', () => {
  test('defaults to "This week\'s plan" with both nav buttons enabled', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await expect(page.locator('#plannerWeekTitle')).toContainText("This week's plan");
    await expect(page.locator('#prevWeekBtn')).toBeEnabled();
    await expect(page.locator('#nextWeekBtn')).toBeEnabled();
  });

  test('Next/Prev swap the title to a date range and back to "This week\'s plan"', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.locator('#nextWeekBtn').click();
    await expect(page.locator('#plannerWeekTitle')).not.toContainText("This week's plan");
    await expect(page.locator('#plannerWeekTitle')).toContainText('–'); // "Mon D – Sun D" style range

    await page.locator('#prevWeekBtn').click();
    await expect(page.locator('#plannerWeekTitle')).toContainText("This week's plan");
  });

  test('navigating out ~3 months disables the button at that boundary, and going back one re-enables it', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    for (let i = 0; i < 13; i++) await page.locator('#nextWeekBtn').click();
    await expect(page.locator('#nextWeekBtn')).toBeDisabled();
    await expect(page.locator('#prevWeekBtn')).toBeEnabled();

    await page.locator('#prevWeekBtn').click();
    await expect(page.locator('#nextWeekBtn')).toBeEnabled();
  });

  test('the "Copy from previous week" button reflects the currently viewed week, not always the real current week', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await expect(page.locator('#copyLastWeekBtn')).toContainText('Copy from previous week');
    await page.locator('#nextWeekBtn').click();
    // Still present and functional after navigating — not tied to a
    // hardcoded "last week" that only makes sense on the default view.
    await expect(page.locator('#copyLastWeekBtn')).toBeVisible();
  });

  test('each day card shows a real date alongside the day name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    const dateLabels = page.locator('.day-label-date');
    await expect(dateLabels).toHaveCount(7);
    // Whatever today's real date is, every card's date label is non-empty
    // and looks like "Mon D" — not asserting exact dates since the test
    // runs on the real clock, same approach as the seeded-suggestion date.
    for (const text of await dateLabels.allTextContents()) {
      expect(text.trim()).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    }
  });
});

test.describe('Meal planner — Jump to a date calendar', () => {
  test('opens a real branded calendar, not a native date input', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await page.click('#jumpToDateBtn');
    await expect(page.locator('#pickerModal h3')).toContainText('Jump to a date');
    await expect(page.locator('.cz2-cal-grid')).toBeVisible();
    await expect(page.locator('.cz2-cal-weekday')).toHaveCount(7);
  });

  test('the row for the week currently on screen is banded, and today is marked', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.click('#jumpToDateBtn');
    await expect(page.locator('.cz2-cal-week-row.current-week')).toHaveCount(1);
    await expect(page.locator('.cz2-cal-cell.today')).toHaveCount(1);
    // Today's cell is inside the banded current-week row.
    await expect(page.locator('.cz2-cal-week-row.current-week .cz2-cal-cell.today')).toHaveCount(1);
  });

  test('clicking a day jumps the planner straight to that week and closes the picker', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.click('#nextWeekBtn'); // move off "This week's plan" so a jump-back is visible
    await page.click('#jumpToDateBtn');
    await page.click('.cz2-cal-cell.today');
    await expect(page.locator('#pickerOverlay')).toBeHidden();
    await expect(page.locator('#plannerWeekTitle')).toContainText("This week's plan");
  });

  test('month navigation is disabled once neither adjacent month has a day within the ~3-month range', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.click('#jumpToDateBtn');
    await expect(page.locator('.cz2-cal-month-btn[aria-label="Previous month"]')).toBeEnabled();
    await expect(page.locator('.cz2-cal-month-btn[aria-label="Next month"]')).toBeEnabled();

    // How many months out the boundary sits depends on where "today"
    // falls within its own month, so step forward/back until each arrow
    // disables itself rather than assuming a fixed click count.
    const nextBtn = page.locator('.cz2-cal-month-btn[aria-label="Next month"]');
    for (let i = 0; i < 20 && !(await nextBtn.isDisabled()); i++) await nextBtn.click();
    await expect(nextBtn).toBeDisabled();

    const prevBtn = page.locator('.cz2-cal-month-btn[aria-label="Previous month"]');
    for (let i = 0; i < 20 && !(await prevBtn.isDisabled()); i++) await prevBtn.click();
    await expect(prevBtn).toBeDisabled();
  });

  test('a day outside the browsable range is greyed out and not clickable', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.click('#jumpToDateBtn');
    const nextBtn = page.locator('.cz2-cal-month-btn[aria-label="Next month"]');
    for (let i = 0; i < 20 && !(await nextBtn.isDisabled()); i++) await nextBtn.click();
    const disabledCells = page.locator('.cz2-cal-cell:disabled');
    await expect(disabledCells.first()).toBeVisible();
  });

  test('Close dismisses the calendar without changing the viewed week', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js');
    await page.click('#jumpToDateBtn');
    await page.locator('.cz2-actions button', { hasText: 'Close' }).click();
    await expect(page.locator('#pickerOverlay')).toBeHidden();
    await expect(page.locator('#plannerWeekTitle')).toContainText("This week's plan");
  });
});

test.describe('Meal planner — household co-admins get an automatic column', () => {
  test('a co-admin who joined the household (e.g. invited as a spouse in Settings) gets their own column automatically', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', `
      window.__TEST_HOUSEHOLD_MEMBERS__ = [
        { user_id: 'me-1', joined_at: '2026-01-01T00:00:00Z', profiles: { display_name: 'Test Cook', initials: 'TC', avatar_url: null } },
        { user_id: 'spouse-1', joined_at: '2026-01-02T00:00:00Z', profiles: { display_name: 'Sarah', initials: 'SC', avatar_url: null } },
      ];
    `);
    const monday = page.locator('.planner-day-card').first();
    const cols = monday.locator('.planner-person-col');
    // You + Sarah (co-admin) + Emma (family profile) fill household_size 3 — no ghost left.
    await expect(cols).toHaveCount(3);
    await expect(cols.nth(0)).toContainText('You');
    await expect(cols.nth(1)).toContainText('Sarah');
    await expect(cols.nth(2)).toContainText('Emma');
  });

  test('the caller themselves never appears twice, even though household_members includes them', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', `
      window.__TEST_HOUSEHOLD_MEMBERS__ = [
        { user_id: 'me-1', joined_at: '2026-01-01T00:00:00Z', profiles: { display_name: 'Test Cook', initials: 'TC', avatar_url: null } },
      ];
    `);
    const monday = page.locator('.planner-day-card').first();
    await expect(monday.locator('.planner-person-col', { hasText: 'You' })).toHaveCount(1);
  });

  test('a co-admin can be suggested a meal for, the same as any real column', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', `
      window.__TEST_HOUSEHOLD_MEMBERS__ = [
        { user_id: 'me-1', joined_at: '2026-01-01T00:00:00Z', profiles: { display_name: 'Test Cook', initials: 'TC', avatar_url: null } },
        { user_id: 'spouse-1', joined_at: '2026-01-02T00:00:00Z', profiles: { display_name: 'Sarah', initials: 'SC', avatar_url: null } },
      ];
    `);
    const tuesday = page.locator('.planner-day-card').nth(1);
    await tuesday.locator('.planner-person-col', { hasText: 'Sarah' }).locator('.planner-person-add-btn').click();
    await page.fill('#pickerModal input[type="text"]', 'Pasta night');
    await page.locator('#pickerModal button', { hasText: 'Suggest' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_SUGGESTIONS__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_SUGGESTIONS__[0]);
    expect(inserted).toMatchObject({ suggested_by_user_id: 'spouse-1', dish_text: 'Pasta night' });
  });

  test('a family profile linked to a co-admin\'s own account does not also get a duplicate column', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', `
      window.__TEST_HOUSEHOLD_MEMBERS__ = [
        { user_id: 'me-1', joined_at: '2026-01-01T00:00:00Z', profiles: { display_name: 'Test Cook', initials: 'TC', avatar_url: null } },
        { user_id: 'spouse-1', joined_at: '2026-01-02T00:00:00Z', profiles: { display_name: 'Sarah', initials: 'SC', avatar_url: null } },
      ];
      window.__TEST_LINKED_FAMILY_PROFILE__ = { id: 'fam-linked', name: 'Sarah', avatar_emoji: 'SC', linked_user_id: 'spouse-1' };
    `);
    const monday = page.locator('.planner-day-card').first();
    await expect(monday.locator('.planner-person-col', { hasText: 'Sarah' })).toHaveCount(1);
  });
});
