const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// A group's own Challenges page: scoped to that group's members only,
// with its own create/join/leaderboard flow separate from the sitewide
// Challenges page.
test.describe('Group Challenges page', () => {
  test('a member sees both the active and ended challenge, with the winner finalized on the ended one', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-challenges.html', 'group-challenges.js');
    await page.goto(page.url() + '?id=group-1');

    const cards = page.locator('.challenge-card');
    await expect(cards).toHaveCount(2);

    const active = cards.filter({ hasText: 'Sunday Roast Showdown' });
    await expect(active).toContainText('🌍 Cuisine');
    await expect(active.locator('.challenge-btn')).toHaveText('Join the challenge');

    const ended = cards.filter({ hasText: 'Taco Tuesday' });
    await expect(ended).toContainText('🏆 Winner: Alice Diaz');
  });

  test('joining the active challenge upserts an entry scoped to this group\'s challenge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-challenges.html', 'group-challenges.js');
    await page.goto(page.url() + '?id=group-1');

    const active = page.locator('.challenge-card').filter({ hasText: 'Sunday Roast Showdown' });
    await active.locator('.challenge-btn').click();
    await expect(active.locator('.challenge-btn')).toHaveText('Joined ✓');

    const upserts = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'upsert' && c.table === 'challenge_entries'));
    expect(upserts[0].payload).toMatchObject({ challenge_id: 'gchal-active', user_id: 'me-1' });
  });

  test('the leaderboard toggle shows the entrant and their recipe', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-challenges.html', 'group-challenges.js');
    await page.goto(page.url() + '?id=group-1');

    const active = page.locator('.challenge-card').filter({ hasText: 'Sunday Roast Showdown' });
    await active.locator('.challenge-leaderboard-toggle').click();
    const item = active.locator('.challenge-leaderboard-item');
    await expect(item).toHaveCount(1);
    await expect(item).toContainText('Alice Diaz');
    await expect(item).toContainText('Herb-Crusted Chicken');
  });

  test('starting a new group challenge scopes it to this group, not sitewide', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-challenges.html', 'group-challenges.js');
    await page.goto(page.url() + '?id=group-1');

    await page.click('#newChallengeBtn');
    await page.fill('#pickerModal input[type="text"]', 'Bake-Off');
    await page.locator('#pickerModal button', { hasText: 'Start it' }).click();

    await expect(page.locator('#pickerOverlay')).toBeHidden();
    await expect(page.locator('.challenge-card').filter({ hasText: 'Bake-Off' })).toBeVisible();
    const inserted = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'insert' && c.table === 'challenges'));
    expect(inserted[0].payload.group_id).toBe('group-1');
  });

  test('a non-member sees a join prompt instead of the challenges list', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-challenges.html', 'group-challenges.js', `
      window.__STATE__.group_members = [];
    `);
    await page.goto(page.url() + '?id=group-1');

    await expect(page.locator('.challenge-card')).toHaveCount(0);
    await expect(page.locator('#newChallengeBtn')).toBeHidden();
    await expect(page.locator('#challengesEmpty')).toContainText('Join this group');
  });
});
