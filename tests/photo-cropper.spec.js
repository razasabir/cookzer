const path = require('path');
const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');
const { confirmCrop, cancelCrop } = require('./helpers/cropper');

// CookzerPhotoCropper.open() itself — exercised directly against a
// synthetic in-page image (rather than a fixture file) so every test
// controls its own source dimensions precisely. Run on cookzer-feed.html
// only because that's a page that already loads photo-cropper.js and has
// a working mock; the module itself has no feed-specific behavior.
async function startCrop(page, opts) {
  await page.evaluate(async (opts) => {
    const file = await new Promise((resolve) => {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 150;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 200, 150);
      c.toBlob((blob) => resolve(new File([blob], 'test.png', { type: 'image/png' })), 'image/png');
    });
    window.__cropPromise = window.CookzerPhotoCropper.open(file, opts);
  }, opts);
}

async function cropResult(page) {
  return page.evaluate(async () => {
    const file = await window.__cropPromise;
    if (!file) return null;
    const dims = await new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
      im.src = URL.createObjectURL(file);
    });
    return { name: file.name, type: file.type, size: file.size, ...dims };
  });
}

test.describe('CookzerPhotoCropper', () => {
  test('opens with the given title and a rect frame matching the requested aspect ratio', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await startCrop(page, { aspect: 4 / 3, title: 'Crop your photo' });

    await expect(page.locator('.pc-modal h3')).toHaveText('Crop your photo');
    const frame = page.locator('.pc-frame');
    await expect(frame).toBeVisible();
    await expect(frame).not.toHaveClass(/pc-circle/);

    const box = await frame.boundingBox();
    expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
  });

  test('shape: "circle" forces a square, round frame regardless of the passed aspect', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await startCrop(page, { shape: 'circle', aspect: 16 / 9, title: 'Crop your profile photo' });

    const frame = page.locator('.pc-frame');
    await expect(frame).toHaveClass(/pc-circle/);
    const box = await frame.boundingBox();
    expect(box.width / box.height).toBeCloseTo(1, 1);
  });

  test('the zoom slider enlarges the displayed image', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await startCrop(page, { aspect: 1, title: 'Crop' });

    const previewImg = page.locator('.pc-frame img');
    const widthBefore = await previewImg.evaluate((el) => parseFloat(el.style.width));

    const slider = page.locator('.pc-zoom-row input[type="range"]');
    await slider.evaluate((el) => {
      el.value = '2.5';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const widthAfter = await previewImg.evaluate((el) => parseFloat(el.style.width));
    expect(widthAfter).toBeGreaterThan(widthBefore);
  });

  test('dragging the frame repositions the image', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await startCrop(page, { aspect: 4 / 3, title: 'Crop' });

    // Zoom in first so there's room to pan without hitting the clamp.
    const slider = page.locator('.pc-zoom-row input[type="range"]');
    await slider.evaluate((el) => {
      el.value = '2';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const previewImg = page.locator('.pc-frame img');
    const transformBefore = await previewImg.evaluate((el) => el.style.transform);

    const frame = page.locator('.pc-frame');
    const box = await frame.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 - 25, { steps: 5 });
    await page.mouse.up();

    const transformAfter = await previewImg.evaluate((el) => el.style.transform);
    expect(transformAfter).not.toBe(transformBefore);
  });

  test('confirming resolves with a cropped File matching the original name/type, sized to the requested aspect', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await startCrop(page, { aspect: 4 / 3, title: 'Crop your photo' });
    await confirmCrop(page);

    const result = await cropResult(page);
    expect(result).not.toBeNull();
    expect(result.name).toBe('test.png');
    expect(result.type).toBe('image/png');
    expect(result.size).toBeGreaterThan(0);
    expect(result.w / result.h).toBeCloseTo(4 / 3, 1);
  });

  test('canceling resolves with null and leaves no trace in the DOM', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await startCrop(page, { aspect: 1, title: 'Crop' });
    await cancelCrop(page);

    const result = await cropResult(page);
    expect(result).toBeNull();
    await expect(page.locator('.pc-modal')).toHaveCount(0);
  });

  test('clicking the backdrop also cancels', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');
    await startCrop(page, { aspect: 1, title: 'Crop' });

    await expect(page.locator('.pc-modal')).toBeVisible();
    // Click the overlay itself, well outside the centered modal.
    await page.locator('.cz2-overlay').click({ position: { x: 5, y: 5 } });

    const result = await cropResult(page);
    expect(result).toBeNull();
    await expect(page.locator('.pc-modal')).toHaveCount(0);
  });
});

test.describe('Crop step wired into upload flows', () => {
  test('feed composer: canceling the crop leaves the composer untouched', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
    });
    await loadPageWithMock(page, 'cookzer-feed.html', 'photo-composer.js');

    await page.locator('#composerMediaInput').setInputFiles(path.join(__dirname, '..', 'icon-192.png'));
    await cancelCrop(page);

    await expect(page.locator('#composerPhotoPreview')).toBeHidden();
    await expect(page.locator('#composerFilterRow')).toBeHidden();
  });

  test('profile picture: change photo opens a circular crop step, and confirming updates the avatar preview and upload', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-profile.html', 'profile-page.js');

    await page.locator('#profileActions button', { hasText: 'Edit profile' }).click();
    await expect(page.locator('#editModal')).toHaveClass(/open/);

    await page.locator('#editAvatarBtn').click();
    await page.locator('#editAvatarInput').setInputFiles(path.join(__dirname, '..', 'icon-192.png'));

    await expect(page.locator('.pc-modal h3')).toHaveText('Crop your profile photo');
    await expect(page.locator('.pc-frame')).toHaveClass(/pc-circle/);
    await confirmCrop(page);

    const bgImage = await page.locator('#editAvatarPreview').evaluate((el) => el.style.backgroundImage);
    expect(bgImage).toContain('blob:');

    await page.locator('#editSaveBtn').click();
    await expect.poll(() => page.evaluate(() => window.__UPLOADS__.length)).toBe(1);
    const upload = await page.evaluate(() => window.__UPLOADS__[0]);
    expect(upload.bucket).toBe('avatars');
    expect(upload.hasName).toBe(true);
  });
});
