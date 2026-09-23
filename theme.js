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
  //
  // The gap isn't necessarily all at the bottom (nav bar) — on some
  // devices/OS versions part or all of it is the status bar at the top
  // (reported after the bottom fix shipped: the status bar was still
  // overlapping the header on a device where the native
  // decorFitsSystemWindows fix didn't fully reserve that space).
  // visualViewport.offsetTop gives the portion hidden at the top; the
  // remainder of the innerHeight/visualViewport.height gap is the
  // portion hidden at the bottom, same as before.
  function applyViewportInsetFix() {
    if (!window.visualViewport) return;
    function update() {
      var totalGap = Math.max(0, Math.round(window.innerHeight - window.visualViewport.height));
      var topGap = Math.max(0, Math.round(window.visualViewport.offsetTop));
      var bottomGap = Math.max(0, totalGap - topGap);
      document.documentElement.style.setProperty('--cz-viewport-inset-fix', bottomGap + 'px');
      document.documentElement.style.setProperty('--cz-viewport-inset-fix-top', topGap + 'px');
    }
    update();
    window.visualViewport.addEventListener('resize', update);
  }
  applyViewportInsetFix();

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
