// Shared keyboard shortcuts: "/" focuses the page's search bar (feed only —
// a no-op elsewhere since the element doesn't exist), "Esc" closes the
// mobile sidebar drawer and any open modal (both use consistent classes
// across pages: .sidebar.open, .modal-overlay.open).
document.addEventListener('keydown', function (e) {
  const target = e.target;
  const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

  if (e.key === '/' && !isTyping) {
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
      e.preventDefault();
      searchBar.focus();
    }
    return;
  }

  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach((m) => m.classList.remove('open'));
    const sidebar = document.querySelector('.sidebar.open');
    if (sidebar) {
      sidebar.classList.remove('open');
      const overlay = document.querySelector('.sidebar-overlay.open');
      if (overlay) overlay.classList.remove('open');
    }
  }
});
