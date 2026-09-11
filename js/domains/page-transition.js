export function init() {
  (function () {
    var F = window.__FEATURES__ || {}, PT = (F && F.pageTransition) || {};
    if (PT.enabled === false) return;
    if (PT.respectReducedMotion !== false && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var OUT = isNaN(+PT.outDurationMs) ? 120 : +PT.outDurationMs;
    var EX = PT.excludeSelector || '[data-no-transition]';
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a');
      if (!a) return;
      if (EX && a.closest(EX)) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('javascript:') === 0 || a.target === '_blank' || a.hasAttribute('download')) return;
      var u;
      try { u = new URL(href, location.href); } catch (err) { return; }
      if (u.origin !== location.origin) return;
      if (u.pathname === location.pathname) return;
      e.preventDefault();
      document.documentElement.classList.add('page-leaving');
      setTimeout(function () { location.href = u.href; }, OUT);
    });
  })();
}
