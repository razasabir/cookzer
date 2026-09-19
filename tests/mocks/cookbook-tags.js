// Mock for cookzer-cookbook.html's "Filter by hashtag" row — covers both
// tag sources it now reads: the saver's own personal tags (saved_recipes.tags)
// and the recipe author's own free-text tags (recipes.tags, the same ones
// the feed's tag filter chips read).
window.__CALLS__ = [];

const SAVED_RECIPES = [
  { recipe_id: 'r1', tags: ['weekend'], note: null, recipes: { id: 'r1', title: 'Lemon Herb Chicken', hero_photo_path: null, tags: ['quick', 'weeknight'] } },
  { recipe_id: 'r2', tags: [], note: null, recipes: { id: 'r2', title: 'Garlic Naan', hero_photo_path: null, tags: ['quick'] } },
  { recipe_id: 'r3', tags: ['comfort'], note: null, recipes: { id: 'r3', title: 'Beef Stew', hero_photo_path: null, tags: [] } },
];

function chain(table) {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    order() { return builder; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      window.__CALLS__.push({ table });
      let result = [];
      if (table === 'saved_recipes') result = SAVED_RECIPES;
      else if (table === 'recipe_lists') result = [];
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { return Promise.resolve({ data: null, error: null }); },
    update() { return builder; },
    insert() { return { select() { return { single: () => Promise.resolve({ data: { id: 'new-list-1' }, error: null }) }; } }; },
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
