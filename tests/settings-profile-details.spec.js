const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Settings — profile visibility, social links, dietary tags', () => {
  test('visibility toggle shows the saved state and switching it saves the new value', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-profile-details.js');

    await expect(page.locator('[data-value="public"]')).toHaveClass(/active/);
    await expect(page.locator('[data-value="followers"]')).not.toHaveClass(/active/);

    await page.click('[data-value="followers"]');
    await expect(page.locator('[data-value="followers"]')).toHaveClass(/active/);
    await expect(page.locator('[data-value="public"]')).not.toHaveClass(/active/);
    await expect(page.locator('#visibilityStatus')).toContainText('Only your followers');

    const updates = await page.evaluate(() => window.__PROFILE_UPDATES__);
    expect(updates.some((u) => u.profile_visibility === 'followers')).toBe(true);
  });

  test('social links prefill from the saved profile and Save writes all four fields', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-profile-details.js');

    await expect(page.locator('#socialInstagram')).toHaveValue('https://instagram.com/testcook');
    await expect(page.locator('#socialYoutube')).toHaveValue('');

    await page.fill('#socialYoutube', 'https://youtube.com/@testcook');
    await page.click('#saveSocialLinksBtn');

    await expect(page.locator('#profileDetailsStatus')).toHaveText('Saved.');
    const updates = await page.evaluate(() => window.__PROFILE_UPDATES__);
    const last = updates[updates.length - 1];
    expect(last.social_links.instagram).toBe('https://instagram.com/testcook');
    expect(last.social_links.youtube).toBe('https://youtube.com/@testcook');
  });

  test('dietary tags render as toggleable chips, not a text prompt, and save immediately', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-settings.html', 'settings-profile-details.js');

    const veganChip = page.locator('.tag-chip', { hasText: 'Vegan' });
    await expect(veganChip).toHaveClass(/active/);
    const ketoChip = page.locator('.tag-chip', { hasText: 'Keto' });
    await expect(ketoChip).not.toHaveClass(/active/);

    await ketoChip.click();
    await expect(ketoChip).toHaveClass(/active/);
    const updates = await page.evaluate(() => window.__PROFILE_UPDATES__);
    const last = updates[updates.length - 1];
    expect(last.dietary_tags).toEqual(expect.arrayContaining(['Vegan', 'Keto']));

    await veganChip.click();
    await expect(veganChip).not.toHaveClass(/active/);
    const updates2 = await page.evaluate(() => window.__PROFILE_UPDATES__);
    expect(updates2[updates2.length - 1].dietary_tags).toEqual(['Keto']);
  });
});
