const path = require('path');
const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

const SAMPLE_IMAGE = path.join(__dirname, '..', 'icon-192.png');

// Food-photo filters on post composers (feed + group): a shared
// photo-filters.js module renders the same 7 swatches used by the
// recipe gallery's own upload modal, and bakes the chosen filter into
// the uploaded image (canvas) rather than storing it as metadata —
// simpler than teaching every place a post photo renders about a
// stored filter key.
test.describe('Photo filters on post composers', () => {
  test('feed composer: filter row appears, a swatch can be selected, and only a non-Original choice bakes a new file', async ({ page }) => {
    // Skip the first-visit welcome modal — unrelated to this test, but it
    // opens on a fresh localStorage and would intercept the Post click.
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');

    const photoInput = page.locator('#composerPhotoInput');
    await photoInput.setInputFiles(SAMPLE_IMAGE);

    const filterRow = page.locator('#composerFilterRow');
    await expect(filterRow).toBeVisible();
    const swatches = filterRow.locator('.pf-swatch');
    await expect(swatches).toHaveCount(7);
    await expect(swatches.first()).toHaveClass(/active/);
    await expect(swatches.first().locator('.pf-swatch-label')).toHaveText('Original');

    // Post with the default (Original) filter — the raw File should be
    // uploaded unchanged (a real File has a .name; a canvas Blob does not).
    await page.locator('#composerPostBtn').click();
    await expect.poll(() => page.evaluate(() => window.__UPLOADS__.length)).toBe(1);
    let upload = await page.evaluate(() => window.__UPLOADS__[0]);
    expect(upload.bucket).toBe('post-photos');
    expect(upload.hasName).toBe(true);

    // Second post, this time picking a real filter — the uploaded object
    // should now be a baked Blob (no .name), proving the filter was applied.
    await photoInput.setInputFiles(SAMPLE_IMAGE);
    await expect(filterRow.locator('.pf-swatch')).toHaveCount(7);
    const vividSwatch = filterRow.locator('.pf-swatch', { hasText: 'Vivid' });
    await vividSwatch.click();
    await expect(vividSwatch).toHaveClass(/active/);
    const previewFilter = await page.locator('#composerPhotoPreview').evaluate((el) => el.style.filter);
    expect(previewFilter).toContain('saturate');

    await page.locator('#composerPostBtn').click();
    await expect.poll(() => page.evaluate(() => window.__UPLOADS__.length)).toBe(2);
    upload = await page.evaluate(() => window.__UPLOADS__[1]);
    expect(upload.hasName).toBe(false);
  });

  test('group composer: filter row appears and swatch selection updates the preview', async ({ page }) => {
    await page.addInitScript(() => {
      window.__GROUP_ID__ = 'g1';
    });
    await loadPageWithMock(page, 'cookzer-group.html?id=g1', 'photo-composer.js');

    const photoInput = page.locator('#composerPhotoInput');
    await photoInput.setInputFiles(SAMPLE_IMAGE);

    const filterRow = page.locator('#composerFilterRow');
    await expect(filterRow).toBeVisible();
    await expect(filterRow.locator('.pf-swatch')).toHaveCount(7);

    const bwSwatch = filterRow.locator('.pf-swatch', { hasText: 'B&W' });
    await bwSwatch.click();
    await expect(bwSwatch).toHaveClass(/active/);
    const previewFilter = await page.locator('#composerPhotoPreview').evaluate((el) => el.style.filter);
    expect(previewFilter).toContain('grayscale');
  });
});
