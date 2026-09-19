const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Migration 031: group_events + group_event_rsvps.
test.describe('group events page', () => {
  test('member sees the existing event and can RSVP', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-events.html', 'group-events.js');
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('.event-card')).toHaveCount(1);
    await expect(page.locator('.event-card')).toContainText('Sunday Roast');

    await page.locator('.rsvp-btn', { hasText: 'Going' }).click();
    await expect.poll(() => page.evaluate(() => window.__STATE__.rsvps.some((r) => r.status === 'going' && r.user_id === 'me-1'))).toBe(true);
    await expect(page.locator('.rsvp-btn.selected')).toContainText('Going');
  });

  test('member can create a new event via the real form (no prompt)', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-events.html', 'group-events.js');
    await page.goto(page.url() + '?id=g1');

    await page.locator('#newEventBtn').click();
    await expect(page.locator('#pickerModal h3')).toContainText('New event');
    await page.fill('#pickerModal input[type="text"]', 'Taco Night');
    await page.fill('#pickerModal input[type="datetime-local"]', '2030-02-01T18:30');
    await page.locator('#pickerModal button', { hasText: 'Create' }).click();

    await expect(page.locator('.event-card')).toHaveCount(2);
    await expect(page.locator('.event-card', { hasText: 'Taco Night' })).toBeVisible();
  });

  test('non-member is told to join rather than seeing the event list', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-group-events.html', 'group-events.js');
    await page.addInitScript(() => {
      window.__STATE__.myRole = null;
    });
    await page.goto(page.url() + '?id=g1');

    await expect(page.locator('#newEventBtn')).toBeHidden();
    await expect(page.locator('#eventsEmpty')).toContainText('Join this group');
  });
});
