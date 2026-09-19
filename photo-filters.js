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
    // Food-photography-specific presets, added alongside the general set
    // above — each targets a look common to a particular kind of dish
    // (produce/bowls, plated fine dining, baked goods, grilled/roasted).
    { key: 'golden-hour', label: 'Golden Hour', css: 'sepia(0.15) saturate(1.4) brightness(1.12) contrast(1.05)' },
    { key: 'fresh', label: 'Fresh', css: 'brightness(1.1) saturate(1.05) contrast(0.95)' },
    { key: 'crisp', label: 'Crisp', css: 'contrast(1.2) saturate(1.15) brightness(1.02) hue-rotate(2deg)' },
    { key: 'bakery', label: 'Bakery', css: 'contrast(0.85) brightness(1.08) saturate(0.85) sepia(0.1)' },
    { key: 'char', label: 'Char', css: 'contrast(1.3) brightness(0.9) saturate(0.9) sepia(0.1)' },
  ];
  const FILTER_CSS = Object.fromEntries(FILTERS.map((f) => [f.key, f.css]));

  // Vignette is a separate on/off toggle layered on top of any color
  // filter above (including "Original") rather than a filter of its own —
  // it darkens the edges to pull the eye to the dish, which a CSS
  // `filter` function alone can't do. The preview approximation below
  // (an inset box-shadow, works directly on an <img>) and the baked
  // version (a radial gradient painted onto the upload canvas, see
  // applyVignette) are tuned to look like the same effect at their very
  // different sizes — the box-shadow approximates it in dp for tiny
  // swatches and mid-size previews, while the canvas version scales with
  // the photo's real pixel dimensions.
  const VIGNETTE_PREVIEW_CSS = 'inset 0 0 40px 10px rgba(15, 10, 5, 0.45)';

  function applyVignette(ctx, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const outerRadius = Math.sqrt(cx * cx + cy * cy);
    const gradient = ctx.createRadialGradient(cx, cy, outerRadius * 0.55, cx, cy, outerRadius);
    gradient.addColorStop(0, 'rgba(15, 10, 5, 0)');
    gradient.addColorStop(1, 'rgba(15, 10, 5, 0.55)');
    ctx.filter = 'none'; // the overlay itself shouldn't be re-tinted by a color filter already applied to the image beneath it
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // Samples the photo at a small fixed size (fast, and resolution doesn't
  // change what these averages mean) to get a rough read on exposure,
  // color cast, and how punchy the colors already are.
  function analyzePhoto(imgEl) {
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let rSum = 0, gSum = 0, bSum = 0, satSum = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      rSum += r; gSum += g; bSum += b;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      satSum += max === 0 ? 0 : (max - min) / max;
    }
    const r = rSum / n, g = gSum / n, b = bSum / n;
    return {
      luma: 0.2126 * r + 0.7152 * g + 0.0722 * b, // perceived brightness, 0-255
      warmth: r - b, // positive = yellow/orange cast, negative = blue cast
      saturation: satSum / n, // 0-1, how punchy the colors already are
    };
  }

  // Suggests a single starting filter from the existing preset list based
  // on the photo's own exposure/cast/saturation — never a new manual
  // control, just which swatch to pre-select. Returns null when the photo
  // is already reasonably well-balanced (Original stays the default).
  function suggestFilter(imgEl) {
    let stats;
    try {
      stats = analyzePhoto(imgEl);
    } catch (e) {
      return null; // e.g. a tainted canvas — fail quiet, no suggestion
    }
    const { luma, warmth, saturation } = stats;
    if (luma < 95) {
      return warmth > 8
        ? { key: 'fresh', reason: 'this photo looks a little dark' }
        : { key: 'golden-hour', reason: 'this photo looks a little dark' };
    }
    if (luma > 195) {
      return { key: 'crisp', reason: 'this photo looks a little washed out' };
    }
    if (saturation < 0.22) {
      return { key: 'vivid', reason: 'the colors look a little flat' };
    }
    if (warmth < -18) {
      return { key: 'warm', reason: 'this photo has a cool, bluish cast' };
    }
    if (warmth > 30) {
      return { key: 'cool', reason: 'this photo has a warm, yellowish cast — common under indoor lighting' };
    }
    return null;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = src;
    });
  }

  // Draws a loaded <img> through a CSS filter (and optionally a vignette
  // overlay) onto a canvas and returns the result as a Blob, ready to
  // upload in place of the original file.
  function bakeFilter(imgEl, filterCss, mimeType, vignette) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.filter = filterCss || 'none';
      ctx.drawImage(imgEl, 0, 0);
      if (vignette) applyVignette(ctx, canvas.width, canvas.height);
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
      .pf-vignette-toggle {
        flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
        width: 52px; height: 52px; border-radius: 10px; border: 2px solid var(--line, #e4ded2);
        background: var(--paper, #fff); cursor: pointer; font: inherit; gap: 2px;
      }
      .pf-vignette-toggle.active { border-color: var(--forest, #2f6b3a); background: rgba(47, 107, 58, 0.08); }
      .pf-vignette-icon { font-size: 18px; line-height: 1; }
      .pf-vignette-label { font-size: 10px; color: var(--ink-soft, #6b6255); }
      .pf-vignette-toggle.active .pf-vignette-label { color: var(--forest, #2f6b3a); font-weight: 600; }
      .pf-suggestion { font-size: 12px; color: var(--ink-soft, #6b6255); margin: 2px 2px 8px; }
      .pf-suggestion strong { color: var(--forest, #2f6b3a); }
    `;
    document.head.appendChild(style);
  }

  // Renders (or hides, when suggestion is null) a one-line "✨ Suggested
  // X — why" hint into containerEl. Purely informational — it doesn't
  // wire up any control of its own; the caller pre-selects the suggested
  // swatch and the existing swatch row remains how the user picks
  // anything else, including Original.
  function renderSuggestion(containerEl, suggestion) {
    injectStyle();
    if (!suggestion) {
      containerEl.hidden = true;
      containerEl.textContent = '';
      return;
    }
    const f = FILTERS.find((x) => x.key === suggestion.key);
    if (!f) {
      containerEl.hidden = true;
      return;
    }
    containerEl.className = (containerEl.className ? containerEl.className.replace(/\bpf-suggestion\b/, '').trim() + ' ' : '') + 'pf-suggestion';
    containerEl.innerHTML = '';
    containerEl.appendChild(document.createTextNode('✨ Suggested '));
    const strong = document.createElement('strong');
    strong.textContent = f.label;
    containerEl.appendChild(strong);
    containerEl.appendChild(document.createTextNode(' — ' + suggestion.reason + '.'));
    containerEl.hidden = false;
  }

  // Renders the swatch row into containerEl and wires click handling.
  // Caller owns the "which filter is active" state via activeKey/onSelect.
  // vignetteOn/onVignetteToggle are optional — pass both to also render a
  // vignette on/off chip after the swatches (omit to render swatches only,
  // unchanged from before vignette existed).
  function renderSwatches(containerEl, previewImgSrc, activeKey, onSelect, vignetteOn, onVignetteToggle) {
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

    if (onVignetteToggle) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'pf-vignette-toggle' + (vignetteOn ? ' active' : '');

      const icon = document.createElement('div');
      icon.className = 'pf-vignette-icon';
      icon.textContent = '◐';

      const label = document.createElement('div');
      label.className = 'pf-vignette-label';
      label.textContent = 'Vignette';

      toggle.appendChild(icon);
      toggle.appendChild(label);
      toggle.addEventListener('click', () => onVignetteToggle(!vignetteOn));
      containerEl.appendChild(toggle);
    }
  }

  window.CookzerPhotoFilters = {
    FILTERS, FILTER_CSS, VIGNETTE_PREVIEW_CSS,
    loadImage, bakeFilter, renderSwatches, renderSuggestion, suggestFilter, injectStyle,
  };
})();
