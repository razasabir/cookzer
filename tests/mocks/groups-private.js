window.__INSERTED_GROUPS__ = [];
window.__INSERTED_MEMBERS__ = [];
window.__RPC_CALLS__ = [];

let groups = [
  { id: 'g-public', name: 'Slow Cooker Fanatics', description: '', cover_gradient: null, is_private: false, created_at: new Date().toISOString() },
  { id: 'g-private', name: 'The Smiths', description: '', cover_gradient: null, is_private: true, created_at: new Date().toISOString() },
];

function chain(table) {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    in() { return builder; },
    order() { return builder; },
    single() {
      if (table === 'groups') return Promise.resolve({ data: { id: 'new-group-1' }, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) {
      let result = [];
      if (table === 'groups') result = groups;
      else if (table === 'group_members') result = [];
      return Promise.resolve({ data: result, error: null }).then(resolve);
    },
    insert(payload) {
      if (table === 'groups') window.__INSERTED_GROUPS__.push(payload);
      if (table === 'group_members') window.__INSERTED_MEMBERS__.push(payload);
      return builder;
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
    rpc: (name, args) => {
      window.__RPC_CALLS__.push({ name, args });
      if (name === 'join_private_group') {
        if (args.p_invite_code === 'GOODCODE') return Promise.resolve({ data: 'g-private-1', error: null });
        return Promise.resolve({ data: null, error: { message: "That invite code doesn't match a private group." } });
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
};
