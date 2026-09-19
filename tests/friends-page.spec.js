const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { loadPageWithMock, blockExternalRequests } = require('./helpers/loadPage');

// People You May Know + Invite Friends on cookzer-friends.html
// (migration 033), and the invite-link referral-capture flow that
// auth-guard.js runs on every guarded page.
test.describe('People You May Know', () => {
  test('ranks group-mates above 2nd-degree follows and excludes people already followed', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    await page.goto(page.url());

    const rows = page.locator('#pymkList .pymk-row');
    await expect(rows).toHaveCount(2);
    // erin-1: shared group (weight 2) ranks above dave-1: 2nd-degree follow (weight 1).
    await expect(rows.nth(0)).toContainText('Erin Fox');
    await expect(rows.nth(1)).toContainText('Dave Kim');
    // frank-1 is already followed by me-1, so never suggested.
    await expect(page.locator('#pymkList')).not.toContainText('Frank Lee');
  });

  test('Follow removes the suggestion and records the follow', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    await page.goto(page.url());

    const erinRow = page.locator('#pymkList .pymk-row', { hasText: 'Erin Fox' });
    await erinRow.locator('.follow-toggle-btn').click();

    await expect(page.locator('#pymkList .pymk-row', { hasText: 'Erin Fox' })).toHaveCount(0);
    const call = await page.evaluate(() => window.__CALLS__.find((c) => c.op === 'insert' && c.table === 'follows' && c.payload.followee_id === 'erin-1'));
    expect(call).toBeTruthy();
  });

  test('dismissing a suggestion removes it and records the dismissal', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    await page.goto(page.url());

    const daveRow = page.locator('#pymkList .pymk-row', { hasText: 'Dave Kim' });
    await daveRow.locator('.pymk-dismiss-btn').click();

    await expect(page.locator('#pymkList .pymk-row', { hasText: 'Dave Kim' })).toHaveCount(0);
    const call = await page.evaluate(() => window.__CALLS__.find((c) => c.op === 'insert' && c.table === 'pymk_dismissals' && c.payload.dismissed_id === 'dave-1'));
    expect(call).toBeTruthy();
  });
});

test.describe('Invite friends', () => {
  test('shows a personal invite link and how many people joined through it', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    await page.goto(page.url());

    const link = await page.locator('#inviteLinkInput').inputValue();
    expect(link).toContain('cookzer-auth.html?ref=me-1&tab=signup');
    await expect(page.locator('#inviteStat')).toContainText('Nobody has joined through your invite yet');
  });
});

test.describe('Invite-link referral capture', () => {
  test('a stashed ?ref= id gets attributed to the new user and auto-follows the referrer', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cz_ref', 'carol-1');
    });
    await loadPageWithMock(page, 'cookzer-friends.html', 'friends-page.js');
    await page.goto(page.url());

    await expect.poll(() => page.evaluate(() => {
      const me = window.__STATE__.profiles.find((p) => p.id === 'me-1');
      return me && me.referred_by;
    })).toBe('carol-1');

    const followCall = await page.evaluate(() => window.__CALLS__.find((c) => c.op === 'insert' && c.table === 'follows' && c.payload.followee_id === 'carol-1'));
    expect(followCall).toBeTruthy();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('cz_ref'))).toBeNull();
  });

  test('does not overwrite an existing referred_by on a later visit', async ({ page }) => {
    // Registered in order — localStorage stashed, then the mock defines
    // window.__STATE__, then this patches it — all three run before the
    // page's own scripts on the single goto() below.
    await page.addInitScript(() => {
      localStorage.setItem('cz_ref', 'bob-1');
    });
    const mockSrc = fs.readFileSync(path.join(__dirname, 'mocks', 'friends-page.js'), 'utf8');
    await page.addInitScript({ content: mockSrc });
    await page.addInitScript(() => {
      window.__STATE__.profiles.find((p) => p.id === 'me-1').referred_by = 'alice-1';
    });
    await blockExternalRequests(page);
    await page.goto('file://' + path.join(__dirname, '..', 'cookzer-friends.html'));

    await expect.poll(() => page.evaluate(() => localStorage.getItem('cz_ref'))).toBeNull();
    const me = await page.evaluate(() => window.__STATE__.profiles.find((p) => p.id === 'me-1').referred_by);
    expect(me).toBe('alice-1');
  });
});
