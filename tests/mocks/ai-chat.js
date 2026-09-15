window.__CALLS__ = [];

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
    insert() { return Promise.resolve({ data: null, error: null }); },
  };
  return builder;
}

function conversationsChain(store) {
  const filters = {};
  const builder = {
    select() { return builder; },
    eq(col, val) { filters[col] = val; return builder; },
    maybeSingle() {
      window.__CALLS__.push({ table: 'ai_assistant_conversations', op: 'maybeSingle', filters: { ...filters } });
      const id = store.conversationsByFeature[filters.feature];
      return Promise.resolve({ data: id ? { id } : null, error: null });
    },
    insert(row) {
      window.__CALLS__.push({ table: 'ai_assistant_conversations', op: 'insert', row });
      const id = store.conversationsByFeature[row.feature] || ('convo-' + row.feature);
      store.conversationsByFeature[row.feature] = id;
      return {
        select() { return this; },
        single: () => Promise.resolve({ data: { id }, error: null }),
      };
    },
  };
  return builder;
}

function messagesChain(store) {
  const filters = {};
  let countMode = false;
  const builder = {
    select(cols, opts) {
      if (opts && opts.count) countMode = true;
      return builder;
    },
    eq(col, val) { filters[col] = val; return builder; },
    gte() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    then(resolve) {
      window.__CALLS__.push({ table: 'ai_assistant_messages', op: 'select', countMode, filters: { ...filters } });
      if (countMode) {
        return Promise.resolve({ data: [], error: null, count: store.usageCount }).then(resolve);
      }
      const history = store.messagesByConversation[filters.conversation_id] || [];
      return Promise.resolve({ data: history.slice(), error: null }).then(resolve);
    },
    insert(row) {
      window.__CALLS__.push({ table: 'ai_assistant_messages', op: 'insert', row });
      if (row.role === 'user') store.usageCount++;
      const list = store.messagesByConversation[row.conversation_id] || (store.messagesByConversation[row.conversation_id] = []);
      list.push({ role: row.role, content: row.content });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return builder;
}

(function () {
  const seed = window.__AI_CHAT_SEED__ || {};
  const store = {
    conversationsByFeature: {},
    messagesByConversation: {},
    usageCount: typeof seed.usageCount === 'number' ? seed.usageCount : 0,
  };
  if (seed.conversationId && seed.feature) {
    store.conversationsByFeature[seed.feature] = seed.conversationId;
    store.messagesByConversation[seed.conversationId] = seed.history || [];
  }

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = (url, opts) => {
    if (typeof url === 'string' && url.indexOf('/api/ai-chat') === 0) {
      window.__CALLS__.push({ table: 'api/ai-chat', op: 'fetch', body: opts && opts.body ? JSON.parse(opts.body) : null });
      const resp = seed.apiResponse || {
        status: 200,
        body: { reply: 'Try chicken fried rice — you have everything you need!', usageCount: store.usageCount, limit: 500 },
      };
      return Promise.resolve({
        status: resp.status,
        ok: resp.status >= 200 && resp.status < 300,
        json: () => Promise.resolve(resp.body),
      });
    }
    if (originalFetch) return originalFetch(url, opts);
    return Promise.reject(new Error('Unmocked fetch: ' + url));
  };

  window.supabase = {
    createClient: () => ({
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'me-1' }, access_token: 'test-token' } } }),
        getUser: () => Promise.resolve({ data: { user: { id: 'me-1', email: 'me@example.com' } } }),
        onAuthStateChange: () => {},
        signOut: () => Promise.resolve({}),
      },
      from: (table) => {
        if (table === 'ai_assistant_conversations') return conversationsChain(store);
        if (table === 'ai_assistant_messages') return messagesChain(store);
        return genericChain(table);
      },
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/x.jpg' } }), upload: () => Promise.resolve({ data: {}, error: null }) }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
      removeChannel: () => {},
    }),
  };
})();
