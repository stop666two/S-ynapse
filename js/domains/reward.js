export function init() {
  (function () {
    var ov = document.querySelector('[data-reward-open]');
    if (!ov) return;
    var overlay = null;
    var openers = document.querySelectorAll('[data-reward-open]');
    openers.forEach(function (b) {
      b.addEventListener('click', function () {
        if (!overlay) overlay = document.getElementById('rewardOverlay');
        if (overlay) overlay.hidden = false;
      });
    });
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-reward-close]');
      if (c && overlay) { overlay.hidden = true; return; }
      if (overlay && e.target === overlay) overlay.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && !overlay.hidden) overlay.hidden = true;
    });
  })();
}
