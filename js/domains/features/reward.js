// 打赏弹层：开合按钮随文章内容交换而重建；文档级监听器只绑定一次，弹层元素实时按 id 查询。
// W4 接线：features.reward.closeByBtn/closeByOverlay/closeByEsc 三个关闭路径各自门控（默认 true=现行为）。
var globalBound = false;

function closeCfg() {
  var F = window.__FEATURES__ || {};
  return (F && F.reward) || {};
}

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
    if (!overlay) return;
    var cfg = closeCfg();
    var c = e.target.closest('[data-reward-close]');
    if (c) { if (cfg.closeByBtn !== false) overlay.hidden = true; return; }
    if (e.target === overlay && cfg.closeByOverlay !== false) overlay.hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    var overlay = document.getElementById('rewardOverlay');
    if (e.key !== 'Escape' || !overlay || overlay.hidden) return;
    if (closeCfg().closeByEsc !== false) overlay.hidden = true;
  });
}

export function init() {
  bind();
  window.__SOFTNAV_HOOKS__.push(bind);
}
