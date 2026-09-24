const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Privacy Policy page', () => {
  test('shows the static fallback when no version has been published yet', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-privacy.html', 'policy-pages.js', `window.__POLICY__ = null; window.__SIGNED_IN__ = false;`);
    await expect(page.locator('#policyBody')).toContainText('Cookzer ("we", "us") is a social network');
    await expect(page.locator('#policyUpdated')).toContainText('September 17, 2026');
  });

  test('switches to the published version from policy_documents when one exists', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-privacy.html', 'policy-pages.js', `
      window.__SIGNED_IN__ = false;
      window.__POLICY__ = { version: 3, content: 'A brand-new privacy policy written by an admin.', published_at: '2026-09-24T00:00:00Z' };
    `);
    await expect(page.locator('#policyBody')).toHaveText('A brand-new privacy policy written by an admin.');
    await expect(page.locator('#policyUpdated')).toContainText('v3');
  });

  test('records consent for a signed-in visitor viewing a published version', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-privacy.html', 'policy-pages.js', `
      window.__SIGNED_IN__ = true;
      window.__POLICY__ = { version: 2, content: 'Policy text.', published_at: '2026-09-24T00:00:00Z' };
    `);
    await page.waitForFunction(() => window.__CONSENT_CALLS__.length > 0);
    const call = await page.evaluate(() => window.__CONSENT_CALLS__[0]);
    expect(call.p_type).toBe('privacy');
    expect(call.p_version).toBe(2);
  });

  test('does not record consent for a logged-out visitor', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-privacy.html', 'policy-pages.js', `
      window.__SIGNED_IN__ = false;
      window.__POLICY__ = { version: 2, content: 'Policy text.', published_at: '2026-09-24T00:00:00Z' };
    `);
    await expect(page.locator('#policyBody')).toHaveText('Policy text.');
    const calls = await page.evaluate(() => window.__CONSENT_CALLS__);
    expect(calls.length).toBe(0);
  });
});

test.describe('Terms of Service page', () => {
  test('exists, and shows the static fallback when no version has been published yet', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-terms.html', 'policy-pages.js', `window.__POLICY__ = null; window.__SIGNED_IN__ = false;`);
    await expect(page.locator('h1')).toHaveText('Terms of Service');
    await expect(page.locator('#policyBody')).toContainText('These terms govern your use of Cookzer');
  });

  test('switches to the published version from policy_documents when one exists', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-terms.html', 'policy-pages.js', `
      window.__SIGNED_IN__ = false;
      window.__POLICY__ = { version: 1, content: 'The real terms text.', published_at: '2026-09-24T00:00:00Z' };
    `);
    await expect(page.locator('#policyBody')).toHaveText('The real terms text.');
    await expect(page.locator('#policyUpdated')).toContainText('v1');
  });
});
