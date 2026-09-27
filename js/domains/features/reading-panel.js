// 阅读设置面板：字号/行高/宽度调节 + 「主题」页签（features.themeLab 时渲染，交接给 theme-lab 模块）。
// 软导航替换正文后经 __SOFTNAV_HOOKS__ 重绑；onclick/oninput 赋值天然幂等。
let activeTab = 0;
let hooked = false;

export function init() {
  bind();
  if (!hooked && Array.isArray(window.__SOFTNAV_HOOKS__)) {
    hooked = true;
    window.__SOFTNAV_HOOKS__.push(bind);
  }
}

function bind() {
  const g = document.getElementById('readerGear');
  const p = document.getElementById('readerPanel');
  if (!g || !p) return;
  const F = window.__FEATURES__ || {};
  const RP = (F && F.readingPanel) || {};
  const PK = RP.persistKey;
  const fs = document.getElementById('rFont');
  const lh = document.getElementById('rLine');
  const wd = document.getElementById('rWidth');
  if (!fs || !lh || !wd) return;
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(PK) || '{}'); } catch (e) { /* 忽略：存储不可用/内容损坏时回退默认偏好 */ }
  function apply() {
    let s = '';
    if (prefs.fs) s = prefs.fs + 'px';
    document.documentElement.style.setProperty('--post-fs', s);
    s = '';
    if (prefs.lh) s = prefs.lh;
    document.documentElement.style.setProperty('--post-lh', s);
    s = '';
    if (prefs.wd) s = prefs.wd + 'px';
    document.documentElement.style.setProperty('--post-w', s);
  }
  function syncUI() {
    const dv = (el, fb) => (el && el.getAttribute && el.getAttribute('value')) || fb;
    fs.value = prefs.fs || dv(fs, 16);
    lh.value = prefs.lh || dv(lh, 1.8);
    wd.value = prefs.wd || dv(wd, '');
  }
  function save() {
    try { localStorage.setItem(PK, JSON.stringify(prefs)); } catch (e) { /* 忽略：存储不可用时偏好仅当次会话有效 */ }
  }

  const tabRead = document.getElementById('rtabRead');
  const tabTheme = document.getElementById('rtabTheme');
  const pageRead = document.getElementById('rpageRead');
  const pageTheme = document.getElementById('rpageTheme');
  function selectTab(index, focus) {
    activeTab = index === 1 ? 1 : 0;
    const tabs = [tabRead, tabTheme];
    const pages = [pageRead, pageTheme];
    for (let i = 0; i < tabs.length; i++) {
      const on = i === activeTab;
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].tabIndex = on ? 0 : -1;
      pages[i].hidden = !on;
    }
    if (focus) tabs[activeTab].focus();
    if (activeTab === 1 && typeof window.__themeLabSync === 'function') window.__themeLabSync();
  }
  if (tabRead && tabTheme && pageRead && pageTheme) {
    tabRead.onclick = function () { selectTab(0, false); };
    tabTheme.onclick = function () { selectTab(1, false); };
    const onKey = function (e) {
      const key = e.key;
      const current = document.activeElement === tabTheme ? 1 : 0;
      if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowUp') {
        e.preventDefault();
        selectTab(current === 0 ? 1 : 0, true);
      } else if (key === 'Home') { e.preventDefault(); selectTab(0, true); }
      else if (key === 'End') { e.preventDefault(); selectTab(1, true); }
    };
    tabRead.onkeydown = onKey;
    tabTheme.onkeydown = onKey;
    selectTab(activeTab, false);
  }

  g.onclick = function () {
    const open = p.classList.toggle('open');
    g.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) return;
    syncUI();
    if (typeof window.__themeLabSync === 'function') window.__themeLabSync();
  };
  fs.oninput = function () { prefs.fs = +fs.value; save(); apply(); };
  lh.oninput = function () { prefs.lh = +lh.value; save(); apply(); };
  wd.oninput = function () { prefs.wd = +wd.value; save(); apply(); };
  const rset = document.getElementById('rReset');
  if (rset) {
    rset.onclick = function () {
      prefs = {};
      try { localStorage.removeItem(PK); } catch (e) { /* 忽略：存储不可用时偏好仅当次会话有效 */ }
      apply();
      syncUI();
    };
  }
  apply();
}
