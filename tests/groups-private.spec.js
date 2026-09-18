const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Both create-group and join-by-code redirect to cookzer-group.html
// immediately on success, which tears down this page's JS context (and
// the window.__…__ arrays these tests read from) essentially as fast
// as a local file:// navigation can complete — faster than a separate,
// later page.evaluate() round-trip can win the race. Clicking and
// reading the resulting state back happen inside one evaluate() call
// instead, with a couple of zero-length timeouts to let the click
// handler's own awaited inserts run first.
async function clickAndReadInsertedGroup(page, selector) {
  return page.evaluate(async (sel) => {
    document.querySelector(sel).click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    return window.__INSERTED_GROUPS__[0];
  }, selector);
}

async function clickAndReadRpcCall(page, selector) {
  return page.evaluate(async (sel) => {
    document.querySelector(sel).click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    return window.__RPC_CALLS__[0];
  }, selector);
}

test.describe('Private groups — create and join by invite code', () => {
  test('checking "Private" generates an invite code and creates the group as private', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-groups.html', 'groups-private.js');
    await page.click('#createGroupBtn');
    await page.fill('#groupNameInput', 'The Smiths');
    await page.check('#groupPrivateInput');

    const inserted = await clickAndReadInsertedGroup(page, '#saveGroupBtn');
    expect(inserted.is_private).toBe(true);
    expect(inserted.invite_code).toMatch(/^[A-Z0-9]{8}$/);
  });

  test('leaving "Private" unchecked creates an ordinary public group with no invite code', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-groups.html', 'groups-private.js');
    await page.click('#createGroupBtn');
    await page.fill('#groupNameInput', 'Slow Cooker Fanatics 2');

    const inserted = await clickAndReadInsertedGroup(page, '#saveGroupBtn');
    expect(inserted.is_private).toBe(false);
    expect(inserted.invite_code).toBeNull();
  });

  test('joining with a valid code calls join_private_group with the uppercased code', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-groups.html', 'groups-private.js');
    await page.click('#joinGroupBtn');
    await page.fill('#joinCodeInput', 'goodcode');

    const call = await clickAndReadRpcCall(page, '#submitJoinBtn');
    expect(call.name).toBe('join_private_group');
    expect(call.args.p_invite_code).toBe('GOODCODE');
  });

  test('joining with an invalid code shows the error instead of redirecting', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-groups.html', 'groups-private.js');
    await page.click('#joinGroupBtn');
    await page.fill('#joinCodeInput', 'WRONGCODE');
    await page.click('#submitJoinBtn');

    await expect(page.locator('.cz-modal-message')).toContainText("doesn't match");
  });

  test('a private group in the listing shows a lock icon, a public one doesn\'t', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-groups.html', 'groups-private.js');
    await expect(page.locator('.group-card', { hasText: 'The Smiths' }).locator('.group-name')).toContainText('🔒');
    await expect(page.locator('.group-card', { hasText: 'Slow Cooker Fanatics' }).locator('.group-name')).not.toContainText('🔒');
  });
});
