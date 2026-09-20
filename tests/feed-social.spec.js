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
  test('a post with no recipe and no photo shows exactly Heart, Share — no Comment icon, no Save, no Download', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const actions = page.locator('#post-post-no-photo .action-btn');
    await expect(actions).toHaveCount(2);
    await expect(actions.nth(0)).toHaveAttribute('title', 'Heart');
    await expect(actions.nth(1)).toHaveAttribute('title', 'Share');
    // Icon only, no leftover label text next to it.
    await expect(actions.nth(0)).toHaveText('❤️');
    // The comment icon is gone entirely — commenting happens through the
    // always-visible comment input, not a toggle button.
    await expect(page.locator('#post-post-no-photo .action-btn[title="Comment"]')).toHaveCount(0);
  });

  test('a post with a photo shows a Download option', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const actions = page.locator('#post-post-plain .action-btn');
    await expect(actions).toHaveCount(3);
    await expect(actions.nth(2)).toHaveAttribute('title', 'Download photo');
    const svg = actions.nth(2).locator('svg');
    await expect(svg).toHaveCount(1);
  });

  test('a recipe post shows a Save option, icon-only', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const actions = page.locator('#post-post-recipe .action-btn');
    await expect(actions).toHaveCount(3);
    await expect(actions.nth(2)).toHaveAttribute('title', 'Save');
    await expect(actions.nth(2)).toHaveText('🔖');
  });

  test('the always-visible comment input replaces the old toggle — no separate hearts/comments count row', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await expect(page.locator('#post-post-plain .card-comment-input')).toBeVisible();
    await expect(page.locator('#post-post-plain .card-comment-input')).toHaveAttribute('placeholder', 'Comment');
    await expect(page.locator('#post-post-plain .card-stats')).toHaveCount(0);
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
    // A solid filled arrow, not just a thin outline — bold enough to hold
    // its own next to the ❤️/💬 emoji beside it.
    const filledPath = svg.locator('path[fill="currentColor"]');
    await expect(filledPath).toHaveCount(1);
    const strokedPath = svg.locator('path[stroke="currentColor"]');
    const strokeWidth = await strokedPath.evaluate((el) => Number(el.getAttribute('stroke-width')));
    expect(strokeWidth).toBeGreaterThanOrEqual(2);
    const strokeColor = await svg.evaluate((el) => getComputedStyle(el).color);
    expect(strokeColor).toBe('rgb(255, 107, 74)'); // currentColor picks up the brand orange
  });

  test('Heart icon renders larger than plain body text, matching the Share icon\'s size', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const heartBtn = page.locator('#post-post-plain .action-btn[title="Heart"]');
    const heartSize = await heartBtn.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(heartSize).toBeGreaterThanOrEqual(20);
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
