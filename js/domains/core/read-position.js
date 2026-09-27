const KEY = 's-readpos';

export function init() {
  const F = window.__FEATURES__ || {}, RP = (F && F.readingProgress) || {};
  if (RP.enabled === false || RP.rememberPosition === false) return;
  const maxAge = (isNaN(+RP.rememberPositionMaxAgeHours) ? 72 : +RP.rememberPositionMaxAgeHours) * 3600000;
  // 以下三键缺省/非法回退 160 / 80 / 400，均保持历史行为。
  const rawMin = +RP.minRestorePx;
  const minRestorePx = isNaN(rawMin) ? 160 : Math.max(0, rawMin);
  const rawMax = +RP.maxStoredPositions;
  const maxStored = isNaN(rawMax) ? 80 : Math.max(1, Math.floor(rawMax));
  const rawThrottle = +RP.saveThrottleMs;
  const saveThrottleMs = isNaN(rawThrottle) ? 400 : Math.max(0, rawThrottle);
  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
    catch (e) { return {}; }
  }
  function save() {
    try {
      const o = load();
      o[location.pathname] = { y: Math.round(window.scrollY), t: Date.now() };
      const ks = Object.keys(o);
      if (ks.length > maxStored) {
        ks.sort(function (a, b) { return (o[a].t || 0) - (o[b].t || 0); }).slice(0, ks.length - maxStored).forEach(function (k) { delete o[k]; });
      }
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) { /* 隐私模式等场景忽略 */ }
  }
  const nav = performance.getEntriesByType('navigation')[0];
  const fromBack = nav && nav.type === 'back_forward';
  if (!location.hash && !fromBack) {
    const rec = load()[location.pathname];
    if (rec && rec.y > minRestorePx && Date.now() - (rec.t || 0) <= maxAge) {
      requestAnimationFrame(function () { window.scrollTo(0, rec.y); });
    }
  }
  let t = 0;
  window.addEventListener('scroll', function () {
    const now = Date.now();
    if (now - t > saveThrottleMs) { t = now; save(); }
  }, { passive: true });
  window.addEventListener('pagehide', save);
}
