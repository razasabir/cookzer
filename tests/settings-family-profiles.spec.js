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

test.describe('Settings — how many people you cook for', () => {
  test('loads the saved household size', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await expect(page.locator('#householdSizeInput')).toHaveValue('4');
  });

  test('the field label says the count includes yourself', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await expect(page.locator('label', { hasText: 'How many people do you usually cook for' })).toContainText('including yourself');
  });

  test('saving a new value updates the profile and confirms the new column count, spelling out you + others', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.fill('#householdSizeInput', '3');
    await page.click('#saveHouseholdSizeBtn');

    await expect.poll(() => page.evaluate(() => window.__PROFILE_UPDATES__.length)).toBe(1);
    const updated = await page.evaluate(() => window.__PROFILE_UPDATES__[0]);
    expect(updated.household_size).toBe(3);
    await expect(page.locator('#householdSizeStatus')).toContainText('3 columns');
    await expect(page.locator('#householdSizeStatus')).toContainText('you + 2 others');
  });

  test('saving 1 confirms just yourself, with no "+ others" clause', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.fill('#householdSizeInput', '1');
    await page.click('#saveHouseholdSizeBtn');
    await expect.poll(() => page.evaluate(() => window.__PROFILE_UPDATES__.length)).toBe(1);
    await expect(page.locator('#householdSizeStatus')).toContainText('1 column (you)');
  });

  test('rejects an out-of-range value without saving', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.fill('#householdSizeInput', '20');
    await page.click('#saveHouseholdSizeBtn');
    await expect(page.locator('#householdSizeStatus')).toContainText('between 1 and 12');
    expect(await page.evaluate(() => window.__PROFILE_UPDATES__.length)).toBe(0);
  });

  test('the hint button explains what the columns are, that the count includes yourself, and where to change them', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.click('#householdSizeHint');
    await expect(page.locator('.cz-modal-message')).toContainText('Meal Planner');
    await expect(page.locator('.cz-modal-message')).toContainText('counting yourself');
    await page.locator('.cz-modal-btn').click();
  });
});

test.describe('Settings — adding a friend as a family member', () => {
  test('the picker lists people you follow', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.click('#addFriendFamilyProfileBtn');
    await expect(page.locator('#pickerModal h3')).toContainText('Add a friend as a family member');
    await expect(page.locator('.cz2-row')).toHaveCount(2);
    await expect(page.locator('.cz2-row')).toContainText(['Jordan Lee', 'Casey Kim']);
  });

  test('picking a friend links their real account, name, and avatar — no chip picker', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.click('#addFriendFamilyProfileBtn');
    await page.locator('.cz2-row', { hasText: 'Jordan Lee' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_FAMILY_PROFILES__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_FAMILY_PROFILES__[0]);
    expect(inserted.linked_user_id).toBe('friend-1');
    expect(inserted.name).toBe('Jordan Lee');
    expect(inserted.avatar_emoji).toBe('JL');
    await expect(page.locator('#pickerOverlay')).toBeHidden();

    await expect(page.locator('.family-profile-row')).toHaveCount(2);
    const newRow = page.locator('.family-profile-row', { hasText: 'Jordan Lee' });
    await expect(newRow.locator('.family-profile-linked-badge')).toHaveText('Friend');
    await expect(newRow.locator('.family-profile-kidmode')).toHaveCount(0);
  });

  test('searching the picker filters by name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.click('#addFriendFamilyProfileBtn');
    await page.fill('#pickerModal input[type="text"]', 'casey');
    await expect(page.locator('.cz2-row')).toHaveCount(1);
    await expect(page.locator('.cz2-row')).toContainText('Casey Kim');
  });

  test('an already-linked friend no longer appears in the picker', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.click('#addFriendFamilyProfileBtn');
    await page.locator('.cz2-row', { hasText: 'Jordan Lee' }).click();
    await expect.poll(() => page.evaluate(() => window.__INSERTED_FAMILY_PROFILES__.length)).toBe(1);

    await page.click('#addFriendFamilyProfileBtn');
    await expect(page.locator('.cz2-row')).toHaveCount(1);
    await expect(page.locator('.cz2-row')).toContainText('Casey Kim');
  });

  test('once every followed friend is added, the picker explains there\'s no one left', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.click('#addFriendFamilyProfileBtn');
    await page.locator('.cz2-row', { hasText: 'Jordan Lee' }).click();
    await expect.poll(() => page.evaluate(() => window.__INSERTED_FAMILY_PROFILES__.length)).toBe(1);
    await page.click('#addFriendFamilyProfileBtn');
    await page.locator('.cz2-row', { hasText: 'Casey Kim' }).click();
    await expect.poll(() => page.evaluate(() => window.__INSERTED_FAMILY_PROFILES__.length)).toBe(2);

    await page.click('#addFriendFamilyProfileBtn');
    await expect(page.locator('#pickerModal')).toContainText('Everyone you follow is already added.');
  });
});
