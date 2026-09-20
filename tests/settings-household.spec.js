const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Settings — Household Co-Admins', () => {
  test('a solo household shows just you, with no Remove/Leave button', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-household.js');
    const rows = page.locator('#householdMembersList .family-profile-row');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Test Cook (you)');
    await expect(page.locator('#householdMembersList .family-profile-remove')).toHaveCount(0);
  });

  test('the add-co-admin picker lists followed friends, not a numbered prompt', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-household.js');
    await page.click('#addCoAdminBtn');
    await expect(page.locator('#pickerModal h3')).toContainText('Add a co-admin');
    await expect(page.locator('.cz2-row')).toHaveCount(2);
    await expect(page.locator('.cz2-row')).toContainText(['Jordan Lee', 'Casey Kim']);
  });

  test('searching the co-admin picker filters by name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-household.js');
    await page.click('#addCoAdminBtn');
    await page.fill('#pickerModal input[type="text"]', 'casey');
    await expect(page.locator('.cz2-row')).toHaveCount(1);
    await expect(page.locator('.cz2-row')).toContainText('Casey Kim');
  });

  test('picking a friend calls add_household_co_admin and the new co-admin appears in the list', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-household.js');
    await page.click('#addCoAdminBtn');
    await page.locator('.cz2-row', { hasText: 'Jordan Lee' }).click();

    await expect.poll(() => page.evaluate(() => window.__ADD_CO_ADMIN_CALLS__.length)).toBe(1);
    const call = await page.evaluate(() => window.__ADD_CO_ADMIN_CALLS__[0]);
    expect(call.p_invitee_user_id).toBe('friend-1');
    await expect(page.locator('#pickerOverlay')).toBeHidden();

    const rows = page.locator('#householdMembersList .family-profile-row');
    await expect(rows).toHaveCount(2);
    await expect(rows).toContainText(['Test Cook (you)', 'Jordan Lee']);
  });

  test('once every followed friend is a co-admin, the picker explains there\'s no one left to add', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-household.js');
    await page.click('#addCoAdminBtn');
    await page.locator('.cz2-row', { hasText: 'Jordan Lee' }).click();
    await expect.poll(() => page.evaluate(() => window.__ADD_CO_ADMIN_CALLS__.length)).toBe(1);

    await page.click('#addCoAdminBtn');
    await expect(page.locator('.cz2-row')).toHaveCount(1);
    await expect(page.locator('.cz2-row')).toContainText('Casey Kim');
  });

  test('after adding a co-admin, both members get a Remove/Leave button, and removing one confirms first', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-household.js');
    await page.click('#addCoAdminBtn');
    await page.locator('.cz2-row', { hasText: 'Jordan Lee' }).click();
    await expect.poll(() => page.evaluate(() => window.__ADD_CO_ADMIN_CALLS__.length)).toBe(1);

    const rows = page.locator('#householdMembersList .family-profile-row');
    await expect(rows).toHaveCount(2);
    const jordanRow = rows.filter({ hasText: 'Jordan Lee' });
    await expect(jordanRow.locator('.family-profile-remove')).toHaveText('Remove');
    const yourRow = rows.filter({ hasText: '(you)' });
    await expect(yourRow.locator('.family-profile-remove')).toHaveText('Leave');

    await jordanRow.locator('.family-profile-remove').click();
    await expect(page.locator('.cz-modal-message')).toContainText('Jordan Lee');
    await page.locator('.cz-modal-btn.cz-danger').click();

    await expect.poll(() => page.evaluate(() => window.__REMOVED_MEMBER_IDS__.length)).toBe(1);
    expect(await page.evaluate(() => window.__REMOVED_MEMBER_IDS__[0])).toBe('friend-1');
    await expect(rows).toHaveCount(1);
    await expect(page.locator('#householdMembersList .family-profile-remove')).toHaveCount(0);
  });
});
