// 导航高亮 + 滑动指示器（自 motion.js 抽出，独立于 features.motion）。
// 设计约束：
//   - 高亮由构建期 SSR 兜底（layout.ejs 输出 nav-active / aria-current），本模块只做运行时维护；
//   - 即使 features.motion.enabled=false / reducedMotion='off'，本模块也必须运行：
//     软导航只交换 .content-wrapper，高亮需在交换后重算（__SOFTNAV_HOOKS__）；
//   - 指示器是纯增强：JS 不可用时 SSR 高亮不受影响；JS 可用时即使 motion 关闭也定位显示；
//   - 判定规则与构建期 scripts/lib/nav-match.js 同源（navPath/isNavActive 逐字等价，
//     改动需同步该文件与 scripts/nav-match.test.js）。
let navInd = null;

function navPath(url) {
  var p = String(url || '').replace(/\/index\.html$/, '/');
  if (p.length > 1 && p.charAt(p.length - 1) !== '/') p += '/';
  return p;
}

function isNavActive(pathname, href) {
  var h = String(href || '');
  if (!h || h.indexOf('#') === 0 || h.indexOf('http') === 0) return false;
  var it = navPath(pathname);
  var target = navPath(h);
  var isHome = target === '/' || /^\/[a-z]{2}\/$/.test(target);
  var exact = it === target;
  var sub = !isHome && target.length > 1 && it.indexOf(target) === 0;
  return exact || sub;
}

// SSR 模板已渲染 span.nav-indicator 时直接复用（避免重复节点）；缺失时才创建。
function ensureIndicator() {
  var nav = document.getElementById('mainNav');
  if (!nav) return null;
  if (navInd && navInd.parentNode === nav) return navInd;
  navInd = nav.querySelector('.nav-indicator');
  if (navInd) return navInd;
  navInd = document.createElement('span');
  navInd.className = 'nav-indicator';
  navInd.setAttribute('aria-hidden', 'true');
  nav.insertBefore(navInd, nav.firstChild);
  return navInd;
}

function syncNav() {
  var it = window.location.pathname;
  var active = null;
  document.querySelectorAll('header .nav-link').forEach(function (a) {
    a.classList.remove('nav-active');
    a.removeAttribute('aria-current');
    if (isNavActive(it, a.getAttribute('href'))) active = a;
  });
  if (active) {
    active.classList.add('nav-active');
    active.setAttribute('aria-current', 'page');
  }
  var ind = ensureIndicator();
  if (!ind) return;
  var toggle = document.getElementById('navToggle');
  var collapsed = toggle && getComputedStyle(toggle).display !== 'none';
  var nav = ind.parentNode;
  var ar = active && !collapsed ? active.getBoundingClientRect() : null;
  if (!ar || !ar.width) { ind.style.display = 'none'; return; }
  var nr = nav.getBoundingClientRect();
  ind.style.display = '';
  ind.style.width = ar.width + 'px';
  ind.style.height = ar.height + 'px';
  ind.style.transform = 'translate(' + Math.round(ar.left - nr.left) + 'px,' + Math.round(ar.top - nr.top) + 'px)';
  if (!ind.classList.contains('on')) {
    void ind.offsetWidth;
    ind.classList.add('on');
  }
}

function watchNav() {
  var nav = document.getElementById('mainNav');
  if (!nav) return;
  if (typeof ResizeObserver === 'function') {
    var ro = new ResizeObserver(function () { syncNav(); });
    ro.observe(nav);
  }
  window.addEventListener('resize', syncNav);
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(function () { syncNav(); });
  }
}

export function init() {
  function boot() {
    syncNav();
    watchNav();
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
  if (!Array.isArray(window.__SOFTNAV_HOOKS__)) window.__SOFTNAV_HOOKS__ = [];
  window.__SOFTNAV_HOOKS__.push(syncNav);
  window.addEventListener('popstate', function () { syncNav(); });
}
