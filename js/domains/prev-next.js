export function init() {
  document.addEventListener('click', function (e) {
    var l = e.target.closest('.post-nav-link');
    if (!l) return;
    var F = window.__FEATURES__ || {}, PN = (F && F.prevNext) || {};
    if (PN.scrollToTopOnClick === false) return;
    window.scrollTo(0, 0);
  });
}
