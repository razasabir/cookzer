// Shared dark-mode toggle. Included before styles.css on every page so the
// saved choice applies before first paint (no flash of the wrong theme).
(function () {
  var saved = null;
  try {
    saved = localStorage.getItem('cookzer-theme');
  } catch (e) {
    // Private browsing / storage blocked — fall back to light, silently.
  }
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Corrects for a WebView where window.innerHeight overstates the
  // actually-visible area — the Android system nav bar's pixels are
  // included in that measurement, but the WebView can't actually paint
  // into them. Confirmed on a real device via a diagnostic readout:
  // .main's scrollHeight and clientHeight were EXACTLY equal (both
  // 817px, matching window.innerHeight almost exactly), meaning the
  // browser genuinely believed there was nothing left to scroll — not
  // that there was more content it couldn't make room for. That's a
  // different, more fundamental problem than env(safe-area-inset-bottom)
  // not resolving (which was this repo's first theory): that CSS
  // variable assumes the browser already knows part of its own
  // reported viewport is obscured. Two earlier attempts also tried
  // gating extra padding behind "is this the native app" detection
  // (window.Capacitor.isNativePlatform(), then an Android WebView
  // user-agent check) — the same diagnostic readout showed both
  // returning false on the real device, so neither ever fired.
  //
  // window.visualViewport measures the genuinely-visible area directly
  // and needs none of that: the gap between it and window.innerHeight,
  // when there is one, is real missing screen space, full stop. Applied
  // everywhere as extra scroll-container padding via a CSS custom
  // property (see .main etc. in styles.css) — never gated behind
  // environment detection, which twice proved unreliable. On an
  // ordinary browser (desktop, mobile Safari/Chrome, no WebView
  // mismatch) the two heights already match, so this resolves to 0 and
  // changes nothing there.
  function applyViewportInsetFix() {
    if (!window.visualViewport) return;
    function update() {
      var gap = window.innerHeight - window.visualViewport.height;
      document.documentElement.style.setProperty('--cz-viewport-inset-fix', Math.max(0, Math.round(gap)) + 'px');
    }
    update();
    window.visualViewport.addEventListener('resize', update);
  }
  applyViewportInsetFix();

  // ---- TEMPORARY diagnostic banner — delete once root-caused. After the
  // native edge-to-edge opt-out (PR #250) fixed the bottom-cutoff bug, the
  // whole page started rendering visibly zoomed in (a fixed 28px heading
  // taking up two lines at roughly 2x its spec'd size, header icons
  // similarly oversized) — since .page-title's font-size is an absolute
  // px value, not rem/em, the only way it renders larger on screen is if
  // the browser is scaling the entire page up, i.e. a viewport-width/zoom
  // miscalculation, not a CSS bug. Pinned to the very top of the
  // viewport (position:fixed — see the profile-preview banner bug earlier
  // this session for why a plain body child would break).
  function renderZoomDebugBanner() {
    var vv = window.visualViewport;
    var titleEl = document.querySelector('.page-title, h1');
    var titleFontSize = titleEl ? getComputedStyle(titleEl).fontSize : 'n/a';
    var banner = document.createElement('div');
    banner.id = 'czZoomDebugBanner';
    banner.textContent =
      'ZDBG innerW=' + window.innerWidth + ' outerW=' + window.outerWidth +
      ' dpr=' + window.devicePixelRatio +
      ' docClientW=' + document.documentElement.clientWidth +
      ' | vvW=' + (vv ? Math.round(vv.width) : 'n/a') + ' vvScale=' + (vv ? vv.scale : 'n/a') +
      ' | titleFontSize=' + titleFontSize;
    banner.style.cssText =
      'position:fixed; left:0; right:0; top:0; z-index:999999; ' +
      'background:#000; color:#0f0; font:10px/1.4 monospace; ' +
      'padding:4px 6px; white-space:pre-wrap; pointer-events:none;';
    document.body.appendChild(banner);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderZoomDebugBanner);
  } else {
    renderZoomDebugBanner();
  }

  window.toggleTheme = function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    try {
      localStorage.setItem('cookzer-theme', isDark ? 'light' : 'dark');
    } catch (e) {
      // Nothing to persist to — the toggle still works for this page view.
    }
    syncThemeButtons();
  };

  function syncThemeButtons() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
      btn.textContent = isDark ? '☀️' : '🌙';
      btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncThemeButtons);
  } else {
    syncThemeButtons();
  }
})();
