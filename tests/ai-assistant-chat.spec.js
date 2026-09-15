const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Cookzer+ AI Assistant — real Haiku 4.5 chat (api/ai-chat.js), on
// Pantry Challenge, Leftovers, and Health. window.fetch is mocked to
// stand in for the serverless endpoint.
test.describe('Cookzer+ AI Assistant chat', () => {
  test('appears on both Pantry Challenge and Leftovers tabs and sends a message', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-pantry.html', 'ai-chat.js');

    const pantryChat = page.locator('#pantryAiTeaser .cz-ai-chat');
    await expect(pantryChat).toContainText('Cookzer+ AI Assistant');
    await expect(pantryChat.locator('.cz-ai-chat-badge')).toHaveText('Cookzer+');

    const leftoversChat = page.locator('#leftoversAiTeaser .cz-ai-chat');
    await expect(leftoversChat).toContainText('leftovers');

    await pantryChat.locator('.cz-ai-chat-input').fill('chicken thighs, rice, half an onion');
    await pantryChat.locator('.cz-ai-chat-send').click();

    await expect(pantryChat.locator('.cz-ai-chat-msg.user').last()).toContainText('chicken thighs');
    await expect(pantryChat.locator('.cz-ai-chat-msg.assistant').last()).toContainText('chicken fried rice');

    const calls = await page.evaluate(() => window.__CALLS__);
    expect(calls).toContainEqual(expect.objectContaining({ table: 'ai_assistant_conversations', op: 'insert', row: { user_id: 'me-1', feature: 'pantry' } }));
    expect(calls).toContainEqual(expect.objectContaining({
      table: 'ai_assistant_messages',
      op: 'insert',
      row: expect.objectContaining({ role: 'user', content: 'chicken thighs, rice, half an onion' }),
    }));
    const apiCall = calls.find((c) => c.table === 'api/ai-chat');
    expect(apiCall.body).toEqual(expect.objectContaining({ feature: 'pantry', message: 'chicken thighs, rice, half an onion' }));
  });

  test('appears on the Health page', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-health.html', 'ai-chat.js');
    const chat = page.locator('#healthAiTeaser .cz-ai-chat');
    await expect(chat).toContainText('Cookzer+ AI Assistant');
    await expect(chat).toContainText('nutrition');
  });

  test('loads existing conversation history on mount', async ({ page }) => {
    await page.addInitScript(() => {
      window.__AI_CHAT_SEED__ = {
        conversationId: 'convo-existing',
        feature: 'health',
        history: [
          { role: 'user', content: 'what can I make with eggs and spinach?' },
          { role: 'assistant', content: 'A spinach frittata would work great here.' },
        ],
        usageCount: 2,
      };
    });
    await loadPageWithMock(page, 'cookzer-health.html', 'ai-chat.js');

    const chat = page.locator('#healthAiTeaser .cz-ai-chat');
    await expect(chat.locator('.cz-ai-chat-msg.user').first()).toContainText('eggs and spinach');
    await expect(chat.locator('.cz-ai-chat-msg.assistant').first()).toContainText('spinach frittata');
    await expect(chat.locator('[data-role="usage"]')).toHaveText('2/500 this month');
  });

  test('shows the limit-reached state and disables input when the monthly cap is hit', async ({ page }) => {
    await page.addInitScript(() => {
      window.__AI_CHAT_SEED__ = { usageCount: 500 };
    });
    await loadPageWithMock(page, 'cookzer-pantry.html', 'ai-chat.js');

    const chat = page.locator('#pantryAiTeaser .cz-ai-chat');
    await expect(chat).toContainText("You've used all 500 Cookzer+ messages this month");
    await expect(chat.locator('.cz-ai-chat-input')).toBeDisabled();
    await expect(chat.locator('.cz-ai-chat-send')).toBeDisabled();
  });
});
