// People You May Know: ranks candidates by how many people you already
// follow also follow them ("2nd-degree follows"), plus how many groups
// you share with them, then drops anyone already followed, yourself, or
// previously dismissed. Pure client-side scoring over a handful of small
// queries — no new tables beyond pymk_dismissals, which only remembers
// "not interested" choices.
(function () {
  async function computeSuggestions(sb, userId, opts) {
    const limit = (opts && opts.limit) || 8;

    const [{ data: myFollowingRows }, { data: dismissedRows }, { data: myGroupRows }] = await Promise.all([
      sb.from('follows').select('followee_id').eq('follower_id', userId),
      sb.from('pymk_dismissals').select('dismissed_id').eq('user_id', userId),
      sb.from('group_members').select('group_id').eq('user_id', userId),
    ]);

    const myFollowing = new Set((myFollowingRows || []).map((r) => r.followee_id));
    const dismissed = new Set((dismissedRows || []).map((r) => r.dismissed_id));
    const myGroupIds = (myGroupRows || []).map((r) => r.group_id);

    const scores = new Map();
    function bump(id, weight) {
      if (id === userId || myFollowing.has(id) || dismissed.has(id)) return;
      scores.set(id, (scores.get(id) || 0) + weight);
    }

    if (myFollowing.size > 0) {
      const { data: secondDegree } = await sb
        .from('follows')
        .select('followee_id')
        .in('follower_id', Array.from(myFollowing));
      (secondDegree || []).forEach((r) => bump(r.followee_id, 1));
    }

    if (myGroupIds.length > 0) {
      const { data: groupMates } = await sb
        .from('group_members')
        .select('user_id')
        .in('group_id', myGroupIds);
      (groupMates || []).forEach((r) => bump(r.user_id, 2));
    }

    const ranked = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({ id, score }));

    if (ranked.length === 0) return [];

    const { data: profiles } = await sb
      .from('profiles')
      .select('id, display_name, initials')
      .in('id', ranked.map((r) => r.id));

    const profileById = new Map((profiles || []).map((p) => [p.id, p]));
    return ranked
      .map((r) => {
        const p = profileById.get(r.id);
        return p ? { id: p.id, display_name: p.display_name, initials: p.initials, score: r.score } : null;
      })
      .filter(Boolean);
  }

  async function dismiss(sb, userId, dismissedId) {
    await sb.from('pymk_dismissals').insert({ user_id: userId, dismissed_id: dismissedId });
  }

  window.CookzerPYMK = { computeSuggestions, dismiss };
})();
