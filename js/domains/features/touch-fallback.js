// features.mobile.touchFallback（默认 true）——触屏设备为 hover-only 控件提供替代交互。
// 触屏判定后给 <html> 置 data-touch-fallback；文档级委托 touchstart/focusin：
// 点击 pre / 标题（h2-h4）/ Mermaid SSR 容器即加 .touch-reveal（显形复制按钮/标题锚点/图表复制），
// 点击其它区域或另一目标时清除；卡片遮罩由 CSS :active 处理（见 templates/site-css.ejs）。
var REVEAL_SEL = '.post-content pre, .post-content h2, .post-content h3, .post-content h4, .mermaid-ssr';
var globalBound = false;

function isTouch() {
  if ('ontouchstart' in window) return true;
  if ((navigator.maxTouchPoints || 0) > 0) return true;
  try { return window.matchMedia('(hover: none)').matches; } catch (e) { return false; }
}

function on() {
  return document.documentElement.hasAttribute('data-touch-fallback');
}

function clearOthers(el) {
  document.querySelectorAll('.touch-reveal').forEach(function (x) { if (x !== el) x.classList.remove('touch-reveal'); });
}

function bindGlobals() {
  if (globalBound) return;
  globalBound = true;
  document.addEventListener('touchstart', function (e) {
    if (!on()) return;
    var t = e.target;
    var el = (t && t.closest) ? t.closest(REVEAL_SEL) : null;
    clearOthers(el);
    if (el) el.classList.add('touch-reveal');
  }, { passive: true });
  document.addEventListener('focusin', function (e) {
    if (!on()) return;
    var t = e.target;
    var el = (t && t.closest) ? t.closest(REVEAL_SEL) : null;
    if (el && !el.classList.contains('touch-reveal')) { clearOthers(el); el.classList.add('touch-reveal'); }
  });
}

function bind() {
  var F = window.__FEATURES__ || {}, M = (F && F.mobile) || {};
  if (M.enabled === false || M.touchFallback === false) return;
  if (!isTouch()) return;
  document.documentElement.setAttribute('data-touch-fallback', '');
}

export function init() {
  bind();
  bindGlobals();
}
