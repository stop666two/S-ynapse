// 评论区占位：软导航交换 DOM 后重新观察新的占位节点；旧观察器与定时器先清理。
var obs = null, timer = null;

function bind() {
  if (obs) { obs.disconnect(); obs = null; }
  if (timer) { clearTimeout(timer); timer = null; }
  var F = window.__FEATURES__ || {}, CM = (F && F.comments) || {};
  var dl = isNaN(+CM.loadDelayMs) ? 300 : +CM.loadDelayMs;
  var ph = document.getElementById('commentsPlaceholder');
  if (!ph) return;
  var sec = ph.parentElement, done = false;
  function has() {
    return !!(sec && (sec.querySelector('iframe') || sec.querySelector('.giscus') || (sec.querySelector('#disqus_thread') && sec.querySelector('#disqus_thread').innerHTML.trim())));
  }
  function settle() {
    if (!has()) return false;
    done = true;
    ph.textContent = '';
    ph.classList.add('placeholder-done');
    if (obs) { obs.disconnect(); obs = null; }
    return true;
  }
  if (window.MutationObserver && sec) {
    obs = new MutationObserver(function () { settle(); });
    obs.observe(sec, { childList: true, subtree: true });
  }
  timer = setTimeout(function () {
    if (!done && !settle()) {
      var __en = (document.documentElement.getAttribute('data-lang') || ((document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'zh')) === 'en';
      ph.textContent = (__en && CM.emptyTextEn) ? CM.emptyTextEn : (CM.emptyText || '暂无评论');
      ph.classList.add('placeholder-done');
    }
  }, dl);
}

export function init() {
  bind();
  window.__SOFTNAV_HOOKS__.push(bind);
}
