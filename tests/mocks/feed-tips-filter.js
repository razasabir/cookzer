window.__CALLS__ = [];
window.__INSERTED_POSTS__ = [];

const ALL_POSTS = [
  { id: 'post-tip-1', author_id: 'user-1', kind: 'tip', recipe_id: null, caption: 'Freeze ginger, grate it straight from frozen.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook A', initials: 'CA' }, recipes: null },
  { id: 'post-normal-1', author_id: 'user-2', kind: 'post', recipe_id: null, caption: 'Made pasta tonight.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook B', initials: 'CB' }, recipes: null },
  { id: 'post-tip-2', author_id: 'user-3', kind: 'tip', recipe_id: null, caption: 'Salt your pasta water more than feels right.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook C', initials: 'CC' }, recipes: null },
  { id: 'post-recipe-1', author_id: 'user-4', kind: 'post', recipe_id: 'r1', caption: 'Finally nailed this one.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook D', initials: 'CD' }, recipes: { title: 'Lemon Herb Chicken', hero_photo_path: null } },
];

function chain(table) {
  let rangeArgs = null;
  let eqArgs = [];
  const builder = {
    select() { return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    neq() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    in() { return builder; },
    range(from, to) { rangeArgs = [from, to]; return builder; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      window.__CALLS__.push({ table, rangeArgs, eqArgs });
      let result = [];
      if (table === 'posts') {
        const kindFilter = eqArgs.find((a) => a[0] === 'kind');
        result = kindFilter ? ALL_POSTS.filter((p) => p.kind === kindFilter[1]) : ALL_POSTS;
        if (rangeArgs) result = result.slice(rangeArgs[0], rangeArgs[1] + 1);
      } else if (table === 'profiles') {
        result = [{ id: 'me-1', display_name: 'Me', initials: 'ME', avatar_url: null }];
      }
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    delete() { return Promise.resolve({ data: null, error: null }); },
    update() { return builder; },
    insert(payload) {
      window.__INSERTED_POSTS__.push(payload);
      return {
        select() {
          return { single: () => Promise.resolve({ data: { id: 'new-post-1' }, error: null }) };
        },
      };
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
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
try { localStorage.setItem('cookzer-welcomed', '1'); } catch (e) {}
