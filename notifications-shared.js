// Shared notification fetching, used by the bell dropdown (auth-guard.js)
// and the full Notifications page — keeps both in sync on preferences
// and read-state instead of duplicating the query logic.
(function () {
  async function loadPrefs(userId) {
    const { data } = await sb
      .from('notification_prefs')
      .select('notify_follows, notify_hearts, notify_comments')
      .eq('user_id', userId)
      .maybeSingle();
    return data || { notify_follows: true, notify_hearts: true, notify_comments: true };
  }

  async function fetchItems(userId, limitPer) {
    limitPer = limitPer || 5;
    const prefs = await loadPrefs(userId);

    const followsP = prefs.notify_follows
      ? sb.from('follows')
          .select('follower_id, created_at, profiles!follows_follower_id_fkey(display_name)')
          .eq('followee_id', userId)
          .order('created_at', { ascending: false })
          .limit(limitPer)
          .then(({ data }) => (data || [])
            .filter((f) => f.profiles)
            .map((f) => ({ created_at: f.created_at, actorId: f.follower_id, text: (f.profiles.display_name || 'Someone') + ' followed you' })))
      : Promise.resolve([]);

    const heartsP = prefs.notify_hearts
      ? sb.from('hearts')
          .select('user_id, created_at, profiles(display_name), posts!inner(author_id)')
          .eq('posts.author_id', userId)
          .order('created_at', { ascending: false })
          .limit(limitPer)
          .then(({ data }) => (data || [])
            .filter((h) => h.profiles)
            .map((h) => ({ created_at: h.created_at, actorId: h.user_id, text: (h.profiles.display_name || 'Someone') + ' hearted your post' })))
      : Promise.resolve([]);

    const commentsP = prefs.notify_comments
      ? sb.from('comments')
          .select('author_id, created_at, text, profiles(display_name), posts!inner(author_id)')
          .eq('posts.author_id', userId)
          .order('created_at', { ascending: false })
          .limit(limitPer)
          .then(({ data }) => (data || [])
            .filter((c) => c.profiles)
            .map((c) => ({ created_at: c.created_at, actorId: c.author_id, text: (c.profiles.display_name || 'Someone') + ' commented on your post' })))
      : Promise.resolve([]);

    const [follows, hearts, comments] = await Promise.all([followsP, heartsP, commentsP]);
    const items = [...follows, ...hearts, ...comments];
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return items;
  }

  async function getReadAt(userId) {
    const { data } = await sb.from('profiles').select('notifications_read_at').eq('id', userId).maybeSingle();
    return data && data.notifications_read_at ? new Date(data.notifications_read_at) : null;
  }

  async function markRead(userId) {
    await sb.from('profiles').update({ notifications_read_at: new Date().toISOString() }).eq('id', userId);
  }

  window.CookzerNotifications = { loadPrefs, fetchItems, getReadAt, markRead };
})();
