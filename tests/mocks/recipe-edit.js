window.__RECIPE_UPDATES__ = [];
window.__INSERTED_RECIPE_PHOTOS__ = [];

const RECIPE = {
  id: 'r1',
  title: 'Spaghetti Carbonara',
  description: 'A classic.',
  category: 'Dinner',
  dietary_tags: ['Vegetarian'],
  tags: ['quick', 'weeknight'],
  prep_time_minutes: 10,
  cook_time_minutes: 15,
  servings: 4,
  spice_level: 'Mild',
  ingredients: [{ name: 'Spaghetti', qty: '400g' }, { name: 'Eggs', qty: '3' }],
  steps: [
    { text: 'Boil the pasta.', photo_paths: ['me-1/step1.jpg', 'me-1/step1b.jpg'] },
    { text: 'Toss with egg and cheese.', photo_paths: [] },
  ],
  nutrition: { calories: 520, protein: 22 },
  cost_per_serve: 3.5,
  hero_photo_path: 'me-1/step1.jpg',
  author_id: 'me-1',
};

// One gallery photo beyond the step photo above, so the "extra photos"
// prefill has something to show once the step's own photo is excluded.
const RECIPE_PHOTOS = [
  { id: 'p1', storage_path: 'me-1/step1.jpg' },
  { id: 'p2', storage_path: 'me-1/extra1.jpg' },
];

function chain(table) {
  let eqArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    neq() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    or() { return builder; },
    in() { return builder; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() {
      if (table === 'recipes') return Promise.resolve({ data: RECIPE, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'recipe_photos') {
        const recipeIdFilter = eqArgs.find((a) => a[0] === 'recipe_id');
        const userIdFilter = eqArgs.find((a) => a[0] === 'user_id');
        result = RECIPE_PHOTOS.filter((p) =>
          (!recipeIdFilter || recipeIdFilter[1] === 'r1') && (!userIdFilter || userIdFilter[1] === 'me-1')
        );
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    update(payload) {
      const upd = {
        async eq(col, val) {
          window.__RECIPE_UPDATES__.push({ id: val, payload });
          // Reported to the test harness itself (not just a window var):
          // the page redirects right after a successful save, and that
          // navigation would otherwise wipe this array before it's read.
          if (window.__reportTestHook__) await window.__reportTestHook__('recipes.update', { id: val, payload });
          return { data: null, error: null };
        },
      };
      return upd;
    },
    upsert() { return Promise.resolve({ data: null, error: null }); },
    async insert(payload) {
      if (table === 'recipe_photos') {
        const rows = Array.isArray(payload) ? payload : [payload];
        window.__INSERTED_RECIPE_PHOTOS__.push(...rows);
        if (window.__reportTestHook__) await window.__reportTestHook__('recipe_photos.insert', rows);
      }
      return { data: null, error: null };
    },
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
        getPublicUrl: (path) => ({ data: { publicUrl: 'https://example.test/' + path } }),
        upload: () => Promise.resolve({ data: {}, error: null }),
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
