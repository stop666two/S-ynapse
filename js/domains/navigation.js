export function init() {
  const F = window.__FEATURES__ || {};
  const MB = (F && F.mobileBottomNav) || {};
  const nav = document.getElementById('mBottomNav');
  if (!nav || MB.enabled === false) return;
  nav.addEventListener('click', function (e) {
    const it = e.target.closest('.m-nav-item');
    if (!it) return;
    const k = it.getAttribute('data-nav');
    if (k === 'theme') { e.preventDefault(); window.toggleDark(); }
    else if (k === 'top') { e.preventDefault(); window.scrollTo({ top: 0, behavior: window.__SB() }); }
  });
}
