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

  test('creator can rename the group via the Edit button', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.goto(page.url() + '?id=g1');
    await expect(page.locator('#groupName')).toHaveText('Weeknight Cooks');

    await page.locator('#editGroupBtn').click();
    await expect(page.locator('.cz-modal-message')).toContainText('Group name');
    await expect(page.locator('.cz-modal-input')).toHaveValue('Weeknight Cooks');
    await page.locator('.cz-modal-input').fill('Sunday Roasts');
    await page.locator('.cz-modal-btn.cz-primary').click();

    // A second prompt follows for the description — accept its default.
    await expect(page.locator('.cz-modal-message')).toContainText('description');
    await page.locator('.cz-modal-btn.cz-primary').click();

    await expect(page.locator('#groupName')).toHaveText('Sunday Roasts');
  });

  test('non-creator sees no admin controls or Remove buttons', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group.html', 'group-admin.js');
    await page.addInitScript(() => {
      window.__STATE__.group.created_by = 'bob-1';
    });
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('#editGroupBtn')).toBeHidden();
    await expect(page.locator('#deleteGroupBtn')).toBeHidden();
    await expect(page.locator('#membersList .member-remove-btn')).toHaveCount(0);
  });
});
