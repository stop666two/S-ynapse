// 打赏弹层：开合按钮随文章内容交换而重建；文档级监听器只绑定一次，弹层元素实时按 id 查询。
var globalBound = false;

function bind() {
  (function () {
    var ov = document.querySelector('[data-reward-open]');
    if (!ov) return;
    var openers = document.querySelectorAll('[data-reward-open]');
    openers.forEach(function (b) {
      b.addEventListener('click', function () {
        var overlay = document.getElementById('rewardOverlay');
        if (overlay) overlay.hidden = false;
      });
    });
  })();
  if (globalBound) return;
  globalBound = true;
  document.addEventListener('click', function (e) {
    var overlay = document.getElementById('rewardOverlay');
    var c = e.target.closest('[data-reward-close]');
    if (c && overlay) { overlay.hidden = true; return; }
    if (overlay && e.target === overlay) overlay.hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    var overlay = document.getElementById('rewardOverlay');
    if (e.key === 'Escape' && overlay && !overlay.hidden) overlay.hidden = true;
  });
}

export function init() {
  bind();
  window.__SOFTNAV_HOOKS__.push(bind);
}
