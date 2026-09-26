export function init() {
  // features.readMode.focusOnlyContent=false → 阅读模式保留侧栏（CSS 以 html[data-reading-focus="false"] 门控）；
  // 属性缺失（JS 未加载）时 CSS 默认按 true（隐藏侧栏）处理，与历史行为一致。
  var F = window.__FEATURES__ || {}, R = (F && F.readMode) || {};
  document.documentElement.setAttribute('data-reading-focus', R.focusOnlyContent === false ? 'false' : 'true');
  var rm = false;
  try { rm = localStorage.getItem('readingMode') === 'true'; } catch (e) { /* 忽略：存储不可用时按未开启处理 */ }
  if (rm) document.documentElement.setAttribute('data-reading', 'true');
}
