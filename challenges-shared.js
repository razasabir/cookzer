// Shared theme data + rendering used by both the sitewide Challenges
// page and each group's own Challenges page, so the two don't duplicate
// the card/leaderboard logic (see migration 043_challenges_revamp.sql
// for the schema this is built on).
(function () {
  const CATEGORIES = {
    speed: { icon: '⚡', label: 'Speed' },
    budget: { icon: '💰', label: 'Budget' },
    dietary: { icon: '🌱', label: 'Plant-Powered' },
    cuisine: { icon: '🌍', label: 'Cuisine' },
    pantry: { icon: '🧹', label: 'Pantry Clean-Out' },
    leftovers: { icon: '♻️', label: 'Leftover Remix' },
    trending: { icon: '🔥', label: 'Trending' },
  };

  // One deterministic theme per calendar week, so every visitor who
  // finds an empty sitewide slate in the same week gets offered the
  // same challenge rather than racing to spawn different ones.
  const WEEKLY_THEMES = [
    { category: 'speed', title: '15-Minute Meals', description: 'Cook something delicious in 15 minutes or less. Fast doesn\'t mean boring.' },
    { category: 'budget', title: 'Budget Bites', description: 'Make a full meal for under $5 a serving. Show off your smarts, not your grocery bill.' },
    { category: 'dietary', title: 'Plant-Powered Week', description: 'Cook something 100% plant-based — vegan, vegetarian, or just meat-free.' },
    { category: 'cuisine', title: 'Around the World', description: 'Cook a dish from a cuisine you don\'t usually make. Bonus points for authenticity.' },
    { category: 'pantry', title: 'Pantry Clean-Out', description: 'Use up something that\'s been sitting in your pantry or freezer too long.' },
    { category: 'leftovers', title: 'Leftover Remix', description: 'Turn last night\'s leftovers into something totally different.' },
  ];

  function weekIndex(date) {
    // Days since epoch / 7, floored — stable and simple, no ISO-week
    // edge cases (year boundaries, week-53 years) to get wrong.
    return Math.floor((date || new Date()).getTime() / (7 * 86400000));
  }

  function themeForThisWeek() {
    return WEEKLY_THEMES[weekIndex() % WEEKLY_THEMES.length];
  }

  function categoryMeta(category) {
    return CATEGORIES[category] || null;
  }

  // Keeps the sitewide slate from ever going empty: if no sitewide
  // challenge is currently running, seeds this week's rotating theme.
  // A rare simultaneous double-insert (two tabs both finding it empty
  // at once) is harmless — both use the same theme and just show as
  // two near-identical challenges instead of one.
  async function ensureWeeklyChallenge(sb, currentUserId) {
    const { data: active } = await sb
      .from('challenges')
      .select('id')
      .is('group_id', null)
      .gt('ends_at', new Date().toISOString())
      .limit(1);
    if (active && active.length > 0) return;

    const theme = themeForThisWeek();
    await sb.from('challenges').insert({
      title: theme.title,
      description: theme.description,
      category: theme.category,
      ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      created_by: currentUserId,
      is_auto_generated: true,
    });
  }

  // Computes and persists the winner of an ended challenge that doesn't
  // have one yet — the top-hearts entry among those with a post
  // attached. Returns the winner's profile row (or null) either way, so
  // a caller can render immediately without a second read-back.
  async function finalizeWinnerIfNeeded(sb, challenge) {
    if (challenge.winner_user_id) {
      if (challenge.winner_profile) return challenge.winner_profile;
      const { data } = await sb.from('profiles').select('id, display_name, initials').eq('id', challenge.winner_user_id).maybeSingle();
      return data || null;
    }
    if (new Date(challenge.ends_at) > new Date()) return null;

    const { data: entries } = await sb
      .from('challenge_entries')
      .select('user_id, post_id, profiles(id, display_name, initials)')
      .eq('challenge_id', challenge.id)
      .not('post_id', 'is', null);
    if (!entries || entries.length === 0) return null;

    const postIds = entries.map((e) => e.post_id);
    const { data: hearts } = await sb.from('hearts').select('post_id').in('post_id', postIds);
    const heartCounts = {};
    (hearts || []).forEach((h) => { heartCounts[h.post_id] = (heartCounts[h.post_id] || 0) + 1; });

    const winner = entries
      .map((e) => ({ ...e, hearts: heartCounts[e.post_id] || 0 }))
      .sort((a, b) => b.hearts - a.hearts)[0];
    if (!winner) return null;

    await sb.from('challenges').update({ winner_user_id: winner.user_id, winner_computed_at: new Date().toISOString() }).eq('id', challenge.id);
    return winner.profiles || null;
  }

  window.CookzerChallenges = { CATEGORIES, WEEKLY_THEMES, categoryMeta, themeForThisWeek, ensureWeeklyChallenge, finalizeWinnerIfNeeded };
})();
