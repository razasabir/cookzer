window.__CALLS__ = [];

const RECIPES = [
  { id: 'r1', title: 'Lemon Herb Roast Chicken', hero_photo_path: null, ingredients: [{ name: 'Chicken breast' }, { name: 'Lemon' }, { name: 'Garlic' }] },
  { id: 'r2', title: 'Veggie Fried Rice', hero_photo_path: null, ingredients: [{ name: 'Rice' }, { name: 'Egg' }, { name: 'Carrot' }, { name: 'Peas' }] },
  { id: 'r3', title: 'Chicken Fried Rice', hero_photo_path: null, ingredients: [{ name: 'Chicken' }, { name: 'Rice' }, { name: 'Egg' }] },
];

function chain(table) {
  const builder = {
    select() { return builder; }, eq() { return builder; }, neq() { return builder; }, in() { return builder; },
    order() { return builder; }, limit() { return builder; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      window.__CALLS__.push({ table });
      const result = table === 'recipes' ? RECIPES : [];
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
