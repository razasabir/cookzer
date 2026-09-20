window.__CALLS__ = [];

const HOUSEHOLD = { id: 'household-1', name: null, household_size: 4 };

const PLANNED_ENTRIES = [
  { recipe_id: 'r1', recipes: { ingredients: [{ name: 'Chicken breast', qty: '600 g' }, { name: 'Rice', qty: '2 cups' }] } },
  { recipe_id: 'r2', recipes: { ingredients: [{ name: 'Olive oil', qty: '2 tbsp' }, { name: 'unobtainium dust', qty: '1 cup' }] } },
];

function chain(table) {
  let selectArg = '';
  const builder = {
    select(arg) { selectArg = arg || ''; return builder; },
    eq() { return builder; },
    in() { return builder; },
    not() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    single() {
      if (table === 'households') return Promise.resolve({ data: HOUSEHOLD, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      window.__CALLS__.push({ table, selectArg });
      let result = [];
      if (table === 'meal_plan_entries' && selectArg.includes('ingredients')) result = PLANNED_ENTRIES;
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
    rpc: (fn) => {
      if (fn === 'get_or_create_my_household') return Promise.resolve({ data: HOUSEHOLD.id, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
