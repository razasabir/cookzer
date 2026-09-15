const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Cookzer+ AI Assistant teaser: no real LLM is wired up (needs a
// server-side API key and a billing decision, neither of which exist),
// so this is a waitlist-capture card on Pantry Challenge, Leftovers,
// and Health instead of a fake chatbot.
test.describe('Cookzer+ AI Assistant teaser', () => {
  test('appears on both Pantry Challenge and Leftovers tabs and can be joined', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-pantry.html', 'ai-teaser.js');

    const pantryTeaser = page.locator('#pantryAiTeaser .cz-ai-teaser');
    await expect(pantryTeaser).toContainText('Cookzer+ AI Assistant');
    await expect(pantryTeaser.locator('.cz-ai-teaser-badge')).toHaveText('Cookzer+');

    const leftoversTeaser = page.locator('#leftoversAiTeaser .cz-ai-teaser');
    await expect(leftoversTeaser).toContainText('leftovers');

    await pantryTeaser.locator('.cz-ai-teaser-btn').click();
    await expect(pantryTeaser).toContainText('You’re on the waitlist');

    const calls = await page.evaluate(() => window.__CALLS__);
    expect(calls).toContainEqual(expect.objectContaining({ table: 'ai_assistant_waitlist', op: 'insert', row: { user_id: 'me-1', feature: 'pantry' } }));
  });

  test('appears on the Health page', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-health.html', 'ai-teaser.js');
    const teaser = page.locator('#healthAiTeaser .cz-ai-teaser');
    await expect(teaser).toContainText('Cookzer+ AI Assistant');
    await expect(teaser).toContainText('nutrition');
  });
});
