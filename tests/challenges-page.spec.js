const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// The Challenges page redesign: multiple concurrent challenges instead
// of one global slot, a weekly auto-seed so the slate is never empty, a
// "Start a Challenge" flow, per-card leaderboards, and winner
// finalization on past challenges.
test.describe('Challenges page — active challenges', () => {
  test('shows the seeded active challenge without duplicating it via the weekly auto-seed', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-challenges.html', 'challenges-page.js');
    const cards = page.locator('.challenge-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Budget Bites');
    await expect(cards.first()).toContainText('💰 Budget');
    await expect(cards.first()).toContainText('This week\'s featured challenge');

    const insertedChallenges = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'insert' && c.table === 'challenges'));
    expect(insertedChallenges).toHaveLength(0);
  });

  test('joining a challenge upserts an entry and flips the button to Joined', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-challenges.html', 'challenges-page.js');
    const card = page.locator('.challenge-card').first();
    const joinBtn = card.locator('.challenge-btn');
    await expect(joinBtn).toHaveText('Join the challenge');

    await joinBtn.click();

    await expect(card.locator('.challenge-btn')).toHaveText('Joined ✓');
    const upserts = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'upsert' && c.table === 'challenge_entries'));
    expect(upserts.length).toBeGreaterThan(0);
    expect(upserts[0].payload.challenge_id).toBe('chal-active');
    expect(upserts[0].payload.user_id).toBe('me-1');
  });

  test('the leaderboard toggle expands and shows the entrant with their heart count', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-challenges.html', 'challenges-page.js');
    const card = page.locator('.challenge-card').first();
    const toggle = card.locator('.challenge-leaderboard-toggle');
    await expect(card.locator('.leaderboard-item')).toHaveCount(0);

    await toggle.click();

    const item = card.locator('.leaderboard-item');
    await expect(item).toHaveCount(1);
    await expect(item).toContainText('Alice Diaz');
    await expect(item).toContainText('Lentil Soup');
    await expect(item.locator('.entry-hearts')).toHaveText('0 ❤️');
  });

  test('"Start a Challenge" creates a new one that appears alongside the existing one', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-challenges.html', 'challenges-page.js');
    await page.click('#newChallengeBtn');
    await expect(page.locator('#pickerModal h3')).toContainText('Start a Challenge');

    await page.fill('#pickerModal input[type="text"]', 'One-Pot Wonders');
    await page.locator('.cz2-chip', { hasText: '⚡ Speed' }).click();
    await page.locator('.cz2-chip', { hasText: '3 days' }).click();
    await page.locator('#pickerModal button', { hasText: 'Start it' }).click();

    await expect(page.locator('#pickerOverlay')).toBeHidden();
    const cards = page.locator('.challenge-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: 'One-Pot Wonders' })).toContainText('⚡ Speed');
    await expect(cards.filter({ hasText: 'One-Pot Wonders' })).toContainText('Started by Me');

    const inserted = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'insert' && c.table === 'challenges'));
    expect(inserted).toHaveLength(1);
    expect(inserted[0].payload.category).toBe('speed');
    expect(inserted[0].payload.group_id).toBeUndefined();
  });

  test('shows a reminder when you joined but haven\'t submitted a dish, ending soon', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-challenges.html', 'challenges-page.js', `
      window.__STATE__.challenges.find((c) => c.id === 'chal-active').ends_at = new Date(Date.now() + 3 * 3600000).toISOString();
      window.__STATE__.challenge_entries.push({ id: 'entry-mine', challenge_id: 'chal-active', user_id: 'me-1', post_id: null });
    `);

    const card = page.locator('.challenge-card').first();
    await expect(card.locator('.challenge-btn')).toHaveText('Joined ✓');
    await expect(card.locator('.challenge-card-reminder')).toContainText('you joined but haven\'t entered a dish yet');
  });
});

test.describe('Challenges page — empty slate', () => {
  test('auto-seeds this week\'s themed challenge when nothing sitewide is active', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-challenges.html', 'challenges-page.js', `
      window.__STATE__.challenges = window.__STATE__.challenges.filter((c) => c.id !== 'chal-active');
    `);

    await expect(page.locator('.challenge-card')).toHaveCount(1);
    await expect(page.locator('#challengesEmpty')).toBeHidden();
    const inserted = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'insert' && c.table === 'challenges'));
    expect(inserted).toHaveLength(1);
    expect(inserted[0].payload.is_auto_generated).toBe(true);
  });
});

test.describe('Challenges page — past challenges', () => {
  test('shows entry counts and lazily finalizes + displays the winner', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-challenges.html', 'challenges-page.js');
    const past = page.locator('#pastChallengesList .leaderboard-item');
    await expect(past).toHaveCount(1);
    await expect(past).toContainText('Weeknight Pasta');
    await expect(past).toContainText('2 entries');

    // post-2 (Bob's entry) has 2 hearts vs post-3's (Alice's) 1 — Bob wins.
    await expect(page.locator('#pastChallengesList')).toContainText('🏆 Winner: Bob Ortiz');
    const updates = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'update' && c.table === 'challenges'));
    expect(updates).toHaveLength(1);
    expect(updates[0].payload.winner_user_id).toBe('bob-1');
  });
});
