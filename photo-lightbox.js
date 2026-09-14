// Shared photo lightbox: full-size image with an upload-details panel on
// the side. Any page can call window.CookzerLightbox.open({...}) — the DOM
// is built lazily on first use so pages that never open it pay nothing.
(function () {
  let overlay = null;

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'pl-overlay';
    overlay.innerHTML =
      '<div class="pl-frame">' +
        '<button class="pl-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="pl-image-wrap"><img alt="Photo"></div>' +
        '<div class="pl-panel"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.pl-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  }

  function close() {
    overlay.classList.remove('open');
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function open(opts) {
    if (!overlay) build();

    const img = overlay.querySelector('.pl-image-wrap img');
    img.src = opts.imageUrl;
    img.style.filter = opts.filterCss || 'none';

    const panel = overlay.querySelector('.pl-panel');
    panel.innerHTML = '';

    if (opts.authorName) {
      const author = document.createElement(opts.authorHref ? 'a' : 'div');
      author.className = 'pl-author';
      if (opts.authorHref) author.href = opts.authorHref;

      const avatar = document.createElement('div');
      avatar.className = 'pl-avatar';
      if (opts.authorAvatarUrl) {
        avatar.style.backgroundImage = "url('" + opts.authorAvatarUrl + "')";
      } else {
        avatar.textContent = opts.authorInitials || '??';
      }
      author.appendChild(avatar);

      const info = document.createElement('div');
      info.className = 'pl-author-info';
      const name = document.createElement('div');
      name.className = 'pl-author-name';
      name.textContent = opts.authorName;
      info.appendChild(name);
      const timeText = formatTime(opts.timestamp);
      if (timeText) {
        const time = document.createElement('div');
        time.className = 'pl-time';
        time.textContent = timeText;
        info.appendChild(time);
      }
      author.appendChild(info);
      panel.appendChild(author);
    }

    if (opts.caption) {
      const caption = document.createElement('div');
      caption.className = 'pl-caption';
      caption.textContent = opts.caption;
      panel.appendChild(caption);
    }

    if (opts.meta && opts.meta.length > 0) {
      const list = document.createElement('div');
      list.className = 'pl-meta-list';
      opts.meta.forEach((m) => {
        const row = document.createElement('div');
        row.className = 'pl-meta-row';
        const label = document.createElement('span');
        label.textContent = m.label;
        const value = document.createElement('b');
        value.textContent = m.value;
        row.appendChild(label);
        row.appendChild(value);
        list.appendChild(row);
      });
      panel.appendChild(list);
    }

    if (opts.recipeTitle && opts.recipeHref) {
      const link = document.createElement('a');
      link.className = 'pl-recipe-link';
      link.href = opts.recipeHref;
      link.textContent = '🍽️ ' + opts.recipeTitle;
      panel.appendChild(link);
    }

    overlay.classList.add('open');
  }

  window.CookzerLightbox = { open, close };
})();
