// 目录（TOC）侧栏与移动端抽屉：软导航交换 DOM 后由 bind() 重新指向新节点；
// 文档级监听器只绑定一次，事件内按 id 实时取元素，避免持有过期引用。
var S = { d: null, links: [], ids: [], headingEls: [], mgLabel: null, mgPct: null, off: 120, T: {}, TSS: {}, MT: {} };
var ticking = false, globalBound = false;

function update() {
  if (!S.links.length) return;
  var cur = '';
  var tops = [];
  for (var i = 0; i < S.headingEls.length; i++) {
    var el = S.headingEls[i];
    tops.push(el ? el.getBoundingClientRect().top : Infinity);
  }
  for (i = 0; i < tops.length; i++) { if (tops[i] < S.off) cur = S.ids[i]; }
  var sh0 = document.documentElement.scrollHeight - window.innerHeight;
  var y = window.scrollY;
  var pct0 = sh0 > 0 ? Math.min(1, y / sh0) : 0;
  var cls = S.TSS.activeClass || 'active';
  S.links.forEach(function (l) {
    var h = l.getAttribute('href');
    l.classList.toggle(cls, h === '#' + cur);
    if (S.T.visitedFade !== false) l.classList.toggle('visited', h !== '#' + cur && h !== '#' + S.ids[0] && l.hasAttribute('data-seen'));
  });
  if (S.mgLabel && S.MT.showCurrent !== false) {
    var curLink = null;
    S.links.forEach(function (l) { if (l.getAttribute('href') === '#' + cur) curLink = l; });
    S.mgLabel.textContent = curLink ? curLink.textContent : '';
    if (S.mgPct) S.mgPct.textContent = Math.round(pct0 * 100) + '%';
  }
  if (S.T.progressLine !== false) {
    var pr = document.getElementById('tocProgress');
    if (pr && pr.firstChild) {
      pr.firstChild.style.width = (sh0 > 0 ? Math.min(100, (y / sh0) * 100) : 0) + '%';
    }
  }
}

function bind() {
  var F = window.__FEATURES__ || {};
  S.T = (F && F.toc) || {};
  S.TSS = (F && F.tocScrollSpy) || {};
  S.MT = (F && F.mobileToc) || {};
  S.d = null; S.links = []; S.ids = []; S.headingEls = []; S.mgLabel = null; S.mgPct = null;
  if (S.T.enabled === false || S.TSS.enabled === false) return;
  var d = document.querySelector('.toc-sidebar-list');
  if (!d) return;
  if (d.dataset.tocBound === '1') return;
  d.dataset.tocBound = '1';
  S.d = d;
  var tg = document.getElementById('tocToggle');
  var TNT = (window.__TUNING__ || {}).toc || {};
  if (tg && S.T.collapsible !== false) {
    tg.onclick = function () {
      var open = !d.classList.contains('collapsed');
      d.classList.toggle('collapsed', open);
      tg.setAttribute('aria-expanded', (!open) ? 'true' : 'false');
      tg.classList.toggle('rotated', open);
    };
  }
  if (String(TNT.collapsedByDefault) === 'true') { d.classList.add('collapsed'); if (tg) tg.setAttribute('aria-expanded', 'false'); }
  S.off = isNaN(+TNT.scrollOffset) ? (isNaN(+S.TSS.offset) ? (isNaN(+S.T.activeOffset) ? 120 : +S.T.activeOffset) : +S.TSS.offset) : +TNT.scrollOffset;
  S.links = Array.prototype.slice.call(d.querySelectorAll('.toc-sidebar-link'));
  S.links.forEach(function (l) { var h = l.getAttribute('href'); if (h && h[0] === '#') S.ids.push(h.slice(1)); });
  if (!S.ids.length) { S.links = []; return; }
  S.mgLabel = document.getElementById('mTocLabel');
  S.mgPct = document.getElementById('mTocPct');
  if (S.T.groupCollapse !== false) {
    var groups = [], head = null;
    S.links.forEach(function (l) {
      var li = l.closest('.toc-sidebar-item');
      if (!li) return;
      if (l.classList.contains('level-2')) { head = { li: li, children: [], btn: null }; groups.push(head); }
      else if (l.classList.contains('level-3') && head) { head.children.push(li); }
    });
    groups.forEach(function (g) {
      if (!g.children.length) return;
      g.li.classList.add('has-group');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'toc-group-toggle';
      b.setAttribute('aria-expanded', 'true');
      b.setAttribute('aria-label', '折叠/展开该章节');
      b.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg>';
      b.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var c = g.li.classList.toggle('collapsed');
        b.setAttribute('aria-expanded', c ? 'false' : 'true');
        g.children.forEach(function (ch) { ch.classList.toggle('toc-child-hidden', c); });
      };
      g.li.appendChild(b);
    });
  }
  S.headingEls = S.ids.map(function (id) { return document.getElementById(id); });
  update();
  S.links.forEach(function (l) {
    l.addEventListener('click', function () {
      l.setAttribute('data-seen', '1');
      if (S.T.updateUrl !== false && history && history.replaceState) history.replaceState(null, '', l.getAttribute('href'));
    });
  });

  // 移动端抽屉与快捷键帮助（元素可能不在本页，按 id 取到则绑定）
  var h = document.getElementById('kbdHelp'), btn = document.getElementById('mTocBtn'), dr = document.getElementById('mTocDrawer');
  if (btn && dr) {
    function open() { dr.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open'); }
    function close() { dr.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.classList.remove('open'); }
    btn.onclick = function () { dr.classList.contains('open') ? close() : open(); };
    var mc = document.getElementById('mTocClose');
    if (mc) mc.onclick = close;
    dr.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
  }
  if (h) {
    h.dataset.tocBound = '1';
  }
}

function bindGlobals() {
  if (globalBound) return;
  globalBound = true;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }, { passive: true });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var dr = document.getElementById('mTocDrawer'), h = document.getElementById('kbdHelp'), btn = document.getElementById('mTocBtn');
    if (dr) dr.classList.remove('open');
    if (h) h.classList.remove('open');
    if (btn) btn.classList.remove('open');
  });
  document.addEventListener('click', function (e) {
    var h = document.getElementById('kbdHelp');
    if (h && h.classList.contains('open') && !e.target.closest('#kbdHelp')) h.classList.remove('open');
  });
}

export function init() {
  bind();
  bindGlobals();
  window.__SOFTNAV_HOOKS__.push(bind);
}
