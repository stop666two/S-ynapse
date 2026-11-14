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

// 移动端浮动目录块（按钮 + 抽屉）必须与当前内容同源。模板只在首屏按 article.toc
// 渲染它，而且位于 .content-wrapper 之外——软导航只替换内容区，于是文章→首页残留上一页章节、
// 首页→文章则完全没有入口。这里按当前内容区的 .toc-sidebar-list 重建/移除该块（数据源与桌面
// 侧栏同一份章节列表），交互用 onclick/data-bound 幂等重绑。
function syncMobileToc(off) {
  var btn = document.getElementById('mTocBtn');
  var dr = document.getElementById('mTocDrawer');
  var list = document.querySelector('.toc-sidebar-list');
  var items = [];
  if (!off && S.MT.enabled !== false && list) {
    var links = list.querySelectorAll('.toc-sidebar-link');
    for (var i = 0; i < links.length; i++) {
      var lk = links[i];
      var href = lk.getAttribute('href') || '';
      if (href.charAt(0) !== '#') continue;
      items.push({
        href: href,
        text: String(lk.textContent || '').replace(/^\s+|\s+$/g, ''),
        level: +((String(lk.className).match(/level-(\d)/) || [])[1]) || 2
      });
    }
  }
  if (!items.length) {
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    if (dr && dr.parentNode) dr.parentNode.removeChild(dr);
    return;
  }
  var T = typeof window.__T === 'function' ? window.__T : function (k, d) { return d || k; };
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'm-toc-btn';
    btn.id = 'mTocBtn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('data-i18n-aria', 'toolbar.tocToggle');
    btn.setAttribute('data-i18n-title', 'toolbar.tocToggle');
    btn.setAttribute('aria-label', T('toolbar.tocToggle', '目录'));
    btn.setAttribute('title', T('toolbar.tocToggle', '目录'));
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="4.5" cy="5.5" r="1.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="4.5" cy="18.5" r="1.5"/><line x1="9" y1="5.5" x2="20" y2="5.5"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18.5" x2="20" y2="18.5"/></svg><span class="m-toc-label" id="mTocLabel"></span><span class="m-toc-pct" id="mTocPct"></span>';
    document.body.appendChild(btn);
  }
  if (!dr) {
    dr = document.createElement('div');
    dr.className = 'm-toc-drawer';
    dr.id = 'mTocDrawer';
    dr.setAttribute('role', 'dialog');
    dr.setAttribute('aria-modal', 'true');
    dr.setAttribute('aria-label', T('toolbar.tocDrawer', '文章目录'));
    var head = document.createElement('div');
    head.className = 'm-toc-head';
    var title = document.createElement('span');
    title.setAttribute('data-i18n', 'sidebar.toc');
    title.textContent = T('sidebar.toc', '目录');
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'm-toc-close';
    closeBtn.id = 'mTocClose';
    closeBtn.setAttribute('aria-label', T('toolbar.close', '关闭'));
    closeBtn.setAttribute('title', T('toolbar.close', '关闭'));
    closeBtn.setAttribute('data-i18n-aria', 'toolbar.close');
    closeBtn.setAttribute('data-i18n-title', 'toolbar.close');
    closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    head.appendChild(title);
    head.appendChild(closeBtn);
    var listEl = document.createElement('nav');
    listEl.className = 'm-toc-list';
    dr.appendChild(head);
    dr.appendChild(listEl);
    document.body.appendChild(dr);
  }
  // 章节列表按当前页重建：同一节点反复导航时不得残留上一页的锚点。
  var nav = dr.querySelector('.m-toc-list');
  if (nav) {
    nav.textContent = '';
    items.forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'm-toc-item level-' + it.level;
      var a = document.createElement('a');
      a.href = it.href;
      a.textContent = it.text;
      row.appendChild(a);
      nav.appendChild(row);
    });
  }
  // 换页后抽屉/按钮回到收起态（上一页可能停在展开态）；只在确实处于展开态时解除滚动锁，
  // 避免把其它浮层（如灯箱）临时设置的 body overflow 一并清掉。
  if (dr.classList.contains('open') && S.MT.lockScroll !== false && document.body) document.body.style.overflow = '';
  dr.classList.remove('open');
  btn.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
  function open() {
    dr.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('open');
    if (S.MT.lockScroll !== false && document.body) document.body.style.overflow = 'hidden';
  }
  function close() {
    dr.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('open');
    if (S.MT.lockScroll !== false && document.body) document.body.style.overflow = '';
  }
  S.mtClose = close;
  btn.onclick = function () { if (dr.classList.contains('open')) close(); else open(); };
  var mc = document.getElementById('mTocClose');
  if (mc) mc.onclick = close;
  if (dr.getAttribute('data-mt-bound') !== '1') {
    dr.setAttribute('data-mt-bound', '1');
    dr.addEventListener('click', function (e) { if (S.MT.autoClose !== false && e.target.closest('a')) close(); });
  }
}

function bind() {
  var F = window.__FEATURES__ || {};
  S.T = (F && F.toc) || {};
  S.TSS = (F && F.tocScrollSpy) || {};
  S.MT = (F && F.mobileToc) || {};
  S.d = null; S.links = []; S.ids = []; S.headingEls = []; S.mgLabel = null; S.mgPct = null;
  var off = S.T.enabled === false || S.TSS.enabled === false;
  syncMobileToc(off);
  if (off) return;
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

  // 快捷键帮助（元素可能不在本页，按 id 取到则绑定）；移动端抽屉的交互统一由 syncMobileToc 负责
  // （该块不在本函数的数据链路上，且需要每次按当前内容区重建）。
  var h = document.getElementById('kbdHelp');
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
