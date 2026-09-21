// Custom pull-to-refresh — the native OS gesture is not part of a
// mobile WebView at all (this app ships wrapped in Capacitor, see
// capacitor.config.json), and even in a plain mobile browser tab it
// only fires when the *document* itself is the scrolled element — every
// page here actually scrolls an inner container (e.g. .feed-container),
// so the browser's own gesture never has anything to trigger on either
// way. Self-injects its own styles/markup on first use, same convention
// as cookzer-modal.js and photo-lightbox.js.
(function () {
  let styleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .cz-ptr-indicator {
        display: flex; align-items: center; justify-content: center;
        height: 0; overflow: hidden; flex-shrink: 0;
      }
      .cz-ptr-spinner {
        width: 22px; height: 22px; border-radius: 50%;
        border: 2.5px solid var(--line, #E3E6DC);
        border-top-color: var(--olive, #2E8F5C);
        box-sizing: border-box;
      }
      .cz-ptr-spinner.spinning { animation: cz-ptr-spin 0.7s linear infinite; }
      @keyframes cz-ptr-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  const THRESHOLD = 64; // px pulled before release triggers a refresh
  const MAX_PULL = 100; // px — resistance cap so it can't be dragged forever

  // attach(scrollEl, onRefresh) — scrollEl is the element that actually
  // scrolls this page's content (not necessarily document.body).
  // onRefresh is called (and awaited, if it returns a promise) when the
  // user releases past the threshold; the spinner spins until it
  // settles either way.
  function attach(scrollEl, onRefresh) {
    injectStyle();

    const indicator = document.createElement('div');
    indicator.className = 'cz-ptr-indicator';
    const spinner = document.createElement('div');
    spinner.className = 'cz-ptr-spinner';
    indicator.appendChild(spinner);
    scrollEl.insertBefore(indicator, scrollEl.firstChild);

    let startY = 0;
    let dragging = false;
    let pulling = false;
    let refreshing = false;

    function reset() {
      indicator.style.transition = 'height 0.2s ease';
      indicator.style.height = '0px';
      spinner.style.transform = '';
      spinner.style.borderTopColor = 'var(--olive, #2E8F5C)';
      pulling = false;
    }

    scrollEl.addEventListener('touchstart', (e) => {
      if (refreshing || scrollEl.scrollTop > 0) { dragging = false; return; }
      startY = e.touches[0].clientY;
      dragging = true;
    }, { passive: true });

    scrollEl.addEventListener('touchmove', (e) => {
      if (refreshing || !dragging) return;
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY <= 0 || scrollEl.scrollTop > 0) {
        dragging = false;
        if (pulling) reset();
        return;
      }
      pulling = true;
      e.preventDefault();
      const dist = Math.min(deltaY * 0.5, MAX_PULL);
      indicator.style.transition = 'none';
      indicator.style.height = dist + 'px';
      spinner.style.transform = 'rotate(' + Math.min((dist / THRESHOLD) * 360, 360) + 'deg)';
      spinner.style.borderTopColor = dist >= THRESHOLD ? 'var(--brick, #FF6B4A)' : 'var(--olive, #2E8F5C)';
    }, { passive: false });

    scrollEl.addEventListener('touchend', async () => {
      if (!dragging) return;
      dragging = false;
      const distReached = (parseFloat(indicator.style.height) || 0) >= THRESHOLD;
      indicator.style.transition = 'height 0.2s ease';

      if (pulling && distReached) {
        refreshing = true;
        indicator.style.height = THRESHOLD + 'px';
        spinner.style.transform = '';
        spinner.style.borderTopColor = 'var(--olive, #2E8F5C)';
        spinner.classList.add('spinning');
        try {
          await onRefresh();
        } finally {
          spinner.classList.remove('spinning');
          reset();
          refreshing = false;
        }
      } else {
        reset();
      }
    });
  }

  window.CookzerPullToRefresh = { attach };
})();
