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
  test('a plain post shows exactly Heart, Comment, Share as icon-only buttons — no Save', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const actions = page.locator('#post-post-plain .action-btn');
    await expect(actions).toHaveCount(3);
    await expect(actions.nth(0)).toHaveAttribute('title', 'Heart');
    await expect(actions.nth(1)).toHaveAttribute('title', 'Comment');
    await expect(actions.nth(2)).toHaveAttribute('title', 'Share');
    // Icon only, no leftover label text next to it.
    await expect(actions.nth(0)).toHaveText('❤️');
    await expect(actions.nth(1)).toHaveText('💬');
  });

  test('a recipe post shows a 4th option, Save', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const actions = page.locator('#post-post-recipe .action-btn');
    await expect(actions).toHaveCount(4);
    await expect(actions.nth(3)).toContainText('Save');
  });

  test('the Share icon is the brand orange, not the default action color', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const shareBtn = page.locator('#post-post-plain .action-btn[title="Share"]');
    const color = await shareBtn.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(255, 107, 74)'); // var(--brick)
  });

  test('the Share icon is a real SVG icon, not a thin/hard-to-see text glyph', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const shareBtn = page.locator('#post-post-plain .action-btn[title="Share"]');
    await expect(shareBtn).toHaveText(''); // no leftover character alongside the icon
    const svg = shareBtn.locator('svg');
    await expect(svg).toHaveCount(1);
    // Bold enough to hold its own next to the ❤️/💬 emoji beside it — not
    // a hairline stroke.
    const strokeWidth = await svg.evaluate((el) => Number(el.getAttribute('stroke-width')));
    expect(strokeWidth).toBeGreaterThanOrEqual(2);
    const strokeColor = await svg.evaluate((el) => getComputedStyle(el).color);
    expect(strokeColor).toBe('rgb(255, 107, 74)'); // stroke="currentColor" picks up the brand orange
  });

  test('Share opens an in-app popup with the link, not the OS share sheet', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-plain .action-btn[title="Share"]').click();
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
