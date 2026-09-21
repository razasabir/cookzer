const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Restaurant Claims admin page', () => {
  test('a non-admin sees a not-authorized message instead of the claims list', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant-claims.html', 'restaurant-claims-nonadmin.js');
    await expect(page.locator('.not-authorized-note')).toContainText("don't have access");
    await expect(page.locator('.claim-card')).toHaveCount(0);
  });

  test('an admin sees the pending claims, each with restaurant, claimant, and contact info', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant-claims.html', 'restaurant-claims-admin.js');

    const cards = page.locator('.claim-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Marfa Bowl Co.');
    await expect(cards.nth(0)).toContainText('Jordan C.');
    await expect(cards.nth(0)).toContainText('owner@marfabowl.com');
    await expect(cards.nth(0)).toContainText('512-555-0100');
    await expect(cards.nth(0).locator('.claim-restaurant-name')).toHaveAttribute('href', 'cookzer-restaurant.html?id=rest-1');
  });

  test('approving a claim confirms first, then calls the review RPC and removes it from the list', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant-claims.html', 'restaurant-claims-admin.js');

    await page.locator('.claim-card').nth(0).locator('.claim-btn.approve').click();
    await expect(page.locator('.cz-modal-overlay')).toBeVisible();
    await expect(page.locator('.cz-modal-message')).toContainText('Marfa Bowl Co.');
    await page.locator('.cz-modal-btn.cz-primary').click();

    await expect.poll(() => page.evaluate(() => window.__REVIEW_CLAIM_RPCS__.length)).toBe(1);
    const rpcArgs = await page.evaluate(() => window.__REVIEW_CLAIM_RPCS__[0]);
    expect(rpcArgs).toMatchObject({ p_claim_id: 'claim-1', p_decision: 'approved' });
    await expect(page.locator('.claim-card')).toHaveCount(1);
  });

  test('rejecting a claim takes an optional note and calls the review RPC with it', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant-claims.html', 'restaurant-claims-admin.js');

    await page.locator('.claim-card').nth(0).locator('.claim-btn.reject').click();
    await expect(page.locator('.cz-modal-input')).toBeVisible();
    await page.fill('.cz-modal-input', 'No proof of ownership provided');
    await page.locator('.cz-modal-btn.cz-primary').click();

    await expect.poll(() => page.evaluate(() => window.__REVIEW_CLAIM_RPCS__.length)).toBe(1);
    const rpcArgs = await page.evaluate(() => window.__REVIEW_CLAIM_RPCS__[0]);
    expect(rpcArgs).toMatchObject({ p_claim_id: 'claim-1', p_decision: 'rejected', p_note: 'No proof of ownership provided' });
    await expect(page.locator('.claim-card')).toHaveCount(1);
  });

  test('cancelling the approve confirmation does not call the RPC', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-restaurant-claims.html', 'restaurant-claims-admin.js');

    await page.locator('.claim-card').nth(0).locator('.claim-btn.approve').click();
    await page.locator('.cz-modal-btn.cz-ghost').click();

    expect(await page.evaluate(() => window.__REVIEW_CLAIM_RPCS__.length)).toBe(0);
    await expect(page.locator('.claim-card')).toHaveCount(2);
  });
});
