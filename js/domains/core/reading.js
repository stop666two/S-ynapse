export function toggleReadingMode() {
  var d = document.documentElement;
  var a = d.getAttribute('data-reading');
  if (a === 'true') { d.removeAttribute('data-reading'); try { localStorage.setItem('readingMode', 'false'); } catch (e) { /* 忽略：存储不可用时阅读模式仅当次会话有效 */ } }
  else { d.setAttribute('data-reading', 'true'); try { localStorage.setItem('readingMode', 'true'); } catch (e) { /* 忽略：存储不可用时阅读模式仅当次会话有效 */ } }
}

// 返回顶部：features.backToTop.scrollDurationMs 自定义 rAF 缓动（0=瞬时）；
// smoothScroll=false 或 window.__SB()==='auto'（含系统减少动效/滚动行为关闭）走原生瞬时；
// 用户滚轮/触摸即取消动画（bttAnim 递增使旧帧失效）。与 hotkey 共用本函数。
var bttAnim = 0;
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
// 逐帧定位必须绕过 CSS scroll-behavior:smooth（否则每帧被浏览器再平滑一次，与 rAF 打架）；
// behavior:'instant' 为标准值，旧浏览器 catch 后回退传统两参调用。
function jumpTo(y) {
  try { window.scrollTo({ top: y, behavior: 'instant' }); }
  catch (e) { window.scrollTo(0, y); }
}
function scrollToTop() {
  var BT = CFG.BT || {};
  var start = window.scrollY || window.pageYOffset || 0;
  var ms = isNaN(+BT.scrollDurationMs) ? 450 : Math.max(0, +BT.scrollDurationMs);
  var auto = (typeof window.__SB === 'function' ? window.__SB() : 'smooth') === 'auto';
  if (start <= 0) { jumpTo(0); return; }
  if (BT.smoothScroll === false || ms <= 0 || auto || !window.requestAnimationFrame) { jumpTo(0); return; }
  bttAnim++;
  var id = bttAnim, t0 = performance.now();
  (function step(now) {
    if (id !== bttAnim) return;
    var p = Math.min(1, (now - t0) / ms);
    jumpTo(Math.round(start * (1 - easeOutCubic(p))));
    if (p < 1) window.requestAnimationFrame(step);
  })(t0);
}

// 页面级元素引用与配置：软导航交换 DOM 后由 bind() 重新指向新节点，
// 文档/窗口级监听器只在首次 init 绑定一次（通过全局状态读取当前引用）。
var S = { bar: null, tip: null, dot: null, btt: null, dock: null, ring: null, dockToc: null, dockTop: null, ariaOn: false, tipTimer: 0, hoverOn: false, focusOn: false };
var CFG = { RP: {}, BT: {}, D: {} };
var lastW = -1, dockRaf = 0, progTimer = null, globalBound = false;

function updateProgress() {
  var bar = S.bar;
  if (!bar) return;
  var sh = document.documentElement.scrollHeight - window.innerHeight;
  var pc = sh > 0 ? Math.min(1, window.scrollY / sh) : 0;
  var w = Math.round(pc * 100);
  if (w === lastW) return;
  lastW = w;
  bar.style.width = w + '%';
  if (S.ariaOn) bar.setAttribute('aria-valuenow', String(w));
  if (S.tip) S.tip.textContent = w + '%';
  if (S.dot) S.dot.style.left = w + '%';
}

function tipMs() { var v = +CFG.RP.tipDisplayMs; return isNaN(v) || v < 0 ? 500 : v; }
function showTip() {
  if (!S.tip || CFG.RP.showTip === false) return;
  if (S.tipTimer) { clearTimeout(S.tipTimer); S.tipTimer = 0; }
  S.tip.hidden = false;
}
function hideTip() {
  if (!S.tip || S.hoverOn || S.focusOn) return;
  if (S.tipTimer) { clearTimeout(S.tipTimer); S.tipTimer = 0; }
  S.tip.hidden = true;
}
function flashTip() {
  showTip();
  if (S.tipTimer) clearTimeout(S.tipTimer);
  S.tipTimer = setTimeout(function () { S.tipTimer = 0; hideTip(); }, tipMs());
}
function seekPct(pct) {
  var sh = document.documentElement.scrollHeight - window.innerHeight;
  if (sh <= 0) return;
  window.scrollTo({ top: Math.max(0, Math.min(1, pct)) * sh, behavior: window.__SB() });
  flashTip();
}

function updateBtt() {
  var b = S.btt;
  if (!b) return;
  var px = isNaN(+CFG.BT.showAfterPx) ? 400 : +CFG.BT.showAfterPx;
  if (window.scrollY > px) b.classList.add('visible'); else b.classList.remove('visible');
}

function updateDock() {
  var d = S.dock;
  if (!d) return;
  var R = 100.5;
  var sh = document.documentElement.scrollHeight - window.innerHeight;
  var pc = sh > 0 ? Math.min(1, window.scrollY / sh) : 0;
  if (S.ring) S.ring.style.strokeDashoffset = String(R * (1 - pc));
  var last = +d.getAttribute('data-last') || 0, now = window.scrollY;
  if (CFG.D.hideOnScrollDown !== false && document.querySelector('.post-content')) {
    if (now < 80) { d.classList.add('visible'); d.classList.remove('scroll-hide'); }
    else if (now > last + 12) { d.classList.remove('visible'); d.classList.add('scroll-hide'); }
    else if (now < last - 12) { d.classList.add('visible'); d.classList.remove('scroll-hide'); }
  }
  d.setAttribute('data-last', String(now));
}

function bind() {
  var F = window.__FEATURES__ || {};
  CFG.RP = (F && F.readingProgress) || {};
  CFG.BT = (F && F.backToTop) || {};
  CFG.D = (F && F.readDock) || {};
  document.querySelectorAll('.reading-mode-btn').forEach(function (b) { b.addEventListener('click', toggleReadingMode); });

  // 阅读进度条
  S.bar = CFG.RP.enabled === false ? null : document.getElementById('rp');
  S.tip = null; S.dot = null; S.hoverOn = false; S.focusOn = false;
  if (S.tipTimer) { clearTimeout(S.tipTimer); S.tipTimer = 0; }
  if (S.bar && CFG.RP.articleOnly && !document.querySelector('.post-article')) S.bar = null;
  if (S.bar) {
    S.tip = document.getElementById('rpTip');
    S.dot = document.getElementById('rpDot');
    S.ariaOn = CFG.RP.ariaAnnounce !== false;
    if (S.ariaOn) { S.bar.setAttribute('aria-valuemin', '0'); S.bar.setAttribute('aria-valuemax', '100'); }
    if (CFG.RP.showTip === false && S.tip) S.tip.style.display = 'none';
    if (CFG.RP.clickToJump !== false) {
      S.bar.classList.add('enabled');
      S.bar.setAttribute('tabindex', '0');
      S.bar.addEventListener('click', function (e) {
        if (e.detail === 0) return;
        var r = S.bar.getBoundingClientRect();
        seekPct((e.clientY - r.top) / r.height);
      });
      S.bar.addEventListener('pointerenter', function () { S.hoverOn = true; showTip(); });
      S.bar.addEventListener('pointerleave', function () { S.hoverOn = false; hideTip(); });
      S.bar.addEventListener('focus', function () { S.focusOn = true; showTip(); });
      S.bar.addEventListener('blur', function () { S.focusOn = false; hideTip(); });
      S.bar.addEventListener('keydown', function (e) {
        var sh = document.documentElement.scrollHeight - window.innerHeight;
        if (sh <= 0) return;
        var step = 0.05, cur = window.scrollY / sh;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); seekPct(cur + step); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); seekPct(cur - step); }
        else if (e.key === 'Home') { e.preventDefault(); seekPct(0); }
        else if (e.key === 'End') { e.preventDefault(); seekPct(1); }
      });
    }
    S.bar.classList.add('visible');
  }
  lastW = -1;
  updateProgress();

  // 返回顶部
  S.btt = CFG.BT.enabled === false ? null : document.getElementById('btt');
  if (S.btt) {
    S.btt.addEventListener('click', scrollToTop);
    updateBtt();
  }

  // 阅读悬浮坞
  S.dock = CFG.D.enabled === false ? null : document.getElementById('readDock');
  if (S.dock && !document.querySelector('.post-article')) S.dock = null;
  if (S.dock && CFG.D.showProgressRing === false && CFG.D.showTocButton === false && CFG.D.showTopButton === false) S.dock = null;
  if (S.dock) {
    S.ring = document.getElementById('dockFg');
    S.dockToc = document.getElementById('dockToc');
    S.dockTop = document.getElementById('dockTop');
    if (CFG.D.showProgressRing === false && S.ring) { var rw = S.ring.closest('.dock-ring'); if (rw) rw.style.display = 'none'; }
    if (CFG.D.showTocButton === false && S.dockToc) S.dockToc.style.display = 'none';
    if (CFG.D.showTopButton === false && S.dockTop) S.dockTop.style.display = 'none';
    S.dock.classList.add('visible');
    if (S.dockTop) S.dockTop.addEventListener('click', scrollToTop);
    if (S.dockToc) S.dockToc.onclick = function () {
      var t = document.querySelector('.toc-sidebar');
      if (t && window.getComputedStyle(t).display !== 'none') { t.scrollIntoView({ behavior: window.__SB(), block: 'start' }); }
      else { var mt = document.querySelector('.m-toc-drawer'); if (mt) { mt.classList.add('open'); } else { window.scrollTo({ top: 0, behavior: window.__SB() }); } }
    };
    updateDock();
  }
}

function bindGlobals() {
  if (globalBound) return;
  globalBound = true;
  window.addEventListener('scroll', function () {
    updateBtt();
    if (progTimer) return;
    var iv = Math.max(1, isNaN(+CFG.RP.updateThrottleMs) ? 30 : +CFG.RP.updateThrottleMs);
    progTimer = setTimeout(function () { progTimer = null; updateProgress(); }, iv);
  }, { passive: true });
  window.addEventListener('scroll', function () {
    if (dockRaf) return;
    dockRaf = window.requestAnimationFrame(function () { dockRaf = 0; updateDock(); });
  }, { passive: true });
  document.addEventListener('keydown', function (e) {
    var hk = CFG.BT.hotkey;
    if (!hk) return;
    var t = e.target;
    var inField = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
    if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.toLowerCase() === String(hk).toLowerCase()) { e.preventDefault(); scrollToTop(); }
  });
  // 用户主动滚动时取消返回顶部动画（rAF 帧检测 id 失效即停）。
  window.addEventListener('wheel', function () { bttAnim++; }, { passive: true });
  window.addEventListener('touchstart', function () { bttAnim++; }, { passive: true });
}

export function init() {
  window.toggleReadingMode = toggleReadingMode;
  bind();
  bindGlobals();
  window.__SOFTNAV_HOOKS__.push(bind);
}
