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

export function init() {
  window.toggleDark = toggleDark;
  var btn = document.querySelector('.dark-toggle');
  if (btn) btn.addEventListener('click', toggleDark);
}
