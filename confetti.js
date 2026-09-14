// Tiny dependency-free confetti burst for small celebration moments
// (joining a challenge, etc). No canvas — just absolutely positioned
// divs that fall and fade via CSS, removed once the animation ends.
function burstConfetti() {
  const colors = ['#009C4A', '#D9A441', '#E85659', '#009C4A', '#F2C87A'];
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('div');
    const size = 6 + Math.random() * 6;
    piece.style.position = 'absolute';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.top = '-20px';
    piece.style.width = size + 'px';
    piece.style.height = size * 0.4 + 'px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.opacity = '0.9';
    piece.style.borderRadius = '2px';
    piece.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
    const duration = 1.4 + Math.random() * 1.2;
    const drift = (Math.random() - 0.5) * 200;
    piece.style.transition = 'transform ' + duration + 's cubic-bezier(0.2,0.6,0.4,1), opacity ' + duration + 's ease-in';
    container.appendChild(piece);
    // Force the browser to commit the starting position in its own frame —
    // without this, the transition and its target both land in the same
    // frame and the piece just jumps straight to the end state.
    void piece.offsetHeight;
    piece.style.transform = 'translate(' + drift + 'px, 100vh) rotate(' + (360 + Math.random() * 360) + 'deg)';
    piece.style.opacity = '0';
  }

  setTimeout(() => container.remove(), 3000);
}
