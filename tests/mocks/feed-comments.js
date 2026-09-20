window.__DELETED_COMMENT_IDS__ = [];
window.__INSERTED_COMMENTS__ = [];

const POSTS = [
  { id: 'post-mine', author_id: 'me-1', kind: 'post', recipe_id: null, caption: 'My own post.', photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Me', initials: 'ME' }, recipes: null },
  { id: 'post-other', author_id: 'user-2', kind: 'post', recipe_id: null, caption: "Someone else's post.", photo_path: null, video_uid: null, mood: null, restaurant_name: null, created_at: new Date().toISOString(), profiles: { display_name: 'Cook B', initials: 'CB' }, recipes: null },
];

const PROFILES = [
  { id: 'me-1', display_name: 'Me', initials: 'ME' },
  { id: 'user-2', display_name: 'Cook B', initials: 'CB' },
  { id: 'user-3', display_name: 'Cook C', initials: 'CC' },
  { id: 'user-4', display_name: 'Cook D', initials: 'CD' },
];

// Covers all four combinations: my comment / someone else's comment,
// on my post / someone else's post. c-other-on-mine also tags a real
// registered name to cover the mention-hyperlink rendering path.
let comments = [
  { id: 'c-mine-on-mine', post_id: 'post-mine', author_id: 'me-1', text: 'My comment on my own post.', created_at: new Date().toISOString(), profiles: { display_name: 'Me', initials: 'ME' } },
  { id: 'c-other-on-mine', post_id: 'post-mine', author_id: 'user-3', text: "Thanks @Cook B, someone else's comment on my post.", created_at: new Date().toISOString(), profiles: { display_name: 'Cook C', initials: 'CC' } },
  { id: 'c-mine-on-other', post_id: 'post-other', author_id: 'me-1', text: "My comment on someone else's post.", created_at: new Date().toISOString(), profiles: { display_name: 'Me', initials: 'ME' } },
  { id: 'c-other-on-other', post_id: 'post-other', author_id: 'user-4', text: "Someone else's comment on someone else's post.", created_at: new Date().toISOString(), profiles: { display_name: 'Cook D', initials: 'CD' } },
];

function chain(table) {
  let eqArgs = [];
  let selectOptions = null;
  const builder = {
    select(cols, options) { selectOptions = options || null; return builder; },
    eq(col, val) { eqArgs.push([col, val]); return builder; },
    neq() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    in() { return builder; },
    range() { return builder; },
    single() {
      if (table === 'profiles') return Promise.resolve({ data: { display_name: 'Me', initials: 'ME' }, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      let result = [];
      let count;
      if (table === 'posts') {
        result = POSTS;
      } else if (table === 'comments') {
        const postIdFilter = eqArgs.find((a) => a[0] === 'post_id');
        const filtered = postIdFilter ? comments.filter((c) => c.post_id === postIdFilter[1]) : comments;
        if (selectOptions && selectOptions.count === 'exact' && selectOptions.head) {
          count = filtered.length;
          result = null;
        } else {
          result = filtered;
        }
      } else if (table === 'hearts' || table === 'post_bookmarks' || table === 'challenge_entries' || table === 'follows') {
        result = [];
      } else if (table === 'profiles') {
        result = PROFILES;
      }
      return Promise.resolve({ data: result, error: null, count }).then(resolve);
    },
    delete() {
      return {
        eq(col, val) {
          if (table === 'comments') {
            window.__DELETED_COMMENT_IDS__.push(val);
            comments = comments.filter((c) => c.id !== val);
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    update() { return builder; },
    insert(payload) {
      if (table === 'comments') {
        window.__INSERTED_COMMENTS__.push(payload);
        const row = { id: 'new-comment-1', ...payload, created_at: new Date().toISOString(), profiles: { display_name: 'Me', initials: 'ME' } };
        comments = comments.concat([row]);
      }
      return Promise.resolve({ data: null, error: null });
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
