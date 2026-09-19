const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Kid Mode — setup in Settings', () => {
  test('the Kid Mode button opens a PIN-setup modal naming that profile', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.locator('.family-profile-kidmode').click();
    await expect(page.locator('#kidModeOverlay h3')).toContainText('Enable Kid Mode for');
    await expect(page.locator('#kidModeOverlay h3')).toContainText('Emma');
  });

  test('mismatched PINs are rejected without enabling anything', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.locator('.family-profile-kidmode').click();
    const pinInputs = page.locator('#kidModeOverlay input[type="password"]');
    await pinInputs.nth(0).fill('1234');
    await pinInputs.nth(1).fill('9999');
    await page.locator('#kidModeOverlay button', { hasText: 'Enable' }).click();
    await expect(page.locator('#kidModeOverlay')).toContainText("PINs don’t match");
    expect(await page.evaluate(() => localStorage.getItem('cz_kid_mode'))).toBeNull();
  });

  test('a too-short PIN is rejected', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.locator('.family-profile-kidmode').click();
    const pinInputs = page.locator('#kidModeOverlay input[type="password"]');
    await pinInputs.nth(0).fill('12');
    await pinInputs.nth(1).fill('12');
    await page.locator('#kidModeOverlay button', { hasText: 'Enable' }).click();
    await expect(page.locator('#kidModeOverlay')).toContainText('at least 4 digits');
    expect(await page.evaluate(() => localStorage.getItem('cz_kid_mode'))).toBeNull();
  });

  test('Cancel closes the modal without enabling Kid Mode', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-family-profiles.js');
    await page.locator('.family-profile-kidmode').click();
    await page.locator('#kidModeOverlay button', { hasText: 'Cancel' }).click();
    await expect(page.locator('#kidModeOverlay')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('cz_kid_mode'))).toBeNull();
  });
});

test.describe('Kid Mode — locked-down device', () => {
  const KID_MODE_INIT = `
    localStorage.setItem('cz_kid_mode', JSON.stringify({
      enabled: true,
      familyProfileId: 'fam-1',
      familyProfileName: 'Emma',
      familyProfileEmoji: '\u{1F467}',
      pinHash: 'test-hash',
    }));
  `;

  test('the planner shows a Kid Mode banner and hides feed/friends/messenger nav', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', KID_MODE_INIT);
    await expect(page.locator('body')).toContainText('Kid Mode');
    await expect(page.locator('body')).toContainText('Emma');
    await expect(page.locator('.sidebar-item.planner')).toBeVisible();
    await expect(page.locator('a[href="cookzer-feed.html"]')).toHaveCount(0);
    // The wordmark link is repointed at the planner rather than removed,
    // so the logo still does something useful instead of a dead click.
    await expect(page.locator('.sidebar-brand').locator('xpath=..')).toHaveAttribute('href', 'cookzer-planner.html');
    await expect(page.locator('a[href="cookzer-messenger.html"]')).toHaveCount(0);
    await expect(page.locator('#notifBellBtn')).toHaveCount(0);
    await expect(page.locator('a[href="cookzer-settings.html"]')).toHaveCount(0);
  });

  test('suggesting a meal auto-attributes to the locked family profile with no picker shown', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', KID_MODE_INIT);
    // Kid Mode collapses the planner to a single column — the locked
    // profile's own. Monday already has a seeded suggestion for it, so
    // use Tuesday (open) to click "+ Add Meal".
    const tuesday = page.locator('.planner-day-card').nth(1);
    await expect(tuesday.locator('.planner-person-col')).toHaveCount(1);
    await tuesday.locator('.planner-person-add-btn').click();

    await expect(page.locator('#pickerModal h3')).toContainText('Suggest a meal for');
    await expect(page.locator('#pickerModal h3')).toContainText('Emma');
    await expect(page.locator('.cz2-chip')).toHaveCount(0);

    await page.fill('#pickerModal input[type="text"]', 'Grilled cheese');
    await page.locator('#pickerModal button', { hasText: 'Suggest' }).click();

    await expect.poll(() => page.evaluate(() => window.__INSERTED_SUGGESTIONS__.length)).toBe(1);
    const inserted = await page.evaluate(() => window.__INSERTED_SUGGESTIONS__[0]);
    expect(inserted.suggested_by_family_profile_id).toBe('fam-1');
    expect(inserted.suggested_by_user_id).toBeUndefined();
  });

  test('unlocking with the right PIN clears Kid Mode', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-planner.html', 'planner-family.js', KID_MODE_INIT);
    // The real PIN was set at enable time via SHA-256; this seeded state
    // uses a placeholder hash, so unlock only needs to prove the wrong-PIN
    // path stays locked — the right-PIN path is exercised end-to-end by
    // hashKidModePin/CookzerKidMode.unlock directly here instead.
    const wrongResult = await page.evaluate(() => window.CookzerKidMode.unlock('0000'));
    expect(wrongResult).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('cz_kid_mode'))).not.toBeNull();

    await page.evaluate(async () => {
      const enc = new TextEncoder().encode('cookzer-kid-mode:1234');
      const buf = await crypto.subtle.digest('SHA-256', enc);
      const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      const state = JSON.parse(localStorage.getItem('cz_kid_mode'));
      state.pinHash = hash;
      localStorage.setItem('cz_kid_mode', JSON.stringify(state));
    });
    const rightResult = await page.evaluate(() => window.CookzerKidMode.unlock('1234'));
    expect(rightResult).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('cz_kid_mode'))).toBeNull();
  });
});
