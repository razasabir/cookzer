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

  window.CookzerModal = { alert: alertModal, confirm: confirmModal, prompt: promptModal };
})();
