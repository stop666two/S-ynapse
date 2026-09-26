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
  var hl = S.T.highlightActive !== false;
  S.links.forEach(function (l) {
    var h = l.getAttribute('href');
    l.classList.toggle(cls, hl && h === '#' + cur);
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
  var _cbd = String(TNT.collapsedByDefault) === 'true';
  if (_cbd) { d.classList.add('collapsed'); if (tg) tg.setAttribute('aria-expanded', 'false'); }
  // features.toc.defaultOpenLevel：0=全折叠（列表收起）；N≥1 → 可见最大标题级=minLevel+N-1
  // （默认 2 且 minLevel=2 → 展开到 h3，h4 初始折叠；tuning.collapsedByDefault 优先级更高）。
  var _dl = +S.T.defaultOpenLevel; if (isNaN(_dl) || _dl < 0) _dl = 2;
  var _minLv = isNaN(+S.T.minLevel) ? 2 : Math.max(1, Math.floor(+S.T.minLevel));
  var _visibleMax = _dl === 0 ? 0 : _minLv + Math.floor(_dl) - 1;
  if (_dl === 0 && !_cbd && S.T.collapsible !== false) { d.classList.add('collapsed'); if (tg) tg.setAttribute('aria-expanded', 'false'); }
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
        g.children.forEach(function (ch) { ch.classList.toggle('toc-child-hidden', c); ch.classList.remove('toc-depth-hidden'); });
      };
      g.li.appendChild(b);
      // defaultOpenLevel 初态：超出可见层级的子项折叠/隐藏（默认 2 → h4 隐藏；≤1 → h3+ 整组折叠）。
      if (!_cbd && _dl > 0) {
        var deep = [];
        g.children.forEach(function (ch) {
          var lk = ch.querySelector('.toc-sidebar-link');
          var lv = lk ? +((lk.className.match(/level-(\d)/) || [])[1]) : 0;
          if (lv > _visibleMax) deep.push(ch);
        });
        if (deep.length && deep.length === g.children.length) {
          g.li.classList.add('collapsed');
          b.setAttribute('aria-expanded', 'false');
          deep.forEach(function (ch) { ch.classList.add('toc-child-hidden'); });
        } else {
          deep.forEach(function (ch) { ch.classList.add('toc-depth-hidden'); });
        }
      }
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
    function open() { dr.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open'); if (S.MT.lockScroll !== false) document.body.style.overflow = 'hidden'; }
    function close() { dr.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.classList.remove('open'); if (S.MT.lockScroll !== false) document.body.style.overflow = ''; }
    S.mtClose = close;
    btn.onclick = function () { dr.classList.contains('open') ? close() : open(); };
    var mc = document.getElementById('mTocClose');
    if (mc) mc.onclick = close;
    dr.addEventListener('click', function (e) { if (S.MT.autoClose !== false && e.target.closest('a')) close(); });
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
    if (dr && dr.classList.contains('open')) { dr.classList.remove('open'); if (S.MT.lockScroll !== false) document.body.style.overflow = ''; }
    if (h) { h.classList.remove('open'); var hb2 = document.getElementById('kbdHintBtn'); if (hb2) hb2.setAttribute('aria-expanded', 'false'); }
    if (btn) btn.classList.remove('open');
  });
  document.addEventListener('click', function (e) {
    var h = document.getElementById('kbdHelp');
    if (h && h.classList.contains('open') && !e.target.closest('#kbdHelp') && !e.target.closest('#kbdHintBtn')) {
      h.classList.remove('open');
      var hb = document.getElementById('kbdHintBtn');
      if (hb) hb.setAttribute('aria-expanded', 'false');
    }
    var dr = document.getElementById('mTocDrawer');
    if (!dr || !dr.classList.contains('open')) return;
    if (S.MT.overlayClose === false) return;
    if (e.target.closest('.m-toc-drawer') || e.target.closest('#mTocBtn')) return;
    dr.classList.remove('open');
    var btn = document.getElementById('mTocBtn');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.classList.remove('open'); }
    if (S.MT.lockScroll !== false) document.body.style.overflow = '';
  });
}

export function init() {
  bind();
  bindGlobals();
  window.__SOFTNAV_HOOKS__.push(bind);
}
