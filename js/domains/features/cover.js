export function init() {
  var F = window.__FEATURES__ || {}, C = (F && F.cover) || {};
  if (C.enabled === false) return;
  var patterns = (Array.isArray(C.patterns) && C.patterns.length) ? C.patterns : ['gradient', 'stripes', 'dots', 'blob', 'mesh'];
  var def = patterns.indexOf(C.defaultPattern) > -1 ? C.defaultPattern : patterns[0];
  // 审查 R-22：封面块位于内容区内，软导航替换 .content-wrapper 后节点全是新的，而 init() 只执行一次。
  // 因此不在 init 时缓存节点：每次按当前文档重新取（fresh），点击监听改为文档级委托，
  // 并把 applyDefault() 注册进 __SOFTNAV_HOOKS__，保证软导航进入文章页（或 A→B）后仍可用。
  function fresh() {
    return {
      strip: document.querySelector('.cover-strip[data-article]'),
      img: document.querySelector('.post-featured-image')
    };
  }
  function apply(pat) {
    var n = fresh();
    var strip = n.strip, img = n.img;
    if (!strip) return;
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
    var n = fresh();
    var img = n.img;
    // 当前页没有封面块（列表页/关于页等）时无事可做；也不得用旧页面的引用去改 DOM。
    if (!n.strip && !img) return;
    // features.cover.preferImage=true（默认）= 头图显示 featuredImage；false = 初始即用 defaultPattern 合成块。
    var block = document.querySelector('.cover-render');
    if (C.preferImage !== false) {
      if (img) img.style.display = '';
      if (block) block.style.display = 'none';
      return;
    }
    apply(def);
  }
  // 文档级委托：缩略图按钮每次随页面重建，绑定在 document 上就无需随软导航重绑。
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-cover]') : null;
    if (!btn) return;
    if (!btn.closest('.cover-strip[data-article]')) return;
    apply(btn.getAttribute('data-cover'));
  });
  applyDefault();
  if (Array.isArray(window.__SOFTNAV_HOOKS__)) window.__SOFTNAV_HOOKS__.push(applyDefault);
  // 供运行时按最新配置重放（测试/软导航复用）；与其它模块的 window.* 公共入口同风格。
  window.__coverApplyDefault = applyDefault;
}
