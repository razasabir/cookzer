const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// Simulates a logged-out visitor: auth-guard.js's carve-out (see
// auth-guard.js's CookzerLoggedOutPreview branch) should let
// cookzer-profile.html?id=<uuid> through instead of redirecting to
// cookzer-auth.html, and the page should render via the
// get_public_profile_preview RPC (mocked in profile-page.js's
// __RPC_HANDLERS__) instead of the normal logged-in loadProfile() path.
const NO_SESSION_INIT = `
  const _origCreateClient = window.supabase.createClient;
  window.supabase.createClient = function (...args) {
    const client = _origCreateClient(...args);
    client.auth.getSession = () => Promise.resolve({ data: { session: null } });
    client.auth.getUser = () => Promise.resolve({ data: { user: null } });
    return client;
  };
`;

test.describe('Public logged-out profile preview', () => {
  test('a public profile renders real data through the preview RPC, with actions gated behind sign-up', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js', NO_SESSION_INIT);

    await expect(page.locator('#loggedInApp')).toBeHidden();
    const preview = page.locator('#loggedOutPreview');
    await expect(preview).toBeVisible();
    await expect(page.locator('#ppName')).toHaveText('Alice Diaz');
    await expect(page.locator('#ppBio')).toHaveText('Baker');
    await expect(page.locator('#ppStatFollowers')).toHaveText('0');

    // Follow is gated, not performed directly — no follows row should be
    // inserted just from clicking it while logged out.
    const callsBefore = await page.evaluate(() => window.__CALLS__.length);
    await page.click('[data-gate="follow"]');
    await expect(page.locator('#gateOverlay')).toHaveClass(/open/);
    await expect(page.locator('#gateTitle')).toHaveText('Follow Alice Diaz on Cookzer');
    const callsAfter = await page.evaluate(() => window.__CALLS__.length);
    expect(callsAfter).toBe(callsBefore);

    await page.click('#gateSignupBtn');
    await expect(page).toHaveURL(/cookzer-auth\.html$/);
  });

  test('a followers-only profile shows a private state instead of leaking data', async ({ page }) => {
    // addInitScript sources run in registration order before any page
    // script — profile-page.js (which defines window.__STATE__) is
    // registered first by loadPageWithMock, so this extraInit can mutate
    // it directly before the page's own RPC call ever fires.
    const extraInit = NO_SESSION_INIT + `
      window.__STATE__.profiles.find((p) => p.id === 'alice-1').profile_visibility = 'followers';
    `;
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js', extraInit);

    await expect(page.locator('#ppPrivate')).toBeVisible();
    await expect(page.locator('#ppFound')).toBeHidden();
  });

  test('no ?id= still redirects to the auth page (the carve-out is scoped to profile links only)', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js', NO_SESSION_INIT);
    await expect(page).toHaveURL(/cookzer-auth\.html$/);
  });

  test('a signed-in visitor still sees the normal logged-in profile page, unaffected by the carve-out', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html?id=alice-1', 'profile-page.js');
    await expect(page.locator('#loggedOutPreview')).toBeHidden();
    await expect(page.locator('#loggedInApp')).toBeVisible();
  });
});
