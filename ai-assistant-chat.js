// Cookzer+ AI Assistant — real chat, backed by Claude Haiku 4.5 via
// api/ai-chat.js. Replaces the ai-assistant-teaser.js waitlist card with
// the same mount(sb, currentUser, containerEl, featureKey) signature, so
// it's a drop-in swap on every page that used the teaser.
//
// No payment processor exists on this platform yet, so this isn't
// gated behind payment — every logged-in user gets it, protected only
// by the same 500-messages/month cap the $5/mo Cookzer+ tier is priced
// against (enforced server-side in api/ai-chat.js). The UI says so.
(function () {
  const PITCH = {
    pantry: {
      title: 'Cooking Ideas',
      desc: 'Tell it what’s in your kitchen and get a suggestion back.',
      placeholder: 'e.g. "chicken thighs, rice, half an onion, some spinach"',
    },
    leftovers: {
      title: 'Leftover Help',
      desc: 'Describe your leftovers and turn them into tonight’s dinner.',
      placeholder: 'e.g. "leftover roast chicken and mashed potatoes"',
    },
    health: {
      title: 'Health & Nutritions',
      desc: 'Ask anything about nutrition, calories, or healthy cooking.',
      placeholder: 'e.g. "how much protein should I eat to hit my goals?"',
    },
  };

  const MAX_HISTORY_MESSAGES = 12;

  function injectStyle() {
    if (document.getElementById('cz-ai-chat-style')) return;
    const style = document.createElement('style');
    style.id = 'cz-ai-chat-style';
    style.textContent = `
      .cz-ai-chat {
        background: linear-gradient(135deg, var(--olive-tint, #EEF1E9), var(--card-bg));
        border: 1px solid var(--line); border-radius: 18px; padding: 18px;
        margin: 20px 0;
      }
      .cz-ai-chat-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
      .cz-ai-chat-icon { font-size: 26px; line-height: 1; flex-shrink: 0; }
      .cz-ai-chat-head-body { flex: 1; min-width: 0; }
      .cz-ai-chat-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .cz-ai-chat-title { font-family: 'Fraunces', serif; font-weight: 600; font-size: 15px; color: var(--olive-dark); }
      .cz-ai-chat-badge {
        font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
        background: var(--mustard); color: #fff; padding: 3px 8px; border-radius: 10px;
      }
      .cz-ai-chat-desc { font-size: 13px; color: var(--ink-soft); line-height: 1.4; margin-top: 2px; }
      .cz-ai-chat-usage { font-size: 11.5px; color: var(--ink-faint); flex-shrink: 0; white-space: nowrap; margin-top: 2px; }
      .cz-ai-chat-log {
        max-height: 300px; min-height: 60px; overflow-y: auto;
        display: flex; flex-direction: column; gap: 8px;
        margin-bottom: 10px; padding-right: 2px;
      }
      .cz-ai-chat-empty { font-size: 12.5px; color: var(--ink-faint); font-style: italic; padding: 6px 2px; }
      .cz-ai-chat-msg { max-width: 82%; padding: 8px 12px; border-radius: 14px; font-size: 13px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
      .cz-ai-chat-msg.user { align-self: flex-end; background: var(--olive); color: #fff; border-bottom-right-radius: 4px; }
      .cz-ai-chat-msg.assistant { align-self: flex-start; background: var(--card-bg); border: 1px solid var(--line); color: var(--ink); border-bottom-left-radius: 4px; }
      .cz-ai-chat-msg.error { align-self: flex-start; background: rgba(206,43,55,0.08); border: 1px solid rgba(206,43,55,0.25); color: var(--red, #CE2B37); }
      .cz-ai-chat-input-row { display: flex; gap: 8px; }
      .cz-ai-chat-input {
        flex: 1; min-width: 0; border: 1px solid var(--line); border-radius: 10px;
        padding: 9px 12px; font-size: 13px; font-family: inherit; background: var(--card-bg); color: var(--ink);
      }
      .cz-ai-chat-input:focus { outline: none; border-color: var(--olive); }
      .cz-ai-chat-send {
        background: var(--olive); color: #fff; border: none; border-radius: 10px;
        padding: 0 16px; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0;
      }
      .cz-ai-chat-send:hover:not(:disabled) { background: var(--olive-dark); }
      .cz-ai-chat-send:disabled { opacity: 0.6; cursor: default; }
      .cz-ai-chat-note { font-size: 11px; color: var(--ink-faint); margin-top: 8px; }
    `;
    document.head.appendChild(style);
  }

  function monthStartIso() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }

  async function mount(sb, currentUser, containerEl, featureKey) {
    injectStyle();
    const pitch = PITCH[featureKey] || PITCH.pantry;
    const LIMIT = 500;

    let convoId = null;
    let history = []; // [{role, content}]
    let usageCount = null;
    let limitReached = false;
    let sending = false;

    containerEl.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'cz-ai-chat';

    const head = document.createElement('div');
    head.className = 'cz-ai-chat-head';
    head.innerHTML = `
      <div class="cz-ai-chat-icon">🤖</div>
      <div class="cz-ai-chat-head-body">
        <div class="cz-ai-chat-title-row">
          <span class="cz-ai-chat-title">${pitch.title}</span>
          <span class="cz-ai-chat-badge">Cookzer+</span>
        </div>
        <div class="cz-ai-chat-desc">${pitch.desc}</div>
      </div>
      <div class="cz-ai-chat-usage" data-role="usage"></div>
    `;

    const log = document.createElement('div');
    log.className = 'cz-ai-chat-log';
    const empty = document.createElement('div');
    empty.className = 'cz-ai-chat-empty';
    empty.textContent = pitch.placeholder;
    log.appendChild(empty);

    const inputRow = document.createElement('div');
    inputRow.className = 'cz-ai-chat-input-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cz-ai-chat-input';
    input.placeholder = pitch.placeholder;
    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'cz-ai-chat-send';
    sendBtn.textContent = 'Send';
    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);

    const note = document.createElement('div');
    note.className = 'cz-ai-chat-note';
    note.textContent = 'Cookzer+ is free while we finish billing — up to 500 AI messages a month.';

    card.appendChild(head);
    card.appendChild(log);
    card.appendChild(inputRow);
    card.appendChild(note);
    containerEl.appendChild(card);

    const usageEl = head.querySelector('[data-role="usage"]');
    function renderUsage() {
      if (usageCount === null) { usageEl.textContent = ''; return; }
      usageEl.textContent = `${usageCount}/${LIMIT} this month`;
    }

    function appendBubble(role, text) {
      if (empty.parentNode) empty.remove();
      const bubble = document.createElement('div');
      bubble.className = 'cz-ai-chat-msg ' + role;
      bubble.textContent = text;
      log.appendChild(bubble);
      log.scrollTop = log.scrollHeight;
      return bubble;
    }

    function setSending(state) {
      sending = state;
      sendBtn.disabled = state || limitReached;
      input.disabled = state || limitReached;
      sendBtn.textContent = state ? 'Sending…' : 'Send';
    }

    // Find or create the conversation for this user+feature, load recent history.
    try {
      const { data: existing } = await sb
        .from('ai_assistant_conversations')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('feature', featureKey)
        .maybeSingle();

      if (existing) {
        convoId = existing.id;
      } else {
        const { data: created, error } = await sb
          .from('ai_assistant_conversations')
          .insert({ user_id: currentUser.id, feature: featureKey })
          .select('id')
          .single();
        if (error) throw error;
        convoId = created.id;
      }

      const { data: msgs } = await sb
        .from('ai_assistant_messages')
        .select('role, content')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: true })
        .limit(40);

      if (msgs && msgs.length) {
        msgs.forEach((m) => {
          appendBubble(m.role, m.content);
          history.push({ role: m.role, content: m.content });
        });
      }

      const { count } = await sb
        .from('ai_assistant_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('role', 'user')
        .gte('created_at', monthStartIso());
      usageCount = count || 0;
      if (usageCount >= LIMIT) {
        limitReached = true;
        appendBubble('error', `You've used all ${LIMIT} Cookzer+ messages this month. It resets on the 1st.`);
        setSending(false);
      }
      renderUsage();
    } catch (e) {
      appendBubble('error', 'Could not load the AI Assistant right now.');
      setSending(true); // keep disabled — nothing left to do without a conversation
      return;
    }

    async function send() {
      const text = input.value.trim();
      if (!text || sending || limitReached) return;

      setSending(true);
      appendBubble('user', text);
      input.value = '';

      await sb.from('ai_assistant_messages').insert({
        conversation_id: convoId,
        user_id: currentUser.id,
        role: 'user',
        content: text,
      });

      try {
        const { data: sess } = await sb.auth.getSession();
        const token = sess && sess.session && sess.session.access_token;
        const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);

        const resp = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ feature: featureKey, message: text, history: trimmedHistory }),
        });
        const body = await resp.json();

        if (resp.status === 402) {
          limitReached = true;
          usageCount = body.usageCount || LIMIT;
          renderUsage();
          appendBubble('error', body.error);
          return;
        }
        if (!resp.ok) {
          appendBubble('error', body.error || 'Something went wrong. Please try again.');
          return;
        }

        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: body.reply });
        usageCount = body.usageCount;
        renderUsage();
        appendBubble('assistant', body.reply);

        await sb.from('ai_assistant_messages').insert({
          conversation_id: convoId,
          user_id: currentUser.id,
          role: 'assistant',
          content: body.reply,
        });
      } catch (e) {
        appendBubble('error', 'Something went wrong. Please try again.');
      } finally {
        setSending(false);
      }
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });
  }

  window.CookzerAIAssistant = { mount };
})();
