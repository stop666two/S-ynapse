// 双语对照运行时（features.bilingual）：文章页「中/EN」切换入口与宽屏并排对照。
// 设计约束：
//   - 并排右栏仅当次会话（不持久化）；关闭开关 / 软导航 / 视口缩回断点以下 /
//     对照缺失时清理右栏并还原单栏；
//   - 右栏经 fetch 同源 HTML → DOMParser 提取对方 .post-content → 净化
//     （去脚本/工具条/评论，剥离重复 id）后克隆插入；不执行对方页面脚本；
//   - 任何失败静默回退单栏（按钮与既有阅读功能不受影响），不阻塞主流程。
import {
  resolveBilingualConfig,
  shouldShowSideBySide,
  paneCleanupSelectors,
  paneStripAttribute,
  PANE_SOURCE_SELECTOR,
  isAlternateHref
} from './bilingual-core.js';

let state = null;
let seq = 0;
let resizeTimer = null;

// 对方文章获取超时（站内请求，超时即静默回退单栏；与软导航 timeoutMs 同量级）。
const FETCH_TIMEOUT_MS = 10000;

function cfg() {
  return resolveBilingualConfig((window.__FEATURES__ || {}).bilingual);
}

function validAlt() {
  return !!(state && state.altUrl && isAlternateHref(state.altUrl, state.altLang));
}

// 净化：按清单移除脚本/表单/页面级工具与评论等；逐元素剥离 id / data-vt / on* 属性，
// 再把源节点整体移入右栏容器（不解析/执行任何脚本）。
function sanitizePane(source, target) {
  for (const sel of paneCleanupSelectors()) {
    const nodes = source.querySelectorAll(sel);
    for (let i = 0; i < nodes.length; i++) nodes[i].remove();
  }
  const all = source.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const attrs = Array.prototype.slice.call(all[i].attributes);
    for (const attr of attrs) {
      if (paneStripAttribute(attr.name)) all[i].removeAttribute(attr.name);
    }
  }
  target.replaceChildren(source);
}

function disable() {
  if (!state || !state.on) return;
  seq++;
  state.on = false;
  if (state.pane) state.pane.hidden = true;
  if (state.paneBody) state.paneBody.replaceChildren();
  if (state.root) state.root.classList.remove('bilingual-on');
  if (state.toggle) state.toggle.setAttribute('aria-pressed', 'false');
}

async function enable() {
  if (!state || state.on || !validAlt()) return;
  const url = state.altUrl;
  const pane = state.pane;
  const paneBody = state.paneBody;
  if (!pane || !paneBody) return;
  const token = ++seq;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(function () { try { controller.abort(); } catch (e) { /* 忽略：中止失败由时序保护兜底 */ } }, FETCH_TIMEOUT_MS) : null;
  let html;
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'bilingual' },
      signal: controller ? controller.signal : undefined
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    html = await res.text();
  } catch (err) {
    return;
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!state || token !== seq) return;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const src = doc.querySelector(PANE_SOURCE_SELECTOR);
  if (!src) return;
  sanitizePane(src, paneBody);
  pane.hidden = false;
  if (state.root) state.root.classList.add('bilingual-on');
  state.on = true;
  if (state.toggle) state.toggle.setAttribute('aria-pressed', 'true');
}

function onToggle() {
  if (state && state.on) disable();
  else enable();
}

function onSwitch(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (!state || !validAlt()) return;
  e.preventDefault();
  const nav = window.__softNav;
  if (nav && typeof nav.isOn === 'function' && nav.isOn() && typeof nav.navigate === 'function') {
    nav.navigate(state.altUrl);
    return;
  }
  window.location.href = state.altUrl;
}

// 断点与存在性同步：窄于断点隐藏开关并关闭并排；无对照隐藏整条工具条。
function syncBreakpoint() {
  if (!state) return;
  const c = cfg();
  const show = c.enabled && c.sideBySide && validAlt() && shouldShowSideBySide(c, true, window.innerWidth);
  if (state.toggle) state.toggle.hidden = !show;
  if (!show) disable();
}

function refresh() {
  seq++;
  if (state && state.on) disable();
  const root = document.getElementById('bilingualWrap');
  const pane = root ? root.querySelector('[data-bilingual-pane]') : null;
  state = {
    root,
    pane,
    paneBody: pane ? pane.querySelector('#bilingualPaneBody') : null,
    bar: root ? root.querySelector('#bilingualBar') : null,
    toggle: root ? root.querySelector('#bilingualSide') : null,
    link: root ? root.querySelector('#bilingualSwitch') : null,
    altUrl: (root && root.getAttribute('data-bilingual-alt')) || '',
    altLang: (root && root.getAttribute('data-bilingual-lang')) || '',
    on: false
  };
  if (state.link) state.link.addEventListener('click', onSwitch);
  if (state.toggle) state.toggle.addEventListener('click', onToggle);
  if (state.bar && !validAlt()) state.bar.hidden = true;
  if (!validAlt() && state.pane) state.pane.hidden = true;
  syncBreakpoint();
}

export function init() {
  if (window.__BILINGUAL_BOUND__) {
    refresh();
    return;
  }
  window.__BILINGUAL_BOUND__ = true;
  refresh();
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncBreakpoint, 120);
  }, { passive: true });
  if (Array.isArray(window.__SOFTNAV_HOOKS__)) window.__SOFTNAV_HOOKS__.push(refresh);
  window.__bilingual = {
    refresh: refresh,
    enable: enable,
    disable: disable,
    isOn: function () { return !!(state && state.on); }
  };
}
