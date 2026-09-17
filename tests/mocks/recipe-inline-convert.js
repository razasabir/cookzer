window.__CALLS__ = [];

const RECIPE = {
  id: 'r1',
  title: 'Spaghetti Carbonara',
  description: 'A classic.',
  category: 'Dinner',
  dietary_tags: [],
  prep_time_minutes: 10,
  cook_time_minutes: 15,
  servings: 4,
  spice_level: 'Mild',
  ingredients: [
    { name: 'Spaghetti', qty: '400g' },
    { name: 'Butter', qty: '1/2 cup' },
    { name: 'Black pepper', qty: 'to taste' },
    { name: 'Egg yolks', qty: '4' },
  ],
  steps: [],
  nutrition: {},
  cost_per_serve: null,
  hero_photo_path: null,
  created_at: new Date().toISOString(),
  author_id: 'author-1',
  profiles: { display_name: 'Test Cook', initials: 'TC' },
};

function chain(table) {
  const builder = {
    select() { return builder; }, eq() { return builder; }, neq() { return builder; }, in() { return builder; },
    order() { return builder; }, limit() { return builder; }, upsert() { return builder; }, insert() { return builder; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() {
      window.__CALLS__.push({ table });
      return Promise.resolve({ data: table === 'recipes' ? RECIPE : null, error: null });
    },
    then(resolve) {
      window.__CALLS__.push({ table });
      return Promise.resolve({ data: [], error: null }).then(resolve);
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
