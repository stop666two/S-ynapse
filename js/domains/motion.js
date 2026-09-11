export function init() {
  (function () {
    var F = window.__FEATURES__ || {}, M = F.motion || {};
    if (M.enabled === false) return;
    if (M.respectReducedMotion !== false && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var lift = M.cardHoverLiftPx || 4;
    document.documentElement.style.setProperty('--mh-lift', lift + 'px');
    document.documentElement.style.setProperty('--mh-under', (M.linkUnderlineThickness || '2px'));
    document.documentElement.style.setProperty('--mh-scale', (isNaN(+M.cardHoverScale) ? 1.02 : +M.cardHoverScale));
    document.documentElement.style.setProperty('--mh-under-offset', (M.linkUnderlineOffset || '3px'));
    document.documentElement.style.setProperty('--mh-ripple', (M.rippleDurationMs ? +M.rippleDurationMs : 500) + 'ms');
    document.documentElement.style.setProperty('--mh-dur', (M.revealDurationMs ? +M.revealDurationMs : 250) + 'ms');
    document.documentElement.style.setProperty('--mh-offset', M.revealOffset || '10px');
    function boot() {
      var it = window.location.pathname;
      document.querySelectorAll('header .nav-link').forEach(function (a) {
        var href = a.getAttribute('href') || '';
        if (!href || href.indexOf('#') === 0 || href.indexOf('http') === 0) return;
        if (href !== '/' && it.indexOf(href) === 0 || href === '/' && it === '/') { a.classList.add('nav-active'); }
      });
      if (M.linkUnderline !== false) {
        document.querySelectorAll('.post-content a,.post-card-title a,.widget a,.post-nav-link,.pagination a,.nav-menu a,.toc-sidebar-link').forEach(function (a) { a.classList.add('motion-underline'); });
      }
      if (M.cardHoverLift !== false) {
        document.querySelectorAll('.post-card,.related-post-card,.widget,.stats-card').forEach(function (c) { c.classList.add('motion-card-hover'); });
      }
      if (M.buttonRipple !== false) {
        document.addEventListener('pointerdown', function (e) {
          var b = e.target.closest('.btn,.share-btn,.reward-btn,.read-tts-btn,.reading-mode-btn,.dark-toggle,.search-toggle,.lb-btn');
          if (!b) return;
          var r = b.getBoundingClientRect(), sz = Math.max(r.width, r.height);
          var ink = document.createElement('span');
          ink.className = 'ripple-ink';
          ink.style.width = ink.style.height = sz + 'px';
          ink.style.left = (e.clientX - r.left - sz / 2) + 'px';
          ink.style.top = (e.clientY - r.top - sz / 2) + 'px';
          b.appendChild(ink);
          ink.addEventListener('animationend', function () { ink.remove(); });
        });
      }
      if (M.scrollReveal !== false) {
        var els = [];
        if (M.revealCards !== false) document.querySelectorAll('.post-card,.related-post-card').forEach(function (x) { els.push(x); });
        if (M.revealHeadings !== false) document.querySelectorAll('.post-content h2,.post-content h3').forEach(function (x) { els.push(x); });
        if (M.revealImages !== false) document.querySelectorAll('.post-content img,.post-card-image:not(.motion-reveal)').forEach(function (x) { els.push(x); });
        if (M.revealBlocks !== false) document.querySelectorAll('.post-content pre,.post-content blockquote,.post-content table').forEach(function (x) { els.push(x); });
        if (els.length) {
          var io = new IntersectionObserver(function (es) {
            es.forEach(function (en) {
              if (en.isIntersecting) {
                var d = +(M.revealDelayMs || 60);
                en.target.classList.add('in');
                io.unobserve(en.target);
              }
            });
          }, { threshold: 0 });
          els.forEach(function (x) { x.classList.add('motion-reveal'); io.observe(x); });
        }
      }
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
  })();
}
