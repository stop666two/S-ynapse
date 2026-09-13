export function toggleReadingMode() {
  var d = document.documentElement;
  var a = d.getAttribute('data-reading');
  if (a === 'true') { d.removeAttribute('data-reading'); try { localStorage.setItem('readingMode', 'false'); } catch (e) {} }
  else { d.setAttribute('data-reading', 'true'); try { localStorage.setItem('readingMode', 'true'); } catch (e) {} }
}

export function init() {
  window.toggleReadingMode = toggleReadingMode;
  (function () {
    var F = window.__FEATURES__ || {}, RP = (F && F.readingProgress) || {};
    if (RP.enabled === false) return;
    var bar = document.getElementById('rp'), tip = document.getElementById('rpTip'), dot = document.getElementById('rpDot');
    if (!bar) return;
    if (RP.articleOnly && !document.querySelector('.post-article')) return;
    if (RP.showTip === false && tip) tip.style.display = 'none';
    if (RP.clickToJump !== false) {
      bar.classList.add('enabled');
      bar.addEventListener('click', function (e) {
        var sh = document.documentElement.scrollHeight - window.innerHeight;
        if (sh <= 0) return;
        var r = bar.getBoundingClientRect();
        window.scrollTo({ top: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) * sh, behavior: window.__SB() });
      });
    }
    var last = -1;
    function update() {
      var sh = document.documentElement.scrollHeight - window.innerHeight;
      var pc = sh > 0 ? Math.min(1, window.scrollY / sh) : 0;
      var w = Math.round(pc * 100);
      if (w === last) return;
      last = w;
      bar.style.width = w + '%';
      if (tip) tip.textContent = w + '%';
      if (dot) dot.style.left = w + '%';
    }
    var iv = Math.max(1, isNaN(+RP.updateThrottleMs) ? 30 : +RP.updateThrottleMs);
    var tm = null;
    window.addEventListener('scroll', function () { if (tm) return; tm = setTimeout(function () { tm = null; update(); }, iv); }, { passive: true });
    bar.classList.add('visible');
    update();
  })();
  (function () {
    var F = window.__FEATURES__ || {}, BT = (F && F.backToTop) || {};
    if (BT.enabled === false) return;
    var b = document.getElementById('btt');
    if (!b) return;
    var px = isNaN(+BT.showAfterPx) ? 400 : +BT.showAfterPx;
    function upd() { if (window.scrollY > px) { b.classList.add('visible'); } else { b.classList.remove('visible'); } }
    window.addEventListener('scroll', upd, { passive: true });
    upd();
    if (BT.hotkey) {
      var hk = String(BT.hotkey);
      document.addEventListener('keydown', function (e) {
        var t = e.target;
        var inField = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
        if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.toLowerCase() === hk.toLowerCase()) { e.preventDefault(); window.scrollTo({ top: 0, behavior: BT.smoothScroll === false ? 'auto' : window.__SB() }); }
      });
    }
  })();
  (function () {
    var F = window.__FEATURES__ || {}, D = (F && F.readDock) || {};
    if (D.enabled === false) return;
    var d = document.getElementById('readDock'), ring = document.getElementById('dockFg'), toc = document.getElementById('dockToc'), top = document.getElementById('dockTop');
    if (!d) return;
    if (!document.querySelector('.post-article')) return;
    d.classList.add('visible');
    var R = 100.5;
    function updat() {
      var sh = document.documentElement.scrollHeight - window.innerHeight;
      var pc = sh > 0 ? Math.min(1, window.scrollY / sh) : 0;
      if (ring) ring.style.strokeDashoffset = String(R * (1 - pc));
      var last = +d.getAttribute('data-last') || 0, now = window.scrollY;
      if (D.hideOnScrollDown !== false && document.querySelector('.post-content')) {
        if (now < 80) { d.classList.add('visible'); d.classList.remove('scroll-hide'); }
        else if (now > last + 12) { d.classList.remove('visible'); d.classList.add('scroll-hide'); }
        else if (now < last - 12) { d.classList.add('visible'); d.classList.remove('scroll-hide'); }
      }
      d.setAttribute('data-last', String(now));
    }
    window.addEventListener('scroll', updat, { passive: true });
    updat();
    if (top) top.onclick = function () { window.scrollTo({ top: 0, behavior: window.__SB() }); };
    if (toc) toc.onclick = function () {
      var t = document.querySelector('.toc-sidebar');
      if (t && window.getComputedStyle(t).display !== 'none') { t.scrollIntoView({ behavior: window.__SB(), block: 'start' }); }
      else { var mt = document.querySelector('.m-toc-drawer'); if (mt) { mt.classList.add('open'); } else { window.scrollTo({ top: 0, behavior: window.__SB() }); } }
    };
  })();
}
