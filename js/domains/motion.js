export function init() {
  (function () {
    var F = window.__FEATURES__ || {}, M = F.motion || {};
    var TM = (window.__TUNING__ || {}).motion || {};
    var pick = function (k1, k2) { var v = TM[k1]; return v !== undefined && v !== '' && v !== null ? v : M[k2]; };
    if (M.enabled === false) return;
    var RM = M.reducedMotion;
    if (RM === undefined) RM = M.respectReducedMotion === false ? 'full' : 'light';
    if (RM === true) RM = 'light'; else if (RM === false) RM = 'full';
    var _sysR = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var _eff = _sysR ? RM : 'full';
    if (_eff === 'off') return;
    var lift = pick('hoverLiftPx', 'cardHoverLiftPx') || 4;
    document.documentElement.style.setProperty('--mh-lift', lift + 'px');
    document.documentElement.style.setProperty('--mh-under', pick('underlineThickness', 'linkUnderlineThickness') || '2px');
    var sc = +pick('hoverScale', 'cardHoverScale');
    document.documentElement.style.setProperty('--mh-scale', isNaN(sc) ? 1.02 : sc);
    document.documentElement.style.setProperty('--mh-under-offset', pick('underlineOffset', 'linkUnderlineOffset') || '3px');
    document.documentElement.style.setProperty('--mh-ripple', (+pick('rippleDurationMs', 'rippleDurationMs') || 500) + 'ms');
    document.documentElement.style.setProperty('--mh-dur', (+pick('revealDurationMs', 'revealDurationMs') || 250) + 'ms');
    document.documentElement.style.setProperty('--mh-offset', pick('revealOffset', 'revealOffset') || '10px');
    if (_eff === 'light') {
      document.documentElement.setAttribute('data-mrm', 'light');
      var _d0 = +pick('revealDurationMs', 'revealDurationMs') || 250;
      document.documentElement.style.setProperty('--mh-dur', Math.min(_d0, 160) + 'ms');
      document.documentElement.style.setProperty('--mh-offset', '6px');
      document.documentElement.style.setProperty('--mh-lift', Math.min(lift, 2) + 'px');
      document.documentElement.style.setProperty('--mh-ripple', Math.min((+pick('rippleDurationMs', 'rippleDurationMs') || 500), 300) + 'ms');
    }
    var stagger = +pick('staggerDelayMs', 'revealDelayMs') || 0;
    function boot() {
      var it = window.location.pathname.replace(/\/index\.html$/, '/');
      document.querySelectorAll('header .nav-link').forEach(function (a) {
        var href = a.getAttribute('href') || '';
        if (!href || href.indexOf('#') === 0 || href.indexOf('http') === 0) return;
        var isHome = href === '/' || /^\/[a-z]{2}\/$/.test(href);
        var exact = it === href;
        var sub = !isHome && href.length > 1 && it.indexOf(href) === 0;
        if (exact || sub) { a.classList.add('nav-active'); }
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
          var once = M.revealOnce !== false;
          var th = +(M.revealThreshold);
          if (isNaN(th) || th < 0) th = 0;
          var io = new IntersectionObserver(function (es) {
            var batch = [];
            es.forEach(function (en) {
              if (en.isIntersecting) {
                batch.push(en.target);
                if (once) io.unobserve(en.target);
              }
            });
            batch.forEach(function (el, idx) {
              if (stagger > 0) {
                el.style.transitionDelay = (Math.min(idx, 8) * stagger) + 'ms';
                setTimeout(function () { el.style.transitionDelay = ''; }, 1400);
              }
              el.classList.add('in');
            });
          }, { threshold: th });
          els.forEach(function (x) { x.classList.add('motion-reveal'); io.observe(x); });
        }
      }
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
  })();
}
