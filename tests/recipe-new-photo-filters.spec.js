const path = require('path');
const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');
const { confirmCrop } = require('./helpers/cropper');

const SAMPLE_IMAGE = path.join(__dirname, '..', 'icon-192.png');

// The recipe wizard's step/extra photo pickers now open the same shared
// filter picker (photo-filters.js) as the feed/group composers and the
// recipe page's own gallery upload — this file covers that it's actually
// wired in here too, not the filter mechanics themselves (already covered
// for the shared module by tests/photo-filters.spec.js).
function filterModal(page) {
  return page.locator('.cz2-overlay .photo-filter-modal');
}

async function goToStepsPanel(page) {
  await page.fill('#rTitle', 'Test Recipe');
  await page.click('#nextBtn'); // -> step 2 (ingredients)
  await page.click('#nextBtn'); // -> step 3 (steps & photos)
}

test.describe('Recipe wizard — photo filters on step/extra photos', () => {
  test('picking a step photo opens the filter picker after cropping, offering the full shared swatch set', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe-new.html', 'photo-composer.js');
    await goToStepsPanel(page);

    const stepPhotoInput = page.locator('#stepRows .step-row').first().locator('input[type="file"]');
    await stepPhotoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    const modal = filterModal(page);
    await expect(modal).toBeVisible();
    await expect(modal.locator('.pf-swatch')).toHaveCount(12);

    const vividSwatch = modal.locator('.pf-swatch', { hasText: 'Vivid' });
    await vividSwatch.click();
    await expect(vividSwatch).toHaveClass(/active/);
    const previewFilter = await modal.locator('.photo-filter-modal-preview').evaluate((el) => el.style.filter);
    expect(previewFilter).toContain('saturate');

    await modal.locator('.pc-btn-primary').click();
    await expect(modal).toBeHidden();

    const tiles = page.locator('#stepRows .step-row').first().locator('.step-photo-tile');
    await expect(tiles).toHaveCount(1);
    await expect(tiles.locator('img')).toBeVisible();
  });

  test('a non-Original filter choice re-bakes the photo\'s pixels; Original leaves them as cropped', async ({ page }) => {
    // Unlike the feed/group composers (which upload the baked Blob as-is),
    // the wizard needs a real filename off the result to pick a storage
    // extension later, so pickPhotoFilter() always wraps the outcome back
    // into a File — baked or not. That means "did it bake?" isn't visible
    // via a missing .name here; comparing the resulting file size against
    // the same cropped source picked twice is what actually shows it.
    await loadPageWithMock(page, 'cookzer-recipe-new.html', 'photo-composer.js');
    await goToStepsPanel(page);

    const stepPhotoInput = page.locator('#stepRows .step-row').first().locator('input[type="file"]');
    const lastPhotoFileSize = () => page.evaluate(() => {
      const photos = document.querySelector('#stepRows .step-row')._photos;
      return photos[photos.length - 1].file.size;
    });

    await stepPhotoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);
    await filterModal(page).locator('.pf-swatch', { hasText: 'Original' }).click();
    await filterModal(page).locator('.pc-btn-primary').click();
    await expect(filterModal(page)).toBeHidden();
    const originalSize = await lastPhotoFileSize();

    await stepPhotoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);
    await filterModal(page).locator('.pf-swatch', { hasText: 'Vivid' }).click();
    await filterModal(page).locator('.pc-btn-primary').click();
    await expect(filterModal(page)).toBeHidden();
    const vividSize = await lastPhotoFileSize();

    expect(vividSize).not.toBe(originalSize);
  });

  test('canceling the filter picker leaves no photo attached', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe-new.html', 'photo-composer.js');
    await goToStepsPanel(page);

    const stepPhotoInput = page.locator('#stepRows .step-row').first().locator('input[type="file"]');
    await stepPhotoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    const modal = filterModal(page);
    await expect(modal).toBeVisible();
    await modal.locator('.pc-btn:not(.pc-btn-primary)').click();
    await expect(modal).toBeHidden();

    await expect(page.locator('#stepRows .step-row').first().locator('.step-photo-tile')).toHaveCount(0);
  });

  test('a step can have more than one photo attached', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe-new.html', 'photo-composer.js');
    await goToStepsPanel(page);

    const stepPhotoInput = page.locator('#stepRows .step-row').first().locator('input[type="file"]');

    await stepPhotoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);
    await filterModal(page).locator('.pc-btn-primary').click();
    await expect(filterModal(page)).toBeHidden();

    await stepPhotoInput.setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);
    await filterModal(page).locator('.pc-btn-primary').click();
    await expect(filterModal(page)).toBeHidden();

    const tiles = page.locator('#stepRows .step-row').first().locator('.step-photo-tile');
    await expect(tiles).toHaveCount(2);

    await tiles.first().locator('.step-photo-remove').click();
    await expect(tiles).toHaveCount(1);
  });

  test('an extra photo also goes through the filter picker before it\'s added', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-recipe-new.html', 'photo-composer.js');
    await goToStepsPanel(page);

    await page.locator('#extraPhotoInput').setInputFiles(SAMPLE_IMAGE);
    await confirmCrop(page);

    const modal = filterModal(page);
    await expect(modal).toBeVisible();
    await modal.locator('.pf-swatch', { hasText: 'B&W' }).click();
    await modal.locator('.pc-btn-primary').click();
    await expect(modal).toBeHidden();

    await expect(page.locator('#extraPhotosGrid .extra-photo-tile')).toHaveCount(1);
  });
});
