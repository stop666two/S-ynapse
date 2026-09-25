// 软导航：拦截站内同语言链接，用 fetch + DOM 交换替代整页刷新，配合同文档 View Transitions 实现无缝过渡。
// 设计约束：
//   - 只在「同源 + 同语言段（/zh/ 或 /en/）+ 非资源文件」时生效；
//   - 任何异常（超时、解析失败、目标结构缺失、交换抛错）都会回退为 location.href 整页跳转；
//   - 页内开关（features.softNavigation.toggle）供用户规避兼容问题；关闭后恢复浏览器原生导航；
//   - 文档级监听器只绑定一次；页面级模块通过 __SOFTNAV_HOOKS__ 注册重绑函数，交换后统一重绑。
const CACHE_MAX = 16;
let navSeq = 0;
let prefetchTimer = null;
const cache = new Map();

// 页面级模块注册表：模块 init 时 push 自己的“重新绑定 DOM”函数（无参、幂等）。
if (typeof window !== 'undefined' && !Array.isArray(window.__SOFTNAV_HOOKS__)) window.__SOFTNAV_HOOKS__ = [];

function cfg() { return (window.__FEATURES__ && window.__FEATURES__.softNavigation) || {}; }
function toggleCfg() { return cfg().toggle || {}; }
function storeKey() { return toggleCfg().storageKey || 's-soft-nav'; }

export function isOn() {
  const c = cfg();
  if (c.enabled === false) return false;
  try {
    const v = localStorage.getItem(storeKey());
    if (v === '0') return false;
    if (v === '1') return true;
  } catch (e) { /* 隐私模式等场景下忽略，按默认值处理 */ }
  return toggleCfg().defaultOn !== false;
}

export function setOn(on) {
  try { localStorage.setItem(storeKey(), on ? '1' : '0'); } catch (e) { /* 忽略：存储不可用时仅当次会话生效 */ }
}

window.__softNavActive = isOn;

function langSeg(pathname) {
  const m = /^\/(zh|en)(?=\/|$)/.exec(pathname || '');
  return m ? m[1] : '';
}

function eligible(a) {
  if (!a || !a.getAttribute) return false;
  const href = a.getAttribute('href') || '';
  if (!href || href.charAt(0) === '#') return false;
  if (/^(mailto:|tel:|javascript:|data:|blob:)/i.test(href)) return false;
  if (a.hasAttribute('download') || a.getAttribute('target') === '_blank') return false;
  const rel = a.getAttribute('rel') || '';
  if (/\bexternal\b/i.test(rel)) return false;
  const sels = cfg().excludeSelectors || [];
  for (let i = 0; i < sels.length; i++) {
    try { if (a.matches(sels[i])) return false; } catch (e) { /* 非法选择器忽略 */ }
  }
  let u;
  try { u = new URL(a.href, window.location.href); } catch (e) { return false; }
  if (u.origin !== window.location.origin) return false;
  if (u.pathname === window.location.pathname && u.search === window.location.search) return false;
  if (langSeg(u.pathname) !== langSeg(window.location.pathname)) return false;
  if (/\.(pdf|zip|png|jpe?g|webp|avif|gif|svg|ico|mp4|webm|mp3|wav|txt|xml|json|js|css|woff2?)$/i.test(u.pathname)) return false;
  return true;
}

function trimCache() {
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

async function fetchPage(url) {
  const timeout = +(cfg().timeoutMs) || 10000;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout) : null;
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'soft-navigation' },
      signal: ctrl ? ctrl.signal : undefined
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const type = res.headers.get('content-type') || '';
    if (type.indexOf('text/html') === -1) throw new Error('非 HTML 响应');
    return await res.text();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadPage(url) {
  const ttl = +(cfg().cacheTtlMs) || 300000;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.html;
  const html = await fetchPage(url);
  cache.set(url, { html: html, t: Date.now() });
  trimCache();
  return html;
}

function syncMeta(curRoot, nextRoot, attr) {
  const keys = new Set();
  curRoot.querySelectorAll('meta[' + attr + ']').forEach(function (m) { keys.add(m.getAttribute(attr)); });
  nextRoot.querySelectorAll('meta[' + attr + ']').forEach(function (m) { keys.add(m.getAttribute(attr)); });
  keys.forEach(function (key) {
    if (!key) return;
    const sel = 'meta[' + attr + '="' + key.replace(/"/g, '\\"') + '"]';
    curRoot.querySelectorAll(sel).forEach(function (n) { n.remove(); });
    nextRoot.querySelectorAll(sel).forEach(function (n) { curRoot.appendChild(n.cloneNode(true)); });
  });
}

function syncHead(newDoc) {
  document.title = newDoc.title || document.title;
  syncMeta(document.head, newDoc.head, 'name');
  syncMeta(document.head, newDoc.head, 'property');
  ['link[rel="canonical"]', 'script[type="application/ld+json"]'].forEach(function (sel) {
    document.head.querySelectorAll(sel).forEach(function (n) { n.remove(); });
    newDoc.head.querySelectorAll(sel).forEach(function (n) { document.head.appendChild(n.cloneNode(true)); });
  });
}

function swap(html, url, mode) {
  const newDoc = new DOMParser().parseFromString(html, 'text/html');
  const nextWrap = newDoc.querySelector('.content-wrapper');
  const curWrap = document.querySelector('.content-wrapper');
  if (!nextWrap || !curWrap) throw new Error('目标页缺少 content-wrapper');
  syncHead(newDoc);
  curWrap.innerHTML = nextWrap.innerHTML;
  const body = document.body;
  const keep = Array.prototype.filter.call(body.classList, function (c) { return !/^bg-/.test(c); });
  Array.prototype.forEach.call(newDoc.body.classList, function (c) { if (/^bg-/.test(c)) keep.push(c); });
  body.className = keep.join(' ');
  const artTitle = newDoc.body.getAttribute('data-article-title') || '';
  body.setAttribute('data-article-title', artTitle);
  if (typeof window.__ART_TITLE__ === 'string' && artTitle) window.__ART_TITLE__ = artTitle;
  if (mode === 'push') history.pushState({ soft: true }, '', url);
  else if (mode === 'replace') history.replaceState({ soft: true }, '', url);
  const hooks = window.__SOFTNAV_HOOKS__ || [];
  for (let i = 0; i < hooks.length; i++) {
    try { hooks[i](); } catch (err) { console.warn('[soft-nav] 重绑失败：' + (err && err.message ? err.message : err)); }
  }
  if (url.indexOf('#') > -1) {
    const target = document.getElementById(url.split('#')[1]);
    if (target) { target.scrollIntoView(); }
  } else if (cfg().scrollToTop !== false) {
    window.scrollTo(0, 0);
  }
  const main = document.querySelector('.main-content');
  if (main) { main.setAttribute('tabindex', '-1'); try { main.focus({ preventScroll: true }); } catch (e) { /* 忽略：部分浏览器不支持 preventScroll */ } }
}

function markBusy(on) {
  const el = document.documentElement;
  if (!el) return;
  if (on) el.classList.add('softnav-busy');
  else el.classList.remove('softnav-busy');
}

async function go(url, mode) {
  if (!isOn()) { window.location.href = url; return; }
  const seq = ++navSeq;
  markBusy(true);
  try {
    const html = await loadPage(url);
    if (seq !== navSeq) return;
    const doSwap = function () { swap(html, url, mode); };
    if (cfg().viewTransition !== false && typeof document.startViewTransition === 'function') {
      const t = document.startViewTransition(doSwap);
      if (t && t.finished && t.finished.catch) t.finished.catch(function () { /* 过渡被中断不影响内容交换 */ });
      if (t && t.updateCallbackDone && t.updateCallbackDone.catch) t.updateCallbackDone.catch(function () {});
    } else {
      doSwap();
    }
  } catch (err) {
    if (seq === navSeq) window.location.href = url;
  } finally {
    if (seq === navSeq) markBusy(false);
  }
}

function schedulePrefetch(a) {
  if (!isOn() || cfg().prefetchOnHover === false) return;
  const url = a.href;
  const ttl = +(cfg().cacheTtlMs) || 300000;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return;
  if (prefetchTimer) clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(function () {
    fetchPage(url).then(function (html) {
      cache.set(url, { html: html, t: Date.now() });
      trimCache();
    }).catch(function () { /* 预取失败静默：点击时会有正式回退 */ });
  }, +(cfg().prefetchDelayMs) || 80);
}

function initUI() {
  const box = document.getElementById('nbSn');
  if (!box) return;
  box.checked = isOn();
  box.addEventListener('change', function () { setOn(box.checked); });
}

export function init() {
  if (cfg().enabled === false) return;
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!isOn()) return;
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!eligible(a)) return;
    e.preventDefault();
    go(a.href, 'push');
  }, true);
  document.addEventListener('pointerover', function (e) {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a && eligible(a)) schedulePrefetch(a);
  }, { passive: true });
  document.addEventListener('focusin', function (e) {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a && eligible(a)) schedulePrefetch(a);
  });
  window.addEventListener('popstate', function () {
    if (!isOn()) { window.location.reload(); return; }
    go(window.location.href, 'pop');
  });
  initUI();
  window.__softNav = { isOn: isOn, setOn: setOn, navigate: function (url) { go(url, 'push'); }, version: 1 };
}
