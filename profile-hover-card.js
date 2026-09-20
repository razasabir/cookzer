// Profile hover card — hovering any link to a Cookzer profile (post
// author, commenter, search result, top contributor, birthday list…)
// shows a quick peek: avatar, bio/location, and recipes/followers/
// streak stats, without navigating away. One shared card element is
// positioned and refilled per hover rather than built once per link.
// Skipped entirely on touch devices, where there's no real "hover" and
// a stray tap could otherwise leave a card stuck open.
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;

  const PROFILE_LINK_RE = /cookzer-profile\.html\?id=([^&]+)/;
  const SHOW_DELAY = 350;
  const HIDE_DELAY = 200;
  const cache = new Map();

  let card = null;
  let showTimer = null;
  let hideTimer = null;
  let hoverToken = 0;

  function ensureCard() {
    if (card) return card;
    card = document.createElement('div');
    card.className = 'cz-hovercard';
    card.hidden = true;
    card.addEventListener('mouseenter', cancelHide);
    card.addEventListener('mouseleave', scheduleHide);
    document.body.appendChild(card);
    return card;
  }

  // Same trailing-consecutive-days logic used on the profile page's own
  // streak number — duplicated here rather than shared, since it's one
  // small pure function and this file has no other reason to depend on
  // cookzer-profile.html's script.
  function computeStreak(cookIns) {
    const days = new Set(cookIns.map((c) => new Date(c.created_at).toDateString()));
    let streak = 0;
    const cursor = new Date();
    while (days.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function fetchSummary(id) {
    if (cache.has(id)) return cache.get(id);
    const promise = (async () => {
      const [profileRes, recipeRes, followerRes, cookInsRes] = await Promise.all([
        sb.from('profiles').select('id, display_name, initials, avatar_url, bio, location').eq('id', id).maybeSingle(),
        sb.from('recipes').select('id', { count: 'exact', head: true }).eq('author_id', id),
        sb.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', id),
        sb.from('posts').select('created_at').eq('author_id', id).eq('kind', 'cook_in').order('created_at', { ascending: false }),
      ]);
      return {
        profile: profileRes.data,
        recipeCount: recipeRes.count || 0,
        followerCount: followerRes.count || 0,
        streak: computeStreak(cookInsRes.data || []),
      };
    })();
    cache.set(id, promise);
    return promise;
  }

  function renderLoading() {
    ensureCard().innerHTML = '<div class="cz-hovercard-loading">Loading…</div>';
  }

  function renderSummary(summary) {
    const el = ensureCard();
    const p = summary.profile;
    if (!p) {
      el.innerHTML = '<div class="cz-hovercard-loading">Profile not found.</div>';
      return;
    }
    el.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'cz-hovercard-header';

    const avatar = document.createElement('div');
    avatar.className = 'cz-hovercard-avatar';
    if (p.avatar_url) {
      avatar.style.backgroundImage = "url('" + p.avatar_url + "')";
    } else {
      avatar.textContent = p.initials || '??';
    }
    header.appendChild(avatar);

    const titles = document.createElement('div');
    titles.className = 'cz-hovercard-titles';
    const name = document.createElement('div');
    name.className = 'cz-hovercard-name';
    name.textContent = p.display_name || 'Someone';
    titles.appendChild(name);
    const bioOrLocation = p.bio || p.location;
    if (bioOrLocation) {
      const meta = document.createElement('div');
      meta.className = 'cz-hovercard-meta';
      meta.textContent = bioOrLocation;
      titles.appendChild(meta);
    }
    header.appendChild(titles);
    el.appendChild(header);

    const stats = document.createElement('div');
    stats.className = 'cz-hovercard-stats';
    [
      [summary.recipeCount, 'Recipes'],
      [summary.followerCount, 'Followers'],
      [summary.streak, 'Day streak'],
    ].forEach(([num, label]) => {
      const stat = document.createElement('div');
      stat.className = 'cz-hovercard-stat';
      const n = document.createElement('span');
      n.className = 'cz-hovercard-stat-num';
      n.textContent = num;
      const l = document.createElement('span');
      l.className = 'cz-hovercard-stat-label';
      l.textContent = label;
      stat.appendChild(n);
      stat.appendChild(l);
      stats.appendChild(stat);
    });
    el.appendChild(stats);
  }

  function position(anchorRect) {
    const el = ensureCard();
    el.hidden = false; // must be visible to measure its real size
    const margin = 8;
    const cardWidth = el.offsetWidth || 240;
    const cardHeight = el.offsetHeight || 120;

    let left = anchorRect.left;
    if (left + cardWidth > window.innerWidth - margin) left = window.innerWidth - cardWidth - margin;
    if (left < margin) left = margin;

    let top = anchorRect.bottom + margin;
    if (top + cardHeight > window.innerHeight - margin) top = anchorRect.top - cardHeight - margin;
    if (top < margin) top = margin;

    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function cancelShow() {
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
  }

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(() => { if (card) card.hidden = true; }, HIDE_DELAY);
  }

  function profileLinkFrom(target) {
    const link = target.closest && target.closest('a[href*="cookzer-profile.html?id="]');
    if (!link) return null;
    const match = link.getAttribute('href').match(PROFILE_LINK_RE);
    return match ? { link, id: decodeURIComponent(match[1]) } : null;
  }

  function handleMouseOver(e) {
    const found = profileLinkFrom(e.target);
    if (!found) return;

    cancelHide();
    cancelShow();
    const token = ++hoverToken;
    const rect = found.link.getBoundingClientRect();

    showTimer = setTimeout(() => {
      if (token !== hoverToken) return;
      renderLoading();
      position(rect);
      fetchSummary(found.id).then((summary) => {
        if (token !== hoverToken) return;
        renderSummary(summary);
        position(rect);
      }).catch(() => {
        if (token === hoverToken && card) card.hidden = true;
      });
    }, SHOW_DELAY);
  }

  function handleMouseOut(e) {
    const found = profileLinkFrom(e.target);
    if (!found) return;
    // Moving onto the card itself shouldn't hide it — only something
    // that isn't the card counts as actually leaving.
    if (e.relatedTarget && card && card.contains(e.relatedTarget)) return;
    cancelShow();
    hoverToken++; // invalidate any in-flight fetch/render for this hover
    scheduleHide();
  }

  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
})();
