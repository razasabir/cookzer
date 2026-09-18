// Shared notification fetching, used by the bell dropdown (auth-guard.js)
// and the full Notifications page — keeps both in sync on preferences
// and read-state instead of duplicating the query logic.
//
// Backed by the real public.notifications table (see
// supabase/migrations/025_real_notifications.sql) — a database trigger
// on each source table (follows/hearts/comments/etc.) writes a row here
// with the display text already built, so this file just reads it back;
// it used to re-derive everything live from 5 source tables on every
// open, which only ever caught activity if you happened to be looking
// right then and couldn't be the basis for an email.
(function () {
  const DEFAULT_PREFS = {
    notify_follows: true,
    notify_hearts: true,
    notify_comments: true,
    notify_remakes: true,
    notify_challenge_joins: true,
    notify_messages: true,
    notify_reviews: true,
    notify_group_joins: true,
    notify_email: true,
  };

  async function loadPrefs(userId) {
    const { data } = await sb
      .from('notification_prefs')
      .select('notify_follows, notify_hearts, notify_comments, notify_remakes, notify_challenge_joins, notify_messages, notify_reviews, notify_group_joins, notify_email')
      .eq('user_id', userId)
      .maybeSingle();
    return data || DEFAULT_PREFS;
  }

  async function fetchItems(userId, limit) {
    const { data } = await sb
      .from('notifications')
      .select('id, type, message, link_url, actor_id, read_at, created_at')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit || 30);
    return (data || []).map((n) => ({
      id: n.id,
      type: n.type,
      text: n.message,
      linkUrl: n.link_url,
      actorId: n.actor_id,
      read_at: n.read_at,
      created_at: n.created_at,
    }));
  }

  async function getUnreadCount(userId) {
    const { count } = await sb
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null);
    return count || 0;
  }

  async function markAllRead(userId) {
    await sb
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .is('read_at', null);
  }

  window.CookzerNotifications = { loadPrefs, fetchItems, getUnreadCount, markAllRead };
})();
