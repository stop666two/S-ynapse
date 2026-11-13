export function toggleDark() {
  const c = document.documentElement.getAttribute('data-theme');
  const d = c !== 'dark';
  window.a(d);
  const TT = (window.__FEATURES__ && window.__FEATURES__.themeToggle) || {};
  const DM = (window.__THEME__ && window.__THEME__.darkMode) || {};
  // theme.darkMode.rememberChoice=false → 偏好存 sessionStorage（仅当次会话）；默认 localStorage（现行为）。
  const store = DM.rememberChoice === false ? sessionStorage : localStorage;
  try { store.setItem(TT.persistKey, d ? 'dark' : 'light'); } catch (e) { /* 存储被禁用时仅当前会话生效 */ }
}

// 审查 R-33 接线：features.themeToggle.enabled=false 表示「明暗切换按钮」整体关闭。
// 模板侧（templates/layout.ejs）已不渲染 .dark-toggle 与移动端底部导航的 theme 项，
// 这里也必须在入口处短路：既不能暴露 window.toggleDark（否则快捷键/脚本/命令面板仍能
// 切换，留下一个「看不见但可触发」的入口），也不能再绑定点击处理器。
function featureOn() {
  var TT = (window.__FEATURES__ && window.__FEATURES__.themeToggle) || {};
  return TT.enabled !== false;
}

export function init() {
  if (!featureOn()) return;
  window.toggleDark = toggleDark;
  var btn = document.querySelector('.dark-toggle');
  if (btn) btn.addEventListener('click', toggleDark);
}
