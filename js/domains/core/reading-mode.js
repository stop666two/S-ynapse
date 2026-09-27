export function init() {
  // features.readMode.focusOnlyContent=false → 阅读模式保留侧栏（CSS 以 html[data-reading-focus="false"] 门控）；
  // 属性缺失（JS 未加载）时 CSS 默认按 true（隐藏侧栏）处理，与历史行为一致。
  var F = window.__FEATURES__ || {}, R = (F && F.readMode) || {};
  document.documentElement.setAttribute('data-reading-focus', R.focusOnlyContent === false ? 'false' : 'true');
  // persist=false 时不恢复（与 reading.js 的 toggleReadingMode 同一语义）；storageKey 缺省回退历史键名。
  if (R.persist === false) return;
  var rm = false;
  try { rm = localStorage.getItem(R.storageKey || 'readingMode') === 'true'; } catch (e) { /* 忽略：存储不可用时按未开启处理 */ }
  if (rm) document.documentElement.setAttribute('data-reading', 'true');
}
