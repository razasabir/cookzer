// Shared food-photo filter set. Same 7 filters cookzer-recipe.html's photo
// gallery modal already shipped with (Original/Vivid/Warm/Cool/B&W/Vintage/
// Moody) — kept in one place so every upload flow that adds filters offers
// the same set instead of each page inventing its own.
//
// Two different application strategies exist on purpose:
//  - cookzer-recipe.html's gallery photos store the chosen filter key
//    (recipe_photos.filter) and apply it as CSS wherever that one gallery
//    grid renders — fine there, since it only ever renders in that one spot.
//  - Everywhere else (feed/group posts — shown across many pages: the
//    feed, groups, profile activity, notifications previews), baking the
//    filter into the actual image pixels at upload time (via bakeFilter
//    below) is simpler and safer than teaching every render site about a
//    stored filter key. No schema change, no downstream changes.
(function () {
  const FILTERS = [
    { key: 'original', label: 'Original', css: 'none' },
    { key: 'vivid', label: 'Vivid', css: 'saturate(1.6) contrast(1.15)' },
    { key: 'warm', label: 'Warm', css: 'sepia(0.25) saturate(1.3) brightness(1.05)' },
    { key: 'cool', label: 'Cool', css: 'hue-rotate(-8deg) saturate(1.1) brightness(1.03) contrast(1.05)' },
    { key: 'bw', label: 'B&W', css: 'grayscale(1) contrast(1.1)' },
    { key: 'vintage', label: 'Vintage', css: 'sepia(0.4) contrast(0.9) brightness(0.95) saturate(0.75)' },
    { key: 'moody', label: 'Moody', css: 'contrast(1.25) brightness(0.85) saturate(0.85)' },
  ];
  const FILTER_CSS = Object.fromEntries(FILTERS.map((f) => [f.key, f.css]));

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = src;
    });
  }

  // Draws a loaded <img> through a CSS filter onto a canvas and returns
  // the result as a Blob, ready to upload in place of the original file.
  function bakeFilter(imgEl, filterCss, mimeType) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.filter = filterCss || 'none';
      ctx.drawImage(imgEl, 0, 0);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process image'))),
        mimeType || 'image/jpeg',
        0.92
      );
    });
  }

  function injectStyle() {
    if (document.getElementById('photo-filters-style')) return;
    const style = document.createElement('style');
    style.id = 'photo-filters-style';
    style.textContent = `
      .pf-swatch-row { display: flex; gap: 10px; overflow-x: auto; padding: 8px 2px; }
      .pf-swatch { flex-shrink: 0; text-align: center; cursor: pointer; background: none; border: none; padding: 0; font: inherit; }
      .pf-swatch img { width: 52px; height: 52px; object-fit: cover; border-radius: 10px; border: 2px solid transparent; display: block; }
      .pf-swatch.active img { border-color: var(--forest, #2f6b3a); }
      .pf-swatch-label { font-size: 10px; color: var(--ink-soft, #6b6255); margin-top: 3px; }
      .pf-swatch.active .pf-swatch-label { color: var(--forest, #2f6b3a); font-weight: 600; }
    `;
    document.head.appendChild(style);
  }

  // Renders the swatch row into containerEl and wires click handling.
  // Caller owns the "which filter is active" state via activeKey/onSelect.
  function renderSwatches(containerEl, previewImgSrc, activeKey, onSelect) {
    injectStyle();
    containerEl.innerHTML = '';
    containerEl.className = (containerEl.className ? containerEl.className + ' ' : '') + 'pf-swatch-row';
    FILTERS.forEach((f) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'pf-swatch' + (f.key === activeKey ? ' active' : '');

      const img = document.createElement('img');
      img.src = previewImgSrc;
      img.style.filter = f.css;

      const label = document.createElement('div');
      label.className = 'pf-swatch-label';
      label.textContent = f.label;

      swatch.appendChild(img);
      swatch.appendChild(label);
      swatch.addEventListener('click', () => onSelect(f));
      containerEl.appendChild(swatch);
    });
  }

  window.CookzerPhotoFilters = { FILTERS, FILTER_CSS, loadImage, bakeFilter, renderSwatches, injectStyle };
})();
