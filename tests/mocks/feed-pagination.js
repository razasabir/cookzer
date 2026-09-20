window.__CALLS__ = [];
function makePost(i) {
  return {
    id: 'post-' + i, author_id: 'user-' + (i % 3), kind: 'post', recipe_id: null,
    caption: 'Post number ' + i, photo_path: null, video_uid: null, mood: null, restaurant_name: null,
    created_at: new Date(Date.now() - i * 60000).toISOString(),
    profiles: { display_name: 'Cook ' + i, initials: 'C' + i }, recipes: null,
  };
}
window.__ALL_POSTS__ = Array.from({ length: 45 }, (_, i) => makePost(i));
window.__HEARTS__ = [
  { post_id: 'post-0', user_id: 'me-1' },
  { post_id: 'post-0', user_id: 'user-1' },
  { post_id: 'post-2', user_id: 'me-1' },
];
window.__COMMENTS__ = [
  { post_id: 'post-0' }, { post_id: 'post-0' }, { post_id: 'post-1' },
];

function chain(table) {
  let rangeArgs = null;
  let inArgs = null;
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    neq() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    in(col, vals) { inArgs = vals; return builder; },
    range(from, to) { rangeArgs = [from, to]; return builder; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      window.__CALLS__.push({ table, rangeArgs, inArgs });
      let result;
      if (table === 'posts') {
        if (rangeArgs) result = window.__ALL_POSTS__.slice(rangeArgs[0], rangeArgs[1] + 1);
        else result = window.__ALL_POSTS__;
      } else if (table === 'hearts') {
        result = inArgs ? window.__HEARTS__.filter((h) => inArgs.includes(h.post_id)) : window.__HEARTS__;
      } else if (table === 'comments') {
        result = inArgs ? window.__COMMENTS__.filter((c) => inArgs.includes(c.post_id)) : window.__COMMENTS__;
      } else if (table === 'profiles') {
        result = [{ id: 'me-1', display_name: 'Me', initials: 'ME', avatar_url: null }];
      } else {
        result = [];
      }
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
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
