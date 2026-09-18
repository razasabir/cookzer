const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Settings — Family Profiles', () => {
  test('existing profiles load and render', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await expect(page.locator('.family-profile-row')).toHaveCount(1);
    await expect(page.locator('.family-profile-row')).toContainText('Emma');
  });

  test('adding a profile with a chosen emoji saves owner_id, name, and avatar_emoji', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.locator('.family-emoji-btn').nth(2).click(); // 👦
    await page.fill('#familyNameInput', 'Jake');
    await page.click('#addFamilyProfileBtn');

    await expect.poll(() => page.evaluate(() => window.__INSERTED_FAMILY_PROFILES__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_FAMILY_PROFILES__[0]);
    expect(inserted.owner_id).toBe('me-1');
    expect(inserted.name).toBe('Jake');
    expect(inserted.avatar_emoji).toBe('👦');
    await expect(page.locator('.family-profile-row')).toHaveCount(2);
  });

  test('adding without a name shows a status message instead of saving', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.click('#addFamilyProfileBtn');
    await expect(page.locator('#familyProfilesStatus')).toContainText('name');
    expect(await page.evaluate(() => window.__INSERTED_FAMILY_PROFILES__.length)).toBe(0);
  });

  test('removing a profile deletes it by id', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.locator('.family-profile-remove').click();
    await expect(page.locator('.cz-modal-message')).toContainText('Emma');
    await page.locator('.cz-modal-btn.cz-primary').click();
    await expect.poll(() => page.evaluate(() => window.__DELETED_FAMILY_PROFILE_IDS__.length)).toBe(1);
    expect(await page.evaluate(() => window.__DELETED_FAMILY_PROFILE_IDS__[0])).toBe('fam-1');
    await expect(page.locator('.family-profile-row')).toHaveCount(0);
  });
});
