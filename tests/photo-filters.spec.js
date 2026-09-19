const path = require('path');
const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

const SAMPLE_IMAGE = path.join(__dirname, '..', 'icon-192.png');
const SAMPLE_IMAGE_2 = path.join(__dirname, '..', 'icon-512.png');

// Food-photo filters on post composers (feed + group): a shared
// photo-filters.js module renders the same 12 swatches (7 general +
// 5 food-photography-specific) used by the recipe gallery's own upload
// modal, plus a separate vignette on/off toggle, and bakes the chosen
// filter (and vignette) into the uploaded image (canvas) rather than
// storing it as metadata — simpler than teaching every place a post
// photo renders about a stored filter key.
test.describe('Photo filters on post composers', () => {
  test('feed composer: filter row appears, a swatch can be selected, and only a non-Original choice bakes a new file', async ({ page }) => {
    // Skip the first-visit welcome modal — unrelated to this test, but it
    // opens on a fresh localStorage and would intercept the Post click.
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');

    const photoInput = page.locator('#composerMediaInput');
    await photoInput.setInputFiles(SAMPLE_IMAGE);

    const filterRow = page.locator('#composerFilterRow');
    await expect(filterRow).toBeVisible();
    const swatches = filterRow.locator('.pf-swatch');
    await expect(swatches).toHaveCount(12);
    await expect(swatches.first()).toHaveClass(/active/);
    await expect(swatches.first().locator('.pf-swatch-label')).toHaveText('Original');
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Golden Hour' })).toHaveCount(1);
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Fresh' })).toHaveCount(1);
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Crisp' })).toHaveCount(1);
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Bakery' })).toHaveCount(1);
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Char' })).toHaveCount(1);

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
    await expect(filterRow.locator('.pf-swatch')).toHaveCount(12);
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
    await expect(filterRow.locator('.pf-swatch')).toHaveCount(12);

    const bwSwatch = filterRow.locator('.pf-swatch', { hasText: 'B&W' });
    await bwSwatch.click();
    await expect(bwSwatch).toHaveClass(/active/);
    const previewFilter = await page.locator('#composerPhotoPreview').evaluate((el) => el.style.filter);
    expect(previewFilter).toContain('grayscale');
  });
});

test.describe('Vignette toggle on post composers', () => {
  test('feed composer: toggling vignette updates the preview and bakes even with Original selected', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');

    const photoInput = page.locator('#composerMediaInput');
    await photoInput.setInputFiles(SAMPLE_IMAGE);

    const filterRow = page.locator('#composerFilterRow');
    const vignetteToggle = filterRow.locator('.pf-vignette-toggle');
    await expect(vignetteToggle).toBeVisible();
    await expect(vignetteToggle).not.toHaveClass(/active/);

    await vignetteToggle.click();
    await expect(vignetteToggle).toHaveClass(/active/);
    const previewShadow = await page.locator('#composerPhotoPreview').evaluate((el) => el.style.boxShadow);
    expect(previewShadow).toContain('inset');

    // Original filter + vignette on — still needs to bake (vignette alone
    // is enough to require a canvas pass, not just a non-Original filter).
    await page.locator('#composerPostBtn').click();
    await expect.poll(() => page.evaluate(() => window.__UPLOADS__.length)).toBe(1);
    const upload = await page.evaluate(() => window.__UPLOADS__[0]);
    expect(upload.hasName).toBe(false);
  });

  test('group composer: vignette toggle is available and toggles off on a new photo pick', async ({ page }) => {
    await page.addInitScript(() => {
      window.__GROUP_ID__ = 'g1';
    });
    await loadPageWithMock(page, 'cookzer-group.html?id=g1', 'photo-composer.js');

    const photoInput = page.locator('#composerPhotoInput');
    await photoInput.setInputFiles(SAMPLE_IMAGE);

    const filterRow = page.locator('#composerFilterRow');
    const vignetteToggle = filterRow.locator('.pf-vignette-toggle');
    await vignetteToggle.click();
    await expect(vignetteToggle).toHaveClass(/active/);

    // Picking a fresh photo resets vignette along with the filter choice.
    await photoInput.setInputFiles(SAMPLE_IMAGE_2);
    await expect(filterRow.locator('.pf-vignette-toggle')).not.toHaveClass(/active/);
  });
});
