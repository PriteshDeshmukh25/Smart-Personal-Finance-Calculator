const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('visible')); return; }
  const io = new IntersectionObserver((entries, obs) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('visible'); obs.unobserve(en.target); }
  }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
}

const tokens = new WeakMap();
/** Counts up/down to `to`. Always ends on the exact formatted value. */
export function animateNumber(el, to, fmt) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = String(to);
  if (reduced() || from === to) { el.textContent = fmt(to); return; }
  const tok = Symbol(), t0 = performance.now(), dur = 500;
  tokens.set(el, tok);
  const step = now => {
    if (tokens.get(el) !== tok) return;
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(p < 1 ? from + (to - from) * (1 - Math.pow(1 - p, 3)) : to);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(() => { if (tokens.get(el) === tok) el.textContent = fmt(to); }, dur + 80);
}

export function initProgress() {
  const bar = document.getElementById('scrollProgress');
  let queued = false;
  const update = () => {
    queued = false;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
  };
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
}
