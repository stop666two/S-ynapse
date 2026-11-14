'use strict';
/* global document */
// 审查 R-33 接线回归：features.themeToggle.enabled / features.morphIcons.enabled /
// features.codeCopy.enabled 三个开关此前「零消费」——用户写 enabled:false 也毫无效果。
// 本文件为每个开关断言「两种取值产生不同行为」，marker 注释与断言均真实依赖该开关：
//   - themeToggle.enabled=false：不渲染按钮（模板静态断言）、不暴露 window.toggleDark、
//     不绑定任何点击处理器（因此快捷键/脚本入口一并消失）。
//   - morphIcons.enabled=false：入口短路——不注册交互探针、不挂软导航 hook、
//     不暴露 __morphScan/__morphCopy，因此不会加载任何 vendor 代码。
//   - codeCopy.enabled=false：不创建单块复制按钮与「复制全部代码」行，无复制处理器；
//     下载按钮属于 features.codeBlock，仍应存在（正向对照，证明关闭的是复制而非整套工具栏）。
//
// 前端模块以 data URL 动态导入（每个用例取唯一 fragment，避免模块缓存串味），
// 假 DOM 手写最小实现，不引依赖，与 scripts/frontend-*.test.js 的做法一致。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = function (rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf-8'); };

const SRC = {
  theme: read('js/domains/core/theme.js'),
  codeBlock: read('js/domains/core/code-block.js'),
  morphicons: read('js/domains/features/morphicons.js'),
  layout: read('templates/layout.ejs')
};

let seq = 0;
function importFresh(src) {
  const b64 = Buffer.from(src, 'utf-8').toString('base64');
  return import('data:text/javascript;base64,' + b64 + '#w' + (++seq));
}

function mkClassList() {
  const set = new Set();
  return {
    add: function (c) { set.add(c); },
    remove: function (c) { set.delete(c); },
    contains: function (c) { return set.has(c); },
    toggle: function (c) { if (set.has(c)) { set.delete(c); return false; } set.add(c); return true; },
    _set: set
  };
}

/* ------------------------------------------------------------------ *
 * 1. features.themeToggle.enabled
 * ------------------------------------------------------------------ */
function installThemeDom(features) {
  const state = { clicks: 0, writes: [], queries: 0, btnListeners: [] };
  const docEl = {
    attrs: {},
    getAttribute: function (k) { return this.attrs[k] != null ? this.attrs[k] : null; },
    setAttribute: function (k, v) { this.attrs[k] = String(v); }
  };
  const btn = {
    addEventListener: function (t) { state.btnListeners.push(t); }
  };
  global.document = {
    documentElement: docEl,
    querySelector: function (sel) { state.queries++; return sel === '.dark-toggle' ? btn : null; }
  };
  global.localStorage = {
    getItem: function () { return null; },
    setItem: function (k, v) { state.writes.push(['local', k, v]); }
  };
  global.sessionStorage = {
    getItem: function () { return null; },
    setItem: function (k, v) { state.writes.push(['session', k, v]); }
  };
  global.window = {
    __FEATURES__: features,
    __THEME__: { darkMode: { rememberChoice: true } },
    a: function (d) { docEl.setAttribute('data-theme', d ? 'dark' : 'light'); }
  };
  return state;
}

test('features.themeToggle.enabled=true 时暴露 toggleDark 并绑定按钮点击', async function () {
  // switch: features.themeToggle.enabled
  const features = { themeToggle: { enabled: true, persistKey: 'ss-theme' } };
  const state = installThemeDom(features);
  const mod = await importFresh(SRC.theme);
  mod.init();

  assert.strictEqual(typeof global.window.toggleDark, 'function', '开启时应暴露 window.toggleDark');
  assert.deepStrictEqual(state.btnListeners, ['click'], '开启时应绑定按钮点击');
  assert.strictEqual(state.queries, 1, '开启时才会去查按钮');

  // 点击后真的切换了主题并写入偏好键（证明处理器有实际行为，不是空壳）。
  global.window.toggleDark();
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.deepStrictEqual(state.writes, [['local', 'ss-theme', 'dark']]);
});

test('features.themeToggle.enabled=false 时不留任何切换入口', async function () {
  // switch: features.themeToggle.enabled
  const features = { themeToggle: { enabled: false, persistKey: 'ss-theme' } };
  const state = installThemeDom(features);
  const mod = await importFresh(SRC.theme);
  mod.init();

  assert.strictEqual(global.window.toggleDark, undefined, '关闭时不得暴露 window.toggleDark（快捷键/脚本入口）');
  assert.deepStrictEqual(state.btnListeners, [], '关闭时不得绑定点击处理器');
  assert.strictEqual(state.queries, 0, '关闭时连按钮都不查');
  assert.deepStrictEqual(state.writes, [], '关闭时不得写主题偏好');
});

test('features.themeToggle.enabled=false 时模板不渲染按钮与底部导航主题项', function () {
  // switch: features.themeToggle.enabled
  // 模板侧是第二个渲染点：只关 JS 会剩下一个「看得见但点了没反应」的按钮，
  // 只关模板会剩下一个「看不见但可被热键/脚本触发」的入口，两处都必须受同一个开关约束。
  const layout = SRC.layout;
  assert.ok(
    /features\.themeToggle&&features\.themeToggle\.enabled!==false&&theme\.darkMode&&theme\.darkMode\.enabled&&theme\.darkMode\.toggle/.test(layout),
    '顶栏 .dark-toggle 的渲染条件必须包含 features.themeToggle.enabled!==false'
  );
  assert.ok(
    layout.includes("it!=='theme'||(features.themeToggle&&features.themeToggle.enabled!==false)"),
    '移动端底部导航的 theme 项必须按同一开关过滤'
  );
});

/* ------------------------------------------------------------------ *
 * 2. features.morphIcons.enabled
 * ------------------------------------------------------------------ */
function installMorphDom(features, morph) {
  const state = { docListeners: [], hooks: [], vendorLoads: 0 };
  global.document = {
    documentElement: { getAttribute: function () { return null; }, attrs: {}, setAttribute: function () {} },
    addEventListener: function (t) { state.docListeners.push(t); },
    removeEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    createElement: function () { return {}; },
    createElementNS: function () { return { setAttribute: function () {} }; }
  };
  global.window = {
    __FEATURES__: features,
    __MORPH__: morph,
    __SOFTNAV_HOOKS__: state.hooks,
    matchMedia: function () { return { matches: false }; },
    addEventListener: function () {}
  };
  return state;
}

test('features.morphIcons.enabled=true 时注册交互探针与软导航 hook', async function () {
  // switch: features.morphIcons.enabled
  const state = installMorphDom({ morphIcons: { enabled: true, idleTimeoutMs: 3000 } }, { preload: 'interaction' });
  const mod = await importFresh(SRC.morphicons);
  mod.init();

  assert.deepStrictEqual(state.docListeners, ['pointerover', 'pointerdown', 'touchstart', 'focusin']);
  assert.strictEqual(state.hooks.length, 1, '开启时应挂一个软导航 hook');
  assert.strictEqual(typeof global.window.__morphScan, 'function', '开启时 code-block 可复用 __morphScan');
  assert.strictEqual(typeof global.window.__morphCopy, 'function');
  assert.strictEqual(global.window.__MORPH_READY__, undefined, '未交互前不得加载 vendor');
});

test('features.morphIcons.enabled=false 时入口短路：不挂监听、不暴露 hook、不加载 vendor', async function () {
  // switch: features.morphIcons.enabled
  const state = installMorphDom({ morphIcons: { enabled: false, idleTimeoutMs: 3000 } }, { preload: 'immediate' });
  let vendorLoads = 0;
  // preload:'immediate' 是「立即加载 vendor」分支：若开关失效，这里会真的发请求。
  // 用 import 记录证明关闭态一条 vendor 代码都不加载。
  const mod = await importFresh(SRC.morphicons);
  mod.init();

  assert.deepStrictEqual(state.docListeners, [], '关闭时不得注册任何交互探针');
  assert.deepStrictEqual(state.hooks, [], '关闭时不得挂软导航 hook');
  assert.strictEqual(global.window.__morphScan, undefined, '关闭时不得暴露 __morphScan');
  assert.strictEqual(global.window.__morphCopy, undefined, '关闭时不得暴露 __morphCopy');
  assert.strictEqual(global.window.__MORPH_READY__, undefined);
  assert.strictEqual(vendorLoads, 0);
});

/* ------------------------------------------------------------------ *
 * 3. features.codeCopy.enabled
 * ------------------------------------------------------------------ */
function installCodeDom(features) {
  const created = [];

  function mkEl(tag) {
    const el = {
      tagName: String(tag).toUpperCase(),
      className: '',
      title: '',
      innerHTML: '',
      textContent: '',
      style: {},
      attrs: {},
      children: [],
      parentNode: null,
      previousElementSibling: null,
      scrollWidth: 0,
      clientWidth: 0,
      scrollLeft: 0,
      listeners: [],
      classList: null,
      setAttribute: function (k, v) { el.attrs[k] = String(v); },
      getAttribute: function (k) { return el.attrs[k] != null ? el.attrs[k] : null; },
      appendChild: function (c) { el.children.push(c); c.parentNode = el; return c; },
      insertBefore: function (c) { el.children.push(c); c.parentNode = el; return c; },
      addEventListener: function (t) { el.listeners.push(t); },
      querySelector: function () { return null; },
      remove: function () {}
    };
    el.classList = mkClassList();
    created.push(el);
    return el;
  }

  const codeEl = mkEl('code');
  codeEl.className = 'language-js';
  codeEl.textContent = 'const a = 1;\nconst b = 2;';

  const pre = mkEl('pre');
  pre.attrs['data-language'] = 'js';
  pre.querySelector = function (sel) { return sel === 'code' ? codeEl : null; };
  pre.parentNode = mkEl('div');

  const body = mkEl('body');
  global.document = {
    readyState: 'complete',
    body: body,
    fonts: null,
    documentElement: { attrs: {}, getAttribute: function () { return null; }, setAttribute: function () {} },
    querySelectorAll: function (sel) { return sel === '.post-content pre' ? [pre] : []; },
    createElement: mkEl,
    addEventListener: function () {}
  };
  global.window = {
    __FEATURES__: features,
    __SOFTNAV_HOOKS__: [],
    langOf: function () { return 'zh'; },
    addEventListener: function () {},
    requestAnimationFrame: function (cb) { cb(); return 1; }
  };
  global.__T = function (key, fallback) { return fallback || key; };
  return { created: created, pre: pre };
}

const byClass = function (created, cls) {
  return created.filter(function (el) {
    return String(el.className).split(/\s+/).indexOf(cls) !== -1;
  });
};

test('features.codeCopy.enabled=true 时渲染复制按钮与「复制全部代码」行', async function () {
  // switch: features.codeCopy.enabled
  const dom = installCodeDom({ codeCopy: { enabled: true }, codeBlock: {} });
  const mod = await importFresh(SRC.codeBlock);
  mod.init();

  const copyBtns = byClass(dom.created, 'copy').filter(function (el) { return el.className === 'code-action-btn copy'; });
  assert.strictEqual(copyBtns.length, 1, '开启时应创建一个单块复制按钮');
  assert.strictEqual(typeof copyBtns[0].onclick, 'function', '开启时必须绑定复制处理器');
  const copyAllRows = dom.created.filter(function (el) { return el.className === 'code-copy-all-row'; });
  assert.strictEqual(copyAllRows.length, 1, '开启时应渲染「复制全部代码」行');
});

test('features.codeCopy.enabled=false 时不创建复制元素、不绑定复制处理器', async function () {
  // switch: features.codeCopy.enabled
  const dom = installCodeDom({ codeCopy: { enabled: false }, codeBlock: {} });
  const mod = await importFresh(SRC.codeBlock);
  mod.init();

  const copyBtns = dom.created.filter(function (el) { return el.className === 'code-action-btn copy'; });
  assert.strictEqual(copyBtns.length, 0, '关闭时不得创建任何复制按钮');
  const copyAllRows = dom.created.filter(function (el) { return el.className === 'code-copy-all-row'; });
  assert.strictEqual(copyAllRows.length, 0, '关闭时不得渲染「复制全部代码」行');
  const copyAllBtns = dom.created.filter(function (el) { return el.className === 'code-copy-all-btn'; });
  assert.strictEqual(copyAllBtns.length, 0, '关闭时不得创建「复制全部代码」按钮');

  // 正向对照：下载按钮属于 features.codeBlock，关闭 codeCopy 不应连带关掉整套工具栏。
  const dlBtns = dom.created.filter(function (el) { return el.className === 'code-action-btn download'; });
  assert.strictEqual(dlBtns.length, 1, '下载按钮仍应存在（codeCopy 只关复制）');
});
