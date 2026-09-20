const path = require('path');
const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');
const { confirmCrop } = require('./helpers/cropper');

const SAMPLE_IMAGE = path.join(__dirname, '..', 'icon-192.png');
const SAMPLE_IMAGE_2 = path.join(__dirname, '..', 'icon-512.png');

// Food-photo filters on post composers (feed + group): a shared
// photo-filters.js module renders the same 12 swatches (7 general +
// 5 food-photography-specific) used by the recipe gallery's own upload
// modal, plus a separate vignette on/off toggle, and bakes the chosen
// filter (and vignette) into the uploaded image (canvas) rather than
// storing it as metadata — simpler than teaching every place a post
// photo renders about a stored filter key.
//
// Every one of these flows now opens the CookzerPhotoCropper crop step
// first (see tests/photo-cropper.spec.js for that step itself) — these
// tests confirmCrop() past it to get to the filter row, same as a real
// upload would after the person clicks "Use Photo".
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
    await confirmCrop(page);

    const filterRow = page.locator('#composerFilterRow');
    await expect(filterRow).toBeVisible();
    const swatches = filterRow.locator('.pf-swatch');
    await expect(swatches).toHaveCount(12);
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Golden Hour' })).toHaveCount(1);
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Fresh' })).toHaveCount(1);
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Crisp' })).toHaveCount(1);
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Bakery' })).toHaveCount(1);
    await expect(filterRow.locator('.pf-swatch', { hasText: 'Char' })).toHaveCount(1);

    // Explicitly select Original (the sample image may otherwise arrive
    // with an auto-suggested filter already pre-selected — see the
    // dedicated suggestion tests below) to get a known baseline: the raw
    // File should be uploaded unchanged (a real File has a .name; a
    // canvas Blob does not).
    const originalSwatch = filterRow.locator('.pf-swatch', { hasText: 'Original' });
    await originalSwatch.click();
    await expect(originalSwatch).toHaveClass(/active/);
    await page.locator('#composerPostBtn').click();
    await expect.poll(() => page.evaluate(() => window.__UPLOADS__.length)).toBe(1);
    let upload = await page.evaluate(() => window.__UPLOADS__[0]);
    expect(upload.bucket).toBe('post-photos');
    expect(upload.hasName).toBe(true);

    // Second post, this time picking a real filter — the uploaded object
    // should now be a baked Blob (no .name), proving the filter was applied.
    await photoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);
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

  test('feed composer: a remove button lets you cancel the selected photo and pick a different one, without cancelling the whole post', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');

    const removeBtn = page.locator('#composerMediaRemoveBtn');
    await expect(removeBtn).toBeHidden();

    const photoInput = page.locator('#composerMediaInput');
    await photoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    await expect(page.locator('#composerPhotoPreview')).toBeVisible();
    await expect(page.locator('#composerFilterRow')).toBeVisible();
    await expect(removeBtn).toBeVisible();

    await removeBtn.click();

    await expect(page.locator('#composerPhotoPreview')).toBeHidden();
    await expect(page.locator('#composerFilterRow')).toBeHidden();
    await expect(removeBtn).toBeHidden();

    // Picking a different photo afterward works cleanly — the whole
    // point is not having to cancel the post to change your mind.
    await photoInput.setInputFiles(SAMPLE_IMAGE_2);
    await confirmCrop(page);
    await expect(page.locator('#composerPhotoPreview')).toBeVisible();
    await expect(removeBtn).toBeVisible();

    await page.locator('#composerPostBtn').click();
    await expect.poll(() => page.evaluate(() => window.__UPLOADS__.length)).toBe(1);
  });

  test('group composer: filter row appears and swatch selection updates the preview', async ({ page }) => {
    await page.addInitScript(() => {
      window.__GROUP_ID__ = 'g1';
    });
    await loadPageWithMock(page, 'cookzer-group.html?id=g1', 'photo-composer.js');

    const photoInput = page.locator('#composerPhotoInput');
    await photoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    const filterRow = page.locator('#composerFilterRow');
    await expect(filterRow).toBeVisible();
    await expect(filterRow.locator('.pf-swatch')).toHaveCount(12);

    const bwSwatch = filterRow.locator('.pf-swatch', { hasText: 'B&W' });
    await bwSwatch.click();
    await expect(bwSwatch).toHaveClass(/active/);
    const previewFilter = await page.locator('#composerPhotoPreview').evaluate((el) => el.style.filter);
    expect(previewFilter).toContain('grayscale');

    // A manual pick wins even if an in-flight auto-suggestion resolves
    // after it — never silently reverts the user's own choice.
    await page.waitForTimeout(200);
    await expect(bwSwatch).toHaveClass(/active/);
    const stillGrayscale = await page.locator('#composerPhotoPreview').evaluate((el) => el.style.filter);
    expect(stillGrayscale).toContain('grayscale');
  });
});

// The suggestion heuristic itself (CookzerPhotoFilters.suggestFilter),
// exercised directly against synthetic solid-color images so each branch
// (dark, washed out, flat colors, cool cast, warm cast, already balanced)
// is deterministic — unlike a real sample photo, whose exact pixel stats
// aren't something a test should hardcode assumptions about.
test.describe('Auto filter suggestion heuristic', () => {
  async function suggestionFor(page, [r, g, b]) {
    return page.evaluate(async ({ r, g, b }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 20;
      canvas.height = 20;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fillRect(0, 0, 20, 20);
      const img = await window.CookzerPhotoFilters.loadImage(canvas.toDataURL());
      return window.CookzerPhotoFilters.suggestFilter(img);
    }, { r, g, b });
  }

  test('suggests a brightening filter for a dark photo, warmer or cooler depending on its existing cast', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await expect(suggestionFor(page, [30, 30, 40])).resolves.toMatchObject({ key: 'golden-hour' });
    await expect(suggestionFor(page, [60, 40, 20])).resolves.toMatchObject({ key: 'fresh' });
  });

  test('suggests Crisp for a washed-out/overexposed photo', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await expect(suggestionFor(page, [250, 250, 245])).resolves.toMatchObject({ key: 'crisp' });
  });

  test('suggests Vivid for flat, low-saturation colors', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await expect(suggestionFor(page, [140, 140, 140])).resolves.toMatchObject({ key: 'vivid' });
  });

  test('suggests a corrective filter for a strong color cast', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await expect(suggestionFor(page, [100, 140, 180])).resolves.toMatchObject({ key: 'warm' }); // cool/bluish cast
    await expect(suggestionFor(page, [200, 150, 90])).resolves.toMatchObject({ key: 'cool' }); // warm/yellowish cast
  });

  test('suggests nothing for an already well-balanced photo', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await expect(suggestionFor(page, [120, 170, 130])).resolves.toBeNull();
  });
});

test.describe('Auto filter suggestion in the composer UI', () => {
  test('feed composer: pre-selects the module\'s own suggestion and shows why, until the user picks something else', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');

    const photoInput = page.locator('#composerMediaInput');
    await photoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    const filterRow = page.locator('#composerFilterRow');
    await expect(filterRow).toBeVisible();

    // Ask the same module the page uses what it would suggest for this
    // exact photo, then confirm the composer applied that suggestion —
    // this stays honest to the real heuristic instead of hardcoding an
    // assumption about this particular sample image's pixels.
    const expected = await page.evaluate(async () => {
      const img = await window.CookzerPhotoFilters.loadImage(document.getElementById('composerPhotoPreview').src);
      const s = window.CookzerPhotoFilters.suggestFilter(img);
      const key = s ? s.key : 'original';
      return { key, label: window.CookzerPhotoFilters.FILTERS.find((f) => f.key === key).label };
    });

    await expect(filterRow.locator('.pf-swatch.active .pf-swatch-label')).toHaveText(expected.label);
    const suggestionBanner = page.locator('#composerFilterSuggestion');
    if (expected.key === 'original') {
      await expect(suggestionBanner).toBeHidden();
    } else {
      await expect(suggestionBanner).toBeVisible();
      await expect(suggestionBanner).toContainText(expected.label);
    }

    // Picking a different swatch by hand overrides the suggestion and
    // dismisses the hint.
    const originalSwatch = filterRow.locator('.pf-swatch', { hasText: 'Original' });
    await originalSwatch.click();
    await expect(originalSwatch).toHaveClass(/active/);
    await expect(suggestionBanner).toBeHidden();
  });

  test('recipe gallery upload modal: also pre-selects a suggested filter, dismissible the same way', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe.html?id=r1', 'recipe-page.js');
    await page.locator('#addPhotoTile').click();
    await page.locator('#photoInput').setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    const filterRow = page.locator('#filterRow');
    await expect(filterRow.locator('.filter-swatch')).toHaveCount(12);

    const expected = await page.evaluate(async () => {
      const img = await window.CookzerPhotoFilters.loadImage(document.getElementById('previewImage').src);
      const s = window.CookzerPhotoFilters.suggestFilter(img);
      return s ? s.key : 'original';
    });

    await expect(filterRow.locator('.filter-swatch.active')).toHaveAttribute('data-filter-key', expected);

    const originalSwatch = filterRow.locator('.filter-swatch', { hasText: 'Original' });
    await originalSwatch.click();
    await expect(originalSwatch).toHaveClass(/active/);
    await expect(page.locator('#filterSuggestion')).toBeHidden();
  });
});

// The composer's own background (a green gradient) made the old plain-
// text swatch labels and suggestion line nearly unreadable — each name
// is now an opaque pill using the app's own card/ink color pair, which
// stays legible regardless of what's behind the row, and the food-
// photography-tuned presets lead the row instead of trailing the
// generic Instagram-style ones.
test.describe('Filter row heading, label contrast, and ordering', () => {
  test('shows a "Food Photography Effects" heading above the swatches', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await page.locator('#composerMediaInput').setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    await expect(page.locator('#composerFilterRow .pf-swatch-heading')).toHaveText('Food Photography Effects');
  });

  test('the food-photography presets lead the row, ahead of the generic ones', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await page.locator('#composerMediaInput').setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    const labels = await page.locator('#composerFilterRow .pf-swatch-label').allTextContents();
    expect(labels).toEqual(['Original', 'Golden Hour', 'Fresh', 'Crisp', 'Bakery', 'Char', 'Vivid', 'Warm', 'Cool', 'B&W', 'Vintage', 'Moody']);
  });

  test('each swatch label is an opaque pill (card background), not text on the composer\'s own background', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await page.locator('#composerMediaInput').setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    const label = page.locator('#composerFilterRow .pf-swatch-label').first();
    const bg = await label.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)'); // not transparent — an actual opaque backdrop
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
    await confirmCrop(page);

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
    await confirmCrop(page);

    const filterRow = page.locator('#composerFilterRow');
    const vignetteToggle = filterRow.locator('.pf-vignette-toggle');
    await vignetteToggle.click();
    await expect(vignetteToggle).toHaveClass(/active/);

    // Picking a fresh photo resets vignette along with the filter choice.
    await photoInput.setInputFiles(SAMPLE_IMAGE_2);
    await confirmCrop(page);
    await expect(filterRow.locator('.pf-vignette-toggle')).not.toHaveClass(/active/);
  });
});
