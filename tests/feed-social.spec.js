const { test, expect } = require('@playwright/test');
const { loadPageWithMock } = require('./helpers/loadPage');

test.describe('Feed — profile photos', () => {
  test('the header shows your name next to your avatar', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await expect(page.locator('#headerName')).toHaveText('Me Cook');
  });

  test('the header and composer avatars show your real photo, not just initials', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const headerBg = await page.locator('#headerAvatar').evaluate((el) => el.style.backgroundImage);
    const composerBg = await page.locator('#composerAvatar').evaluate((el) => el.style.backgroundImage);
    expect(headerBg).toContain('me.jpg');
    expect(composerBg).toContain('me.jpg');
  });

  test('a post card shows the author\'s real photo when they have one, initials otherwise', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const noPhotoAvatar = page.locator('#post-post-recipe .card-avatar');
    await expect(noPhotoAvatar).toHaveText('CB');
    const withPhotoAvatar = page.locator('#post-post-tip .card-avatar');
    const bg = await withPhotoAvatar.evaluate((el) => el.style.backgroundImage);
    expect(bg).toContain('cookc.jpg');
  });
});

test.describe('Feed — recipe/tip borders', () => {
  test('a recipe post gets the green has-recipe border, a tip post the orange has-tip border, a plain post neither', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await expect(page.locator('#post-post-recipe')).toHaveClass(/has-recipe/);
    await expect(page.locator('#post-post-recipe')).not.toHaveClass(/has-tip/);
    await expect(page.locator('#post-post-tip')).toHaveClass(/has-tip/);
    await expect(page.locator('#post-post-tip')).not.toHaveClass(/has-recipe/);
    await expect(page.locator('#post-post-plain')).not.toHaveClass(/has-recipe|has-tip/);
  });
});

test.describe('Feed — action buttons', () => {
  test('a plain post shows exactly Heart, Comment, Share — no Save', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const actions = page.locator('#post-post-plain .action-btn');
    await expect(actions).toHaveCount(3);
    await expect(actions.nth(0)).toContainText('Heart');
    await expect(actions.nth(1)).toContainText('Comment');
    await expect(actions.nth(2)).toContainText('Share');
  });

  test('a recipe post shows a 4th option, Save', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const actions = page.locator('#post-post-recipe .action-btn');
    await expect(actions).toHaveCount(4);
    await expect(actions.nth(3)).toContainText('Save');
  });

  test('Share opens an in-app popup with the link, not the OS share sheet', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-plain .action-btn', { hasText: 'Share' }).click();
    await expect(page.locator('.cz-share-link-row input')).toHaveValue(/post=post-plain/);

    await page.locator('.cz-share-copy-btn').click();
    const clipboard = await page.evaluate(() => window.__CLIPBOARD__);
    expect(clipboard).toContain('post=post-plain');

    await page.locator('.cz-share-close').click();
    await expect(page.locator('.cz-modal-overlay')).toHaveCount(0);
  });
});

test.describe('Feed — @mention autocomplete', () => {
  test('typing @ plus letters shows matching friends, filtered as you type', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const caption = page.locator('#postCaption');
    await caption.pressSequentially('Cooking with @al');
    await expect(page.locator('.mention-row')).toHaveCount(1);
    await expect(page.locator('.mention-row')).toContainText('Alice Cook');
  });

  test('clicking a suggestion inserts their name in place of the typed fragment', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const caption = page.locator('#postCaption');
    await caption.pressSequentially('Cooking with @al');
    await page.locator('.mention-row', { hasText: 'Alice Cook' }).click();
    await expect(caption).toHaveValue('Cooking with @Alice Cook ');
    await expect(page.locator('.mention-dropdown')).toHaveCount(0);
  });

  test('no match, no dropdown', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const caption = page.locator('#postCaption');
    await caption.pressSequentially('Cooking with @zzz');
    await expect(page.locator('.mention-dropdown')).toHaveCount(0);
  });
});
