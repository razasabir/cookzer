// In-app replacements for window.alert/confirm/prompt — native browser
// dialogs carry the site's own address bar ("cookzer.com says") and
// can't be styled at all, which reads as unfinished next to the rest of
// the UI. These have the same call shape (alert(msg), confirm(msg),
// prompt(msg, default)) but are Promise-based since a real DOM modal
// can't block synchronously the way the native ones do — every call
// site awaits them instead. Self-injects its own markup/CSS on first
// use, so no per-page HTML changes are needed beyond loading this file.
(function () {
  let styleInjected = false;
  let shareStyleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .cz-modal-overlay {
        position: fixed; inset: 0; background: rgba(30, 26, 20, 0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; padding: 20px;
      }
      .cz-modal-card {
        background: var(--card-bg, #fff); border-radius: 18px; padding: 24px;
        max-width: 380px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        font-family: 'Work Sans', sans-serif;
      }
      .cz-modal-message {
        font-size: 14.5px; color: var(--ink, #2a2620); line-height: 1.55;
        margin-bottom: 16px; white-space: pre-wrap;
      }
      .cz-modal-input {
        width: 100%; border: 1px solid var(--line, #ddd); border-radius: 10px;
        padding: 10px 12px; font-size: 14px; font-family: inherit;
        color: var(--ink, #2a2620); background: var(--paper, var(--card-bg, #fff));
        margin-bottom: 18px; box-sizing: border-box;
      }
      .cz-modal-input:focus { outline: none; border-color: var(--olive, #4E5A3E); }
      .cz-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
      .cz-modal-btn {
        padding: 9px 18px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
        cursor: pointer; border: 1px solid transparent; font-family: inherit;
      }
      .cz-modal-btn.cz-ghost {
        background: var(--cream, #F3EEE3); color: var(--ink, #2a2620); border-color: var(--line, #ddd);
      }
      .cz-modal-btn.cz-primary { background: var(--olive, #4E5A3E); color: #fff; }
      .cz-modal-btn.cz-primary:hover { background: var(--olive-dark, #3c4630); }
      .cz-modal-btn.cz-danger { background: var(--brick, #B23A2E); color: #fff; }
    `;
    document.head.appendChild(style);
  }

  function openModal({ message, showInput, defaultValue, confirmLabel, cancelLabel, danger }) {
    injectStyle();
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'cz-modal-overlay';

      const card = document.createElement('div');
      card.className = 'cz-modal-card';

      const msg = document.createElement('div');
      msg.className = 'cz-modal-message';
      msg.textContent = message || '';
      card.appendChild(msg);

      let input = null;
      if (showInput) {
        input = document.createElement('input');
        input.className = 'cz-modal-input';
        input.type = 'text';
        input.value = defaultValue == null ? '' : defaultValue;
        card.appendChild(input);
      }

      const actions = document.createElement('div');
      actions.className = 'cz-modal-actions';

      function close(result) {
        document.removeEventListener('keydown', onKeydown);
        overlay.remove();
        resolve(result);
      }

      function onKeydown(e) {
        if (e.key === 'Escape') close(showInput ? null : false);
        if (e.key === 'Enter' && (showInput ? document.activeElement === input : true)) {
          e.preventDefault();
          close(showInput ? input.value : true);
        }
      }

      if (cancelLabel !== null) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'cz-modal-btn cz-ghost';
        cancelBtn.textContent = cancelLabel || 'Cancel';
        cancelBtn.addEventListener('click', () => close(showInput ? null : false));
        actions.appendChild(cancelBtn);
      }

      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'cz-modal-btn ' + (danger ? 'cz-danger' : 'cz-primary');
      okBtn.textContent = confirmLabel || 'OK';
      okBtn.addEventListener('click', () => close(showInput ? input.value : true));
      actions.appendChild(okBtn);

      card.appendChild(actions);
      overlay.appendChild(card);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(showInput ? null : false);
      });
      document.body.appendChild(overlay);
      document.addEventListener('keydown', onKeydown);

      (input || okBtn).focus();
      if (input) input.select();
    });
  }

  function alertModal(message) {
    return openModal({ message, showInput: false, cancelLabel: null, confirmLabel: 'OK' });
  }

  function confirmModal(message, opts) {
    opts = opts || {};
    return openModal({ message, showInput: false, confirmLabel: opts.confirmLabel, cancelLabel: opts.cancelLabel, danger: opts.danger });
  }

  function promptModal(message, defaultValue) {
    return openModal({ message, showInput: true, defaultValue, confirmLabel: 'OK', cancelLabel: 'Cancel' });
  }

  function injectShareStyle() {
    if (shareStyleInjected) return;
    shareStyleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .cz-share-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .cz-share-title { font-size: 15px; font-weight: 700; color: var(--ink, #2a2620); }
      .cz-share-close {
        background: none; border: none; font-size: 20px; line-height: 1;
        color: var(--ink-soft, #6b6459); cursor: pointer; padding: 4px;
      }
      .cz-share-link-row { display: flex; gap: 8px; margin-bottom: 18px; }
      .cz-share-link-input {
        flex: 1; min-width: 0; border: 1px solid var(--line, #ddd); border-radius: 10px;
        padding: 9px 11px; font-size: 13px; color: var(--ink, #2a2620);
        background: var(--paper, var(--card-bg, #fff)); font-family: inherit;
      }
      .cz-share-copy-btn {
        flex-shrink: 0; padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 600;
        border: 1px solid transparent; background: var(--olive, #4E5A3E); color: #fff;
        cursor: pointer; font-family: inherit;
      }
      .cz-share-options { display: flex; gap: 10px; justify-content: center; }
      .cz-share-option {
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        text-decoration: none; font-family: inherit; font-size: 11.5px;
        color: var(--ink-soft, #6b6459); cursor: pointer;
      }
      .cz-share-option-icon {
        width: 44px; height: 44px; border-radius: 50%; font-size: 19px;
        display: flex; align-items: center; justify-content: center;
        background: var(--cream, #F3EEE3);
      }
    `;
    document.head.appendChild(style);
  }

  // In-app replacement for navigator.share()'s OS-level share sheet —
  // that native dialog carries the OS's own chrome (a Windows "Share
  // link" panel, an iOS action sheet) and can't be styled or kept
  // in-app at all, same problem this whole file exists to solve for
  // alert/confirm/prompt. Always shows this instead of ever calling
  // navigator.share(), regardless of whether the browser supports it.
  function shareModal(opts) {
    opts = opts || {};
    const url = opts.url || '';
    const title = opts.title || 'Cookzer';
    const text = opts.text || '';
    injectStyle();
    injectShareStyle();

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'cz-modal-overlay';

      const card = document.createElement('div');
      card.className = 'cz-modal-card';

      const header = document.createElement('div');
      header.className = 'cz-share-header';
      const heading = document.createElement('div');
      heading.className = 'cz-share-title';
      heading.textContent = 'Share';
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'cz-share-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = '×';
      header.appendChild(heading);
      header.appendChild(closeBtn);
      card.appendChild(header);

      const linkRow = document.createElement('div');
      linkRow.className = 'cz-share-link-row';
      const linkInput = document.createElement('input');
      linkInput.type = 'text';
      linkInput.className = 'cz-share-link-input';
      linkInput.readOnly = true;
      linkInput.value = url;
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'cz-share-copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        } catch (e) {
          linkInput.focus();
          linkInput.select();
        }
      });
      linkRow.appendChild(linkInput);
      linkRow.appendChild(copyBtn);
      card.appendChild(linkRow);

      const options = document.createElement('div');
      options.className = 'cz-share-options';
      const shareText = text ? text + ' ' + url : url;
      [
        { label: 'WhatsApp', icon: '💬', href: 'https://wa.me/?text=' + encodeURIComponent(shareText) },
        { label: 'Facebook', icon: '📘', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) },
        { label: 'X', icon: '𝕏', href: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text || title) + '&url=' + encodeURIComponent(url) },
        { label: 'Email', icon: '✉️', href: 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(shareText) },
      ].forEach((t) => {
        const btn = document.createElement('a');
        btn.href = t.href;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.className = 'cz-share-option';
        btn.innerHTML = '<span class="cz-share-option-icon">' + t.icon + '</span><span>' + t.label + '</span>';
        options.appendChild(btn);
      });
      card.appendChild(options);

      function close() {
        document.removeEventListener('keydown', onKeydown);
        overlay.remove();
        resolve();
      }
      function onKeydown(e) { if (e.key === 'Escape') close(); }

      closeBtn.addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      document.addEventListener('keydown', onKeydown);
      copyBtn.focus();
    });
  }

  window.CookzerModal = { alert: alertModal, confirm: confirmModal, prompt: promptModal, share: shareModal };
})();
