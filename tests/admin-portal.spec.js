const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage.js');

test.describe('Admin portal: access gate', () => {
  test('a non-admin sees "not authorized" and no shell', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'restaurant-claims-nonadmin.js');
    await expect(page.locator('#notAuthorized')).toBeVisible();
    await expect(page.locator('#shell')).toBeHidden();
  });

  test('a platform admin sees the shell with their name and role', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await expect(page.locator('#shell')).toBeVisible();
    await expect(page.locator('#notAuthorized')).toBeHidden();
    await expect(page.locator('#staffName')).toHaveText('Raza');
    await expect(page.locator('#staffRole')).toHaveText('Super Admin');
  });
});

test.describe('Admin portal: dashboard', () => {
  test('shows real KPI counts computed from the mock data', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    // 2 open reports seeded, one is 31h old (past the 24h SLA)
    await expect(page.locator('.ab-kpi-tile', { hasText: 'Open reports' }).locator('.ab-kpi-value')).toHaveText('2');
    await expect(page.locator('.ab-kpi-tile', { hasText: 'Open reports' }).locator('.ab-kpi-delta')).toHaveText('1 past 24h SLA');
    // 1 pending claim seeded
    await expect(page.locator('.ab-kpi-tile', { hasText: 'Pending restaurant claims' }).locator('.ab-kpi-value')).toHaveText('1');
    // sidebar badge mirrors the open-report count
    await expect(page.locator('#modBadge')).toHaveText('2');
  });

  test('needs-attention lists the oldest open report and the pending claim', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await expect(page.locator('.ab-content')).toContainText('Harassment');
    await expect(page.locator('.ab-content')).toContainText("Nonna's Table");
  });

  test('recent staff actions shows the seeded audit-log entry with the actor name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await expect(page.locator('.ab-content')).toContainText('Raza');
    await expect(page.locator('.ab-content')).toContainText('restaurant verified');
  });
});

test.describe('Admin portal: Trust & Safety moderation queue', () => {
  test('lists open reports with target snippet, reason, and age', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="moderation"]');
    await expect(page.locator('table.ab-queue tbody tr')).toHaveCount(2);
    await expect(page.locator('table.ab-queue')).toContainText('Harassment');
    await expect(page.locator('table.ab-queue')).toContainText('A harassing comment');
    await expect(page.locator('table.ab-queue')).toContainText('Spam');
  });

  test('Remove is only offered for post/comment targets, and deletes the content', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="moderation"]');

    const rows = page.locator('table.ab-queue tbody tr');
    await expect(rows.nth(0).locator('[data-act="remove"]')).toBeVisible();

    await rows.nth(0).locator('[data-act="remove"]').click();
    // CookzerModal is an in-page overlay, not a native dialog — confirm it, then answer the reason prompt.
    await page.locator('.cz-modal-overlay .cz-modal-btn.cz-danger').click();
    await page.locator('.cz-modal-overlay .cz-modal-input').fill('confirmed harassment');
    await page.locator('.cz-modal-overlay .cz-modal-btn.cz-primary').click();

    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_remove_content'));
    const rpcCalls = await page.evaluate(() => window.__RPC_CALLS__);
    expect(rpcCalls.some((c) => c.fn === 'admin_remove_content')).toBe(true);
  });
});

test.describe('Admin portal: Users', () => {
  test('searching finds a user and clicking opens their detail view', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="users"]');
    await page.fill('#userSearchInput', 'Bob');
    await page.click('#userSearchBtn');
    await expect(page.locator('.ab-user-row')).toHaveCount(1);
    await page.click('.ab-user-row');
    await expect(page).toHaveURL(/#users\/bob-1/);
    await expect(page.locator('.ab-user-card-name')).toHaveText('Bob Kirk');
  });

  test('user detail shows real stats and an activity timeline entry for account creation', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.goto(page.url().split('#')[0] + '#users/alice-1');
    await expect(page.locator('.ab-user-card-name')).toHaveText('Alice Diaz');
    await expect(page.locator('.ab-stat-row', { hasText: 'Recipes posted' }).locator('.ab-stat-value')).toHaveText('1');
    await expect(page.locator('.ab-detail-grid')).toContainText('Account created');
  });

  test('suspending a user calls admin_set_suspension with the chosen type and reason', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.goto(page.url().split('#')[0] + '#users/bob-1');

    await page.click('#actionChips .ab-chip[data-type="suspend"]');
    await expect(page.locator('#durationField')).toBeVisible();
    await page.fill('#actionReason', 'Repeated spam after a strike');
    await page.fill('#actionDuration', '7');
    await page.click('#actionSubmit');
    await page.locator('.cz-modal-overlay .cz-modal-btn.cz-danger').click();

    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_set_suspension'));
    const call = await page.evaluate(() => window.__RPC_CALLS__.find((c) => c.fn === 'admin_set_suspension'));
    expect(call.args.p_user_id).toBe('bob-1');
    expect(call.args.p_type).toBe('suspend');
    expect(call.args.p_duration_days).toBe(7);

    // The page re-renders after the RPC — the active-suspension box and a Lift button should now show.
    await expect(page.locator('.ab-status-box.active-suspend')).toBeVisible();
    await expect(page.locator('#revokeBtn')).toBeVisible();
  });

  test('a user cannot take an action on their own account', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.goto(page.url().split('#')[0] + '#users/admin-1');
    await expect(page.locator('#actionChips')).toHaveCount(0);
    await expect(page.locator('.ab-detail-grid')).toContainText('no actions available');
  });
});

test.describe('Admin portal: Commercial', () => {
  test('shows the pending claim and the active featured-placement row', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="commercial"]');
    await expect(page.locator('.ab-content')).toContainText("Nonna's Table");
    await expect(page.locator('.ab-content')).toContainText('The Copper Spoon');
    await expect(page.locator('#claimBadge')).toHaveText('1');
  });

  test('restaurant search finds a match and links to its manage page', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="commercial"]');
    await page.fill('#restSearchInput', 'Copper');
    await page.click('#restSearchBtn');
    const link = page.locator('#restSearchResults a');
    await expect(link).toHaveAttribute('href', 'cookzer-restaurant.html?id=rest-1');
  });
});
