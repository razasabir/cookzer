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

test.describe('Admin portal: Governance & Policy', () => {
  test('shows the current policy version, DSAR queue, and an active legal hold', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="governance"]');
    await expect(page.locator('.ab-content')).toContainText('Terms of Service');
    await expect(page.locator('.ab-content')).toContainText('v1');
    await expect(page.locator('.ab-content')).toContainText('Alice Diaz');
    await expect(page.locator('.ab-content')).toContainText('Copyright dispute');
    await expect(page.locator('#dsarBadge')).toHaveText('1');
  });

  test('publishing a new policy version calls admin_publish_policy with the new content', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="governance"]');
    await page.click('[data-act="publish-policy"][data-type="terms"]');
    await page.fill('#policyContent-terms', 'Updated terms text');
    await page.click('[data-act="submit-policy"][data-type="terms"]');
    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_publish_policy'));
    const call = await page.evaluate(() => window.__RPC_CALLS__.find((c) => c.fn === 'admin_publish_policy'));
    expect(call.args.p_type).toBe('terms');
    expect(call.args.p_content).toBe('Updated terms text');
  });

  test('fulfilling a deletion request confirms then calls admin_fulfill_deletion_request', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.evaluate(() => {
      window.__STATE__.dsar_requests.push({ id: 'dsar-2', user_id: 'bob-1', type: 'delete', status: 'pending', note: null, created_at: new Date().toISOString() });
    });
    await page.click('.ab-nav-item[data-view="governance"]');
    await page.click('[data-act="dsar-delete"][data-id="dsar-2"]');
    await page.locator('.cz-modal-overlay .cz-modal-btn.cz-danger').click();
    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_fulfill_deletion_request'));
    const call = await page.evaluate(() => window.__RPC_CALLS__.find((c) => c.fn === 'admin_fulfill_deletion_request'));
    expect(call.args.p_request_id).toBe('dsar-2');
  });

  test('placing a legal hold requires a target type chip, then calls admin_place_legal_hold', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="governance"]');
    await page.click('#holdTargetChips .ab-chip[data-type="user"]');
    await page.fill('#holdTargetId', 'bob-1');
    await page.fill('#holdReason', 'fraud investigation');
    await page.click('#placeHoldBtn');
    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_place_legal_hold'));
    const call = await page.evaluate(() => window.__RPC_CALLS__.find((c) => c.fn === 'admin_place_legal_hold'));
    expect(call.args.p_target_type).toBe('user');
    expect(call.args.p_target_id).toBe('bob-1');
  });

  test('the CSAM queue is explicit that detection is not automated', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="governance"]');
    await expect(page.locator('.ab-content')).toContainText('does not perform automated hash-matching');
  });
});

test.describe('Admin portal: Platform Ops', () => {
  test('toggling a feature flag off calls admin_set_feature_flag with enabled=false', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="platform-ops"]');
    await expect(page.locator('.ab-content')).toContainText('new_composer');
    await page.click('[data-act="toggle-flag"][data-key="new_composer"]');
    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_set_feature_flag'));
    const call = await page.evaluate(() => window.__RPC_CALLS__.find((c) => c.fn === 'admin_set_feature_flag'));
    expect(call.args.p_key).toBe('new_composer');
    expect(call.args.p_enabled).toBe(false);
  });

  test('deactivating an announcement calls admin_deactivate_announcement', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="platform-ops"]');
    await expect(page.locator('.ab-content')).toContainText('Scheduled maintenance tonight');
    await page.click('[data-act="deactivate-announcement"]');
    await page.locator('.cz-modal-overlay .cz-modal-btn.cz-primary').click();
    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_deactivate_announcement'));
  });

  test('sending a broadcast confirms (danger) then reports the recipient count', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="platform-ops"]');
    await page.fill('#broadcastMessage', 'Cookzer 2.0 is here');
    await page.click('#sendBroadcastBtn');
    await page.locator('.cz-modal-overlay .cz-modal-btn.cz-danger').click();
    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_broadcast_notification'));
    await expect(page.locator('.cz-modal-overlay .cz-modal-message')).toContainText('Sent to');
  });

  test('rate-limit editor is explicit that limits are not enforced yet', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="platform-ops"]');
    await expect(page.locator('.ab-content')).toContainText('nothing in the app enforces these limits yet');
  });
});

test.describe('Admin portal: Support Tooling', () => {
  test('the ticket queue defaults to open tickets and a row opens the detail view', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="support"]');
    await expect(page.locator('table.ab-queue')).toContainText('Cannot upload photo');
    await expect(page.locator('#ticketBadge')).toHaveText('1');
    await page.click('tr[data-id="ticket-1"]');
    await expect(page).toHaveURL(/#support\/ticket-1/);
    await expect(page.locator('.ab-user-card-name')).toHaveText('Cannot upload photo');
    await expect(page.locator('.ab-detail-grid')).toContainText('Getting a 500 error every time');
  });

  test('replying, assigning to self, and resolving all call the right RPCs', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.goto(page.url().split('#')[0] + '#support/ticket-1');

    await page.fill('#ticketReply', 'Can you share a screenshot?');
    await page.click('#sendReplyBtn');
    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'post_ticket_message'));

    await page.click('#assignToMeBtn');
    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_assign_ticket'));
    const assignCall = await page.evaluate(() => window.__RPC_CALLS__.find((c) => c.fn === 'admin_assign_ticket'));
    expect(assignCall.args.p_assignee).toBe('admin-1');

    await page.click('#resolveTicketBtn');
    await page.waitForFunction(() => window.__RPC_CALLS__.some((c) => c.fn === 'admin_resolve_ticket'));
    await expect(page.locator('.ab-detail-grid')).toContainText('resolved');
  });
});

test.describe('Admin portal: Audit Log', () => {
  test('lists the seeded audit-log entry and the actor name', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="audit-log"]');
    await expect(page.locator('table.ab-queue')).toContainText('restaurant_verified');
    await expect(page.locator('table.ab-queue')).toContainText('Raza');
  });

  test('filtering by action type re-queries and narrows the results', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="audit-log"]');
    await page.fill('#auditSearchInput', 'nonexistent_action');
    await page.click('#auditSearchBtn');
    await expect(page.locator('.ab-content')).toContainText('No matching actions.');
  });
});

test.describe('Admin portal: Analytics', () => {
  test('shows headline KPI totals computed from the mock data', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="analytics"]');
    await expect(page.locator('.ab-kpi-tile', { hasText: 'Total users' }).locator('.ab-kpi-value')).toHaveText('3');
    await expect(page.locator('.ab-kpi-tile', { hasText: 'Total posts' }).locator('.ab-kpi-value')).toHaveText('1');
    await expect(page.locator('.ab-kpi-tile', { hasText: 'Total recipes' }).locator('.ab-kpi-value')).toHaveText('1');
  });

  test('the top-posts leaderboard shows the seeded post with its heart count', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-admin.html', 'admin-portal.js');
    await page.click('.ab-nav-item[data-view="analytics"]');
    await expect(page.locator('.ab-content')).toContainText('Spammy promo post');
    await expect(page.locator('.ab-content')).toContainText('1 ♥');
  });
});
