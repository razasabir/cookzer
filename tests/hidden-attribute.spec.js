const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

// #restaurantTag pairs the `hidden` attribute with an inline
// `display: flex` for its shown state — inline styles otherwise beat
// the browser's default [hidden]{display:none}, so it never actually
// hid (visible as a stray "📍" with no name on the live site). Fixed
// with a site-wide [hidden]{display:none!important} rule in styles.css.
test.describe('[hidden] elements actually hide', () => {
  test('#restaurantTag stays hidden on a fresh page load', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await expect(page.locator('#restaurantTag')).toBeHidden();
  });
});
