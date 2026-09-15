const { test, expect } = require('@playwright/test');
const path = require('path');

// cookzer-modal.js replaces native alert/confirm/prompt with a styled
// in-app modal — these popups used to show the browser's own address
// bar ("cookzer.com says"), which looked out of place on a polished site.
test.describe('CookzerModal', () => {
  async function setup(page) {
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ path: path.resolve(__dirname, '..', 'cookzer-modal.js') });
  }

  test('confirm resolves true on OK, false on Cancel', async ({ page }) => {
    await setup(page);

    const result1 = page.evaluate(() => window.CookzerModal.confirm('Remove this member?'));
    await page.locator('.cz-modal-btn.cz-primary').click();
    expect(await result1).toBe(true);

    const result2 = page.evaluate(() => window.CookzerModal.confirm('Remove this member?'));
    await page.locator('.cz-modal-btn.cz-ghost').click();
    expect(await result2).toBe(false);
  });

  test('confirm resolves false on Escape and on backdrop click', async ({ page }) => {
    await setup(page);

    const r1 = page.evaluate(() => window.CookzerModal.confirm('Sure?'));
    await page.keyboard.press('Escape');
    expect(await r1).toBe(false);

    const r2 = page.evaluate(() => window.CookzerModal.confirm('Sure?'));
    await page.locator('.cz-modal-overlay').click({ position: { x: 5, y: 5 } });
    expect(await r2).toBe(false);
  });

  test('prompt returns the typed value on OK, prefilled with the default', async ({ page }) => {
    await setup(page);

    const result = page.evaluate(() => window.CookzerModal.prompt('Group name:', 'Weeknight Cooks'));
    await expect(page.locator('.cz-modal-input')).toHaveValue('Weeknight Cooks');
    await page.locator('.cz-modal-input').fill('Sunday Roasts');
    await page.locator('.cz-modal-btn.cz-primary').click();
    expect(await result).toBe('Sunday Roasts');
  });

  test('prompt returns null on Cancel or Escape', async ({ page }) => {
    await setup(page);

    const r1 = page.evaluate(() => window.CookzerModal.prompt('Name?'));
    await page.locator('.cz-modal-btn.cz-ghost').click();
    expect(await r1).toBeNull();

    const r2 = page.evaluate(() => window.CookzerModal.prompt('Name?'));
    await page.keyboard.press('Escape');
    expect(await r2).toBeNull();
  });

  test('Enter key in the prompt input submits like clicking OK', async ({ page }) => {
    await setup(page);
    const result = page.evaluate(() => window.CookzerModal.prompt('Tags:', ''));
    await page.locator('.cz-modal-input').fill('quick, easy');
    await page.locator('.cz-modal-input').press('Enter');
    expect(await result).toBe('quick, easy');
  });

  test('alert shows only an OK button and resolves on click', async ({ page }) => {
    await setup(page);
    const result = page.evaluate(() => window.CookzerModal.alert('Saved!'));
    await expect(page.locator('.cz-modal-btn.cz-ghost')).toHaveCount(0);
    await page.locator('.cz-modal-btn.cz-primary').click();
    await result; // resolves with no meaningful value, just confirms it settles
  });

  test('the overlay is removed from the DOM after resolving', async ({ page }) => {
    await setup(page);
    const result = page.evaluate(() => window.CookzerModal.confirm('Sure?'));
    await page.locator('.cz-modal-btn.cz-primary').click();
    await result;
    await expect(page.locator('.cz-modal-overlay')).toHaveCount(0);
  });
});
