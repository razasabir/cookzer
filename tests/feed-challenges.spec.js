const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// The Feed's Challenges integration: the sidebar widget (now multi-
// challenge aware), a 🏆 badge on a post that's a challenge entry, and
// a banner surfacing the most recently finalized challenge's winner.
test.describe('Feed — challenge widget', () => {
  test('shows the active challenge with its category badge and a join button', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-challenges.js');
    await expect(page.locator('#challengeBanner')).toBeVisible();
    await expect(page.locator('#challengeTitle')).toHaveText('Budget Bites');
    await expect(page.locator('#challengeBadge')).toHaveText('💰 Budget');
    await expect(page.locator('#joinChallengeBtn')).toHaveText('Join challenge');
    await expect(page.locator('#seeAllChallengesLink')).toBeVisible();
    await expect(page.locator('#noChallengeNote')).toBeHidden();
  });

  test('joining from the widget upserts an entry and flips the button', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-challenges.js');
    await page.click('#joinChallengeBtn');
    await expect(page.locator('#joinChallengeBtn')).toHaveText('Joined ✓');
    const upserts = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'upsert' && c.table === 'challenge_entries'));
    expect(upserts[0].payload).toMatchObject({ challenge_id: 'chal-active', user_id: 'me-1' });
  });

  test('auto-seeds a fresh weekly challenge instead of sitting empty', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-challenges.js', `
      window.__STATE__.challenges = [];
    `);
    await expect(page.locator('#challengeBanner')).toBeVisible();
    await expect(page.locator('#noChallengeNote')).toBeHidden();
    const inserted = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'insert' && c.table === 'challenges'));
    expect(inserted).toHaveLength(1);
    expect(inserted[0].payload.is_auto_generated).toBe(true);
  });

  test('shows a "start one" link if even the weekly auto-seed comes back empty', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-challenges.js', `
      window.__STATE__.challenges = [];
      // Simulate the self-heal insert itself failing (e.g. a transient
      // network error) — the widget should still fall back gracefully
      // rather than get stuck, since ensureWeeklyChallenge re-queries
      // rather than assuming its own insert worked.
      const realCreateClient = window.supabase.createClient;
      window.supabase.createClient = (...args) => {
        const client = realCreateClient(...args);
        const realFrom = client.from;
        client.from = (table) => {
          const builder = realFrom(table);
          if (table === 'challenges') {
            const realInsert = builder.insert;
            builder.insert = () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) });
          }
          return builder;
        };
        return client;
      };
    `);
    await expect(page.locator('#challengeBanner')).toBeHidden();
    await expect(page.locator('#noChallengeNote')).toBeVisible();
    await expect(page.locator('#noChallengeNote')).toContainText('start one');
  });
});

test.describe('Feed — challenge entry badge on posts', () => {
  test('a post entered in a challenge shows a 🏆 badge naming it', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-challenges.js');
    const badge = page.locator('#challengeBadge-post-1');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('🏆 Budget Bites');
  });
});

test.describe('Feed — challenge winner banner', () => {
  test('surfaces the most recently ended challenge\'s winner', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-challenges.js');
    const banner = page.locator('#challengeWinnerBanner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Alice Diaz won "Weeknight Pasta"');
  });

  test('stays hidden when there is no ended challenge yet', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-challenges.js', `
      window.__STATE__.challenges = window.__STATE__.challenges.filter((c) => c.id !== 'chal-ended');
    `);
    await expect(page.locator('#challengeWinnerBanner')).toBeHidden();
  });
});
