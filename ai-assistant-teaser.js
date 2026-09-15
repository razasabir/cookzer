// Cookzer+ AI Assistant — a paid chat feature planned across Pantry
// Challenge, Leftovers, and Health. No LLM is wired up yet: that needs
// a server-side API key (real ongoing per-message cost) and a billing
// decision (a payment processor isn't set up on this platform at all),
// neither of which exist. Rather than fake a chatbot or silently do
// nothing, this renders an honest paid-feature teaser that captures
// real interest via a waitlist — genuine signal to size the real build
// against, at zero ongoing cost.
(function () {
  const PITCH = {
    pantry: {
      title: 'Cookzer+ AI Assistant',
      body: 'Tell it what’s in your kitchen in plain English and get a personalized suggestion back — no typing ingredients into a search box.',
    },
    leftovers: {
      title: 'Cookzer+ AI Assistant',
      body: 'Describe your leftovers and let it turn them into tonight’s dinner, with substitutions if something’s missing.',
    },
    health: {
      title: 'Cookzer+ AI Assistant',
      body: 'Ask it anything about your nutrition — “how do I hit more protein this week?” — grounded in your own logged cook-ins.',
    },
  };

  function injectStyle() {
    if (document.getElementById('cz-ai-teaser-style')) return;
    const style = document.createElement('style');
    style.id = 'cz-ai-teaser-style';
    style.textContent = `
      .cz-ai-teaser {
        background: linear-gradient(135deg, var(--olive-tint, #EEF1E9), var(--card-bg));
        border: 1px solid var(--line); border-radius: 18px; padding: 20px;
        display: flex; gap: 14px; align-items: flex-start; margin: 20px 0;
      }
      .cz-ai-teaser-icon { font-size: 28px; line-height: 1; flex-shrink: 0; }
      .cz-ai-teaser-body { flex: 1; min-width: 0; }
      .cz-ai-teaser-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
      .cz-ai-teaser-title { font-family: 'Fraunces', serif; font-weight: 600; font-size: 15px; color: var(--olive-dark); }
      .cz-ai-teaser-badge {
        font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
        background: var(--mustard); color: #fff; padding: 3px 8px; border-radius: 10px;
      }
      .cz-ai-teaser-desc { font-size: 13px; color: var(--ink-soft); line-height: 1.5; margin-bottom: 12px; }
      .cz-ai-teaser-btn {
        background: var(--olive); color: #fff; border: none; border-radius: 10px;
        padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
      }
      .cz-ai-teaser-btn:hover { background: var(--olive-dark); }
      .cz-ai-teaser-btn:disabled { opacity: 0.7; cursor: default; }
      .cz-ai-teaser-joined { font-size: 13px; color: var(--olive-dark); font-weight: 600; }
    `;
    document.head.appendChild(style);
  }

  async function mount(sb, currentUser, containerEl, featureKey) {
    injectStyle();
    const pitch = PITCH[featureKey] || PITCH.pantry;

    const { data } = await sb
      .from('ai_assistant_waitlist')
      .select('feature')
      .eq('user_id', currentUser.id)
      .eq('feature', featureKey)
      .maybeSingle();
    let joined = !!data;

    containerEl.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'cz-ai-teaser';

    const icon = document.createElement('div');
    icon.className = 'cz-ai-teaser-icon';
    icon.textContent = '\u{1F916}';

    const body = document.createElement('div');
    body.className = 'cz-ai-teaser-body';

    const titleRow = document.createElement('div');
    titleRow.className = 'cz-ai-teaser-title-row';
    const title = document.createElement('span');
    title.className = 'cz-ai-teaser-title';
    title.textContent = pitch.title;
    const badge = document.createElement('span');
    badge.className = 'cz-ai-teaser-badge';
    badge.textContent = 'Cookzer+';
    titleRow.appendChild(title);
    titleRow.appendChild(badge);

    const desc = document.createElement('div');
    desc.className = 'cz-ai-teaser-desc';
    desc.textContent = pitch.body + ' Coming soon as a paid Cookzer+ feature.';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cz-ai-teaser-btn';

    function renderButtonState() {
      if (joined) {
        btn.remove();
        if (!body.querySelector('.cz-ai-teaser-joined')) {
          const joinedEl = document.createElement('div');
          joinedEl.className = 'cz-ai-teaser-joined';
          joinedEl.textContent = '✓ You’re on the waitlist — we’ll email you when it’s ready.';
          body.appendChild(joinedEl);
        }
      } else {
        btn.textContent = 'Join the waitlist';
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Joining…';
      const { error } = await sb.from('ai_assistant_waitlist').insert({ user_id: currentUser.id, feature: featureKey });
      if (error) {
        btn.disabled = false;
        btn.textContent = 'Join the waitlist';
        if (window.CookzerModal) await window.CookzerModal.alert('Could not join the waitlist: ' + error.message);
        return;
      }
      joined = true;
      renderButtonState();
    });

    body.appendChild(titleRow);
    body.appendChild(desc);
    body.appendChild(btn);
    renderButtonState();

    card.appendChild(icon);
    card.appendChild(body);
    containerEl.innerHTML = '';
    containerEl.appendChild(card);
  }

  window.CookzerAIAssistant = { mount };
})();
