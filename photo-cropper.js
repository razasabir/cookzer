// Shared crop/reposition/zoom step for every photo upload on the site
// (feed posts, group posts, recipe photos, profile picture) — the single
// biggest gap in how photos looked here: a photo used to go straight from
// the file picker to whatever fixed-aspect box displays it, with the
// browser's own object-fit:cover deciding what got cut off. This lets the
// person drag to reposition and use the zoom slider to choose their own
// framing before it's uploaded, the same way Instagram/Facebook-style
// composers work.
//
// Usage: CookzerPhotoCropper.open(file, { aspect, shape, title }) returns
// a Promise that resolves to a cropped File (same name/type as the
// original, new pixels) once the person confirms, or null if they cancel.
// aspect is width/height (e.g. 4/3, 1); shape 'circle' forces aspect to 1
// and renders a round mask (for avatars). Nothing else about the upload
// flow needs to change — treat the resolved File exactly like the
// original one.
(function () {
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;

  function injectStyle() {
    if (document.getElementById('photo-cropper-style')) return;
    const style = document.createElement('style');
    style.id = 'photo-cropper-style';
    style.textContent = `
      .pc-modal { max-width: 420px; }
      .pc-dek { font-size: 12px; color: var(--ink-soft, #6b6255); margin: -8px 0 14px; }
      .pc-frame-wrap { display: flex; justify-content: center; margin-bottom: 14px; }
      .pc-frame {
        position: relative; overflow: hidden; background: #000;
        touch-action: none; cursor: grab; border-radius: 10px;
      }
      .pc-frame.pc-circle { border-radius: 50%; }
      .pc-frame:active { cursor: grabbing; }
      .pc-frame img { position: absolute; left: 0; top: 0; max-width: none; user-select: none; -webkit-user-drag: none; }
      .pc-zoom-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
      .pc-zoom-row span { font-size: 16px; color: var(--ink-soft, #6b6255); flex-shrink: 0; }
      .pc-zoom-row input[type="range"] { flex: 1; }
      .pc-btn {
        padding: 10px 20px; border-radius: 12px; border: 1px solid var(--line, #e4ded2);
        background: var(--cream, #F8F4EC); color: var(--ink, #2b2620); font-weight: 600; font-size: 14px; cursor: pointer;
      }
      .pc-btn-primary { border: none; background: var(--olive, #4E5A3E); color: #fff; }
    `;
    document.head.appendChild(style);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function open(file, options) {
    options = options || {};
    const shape = options.shape === 'circle' ? 'circle' : 'rect';
    const aspect = shape === 'circle' ? 1 : (options.aspect || 1);
    const title = options.title || 'Adjust your photo';

    return new Promise((resolve) => {
      injectStyle();
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };

      img.onload = () => {
        const overlay = document.createElement('div');
        overlay.className = 'cz2-overlay';
        const modal = document.createElement('div');
        modal.className = 'cz2-modal pc-modal';

        const heading = document.createElement('h3');
        heading.textContent = title;
        const dek = document.createElement('div');
        dek.className = 'pc-dek';
        dek.textContent = 'Drag to reposition, use the slider to zoom.';

        const availableWidth = Math.min(360, window.innerWidth - 80);
        const frameW = shape === 'circle' ? Math.min(260, availableWidth) : availableWidth;
        const frameH = frameW / aspect;

        const frameWrap = document.createElement('div');
        frameWrap.className = 'pc-frame-wrap';
        const frame = document.createElement('div');
        frame.className = 'pc-frame' + (shape === 'circle' ? ' pc-circle' : '');
        frame.style.width = frameW + 'px';
        frame.style.height = frameH + 'px';

        const previewImg = document.createElement('img');
        previewImg.src = objectUrl;
        previewImg.draggable = false;
        frame.appendChild(previewImg);
        frameWrap.appendChild(frame);

        const zoomRow = document.createElement('div');
        zoomRow.className = 'pc-zoom-row';
        const zoomOutLabel = document.createElement('span');
        zoomOutLabel.textContent = '🔍';
        const zoomSlider = document.createElement('input');
        zoomSlider.type = 'range';
        zoomSlider.min = String(MIN_ZOOM);
        zoomSlider.max = String(MAX_ZOOM);
        zoomSlider.step = '0.01';
        zoomSlider.value = String(MIN_ZOOM);
        const zoomInLabel = document.createElement('span');
        zoomInLabel.textContent = '🔍';
        zoomInLabel.style.fontSize = '22px';
        zoomRow.appendChild(zoomOutLabel);
        zoomRow.appendChild(zoomSlider);
        zoomRow.appendChild(zoomInLabel);

        const actions = document.createElement('div');
        actions.className = 'cz2-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'pc-btn';
        cancelBtn.textContent = 'Cancel';
        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'pc-btn pc-btn-primary';
        confirmBtn.textContent = 'Use Photo';
        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);

        modal.appendChild(heading);
        modal.appendChild(dek);
        modal.appendChild(frameWrap);
        modal.appendChild(zoomRow);
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // --- pan/zoom state, all in frame-relative CSS pixels ---
        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;
        const baseScale = Math.max(frameW / naturalW, frameH / naturalH);
        let zoom = MIN_ZOOM;
        let panX = 0;
        let panY = 0;

        function clampPan() {
          const scale = baseScale * zoom;
          const dispW = naturalW * scale;
          const dispH = naturalH * scale;
          panX = clamp(panX, frameW - dispW, 0);
          panY = clamp(panY, frameH - dispH, 0);
        }

        function render() {
          const scale = baseScale * zoom;
          const dispW = naturalW * scale;
          const dispH = naturalH * scale;
          previewImg.style.width = dispW + 'px';
          previewImg.style.height = dispH + 'px';
          previewImg.style.transform = 'translate(' + panX + 'px,' + panY + 'px)';
        }

        function setZoom(newZoom) {
          newZoom = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
          const oldScale = baseScale * zoom;
          const newScale = baseScale * newZoom;
          // keep the frame's own center fixed in image space while zooming
          const cx = frameW / 2, cy = frameH / 2;
          const imgX = (cx - panX) / oldScale;
          const imgY = (cy - panY) / oldScale;
          zoom = newZoom;
          panX = cx - imgX * newScale;
          panY = cy - imgY * newScale;
          clampPan();
          render();
          zoomSlider.value = String(zoom);
        }

        clampPan();
        render();

        zoomSlider.addEventListener('input', () => setZoom(parseFloat(zoomSlider.value)));
        frame.addEventListener('wheel', (e) => {
          e.preventDefault();
          setZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1));
        }, { passive: false });

        let dragging = false;
        let dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
        frame.addEventListener('pointerdown', (e) => {
          dragging = true;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          panStartX = panX;
          panStartY = panY;
          frame.setPointerCapture(e.pointerId);
        });
        frame.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          panX = panStartX + (e.clientX - dragStartX);
          panY = panStartY + (e.clientY - dragStartY);
          clampPan();
          render();
        });
        function endDrag() { dragging = false; }
        frame.addEventListener('pointerup', endDrag);
        frame.addEventListener('pointercancel', endDrag);

        function cleanup() {
          overlay.remove();
          URL.revokeObjectURL(objectUrl);
        }

        cancelBtn.addEventListener('click', () => {
          cleanup();
          resolve(null);
        });
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            cleanup();
            resolve(null);
          }
        });

        confirmBtn.addEventListener('click', () => {
          const scale = baseScale * zoom;
          const srcX = clamp(-panX / scale, 0, naturalW);
          const srcY = clamp(-panY / scale, 0, naturalH);
          const srcW = clamp(frameW / scale, 1, naturalW - srcX);
          const srcH = clamp(frameH / scale, 1, naturalH - srcY);

          const maxOut = 1400;
          let outW = Math.round(Math.min(srcW, maxOut));
          let outH = Math.round(outW / aspect);

          const canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

          const mimeType = file.type && file.type.indexOf('image/') === 0 ? file.type : 'image/jpeg';
          canvas.toBlob((blob) => {
            cleanup();
            if (!blob) { resolve(null); return; }
            resolve(new File([blob], file.name || 'photo.jpg', { type: blob.type || mimeType }));
          }, mimeType, 0.92);
        });
      };

      img.src = objectUrl;
    });
  }

  window.CookzerPhotoCropper = { open };
})();
