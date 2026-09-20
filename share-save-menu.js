// Shared Share/Save action-sheet popups. Both Share and Save buttons
// across the app used to go straight to one action (an external-share
// dialog, or a plain bookmark toggle) — now each opens a real clickable
// list of options first (the established .cz2-* picker pattern; see
// CLAUDE.md — never a numbered-list prompt for choosing among several
// things), and self-injects its own overlay/DOM on first use like
// cookzer-modal.js and photo-lightbox.js, so no page markup changes are
// needed beyond loading this file.
(function () {
  let overlay = null;
  let modal = null;
  let styleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .csm-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
      .csm-btn {
        padding: 9px 18px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
        cursor: pointer; border: 1px solid var(--line, #ddd); font-family: inherit;
        background: var(--cream, #F3EEE3); color: var(--ink, #2a2620);
      }
      .csm-btn.csm-primary { background: var(--olive, #4E5A3E); color: #fff; border-color: transparent; }
      .csm-btn.csm-primary:hover { background: var(--olive-dark, #3c4630); }
      .csm-btn:disabled { opacity: 0.6; cursor: default; }
      .csm-date-input {
        width: 100%; padding: 10px 14px; background: var(--cream, #F3EEE3);
        border: 1px solid var(--line, #ddd); border-radius: 12px; font-family: inherit;
        font-size: 14px; color: var(--ink, #2a2620); margin-bottom: 4px; box-sizing: border-box;
      }
      .csm-row-icon { font-size: 17px; width: 22px; text-align: center; flex-shrink: 0; }
    `;
    document.head.appendChild(style);
  }

  function ensureBuilt() {
    if (overlay) return;
    injectStyle();
    overlay = document.createElement('div');
    overlay.className = 'cz2-overlay';
    overlay.hidden = true;
    modal = document.createElement('div');
    modal.className = 'cz2-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) close();
    });
  }

  function close() {
    if (overlay) overlay.hidden = true;
    if (modal) modal.innerHTML = '';
  }

  function row(icon, label, onClick) {
    const r = document.createElement('div');
    r.className = 'cz2-row';
    const iconEl = document.createElement('span');
    iconEl.className = 'csm-row-icon';
    iconEl.textContent = icon;
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    r.appendChild(iconEl);
    r.appendChild(labelEl);
    r.addEventListener('click', onClick);
    return r;
  }

  function show(title, buildBody) {
    ensureBuilt();
    modal.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = title;
    modal.appendChild(h);
    buildBody(modal);
    overlay.hidden = false;
  }

  // ---------------------------------------------------------------
  // Share menu: Reshare to your feed / Share on a group / Share externally
  // ---------------------------------------------------------------

  function openShareMenu(opts) {
    // opts: { sb, currentUserId, postFields: {shared_post_id?, recipe_id?,
    //   shared_profile_id?, caption?}, externalShare: {title, text?, url},
    //   onShared? }
    show('Share', (body) => {
      const list = document.createElement('div');
      list.className = 'cz2-list';
      list.appendChild(row('🔁', 'Reshare to your feed', async () => {
        close();
        await doReshare(opts, null);
      }));
      list.appendChild(row('👥', 'Share on a group', () => openGroupPicker(opts)));
      list.appendChild(row('🔗', 'Share externally', () => {
        close();
        window.CookzerModal.share(opts.externalShare);
      }));
      body.appendChild(list);
    });
  }

  async function doReshare(opts, groupId) {
    const payload = Object.assign({}, opts.postFields, {
      kind: 'share',
      author_id: opts.currentUserId,
      group_id: groupId || null,
    });
    if (!payload.caption) payload.caption = defaultShareCaption(opts.postFields);
    const { error } = await opts.sb.from('posts').insert(payload);
    if (error) {
      await window.CookzerModal.alert('Could not share: ' + error.message);
      return;
    }
    await window.CookzerModal.alert(groupId ? 'Shared to the group!' : 'Reshared to your feed!');
    if (opts.onShared) opts.onShared();
  }

  function defaultShareCaption(postFields) {
    if (postFields.shared_post_id) return null; // the feed renders an embedded preview of the original post
    if (postFields.recipe_id) return null; // renders like any other recipe post
    if (postFields.shared_profile_id) return '🔁 Shared a profile';
    return '🔁 Shared a link';
  }

  async function openGroupPicker(opts) {
    show('Share to which group?', async (body) => {
      const list = document.createElement('div');
      list.className = 'cz2-list';
      list.innerHTML = '<div class="cz2-empty">Loading your groups…</div>';
      body.appendChild(list);

      const { data: rows } = await opts.sb
        .from('group_members')
        .select('group_id, groups(id, name)')
        .eq('user_id', opts.currentUserId);
      const groups = (rows || []).map((r) => r.groups).filter(Boolean);

      list.innerHTML = '';
      if (groups.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cz2-empty';
        empty.textContent = "You're not in any groups yet.";
        list.appendChild(empty);
      } else {
        groups.forEach((g) => {
          list.appendChild(row('👥', g.name, async () => {
            close();
            await doReshare(opts, g.id);
          }));
        });
      }

      const actions = document.createElement('div');
      actions.className = 'csm-actions';
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'csm-btn';
      backBtn.textContent = '← Back';
      backBtn.addEventListener('click', () => openShareMenu(opts));
      actions.appendChild(backBtn);
      body.appendChild(actions);
    });
  }

  // ---------------------------------------------------------------
  // Save menu: Save as a Recipe / Save to Meal Planner / Save to Device
  // ---------------------------------------------------------------

  function openSaveMenu(opts) {
    // opts: { sb, currentUserId, recipeId, imageUrl?, deviceFilename?,
    //   onSaveAsRecipe, saveAsRecipeLabel?, onSaveToMealPlanner? }
    show('Save', (body) => {
      const list = document.createElement('div');
      list.className = 'cz2-list';
      list.appendChild(row('📖', opts.saveAsRecipeLabel || 'Save as a Recipe', () => {
        close();
        opts.onSaveAsRecipe();
      }));
      list.appendChild(row('📅', 'Save to Meal Planner', () => {
        // A page that already has its own "add to meal planner" picker
        // (e.g. the recipe page's week view with per-day conflicts) reuses
        // that exact flow via this callback, rather than a second,
        // slightly-different implementation living here too.
        if (opts.onSaveToMealPlanner) {
          close();
          opts.onSaveToMealPlanner();
        } else {
          openMealPlannerStep(opts);
        }
      }));
      if (opts.imageUrl) {
        list.appendChild(row('💾', 'Save to Device', () => {
          close();
          downloadImage(opts.imageUrl, opts.deviceFilename || 'cookzer-photo.jpg');
        }));
      }
      body.appendChild(list);
    });
  }

  // Generic fallback for pages with no dedicated planner picker of their
  // own: same week-list, conflict-aware shape as the recipe page's
  // "Add to Meal Planner" button, so the UX is consistent everywhere.
  function plannerWeekDates() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sun
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() + diff);
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { label, date: d, iso: d.toISOString().slice(0, 10) };
    });
  }

  async function openMealPlannerStep(opts) {
    show('Add to Meal Planner', async (body) => {
      const list = document.createElement('div');
      list.className = 'cz2-list';
      list.innerHTML = '<div class="cz2-empty">Loading your week…</div>';
      body.appendChild(list);

      const week = plannerWeekDates();
      const { data: existing } = await opts.sb
        .from('meal_plan_entries')
        .select('plan_date, free_text, recipes(title)')
        .eq('user_id', opts.currentUserId)
        .in('plan_date', week.map((w) => w.iso));
      const existingByDate = {};
      (existing || []).forEach((e) => { existingByDate[e.plan_date] = e; });

      list.innerHTML = '';
      week.forEach((w) => {
        const taken = existingByDate[w.iso];
        const dateLabel = w.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (taken) {
          const r = document.createElement('div');
          r.className = 'cz2-row';
          r.style.opacity = '0.5';
          r.style.cursor = 'default';
          r.textContent = dateLabel + ' — already planned: ' + (taken.recipes ? taken.recipes.title : (taken.free_text || 'a meal'));
          list.appendChild(r);
        } else {
          list.appendChild(row('📅', dateLabel, async () => {
            close();
            const { error } = await opts.sb.from('meal_plan_entries').insert({
              user_id: opts.currentUserId,
              plan_date: w.iso,
              recipe_id: opts.recipeId,
              source_note: 'Saved from Share/Save',
            });
            if (error) { await window.CookzerModal.alert('Could not add to your Meal Planner: ' + error.message); return; }
            await window.CookzerModal.alert('Added to your Meal Planner for ' + dateLabel + '.');
          }));
        }
      });

      const actions = document.createElement('div');
      actions.className = 'csm-actions';
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'csm-btn';
      backBtn.textContent = '← Back';
      backBtn.addEventListener('click', () => openSaveMenu(opts));
      actions.appendChild(backBtn);
      body.appendChild(actions);
    });
  }

  async function downloadImage(imageUrl, filename) {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      await window.CookzerModal.alert('Could not download this photo.');
    }
  }

  window.CookzerShareMenu = { open: openShareMenu };
  window.CookzerSaveMenu = { open: openSaveMenu };
})();
