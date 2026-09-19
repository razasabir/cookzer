const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Covers the group features added on top of migration 020's admin controls:
// pinned posts, group rules, per-group mute, and ownership transfer
// (migrations 030-032). Reuses the group-admin mock, extended with posts,
// muted, and rules state.
test.describe('group features: pins, rules, mute, ownership transfer', () => {
  test('creator can pin a post, which floats it to the top with a badge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.goto(page.url() + '?id=g1');

    const cards = page.locator('.feed-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('First post');

    const secondCard = cards.nth(1);
    await expect(secondCard).toContainText('Second post');
    await secondCard.locator('.card-delete-btn[title="Pin to top"]').click();

    await expect.poll(() => page.evaluate(() => window.__CALLS__.some((c) => c.op === 'update' && c.table === 'posts'))).toBe(true);
    const call = await page.evaluate(() => window.__CALLS__.find((c) => c.op === 'update' && c.table === 'posts'));
    expect(call.payload.pinned_at).toBeTruthy();

    const pinnedCard = page.locator('.feed-card').first();
    await expect(pinnedCard).toContainText('Second post');
    await expect(pinnedCard.locator('.pinned-badge')).toHaveText('📌 Pinned');
  });

  test('non-admin member sees no pin button', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.addInitScript(() => {
      window.__STATE__.group.created_by = 'bob-1';
    });
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('.card-delete-btn[title="Pin to top"]')).toHaveCount(0);
  });

  test('creator can set group rules via the edit modal, shown on the page', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('#groupRules')).toBeHidden();

    await page.locator('#editGroupBtn').click();
    await page.fill('#pickerModal textarea >> nth=1', 'Be kind. No spam.');
    await page.locator('#pickerModal button', { hasText: 'Save' }).click();

    await expect(page.locator('#groupRules')).toBeVisible();
    await expect(page.locator('#groupRules')).toContainText('Be kind. No spam.');
  });

  test('any member can mute the group, and unmute it again', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.goto(page.url() + '?id=g1');

    const muteBtn = page.locator('#muteGroupBtn');
    await expect(muteBtn).toBeVisible();
    await expect(muteBtn).toHaveText('🔔');

    await muteBtn.click();
    await expect(muteBtn).toHaveText('🔕 Muted');
    const call = await page.evaluate(() => window.__CALLS__.find((c) => c.op === 'update' && c.table === 'group_members' && c.payload.muted === true));
    expect(call).toBeTruthy();

    await muteBtn.click();
    await expect(muteBtn).toHaveText('🔔');
  });

  test('creator can transfer ownership to another member', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('#transferGroupBtn')).toBeVisible();
    await page.locator('#transferGroupBtn').click();
    await expect(page.locator('#pickerModal h3')).toContainText('Transfer ownership');

    await page.locator('.cz2-row', { hasText: 'Bob Ortiz' }).locator('.cz2-row-action').click();
    await page.locator('.cz-modal-btn.cz-danger').click();

    await expect.poll(() => page.evaluate(() => window.__STATE__.group.created_by)).toBe('bob-1');
    await expect(page.locator('#deleteGroupBtn')).toBeHidden();
    await expect(page.locator('#transferGroupBtn')).toBeHidden();
    await expect(page.locator('#membersList .member-row', { hasText: 'Bob Ortiz' }).locator('.member-owner-tag')).toHaveText('Owner');
  });
});
