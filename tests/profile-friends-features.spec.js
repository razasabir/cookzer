const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Migration 033: mutual friends, birthdays, Kitchen CV skill
// endorsements, and Kitchen CV written recommendations, all on
// cookzer-profile.html.
test.describe('profile: birthday + skills', () => {
  test('owner can set a birthday via the edit modal, shown on their own profile', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await page.goto(page.url());

    await expect(page.locator('#profileLocation')).not.toContainText('🎂');

    await page.locator('button', { hasText: 'Edit profile' }).click();
    await page.selectOption('#editBirthdayMonth', '3');
    await page.selectOption('#editBirthdayDay', '14');
    await page.locator('#editSaveBtn').click();

    await expect(page.locator('#profileLocation')).toContainText('🎂 March 14');
  });

  test('owner can add and remove a Kitchen CV skill via the real picker (no prompt)', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await page.goto(page.url());

    await expect(page.locator('#skillsSection')).toBeVisible();
    await expect(page.locator('.skill-chip')).toHaveCount(0);

    await page.locator('#addSkillBtn').click();
    await expect(page.locator('#pickerModal h3')).toContainText('Add a skill');
    await page.locator('.cz2-chip', { hasText: 'Knife Skills' }).click();

    await expect(page.locator('.skill-chip', { hasText: 'Knife Skills' })).toBeVisible();
    await page.locator('.skill-chip', { hasText: 'Knife Skills' }).locator('.skill-remove').click();
    await expect(page.locator('.skill-chip')).toHaveCount(0);
  });

  test('owner sees a pending recommendation and can approve it to show on their profile', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await page.goto(page.url());

    const card = page.locator('.recommendation-card');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Pending your approval');
    await expect(card).toContainText('Great cook');

    await card.locator('.recommendation-action-btn', { hasText: 'Show on profile' }).click();

    await expect(card).not.toContainText('Pending your approval');
    await expect(card.locator('.recommendation-action-btn', { hasText: 'Hide' })).toBeVisible();
  });
});

test.describe('profile: viewing someone else', () => {
  test('shows mutual friends in common', async ({ page }) => {
    // Migration 055: mutual friends now reads real friendships, not a
    // mutual-follow approximation — me-1 and alice-1 are both friends
    // with bob-1.
    const extraInit = `
      window.__STATE__.friendships.push(
        { user_id_1: 'bob-1', user_id_2: 'me-1' },
        { user_id_1: 'alice-1', user_id_2: 'bob-1' }
      );
    `;
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js', extraInit);
    await page.goto(page.url() + '?id=alice-1');

    await expect(page.locator('#mutualFriendsLine')).toBeVisible();
    await expect(page.locator('#mutualFriendsLine')).toContainText('1');
    await expect(page.locator('#mutualFriendsLine')).toContainText('Bob Ortiz');
  });

  test('can endorse and un-endorse a skill on someone else\'s Kitchen CV', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await page.goto(page.url() + '?id=alice-1');

    const chip = page.locator('.skill-chip', { hasText: 'Baking' });
    await expect(chip.locator('.skill-count')).toHaveText('0');
    await expect(chip).not.toHaveClass(/endorsed-by-me/);

    await chip.click();
    await expect(chip.locator('.skill-count')).toHaveText('1');
    await expect(chip).toHaveClass(/endorsed-by-me/);

    await chip.click();
    await expect(chip.locator('.skill-count')).toHaveText('0');
    await expect(chip).not.toHaveClass(/endorsed-by-me/);
  });

  test('can write a Kitchen CV recommendation via the real form (no prompt)', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await page.goto(page.url() + '?id=alice-1');

    const writeBtn = page.locator('#writeRecommendationBtn');
    await expect(writeBtn).toBeVisible();
    await writeBtn.click();
    await expect(page.locator('#pickerModal h3')).toContainText('Write a recommendation');

    await page.locator('#pickerModal textarea').fill('Alice makes the best sourdough in town.');
    await page.locator('#pickerModal button', { hasText: 'Submit' }).click();

    await expect(page.locator('.recommendation-card')).toContainText('Alice makes the best sourdough in town.');
    await expect(writeBtn).toBeHidden();
  });
});
