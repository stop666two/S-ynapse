export function init() {
  (function () {
    var F = window.__FEATURES__ || {}, S = (F && F.shortcuts) || {};
    if (S.enabled === false) return;
    var kOpen = S.openSearch ? String(S.openSearch) : '';
    var kTheme = S.toggleTheme ? String(S.toggleTheme) : '';
    var kNext = S.nextPost ? String(S.nextPost) : '';
    var kPrev = S.prevPost ? String(S.prevPost) : '';
    var kHelp = S.help ? String(S.help) : '';
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key;
      if (k === kOpen && kOpen) { e.preventDefault(); window.openSearch(); }
      else if (k.toLowerCase() === kTheme.toLowerCase() && kTheme) { window.toggleDark(); }
      else if (k.toLowerCase() === kNext.toLowerCase() && kNext) { var n = document.querySelector('.post-nav-link.next'); if (n) n.click(); }
      else if (k.toLowerCase() === kPrev.toLowerCase() && kPrev) { var pv = document.querySelector('.post-nav-link.prev'); if (pv) pv.click(); }
      else if (k === kHelp && kHelp) { var h = document.getElementById('kbdHelp'); if (h) h.classList.toggle('open'); }
    });
  })();
}
