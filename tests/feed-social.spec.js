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
  test('a post with no recipe and no photo shows exactly Heart, Comment, Share — no Save', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const actions = page.locator('#post-post-no-photo .action-btn');
    await expect(actions).toHaveCount(3);
    await expect(actions.nth(0)).toHaveAttribute('title', 'Heart');
    await expect(actions.nth(1)).toHaveAttribute('title', 'Comment');
    await expect(actions.nth(2)).toHaveAttribute('title', 'Share');
    await expect(page.locator('#post-post-no-photo .action-btn[title="Save"]')).toHaveCount(0);
  });

  test('a post with a photo but no recipe shows a Save option (device save only)', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const actions = page.locator('#post-post-plain .action-btn');
    await expect(actions).toHaveCount(4);
    await expect(actions.nth(3)).toHaveAttribute('title', 'Save');
  });

  test('a recipe post shows a Save option, icon-only, as a real SVG not an emoji', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const saveBtn = page.locator('#post-post-recipe .action-btn[title="Save"]');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn.locator('svg')).toHaveCount(1);
  });

  test('the comment panel is collapsed by default and opens only when the Comment icon is clicked', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await expect(page.locator('#commentPanel-post-plain')).not.toHaveClass(/open/);
    await expect(page.locator('#post-post-plain .card-comment-input')).not.toBeVisible();

    await page.locator('#post-post-plain .action-btn[title="Comment"]').click();
    await expect(page.locator('#commentPanel-post-plain')).toHaveClass(/open/);
    await expect(page.locator('#post-post-plain .card-comment-input')).toBeVisible();
    await expect(page.locator('#post-post-plain .card-comment-input')).toHaveAttribute('placeholder', 'Comment');
  });

  test('opening the comment panel shows every old comment — a real mini feed, not just the input', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js'); // post-plain has 2 seeded comments
    await page.locator('#post-post-plain .action-btn[title="Comment"]').click();
    await expect(page.locator('#commentBox-post-plain .comment-row')).toHaveCount(2);
  });

  test('clicking the Comment icon again closes the panel', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const commentBtn = page.locator('#post-post-plain .action-btn[title="Comment"]');
    await commentBtn.click();
    await expect(page.locator('#commentPanel-post-plain')).toHaveClass(/open/);
    await commentBtn.click();
    await expect(page.locator('#commentPanel-post-plain')).not.toHaveClass(/open/);
  });

  test('the comment input has a Send button beside it', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-plain .action-btn[title="Comment"]').click();
    const sendBtn = page.locator('#post-post-plain .card-comment-send-btn');
    await expect(sendBtn).toHaveText('Send');
  });

  test('the caption is bold', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const caption = page.locator('#post-post-plain .card-description');
    const weight = await caption.evaluate((el) => getComputedStyle(el).fontWeight);
    expect(Number(weight)).toBeGreaterThanOrEqual(700);
  });

  test('heart and comment counts show inline beside their icons when there are any', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await expect(page.locator('#heartCount-post-plain')).toHaveText('3');
    await expect(page.locator('#commentCount-post-plain')).toHaveText('2');
  });

  test('the counts are left blank, not shown as 0, when a post has neither', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await expect(page.locator('#heartCount-post-no-photo')).toHaveText('');
    await expect(page.locator('#commentCount-post-no-photo')).toHaveText('');
  });

  test('the Share icon is a neutral color by default, not a fixed brand color', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const shareBtn = page.locator('#post-post-plain .action-btn[title="Share"]');
    const color = await shareBtn.evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe('rgb(255, 107, 74)'); // not permanently var(--brick) anymore
  });

  test('every action icon is a real stroked SVG, not emoji or a leftover text glyph', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    for (const title of ['Heart', 'Comment', 'Share']) {
      const btn = page.locator(`#post-post-plain .action-btn[title="${title}"]`);
      const svg = btn.locator('svg');
      await expect(svg).toHaveCount(1);
      await expect(svg).toHaveAttribute('stroke', 'currentColor');
      const strokeWidth = await svg.evaluate((el) => Number(el.getAttribute('stroke-width')));
      expect(strokeWidth).toBeGreaterThan(0);
    }
  });

  test('Heart, Comment, and Share icons render at the same size', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const sizes = [];
    for (const title of ['Heart', 'Comment', 'Share']) {
      const svg = page.locator(`#post-post-plain .action-btn[title="${title}"] svg`);
      sizes.push(await svg.evaluate((el) => getComputedStyle(el).width));
    }
    expect(new Set(sizes).size).toBe(1);
  });

  test('clicking Heart calls toggleHeart directly, with no panel to open first', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const heartBtn = page.locator('#post-post-no-photo .action-btn[title="Heart"]');
    await heartBtn.click();
    // No inline panel exists for Heart — verify none of the three panel
    // ids got created/opened as a side effect of this click.
    await expect(page.locator('#commentPanel-post-no-photo')).not.toHaveClass(/open/);
    await expect(page.locator('#sharePanel-post-no-photo')).not.toHaveClass(/open/);
  });

  test('Share opens an in-app popup with the link, not the OS share sheet', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    await page.locator('#post-post-plain .action-btn[title="Share"]').click();
    // Share now opens a Reshare/Group/External inline panel first, not
    // the share-link popup directly — "Share externally" is the option
    // that reaches the same in-app link popup as before.
    await page.locator('#sharePanelBody-post-plain .cz2-row', { hasText: 'Share externally' }).click();
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

test.describe('Feed — @mentions in a rendered caption link to the tagged profile', () => {
  test('a mention matching a real display name renders as a link to that profile, an unmatched "@" stays plain text', async ({ page }) => {
    await loadPageWithMock(page, 'cookzer-feed.html', 'feed-social.js');
    const card = page.locator('#post-post-mention');
    const mentionLink = card.locator('.mention-link');
    await expect(mentionLink).toHaveCount(1);
    await expect(mentionLink).toHaveText('@Cook B');
    await expect(mentionLink).toHaveAttribute('href', 'cookzer-profile.html?id=user-2');
    // "@Not A Real Person" matches no real display_name, so it's left
    // as ordinary text rather than a dead/misleading link.
    await expect(card.locator('.card-description')).toContainText('@Not A Real Person said hi');
  });
});
