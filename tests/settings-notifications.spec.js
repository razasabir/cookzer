const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// The toggle switches use a zero-size native checkbox (opacity/width/
// height: 0, per .switch input in cookzer-settings.html) with a visible
// styled slider sibling — real users click the slider, but Playwright's
// click-point math can't target a zero-size element even with
// force:true, so tests flip the checkbox directly and fire the same
// 'change' event a real click would.
async function toggleCheckbox(page, selector) {
  await page.locator(selector).evaluate((el) => {
    el.checked = !el.checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

test.describe('Settings — notification preferences', () => {
  test('all 10 toggles (8 categories + email + push) load with the saved state', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-notifications.js');
    await expect(page.locator('#prefFollows')).toBeChecked();
    await expect(page.locator('#prefHearts')).not.toBeChecked();
    await expect(page.locator('#prefComments')).toBeChecked();
    await expect(page.locator('#prefRemakes')).toBeChecked();
    await expect(page.locator('#prefChallengeJoins')).not.toBeChecked();
    await expect(page.locator('#prefMessages')).toBeChecked();
    await expect(page.locator('#prefReviews')).not.toBeChecked();
    await expect(page.locator('#prefGroupJoins')).toBeChecked();
    await expect(page.locator('#prefEmail')).not.toBeChecked();
    await expect(page.locator('#prefPush')).not.toBeChecked();
  });

  test('toggling a category checkbox saves the full preference set, including the email toggle', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-notifications.js');
    await toggleCheckbox(page, '#prefHearts');
    await expect.poll(() => page.evaluate(() => window.__PREFS_SAVED__.length)).toBe(1);
    const saved = await page.evaluate(() => window.__PREFS_SAVED__[0]);
    expect(saved.notify_hearts).toBe(true);
    expect(saved.notify_follows).toBe(true);
    expect(saved.notify_email).toBe(false);
  });

  test('toggling the "Also email me" switch saves notify_email', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-notifications.js');
    await toggleCheckbox(page, '#prefEmail');
    await expect.poll(() => page.evaluate(() => window.__PREFS_SAVED__.length)).toBe(1);
    expect(await page.evaluate(() => window.__PREFS_SAVED__[0].notify_email)).toBe(true);
  });

  test('turning push on without Firebase configured reverts the checkbox and shows why', async ({ page }) => {
    // firebase-config.js still ships with placeholder values until a real
    // Firebase project is wired up — CookzerPush.enable() should fail
    // gracefully rather than throw, and the checkbox should reflect that
    // it didn't actually turn on.
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-notifications.js');
    await toggleCheckbox(page, '#prefPush');
    await expect(page.locator('#prefPush')).not.toBeChecked();
    await expect(page.locator('#prefsStatus')).toContainText('not configured');
  });

  test('turning push off saves notify_push: false', async ({ page }) => {
    await page.addInitScript(() => {
      window.__SEED_PREFS__ = {
        notify_follows: true, notify_hearts: true, notify_comments: true,
        notify_remakes: true, notify_challenge_joins: true,
        notify_messages: true, notify_reviews: true, notify_group_joins: true,
        notify_email: true, notify_push: true,
      };
    });
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-notifications.js');
    await expect(page.locator('#prefPush')).toBeChecked();
    await toggleCheckbox(page, '#prefPush');
    await expect.poll(() => page.evaluate(() => window.__PREFS_SAVED__.length)).toBe(1);
    expect(await page.evaluate(() => window.__PREFS_SAVED__[0].notify_push)).toBe(false);
  });
});
