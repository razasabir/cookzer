const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Migration 032: group_polls, group_poll_options, group_poll_votes.
test.describe('group polls page', () => {
  test('member sees the poll and can vote, with results updating', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-polls.html', 'group-polls.js');
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('.poll-card')).toHaveCount(1);
    await expect(page.locator('.poll-card')).toContainText('Pizza or tacos Friday?');

    await page.locator('.poll-option-row', { hasText: 'Pizza' }).click();
    await expect.poll(() => page.evaluate(() => window.__STATE__.votes.some((v) => v.user_id === 'me-1'))).toBe(true);
    await expect(page.locator('.poll-option-row.selected')).toContainText('Pizza');
    await expect(page.locator('.poll-option-row.selected .poll-option-pct')).toHaveText('100%');
  });

  test('member can create a poll with options via the real form (no numbered-list prompt)', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-polls.html', 'group-polls.js');
    await page.goto(page.url() + '?id=g1');

    await page.locator('#newPollBtn').click();
    await expect(page.locator('#pickerModal h3')).toContainText('New poll');
    const textInputs = page.locator('#pickerModal input[type="text"]');
    await textInputs.nth(0).fill('6pm or 7pm?');
    await textInputs.nth(1).fill('6pm');
    await textInputs.nth(2).fill('7pm');
    await page.locator('#pickerModal button', { hasText: 'Create' }).click();

    await expect(page.locator('.poll-card')).toHaveCount(2);
    await expect(page.locator('.poll-card', { hasText: '6pm or 7pm?' })).toBeVisible();
  });

  test('non-member is told to join rather than seeing the poll list', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-polls.html', 'group-polls.js');
    await page.addInitScript(() => {
      window.__STATE__.myRole = null;
    });
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('#newPollBtn')).toBeHidden();
    await expect(page.locator('#pollsEmpty')).toContainText('Join this group');
  });
});
