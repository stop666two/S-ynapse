const NS = 'http://www.w3.org/2000/svg';
const VENDOR = '/assets/vendor/morphicons';
const CHECK_D = 'M20 6L9 17l-5-5';
const HEART_SOLID_D = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const MENU_D = 'M4 6h16M4 12h16M4 18h16';
const X_D = 'M6 6l12 12M18 6L6 18';
const STOP_D = 'M7 7h10v10H7z';

let mod = null;
let modPromise = null;
let inited = false;
const morphs = new Map();

function cfg() {
  return (window.__MORPH__ && typeof window.__MORPH__ === 'object') ? window.__MORPH__ : null;
}
function iconOn(name) {
  const c = cfg();
  return !c.icons || c.icons[name] !== false;
}
function rmPolicy() {
  const c = cfg() || {};
  const v = c.reducedMotion;
  if (v === true) return 'light';
  if (v === false) return 'full';
  return v || 'light';
}
function sysReduce() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function springFor(key) {
  const c = cfg() || {};
  const p = c.perIcon && c.perIcon[key];
  if (p) {
    if (typeof p === 'string') return p;
    if (+p.stiffness > 0 && +p.damping > 0) return { stiffness: +p.stiffness, damping: +p.damping };
  }
  const T = (window.__TUNING__ && window.__TUNING__.morphicons) || {};
  if (sysReduce() && rmPolicy() === 'light') {
    const rk = parseFloat(T.reducedStiffness), rc = parseFloat(T.reducedDamping);
    return (rk > 0 && rc > 0) ? { stiffness: rk, damping: rc } : { stiffness: 900, damping: 55 };
  }
  const k = parseFloat(T.stiffness), d = parseFloat(T.damping);
  if (k > 0 && d > 0) return { stiffness: k, damping: d };
  return c.spring || 'snappy';
}
function loadVendor() {
  if (modPromise) return modPromise;
  modPromise = Promise.all([
    import(VENDOR + '/dom.js'),
    import(VENDOR + '/adapters.js')
  ]).then(function (r) {
    mod = { createMorph: r[0].createMorph, svgToIcon: r[1].svgToIcon };
    return mod;
  }).catch(function () { modPromise = null; return null; });
  return modPromise;
}
function asPath(svg) {
  if (!svg) return null;
  const kids = Array.prototype.filter.call(svg.children, function (n) { return n.tagName.toLowerCase() === 'path'; });
  if (kids.length === 1 && svg.children.length === 1) return kids[0];
  const p = document.createElementNS(NS, 'path');
  svg.replaceChildren(p);
  return p;
}
function bind(root, inst, a, b, on, key) {
  morphs.set(root, { inst: inst, a: a, b: b, on: on, key: key });
}
function morphTo(root, on) {
  const m = morphs.get(root);
  if (!m || m.on === on) return;
  m.on = on;
  const target = on ? m.b : m.a;
  if (sysReduce() && rmPolicy() === 'off') {
    try { m.inst.set(target); } catch (e) { /* 单点故障不影响其他图标 */ }
    return;
  }
  try { m.inst.morphTo(target, springFor(m.key)); } catch (e) { /* 单点故障不影响其他图标 */ }
}
function watch(root, get, fn) {
  new MutationObserver(fn).observe(root, { attributes: true, attributeFilter: ['class', 'aria-pressed'] });
}
function makeSvg(w, h) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', w || 20);
  svg.setAttribute('height', h || 20);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  return svg;
}
function initTheme() {
  const btn = document.querySelector('.dark-toggle');
  if (!btn) return;
  const sun = btn.querySelector('#sunI');
  if (!sun) return;
  const moon = btn.querySelector('#moonI');
  const iconSun = mod.svgToIcon(sun.outerHTML);
  const iconMoon = moon ? mod.svgToIcon(moon.outerHTML) : iconSun;
  const F = window.__FEATURES__ || {};
  if (F.themeToggle) F.themeToggle.toggleIconSwap = false;
  if (moon) moon.remove();
  sun.style.display = '';
  const path = asPath(sun);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  bind(btn, mod.createMorph(path, isDark ? iconMoon : iconSun, { reducedMotion: 'never' }), iconSun, iconMoon, isDark, 'theme');
  new MutationObserver(function () {
    morphTo(btn, document.documentElement.getAttribute('data-theme') === 'dark');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
function initFav() {
  const btn = document.querySelector('#favBtn');
  if (!btn) return;
  const svg = btn.querySelector('svg');
  if (!svg) return;
  const outline = mod.svgToIcon(svg.outerHTML);
  const path = asPath(svg);
  const on = btn.classList.contains('faved');
  bind(btn, mod.createMorph(path, on ? HEART_SOLID_D : outline, { reducedMotion: 'never' }), outline, HEART_SOLID_D, on, 'favorite');
  watch(btn, null, function () { morphTo(btn, btn.classList.contains('faved')); });
}
function initTts() {
  const btn = document.querySelector('#ttsBtn');
  if (!btn) return;
  const svg = btn.querySelector('svg');
  if (!svg) return;
  const idle = mod.svgToIcon(svg.outerHTML);
  const path = asPath(svg);
  const on = btn.classList.contains('speaking');
  bind(btn, mod.createMorph(path, on ? STOP_D : idle, { reducedMotion: 'never' }), idle, STOP_D, on, 'tts');
  watch(btn, null, function () { morphTo(btn, btn.classList.contains('speaking')); });
}
function initMenu() {
  const btn = document.querySelector('#navToggle');
  if (!btn) return;
  const svg = makeSvg(20, 20);
  const path = document.createElementNS(NS, 'path');
  svg.appendChild(path);
  btn.replaceChildren(svg);
  const on = btn.classList.contains('active');
  bind(btn, mod.createMorph(path, on ? X_D : MENU_D, { reducedMotion: 'never' }), MENU_D, X_D, on, 'menu');
  watch(btn, null, function () { morphTo(btn, btn.classList.contains('active')); });
}
function initCopyButtons() {
  document.querySelectorAll('.code-action-btn.copy').forEach(function (btn) {
    if (morphs.has(btn)) return;
    const svg = btn.querySelector('svg');
    if (!svg) return;
    const copyIcon = mod.svgToIcon(svg.outerHTML);
    const path = asPath(svg);
    bind(btn, mod.createMorph(path, copyIcon, { reducedMotion: 'never' }), copyIcon, CHECK_D, false, 'copy');
  });
}
function initAll() {
  if (inited) return;
  inited = true;
  const steps = [];
  if (iconOn('theme')) steps.push(initTheme);
  if (iconOn('favorite')) steps.push(initFav);
  if (iconOn('tts')) steps.push(initTts);
  if (iconOn('menu')) steps.push(initMenu);
  if (iconOn('copy')) steps.push(initCopyButtons);
  for (const fn of steps) {
    try { fn(); } catch (e) { /* 单点失败不影响其余图标 */ }
  }
  window.__MORPH_READY__ = true;
}
export function init() {
  if (!cfg()) return;
  window.__morphScan = function () { if (inited) initCopyButtons(); };
  window.__morphCopy = function (btn, state) {
    const m = morphs.get(btn);
    if (!m) return false;
    const on = state === 'check';
    if (m.on === on) return true;
    m.on = on;
    const target = on ? m.b : m.a;
    try {
      if (sysReduce() && rmPolicy() === 'off') { m.inst.set(target); } else { m.inst.morphTo(target, springFor(m.key)); }
    } catch (e) { return false; }
    return true;
  };
  const pre = (cfg() && cfg().preload) || 'interaction';
  if (pre === 'immediate') {
    loadVendor().then(function (m) { if (m) initAll(); });
  } else if (pre === 'idle' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(function () { loadVendor().then(function (m) { if (m) initAll(); }); }, { timeout: 3000 });
  }
  const events = ['pointerover', 'pointerdown', 'touchstart', 'focusin'];
  function arm(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    if (!t.closest('.dark-toggle,#favBtn,#ttsBtn,#navToggle,.code-action-btn.copy')) return;
    loadVendor().then(function (m) {
      if (!m) return;
      initAll();
      events.forEach(function (ev) { document.removeEventListener(ev, arm, true); });
    });
  }
  events.forEach(function (ev) { document.addEventListener(ev, arm, true); });
}
