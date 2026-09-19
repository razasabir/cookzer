const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Regression test for migration 020's group admin controls: the group
// creator ("me-1" in the mock, matching group.created_by) can edit/delete
// the group and remove other members; a non-creator sees none of that.
test.describe('group admin controls', () => {
  test('creator sees edit/delete and can remove a member', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('#editGroupBtn')).toBeVisible();
    await expect(page.locator('#deleteGroupBtn')).toBeVisible();
    await expect(page.locator('#membersList .member-row')).toHaveCount(2);

    const bobRow = page.locator('#membersList .member-row', { hasText: 'Bob Ortiz' });
    await expect(bobRow.locator('.member-remove-btn')).toHaveText('Remove');
    await expect(page.locator('#membersList .member-row', { hasText: 'Me' }).locator('.member-owner-tag')).toHaveText('Owner');

    await bobRow.locator('.member-remove-btn').click();
    await expect(page.locator('.cz-modal-message')).toContainText('Remove Bob Ortiz');
    await page.locator('.cz-modal-btn.cz-danger').click();

    await expect(page.locator('#membersList .member-row')).toHaveCount(1);
    const calls = await page.evaluate(() => window.__CALLS__);
    expect(calls).toContainEqual(expect.objectContaining({ op: 'delete', table: 'group_members', filters: { group_id: 'g1', user_id: 'bob-1' } }));
  });

  test('creator can rename the group via the real Edit modal (no numbered-list prompt)', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.goto(page.url() + '?id=g1');
    await expect(page.locator('#groupName')).toHaveText('Weeknight Cooks');

    await page.locator('#editGroupBtn').click();
    await expect(page.locator('#pickerModal h3')).toContainText('Edit group');
    await expect(page.locator('#pickerModal input[type="text"]')).toHaveValue('Weeknight Cooks');
    await page.fill('#pickerModal input[type="text"]', 'Sunday Roasts');
    await page.locator('#pickerModal button', { hasText: 'Save' }).click();

    await expect(page.locator('#groupName')).toHaveText('Sunday Roasts');
    await expect(page.locator('#pickerOverlay')).toBeHidden();
  });

  test('creator can add an existing person to the group by searching their name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('#addMembersRow')).toBeVisible();
    await page.fill('#addMembersInput', 'Carol');
    await expect(page.locator('.cz2-row', { hasText: 'Carol Diaz' })).toBeVisible();
    await page.locator('.cz2-row', { hasText: 'Carol Diaz' }).locator('.cz2-row-action').click();

    await expect.poll(() => page.evaluate(() => window.__CALLS__.some((c) => c.op === 'insert' && c.table === 'group_members'))).toBe(true);
    const call = await page.evaluate(() => window.__CALLS__.find((c) => c.op === 'insert' && c.table === 'group_members'));
    expect(call.payload.user_id).toBe('carol-1');
    await expect(page.locator('#membersList .member-row', { hasText: 'Carol Diaz' })).toBeVisible();
  });

  test('creator can promote a member to admin, which shows the Admin tag', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.goto(page.url() + '?id=g1');

    const bobRow = page.locator('#membersList .member-row', { hasText: 'Bob Ortiz' });
    await expect(bobRow.locator('.member-admin-tag')).toHaveCount(0);
    await bobRow.locator('.member-role-btn').click();

    await expect(bobRow.locator('.member-admin-tag')).toHaveText('Admin');
    await expect(bobRow.locator('.member-role-btn')).toHaveText('Remove admin');
  });

  test('non-creator sees no admin controls, Remove buttons, or add-members search', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.addInitScript(() => {
      window.__STATE__.group.created_by = 'bob-1';
    });
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('#editGroupBtn')).toBeHidden();
    await expect(page.locator('#deleteGroupBtn')).toBeHidden();
    await expect(page.locator('#membersList .member-remove-btn')).toHaveCount(0);
    await expect(page.locator('#addMembersRow')).toBeHidden();
  });
});
