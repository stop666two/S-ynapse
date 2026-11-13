export function init() {
  const F = window.__FEATURES__ || {};
  const TN = (window.__TUNING__ || {}).header || {};
  const hd = document.querySelector('.site-header');
  if (hd && TN.scrollShrink !== false) {
    let ticking = false;
    const th = parseInt(TN.scrollThresholdPx, 10);
    const offset = isNaN(th) ? 8 : th;
    const update = function () {
      hd.classList.toggle('scrolled', window.scrollY > offset);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }
  const nt = document.getElementById('navToggle');
  if (nt) {
    nt.addEventListener('click', function () {
      const mn = document.getElementById('mainNav');
      if (mn) mn.classList.toggle('open');
      nt.classList.toggle('active');
    });
  }
  const MB = (F && F.mobileBottomNav) || {};
  const nav = document.getElementById('mBottomNav');
  if (!nav || MB.enabled === false) return;
  nav.addEventListener('click', function (e) {
    const it = e.target.closest('.m-nav-item');
    if (!it) return;
    const k = it.getAttribute('data-nav');
    // 审查 R-33 接线：themeToggle.enabled=false 时 theme.js 不暴露 window.toggleDark，
    // 这里按存在性判断，避免按下底部导航的「主题」项抛 TypeError。
    if (k === 'theme') { e.preventDefault(); if (typeof window.toggleDark === 'function') window.toggleDark(); }
    else if (k === 'top') { e.preventDefault(); window.scrollTo({ top: 0, behavior: window.__SB() }); }
  });
}
