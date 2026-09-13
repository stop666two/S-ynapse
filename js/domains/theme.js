export function toggleDark() {
  const c = document.documentElement.getAttribute('data-theme');
  const d = c !== 'dark';
  window.a(d);
  const TT = (window.__FEATURES__ && window.__FEATURES__.themeToggle) || {};
  try { localStorage.setItem(TT.persistKey || 'ss-theme', d ? 'dark' : 'light'); } catch (e) { /* 存储被禁用时仅当前会话生效 */ }
}

export function init() {
  window.toggleDark = toggleDark;
}
