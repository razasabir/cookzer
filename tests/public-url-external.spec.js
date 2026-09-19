const { test, expect } = require('@playwright/test');
const { blockExternalRequests } = require('./helpers/loadPage');

// Bulk-seeded recipes will use a licensed stock photo URL (Unsplash/Pexels)
// as hero_photo_path instead of a path inside our own Storage bucket.
// publicUrl() must pass a full external URL through unchanged rather than
// running it through sb.storage.from(...).getPublicUrl(), which would
// mangle it. Checked on cookzer-recipe.html; the same fix is applied
// identically on all 9 pages that define this helper.
test.describe('publicUrl external URL passthrough', () => {
  test('an http(s) hero_photo_path is used directly, not resolved via Storage', async ({ page }) => {
    await page.addInitScript(() => {
      function chain(table) {
        const builder = {
          select() { return builder; }, eq() { return builder; }, neq() { return builder; }, in() { return builder; },
          order() { return builder; }, limit() { return builder; }, not() { return builder; },
          single() { return Promise.resolve({ data: null, error: null }); },
          maybeSingle() {
            if (table === 'recipes') {
              return Promise.resolve({
                data: {
                  id: 'r1', title: 'External Photo Recipe', description: '', category: 'Dinner',
                  dietary_tags: [], prep_time_minutes: 5, cook_time_minutes: 5, servings: 2, spice_level: null,
                  ingredients: [], steps: [], nutrition: null, cost_per_serve: null,
                  hero_photo_path: 'https://images.unsplash.com/photo-test?w=800',
                  created_at: new Date().toISOString(), author_id: 'me-1',
                  profiles: { display_name: 'Me', initials: 'ME' },
                },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
          then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
          delete() { return Promise.resolve({ data: null, error: null }); },
          update() { return builder; },
          insert() { return Promise.resolve({ data: null, error: null }); },
        };
        return builder;
      }
      window.supabase = {
        createClient: () => ({
          auth: {
            getSession: () => Promise.resolve({ data: { session: { user: { id: 'me-1' } } } }),
            getUser: () => Promise.resolve({ data: { user: { id: 'me-1', email: 'me@example.com' } } }),
            onAuthStateChange: () => {},
            signOut: () => Promise.resolve({}),
          },
          from: (table) => chain(table),
          storage: {
            from: () => ({
              getPublicUrl: () => ({ data: { publicUrl: 'https://SHOULD-NOT-BE-USED.example.com/x.jpg' } }),
              upload: () => Promise.resolve({ data: {}, error: null }),
            }),
          },
          channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
          removeChannel: () => {},
        }),
      };
    });

    await blockExternalRequests(page);
    await page.goto('file://' + require('path').resolve(__dirname, '..', 'cookzer-recipe.html') + '?id=r1');
    await expect(page.locator('#rHero')).toHaveCSS('background-image', /images\.unsplash\.com\/photo-test/);
    const bg = await page.locator('#rHero').evaluate((el) => el.style.backgroundImage);
    expect(bg).not.toContain('SHOULD-NOT-BE-USED');
  });
});
