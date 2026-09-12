export function init() {
  (function () {
    var F = window.__FEATURES__ || {}, T = (F && F.toc) || {}, TSS = (F && F.tocScrollSpy) || {};
    if (T.enabled === false || TSS.enabled === false) return;
    var cls = TSS.activeClass || 'active';
    var d = document.querySelector('.toc-sidebar-list');
    if (!d) return;
    var tg = document.getElementById('tocToggle');
    var TNT = (window.__TUNING__ || {}).toc || {};
    if (tg && T.collapsible !== false) {
      tg.onclick = function () {
        var open = !d.classList.contains('collapsed');
        d.classList.toggle('collapsed', open);
        tg.setAttribute('aria-expanded', (!open) ? 'true' : 'false');
        tg.classList.toggle('rotated', open);
      };
    }
    if (String(TNT.collapsedByDefault) === 'true') { d.classList.add('collapsed'); if (tg) tg.setAttribute('aria-expanded', 'false'); }
    var off = isNaN(+TNT.scrollOffset) ? (isNaN(+TSS.offset) ? (isNaN(+T.activeOffset) ? 120 : +T.activeOffset) : +TSS.offset) : +TNT.scrollOffset;
    var links = d.querySelectorAll('.toc-sidebar-link');
    var ids = [];
    links.forEach(function (l) { var h = l.getAttribute('href'); if (h && h[0] === '#') ids.push(h.slice(1)); });
    if (!ids.length) return;
    function update() {
      var cur = '';
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el && el.getBoundingClientRect().top < off) cur = ids[i];
      }
      links.forEach(function (l) {
        var h = l.getAttribute('href');
        l.classList.toggle(cls, h === '#' + cur);
        if (T.visitedFade !== false) l.classList.toggle('visited', h !== '#' + cur && h !== '#' + ids[0] && l.hasAttribute('data-seen'));
      });
      if (T.progressLine !== false) {
        var pr = document.getElementById('tocProgress');
        if (pr && pr.firstChild) {
          var sh = document.documentElement.scrollHeight - window.innerHeight;
          pr.firstChild.style.width = (sh > 0 ? Math.min(100, (window.scrollY / sh) * 100) : 0) + '%';
        }
      }
    }
    window.addEventListener('scroll', update);
    update();
    links.forEach(function (l) {
      l.addEventListener('click', function () {
        l.setAttribute('data-seen', '1');
        if (T.updateUrl !== false && history && history.replaceState) history.replaceState(null, '', l.getAttribute('href'));
      });
    });
  })();
  (function () {
    var h = document.getElementById('kbdHelp'), btn = document.getElementById('mTocBtn'), dr = document.getElementById('mTocDrawer');
    if (btn && dr) {
      function open() { dr.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open'); }
      function close() { dr.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.classList.remove('open'); }
      btn.onclick = function () { dr.classList.contains('open') ? close() : open(); };
      document.getElementById('mTocClose').onclick = close;
      dr.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var m = dr;
        if (m) m.classList.remove('open');
        if (h) h.classList.remove('open');
        if (btn) btn.classList.remove('open');
      }
    });
    if (h) {
      document.addEventListener('click', function (e) {
        if (h.classList.contains('open') && !e.target.closest('#kbdHelp')) h.classList.remove('open');
      });
    }
  })();
}
