// Generic Supabase mock for pages with composer photo upload (feed/group).
// Every table not specifically handled returns an empty result — good
// enough to get past each page's init() (feed loading, challenge,
// trending, contributors, etc. all just render "nothing" on empty data)
// so the test can exercise the composer/filter UI in isolation.
window.__CALLS__ = [];
window.__UPLOADS__ = [];

function genericChain(table) {
  const builder = {
    select() { return builder; }, eq() { return builder; }, neq() { return builder; }, in() { return builder; },
    order() { return builder; }, limit() { return builder; }, not() { return builder; }, gte() { return builder; }, lte() { return builder; }, range() { return builder; },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    single() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      window.__CALLS__.push({ table });
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
    delete() { return Promise.resolve({ data: null, error: null }); },
    update() { return builder; },
    insert(row) {
      window.__CALLS__.push({ table, op: 'insert', row });
      return Promise.resolve({ data: null, error: null });
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
    from: (table) => genericChain(table),
    storage: {
      from: (bucket) => ({
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }),
        upload: (path, fileOrBlob, opts) => {
          window.__UPLOADS__.push({
            bucket,
            path,
            hasName: typeof fileOrBlob.name === 'string',
            size: fileOrBlob.size,
            contentType: opts && opts.contentType,
          });
          return Promise.resolve({ data: { path }, error: null });
        },
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
