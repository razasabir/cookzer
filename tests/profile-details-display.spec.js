const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Rendering for migration 053's new profile columns: dietary tags,
// social links, the auto-computed Verified Creator badge, and the
// own-profile completeness nudge.
test.describe('Profile page — dietary tags, social links, verified badge, completeness nudge', () => {
  test('dietary tags and social links render on a visited profile that has them', async ({ page }) => {
    const extraInit = `
      const alice = window.__STATE__.profiles.find((p) => p.id === 'alice-1');
      alice.dietary_tags = ['Vegan', 'Gluten-Free'];
      alice.social_links = { instagram: 'https://instagram.com/alice', website: 'https://alicebakes.com' };
    `;
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js', extraInit);

    await expect(page.locator('#dietaryTagsRow')).toBeVisible();
    await expect(page.locator('#dietaryTagsRow .tag-chip')).toHaveCount(2);
    await expect(page.locator('#dietaryTagsRow')).toContainText('Vegan');
    await expect(page.locator('#dietaryTagsRow')).toContainText('Gluten-Free');

    await expect(page.locator('#socialLinksRow')).toBeVisible();
    const links = page.locator('#socialLinksRow a');
    await expect(links).toHaveCount(2);
    await expect(page.locator('#socialLinksRow a[title="Instagram"]')).toHaveAttribute('href', 'https://instagram.com/alice');
  });

  test('no tags or links means the rows stay hidden, not empty', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js');
    await expect(page.locator('#dietaryTagsRow')).toBeHidden();
    await expect(page.locator('#socialLinksRow')).toBeHidden();
  });

  test('a verified creator shows the badge next to their name', async ({ page }) => {
    const extraInit = `
      window.__STATE__.profiles.find((p) => p.id === 'alice-1').is_verified_creator = true;
    `;
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js', extraInit);
    await expect(page.locator('#verifiedCreatorBadge')).toBeVisible();
  });

  test('a non-verified profile hides the badge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js');
    await expect(page.locator('#verifiedCreatorBadge')).toBeHidden();
  });

  test('an incomplete own profile shows a dismissible completeness nudge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');
    await expect(page.locator('#completenessNudge')).toBeVisible();
    await expect(page.locator('#completenessNudgeText')).toContainText('%');

    await page.click('#completenessNudgeDismiss');
    await expect(page.locator('#completenessNudge')).toBeHidden();
  });

  test('the nudge never shows on someone else\'s profile', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js');
    await expect(page.locator('#completenessNudge')).toBeHidden();
  });
});
