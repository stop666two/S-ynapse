export function init() {
  var F = window.__FEATURES__ || {}, C = (F && F.cover) || {};
  if (C.enabled === false) return;
  var strip = document.querySelector('.cover-strip[data-article]');
  var img = document.querySelector('.post-featured-image');
  var initial = document.querySelector('.cover-render');
  if (!strip || (!img && !initial)) return;
  var patterns = (Array.isArray(C.patterns) && C.patterns.length) ? C.patterns : ['gradient', 'stripes', 'dots', 'blob', 'mesh'];
  var def = patterns.indexOf(C.defaultPattern) > -1 ? C.defaultPattern : patterns[0];
  function apply(pat) {
    var block = document.querySelector('.cover-render');
    if (!block) {
      block = document.createElement('div');
      block.setAttribute('role', 'img');
      var anchor = img || strip;
      anchor.parentNode.insertBefore(block, anchor);
    }
    var safe = String(pat).replace(/[^\w-]/g, '');
    block.className = 'cover-render cover-pattern-' + safe;
    block.setAttribute('aria-label', safe);
    block.style.display = '';
    if (img) img.style.display = 'none';
    strip.querySelectorAll('.cover-thumb').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-cover') === pat);
    });
  }
  function applyDefault() {
    // features.cover.preferImage=true（默认）= 头图显示 featuredImage；false = 初始即用 defaultPattern 合成块。
    var block = document.querySelector('.cover-render');
    if (C.preferImage !== false) {
      if (img) img.style.display = '';
      if (block) block.style.display = 'none';
      return;
    }
    apply(def);
  }
  if (strip.dataset.coverBound !== '1') {
    strip.dataset.coverBound = '1';
    strip.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cover]');
      if (!btn) return;
      apply(btn.getAttribute('data-cover'));
    });
  }
  applyDefault();
  // 供运行时按最新配置重放（测试/软导航复用）；与其它模块的 window.* 公共入口同风格。
  window.__coverApplyDefault = applyDefault;
}
