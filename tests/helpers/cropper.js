const { expect } = require('@playwright/test');

// Every image upload now opens CookzerPhotoCropper's crop/reposition/zoom
// step before the rest of that page's upload flow runs — these helpers
// let a test get past it (or exercise it directly) without every spec
// re-deriving the same selectors.
function cropModal(page) {
  return page.locator('.cz2-overlay .pc-modal');
}

async function confirmCrop(page) {
  const modal = cropModal(page);
  await expect(modal).toBeVisible();
  await modal.locator('.pc-btn-primary').click();
  await expect(modal).toBeHidden();
}

async function cancelCrop(page) {
  const modal = cropModal(page);
  await expect(modal).toBeVisible();
  await modal.locator('.pc-btn:not(.pc-btn-primary)').click();
  await expect(modal).toBeHidden();
}

module.exports = { cropModal, confirmCrop, cancelCrop };
