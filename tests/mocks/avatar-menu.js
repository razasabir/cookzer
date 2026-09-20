const ME = { display_name: 'Me Cook', initials: 'MC', avatar_url: null };

function chain(table) {
  let selectOptions = null;
  const builder = {
    select(cols, options) { selectOptions = options || null; return builder; },
    eq() { return builder; },
    neq() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    in() { return builder; },
    range() { return builder; },
    not() { return builder; },
    gte() { return builder; },
    single() {
      if (table === 'profiles') return Promise.resolve({ data: ME, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      let result = [];
      let count;
      if (table === 'ai_assistant_messages' && selectOptions && selectOptions.count === 'exact' && selectOptions.head) {
        count = 42;
        result = null;
      } else if (table === 'posts' || table === 'follows' || table === 'hearts' || table === 'comments') {
        result = [];
      }
      return Promise.resolve({ data: result, error: null, count }).then(resolve);
    },
    delete() { return { eq() { return Promise.resolve({ data: null, error: null }); } }; },
    update() { return builder; },
    insert() {
      return { select() { return { single: () => Promise.resolve({ data: { id: 'new-1' }, error: null }) }; } };
    },
  };
  return builder;
}

window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'me-1', email: 'me@example.com' } } } }),
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
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
