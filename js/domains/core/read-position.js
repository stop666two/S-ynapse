const KEY = 's-readpos';

export function init() {
  const F = window.__FEATURES__ || {}, RP = (F && F.readingProgress) || {};
  if (RP.enabled === false || RP.rememberPosition === false) return;
  const maxAge = (isNaN(+RP.rememberPositionMaxAgeHours) ? 72 : +RP.rememberPositionMaxAgeHours) * 3600000;
  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
    catch (e) { return {}; }
  }
  function save() {
    try {
      const o = load();
      o[location.pathname] = { y: Math.round(window.scrollY), t: Date.now() };
      const ks = Object.keys(o);
      if (ks.length > 80) {
        ks.sort(function (a, b) { return (o[a].t || 0) - (o[b].t || 0); }).slice(0, ks.length - 80).forEach(function (k) { delete o[k]; });
      }
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) { /* 隐私模式等场景忽略 */ }
  }
  const nav = performance.getEntriesByType('navigation')[0];
  const fromBack = nav && nav.type === 'back_forward';
  if (!location.hash && !fromBack) {
    const rec = load()[location.pathname];
    if (rec && rec.y > 160 && Date.now() - (rec.t || 0) <= maxAge) {
      requestAnimationFrame(function () { window.scrollTo(0, rec.y); });
    }
  }
  let t = 0;
  window.addEventListener('scroll', function () {
    const now = Date.now();
    if (now - t > 400) { t = now; save(); }
  }, { passive: true });
  window.addEventListener('pagehide', save);
}
