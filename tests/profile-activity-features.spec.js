const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Migration 041 + the "improve the profile" pass: a Message button on
// other people's profiles, public curatable Lists surfaced on the
// profile, an Activity stats section (tips/comments/hearts/photos), a
// cook-in streak heatmap, and a pinned/featured recipe.
test.describe('profile: activity + engagement stats', () => {
  test('shows tips, comments, hearts-given and photos counts from the mock data', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url() + '?id=alice-1');

    await expect(page.locator('#activityTipsNum')).toHaveText('2');
    await expect(page.locator('#activityCommentsNum')).toHaveText('1');
    await expect(page.locator('#activityHeartsGivenNum')).toHaveText('2');
    await expect(page.locator('#activityPhotosNum')).toHaveText('1');
  });

  test('renders a streak heatmap with today marked active from a cook-in logged today', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url() + '?id=alice-1');

    const cells = page.locator('#streakHeatmap .streak-cell');
    await expect(cells).not.toHaveCount(0);
    await expect(page.locator('#streakHeatmap .streak-cell.today.active')).toHaveCount(1);
  });
});

test.describe('profile: featured recipe', () => {
  test('shows the pinned recipe card when the profile has one', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url() + '?id=alice-1');

    await expect(page.locator('#featuredRecipeSection')).toBeVisible();
    await expect(page.locator('#featuredRecipeTitle')).toHaveText('Sourdough Boule');
    await expect(page.locator('#featuredRecipeMeta')).toHaveText('Baking');
    await expect(page.locator('#featuredRecipeCard')).toHaveAttribute('href', 'cookzer-recipe.html?id=r1');
  });

  test('hides the featured recipe section when the profile has none pinned', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url());

    await expect(page.locator('#featuredRecipeSection')).toBeHidden();
  });

  test('owner can pin a recipe via the real picker (no prompt) and it shows up on save', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url());

    await page.locator('button', { hasText: 'Edit profile' }).click();
    await expect(page.locator('#editPinnedRecipeName')).toHaveText('None');

    await page.locator('#choosePinnedRecipeBtn').click();
    await expect(page.locator('#pickerModal h3')).toContainText('Pin a recipe');
    await expect(page.locator('#pickerModal').locator('input[type="text"], textarea')).toHaveCount(0);

    await page.locator('#pickerModal .cz2-row', { hasText: 'Garlic Butter Pasta' }).click();
    await expect(page.locator('#editPinnedRecipeName')).toHaveText('Garlic Butter Pasta');

    await page.locator('#editSaveBtn').click();
    await expect(page.locator('#featuredRecipeSection')).toBeVisible();
    await expect(page.locator('#featuredRecipeTitle')).toHaveText('Garlic Butter Pasta');
  });
});

test.describe('profile: lists', () => {
  test('shows only public lists on someone else\'s profile', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url() + '?id=alice-1');

    await expect(page.locator('#listsSection')).toBeVisible();
    const cards = page.locator('.list-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Weeknight favorites');
    await expect(cards.first()).toContainText('2 recipes');
    await expect(cards.first()).not.toContainText('🔒');
  });
});

test.describe('profile: message button', () => {
  test('shows a Message button linking to the messenger on someone else\'s profile', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url() + '?id=alice-1');

    const messageBtn = page.locator('#messageBtn');
    await expect(messageBtn).toBeVisible();
    await expect(messageBtn).toHaveText('Message');

    await Promise.all([
      page.waitForURL(/cookzer-messenger\.html\?with=alice-1/),
      messageBtn.click(),
    ]);
  });

  test('hides the Message button once you\'ve blocked that person', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js', `
      window.__STATE__.user_blocks = [{ blocker_id: 'me-1', blocked_id: 'alice-1' }];
    `);
    await page.goto(page.url() + '?id=alice-1');

    await expect(page.locator('#messageBtn')).toBeHidden();
  });

  test('is absent on your own profile', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url());

    await expect(page.locator('#messageBtn')).toHaveCount(0);
  });
});

// The Message button above links to cookzer-messenger.html?with=<id>;
// this exercises the other end of that link.
test.describe('messenger: ?with= auto-starts a conversation', () => {
  test('opens (or creates) a 1:1 thread with the given person on load', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-messenger.html', 'profile-activity.js');
    await page.goto(page.url() + '?with=alice-1');

    await expect(page.locator('.thread-name')).toHaveText('Alice Diaz');
    await expect(page.locator('#messenger')).toHaveClass(/thread-open/);
  });

  test('reuses an existing 1:1 conversation instead of creating a duplicate', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-messenger.html', 'profile-activity.js', `
      window.__STATE__.conversations = [{ id: 'conv-1', created_by: 'me-1', name: null }];
      window.__STATE__.conversation_participants = [
        { conversation_id: 'conv-1', user_id: 'me-1', last_read_at: null },
        { conversation_id: 'conv-1', user_id: 'alice-1', last_read_at: null },
      ];
    `);
    await page.goto(page.url() + '?with=alice-1');

    await expect(page.locator('.thread-name')).toHaveText('Alice Diaz');
    const insertCalls = await page.evaluate(() => window.__CALLS__.filter((c) => c.op === 'insert' && c.table === 'conversations'));
    expect(insertCalls).toHaveLength(0);
  });
});

test.describe('profile: challenge winner flair', () => {
  test('shows a 🏆 flair with the win count for someone who has won a challenge', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url() + '?id=alice-1');

    const flair = page.locator('#profileWinnerFlair');
    await expect(flair).toBeVisible();
    await expect(flair).toHaveText('🏆 1x Challenge Winner');
  });

  test('stays hidden for someone who has never won one', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-activity.js');
    await page.goto(page.url());

    await expect(page.locator('#profileWinnerFlair')).toBeHidden();
  });
});
