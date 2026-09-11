export function toggleDark() {
  const c = document.documentElement.getAttribute('data-theme');
  const d = c !== 'dark';
  window.a(d);
  const TT = (window.__FEATURES__ && window.__FEATURES__.themeToggle) || {};
  localStorage.setItem(TT.persistKey || 'ss-theme', d ? 'dark' : 'light');
}

export function init() {
  window.toggleDark = toggleDark;
}
