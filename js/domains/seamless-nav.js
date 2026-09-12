const VT_SUPPORTED = (function () {
  try { return CSS.supports('at-rule(@view-transition)'); } catch (e) { return false; }
})();
const SP_SUPPORTED = (function () {
  try { return !!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')); } catch (e) { return false; }
})();

function cfgVT() { return (window.__FEATURES__ && window.__FEATURES__.viewTransition) || {}; }
function cfgSP() { return (window.__FEATURES__ && window.__FEATURES__.speculation) || {}; }
function storeKey(cfg, fallback) {
  return (cfg.toggle && cfg.toggle.storageKey) || fallback;
}
function getOn(cfg, fallbackKey) {
  const t = cfg.toggle || {};
  try {
    const v = localStorage.getItem(storeKey(cfg, fallbackKey));
    if (v === '0') return false;
    if (v === '1') return true;
  } catch (e) { /* 隐私模式等场景下忽略 */ }
  return t.defaultOn !== false;
}
function setOn(cfg, fallbackKey, on) {
  try { localStorage.setItem(storeKey(cfg, fallbackKey), on ? '1' : '0'); } catch (e) { /* 忽略 */ }
}
function sysReduce() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
function vtActive() {
  const c = cfgVT();
  if (c.enabled === false || !VT_SUPPORTED) return false;
  const rm = c.reducedMotion || 'light';
  if (rm === 'off' && sysReduce()) return false;
  return getOn(c, 's-view-transition');
}
function spDelivery() {
  return cfgSP().delivery || 'inline';
}
function spActive() {
  const c = cfgSP();
  if (c.enabled === false || !SP_SUPPORTED) return false;
  if (spDelivery() === 'header') return false;
  return getOn(c, 's-speculation');
}
window.__viewTransitionActive = vtActive;

function setVtOff(off) {
  let el = document.getElementById('vtOff');
  if (off) {
    if (!el) {
      el = document.createElement('style');
      el.id = 'vtOff';
      el.textContent = '@view-transition{navigation:none}';
      document.head.appendChild(el);
    }
  } else if (el) {
    el.remove();
  }
}
function spRule() {
  const c = cfgSP();
  const where = { and: [{ href_matches: '/*' }] };
  (c.excludeSelectors || []).forEach(function (sel) {
    if (sel) where.and.push({ not: { selector_matches: sel } });
  });
  where.and.push({ not: { href_matches: '/*\\?*' } });
  return { where: where, eagerness: c.eagerness || 'moderate' };
}
function setSpeculation(on) {
  const old = document.getElementById('specRules');
  if (old) old.remove();
  if (!on) return;
  const mode = cfgSP().mode || 'both';
  const json = {};
  if (mode === 'prefetch' || mode === 'both') json.prefetch = [spRule()];
  if (mode === 'prerender' || mode === 'both') json.prerender = [spRule()];
  const s = document.createElement('script');
  s.type = 'speculationrules';
  s.id = 'specRules';
  s.textContent = JSON.stringify(json);
  document.head.appendChild(s);
}
function initUI() {
  const btn = document.getElementById('navBoostBtn');
  const panel = document.getElementById('navBoostPanel');
  if (!btn || !panel) return;
  const vtBox = document.getElementById('nbVt');
  const spBox = document.getElementById('nbSp');
  const vtWrap = vtBox && vtBox.closest('.nav-boost-item');
  const spWrap = spBox && spBox.closest('.nav-boost-item');
  let usable = false;
  if (vtBox) {
    if (VT_SUPPORTED) { vtBox.checked = vtActive(); usable = true; }
    else { vtWrap.classList.add('unavailable'); vtBox.disabled = true; vtBox.checked = false; vtWrap.title = '当前浏览器不支持 View Transitions'; }
  }
  if (spBox) {
    if (spDelivery() === 'header') {
      spWrap.style.display = 'none';
    } else if (SP_SUPPORTED) { spBox.checked = spActive(); usable = true; }
    else { spWrap.classList.add('unavailable'); spBox.disabled = true; spBox.checked = false; spWrap.title = '当前浏览器不支持 Speculation Rules'; }
  }
  if (!usable) { const root = document.getElementById('navBoost'); if (root) root.style.display = 'none'; return; }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    const willOpen = panel.hasAttribute('hidden');
    if (willOpen) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    if (!panel.hasAttribute('hidden') && !(e.target.closest && e.target.closest('#navBoost'))) {
      panel.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hasAttribute('hidden')) {
      panel.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
  if (vtBox) vtBox.addEventListener('change', function () {
    setOn(cfgVT(), 's-view-transition', vtBox.checked);
    setVtOff(!vtActive());
  });
  if (spBox) spBox.addEventListener('change', function () {
    setOn(cfgSP(), 's-speculation', spBox.checked);
    setSpeculation(spActive());
  });
}
export function init() {
  if (cfgVT().enabled !== false) setVtOff(!vtActive());
  if (spDelivery() !== 'header') setSpeculation(spActive());
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initUI); } else { initUI(); }
}
