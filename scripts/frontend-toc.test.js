'use strict';
// 回归：模板把 #mTocBtn/#mTocDrawer 按首屏文章的 article.toc 渲染在 .content-wrapper 之外，
// 软导航只替换内容区 —— 修复后由 toc.js 的 syncMobileToc 按当前内容区重建/移除该块。
// 用最小节点树桩（id 注册表 + class 查询 + 父子关系）覆盖 init/bind 读取的接口。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'core', 'toc.js'), 'utf-8');
const load = () => import('data:text/javascript;base64,' + Buffer.from(SRC, 'utf-8').toString('base64'));

function makeNode(tag) {
  const node = {
    tagName: tag,
    id: '',
    className: '',
    attrs: {},
    dataset: {},
    style: {},
    children: [],
    listeners: [],
    _text: '',
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }
    },
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k === 'id') this.id = String(v);
    },
    getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; },
    hasAttribute(k) { return this.attrs[k] != null; },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
      c.parentNode = null;
      return c;
    },
    querySelector(sel) {
      const cls = sel.charAt(0) === '.' ? sel.slice(1) : '';
      if (!cls) return null;
      return this.children.filter((x) => String(x.className).split(' ').indexOf(cls) > -1)[0] || null;
    },
    querySelectorAll(sel) {
      const cls = sel.charAt(0) === '.' ? sel.slice(1) : '';
      if (!cls) return [];
      return this.children.filter((x) => String(x.className).split(' ').indexOf(cls) > -1);
    },
    addEventListener(type, fn) { this.listeners.push([type, fn]); },
    getBoundingClientRect() { return { top: 0, height: 10 }; },
    closest() { return null; },
    focus() {}
  };
  Object.defineProperty(node, 'textContent', {
    get() { return node._text; },
    set(v) {
      node._text = String(v);
      if (node._text === '') node.children = [];
    }
  });
  // DOM 的 a.href 是属性反射：抽屉链接用 a.href = '#id' 赋值，断言侧读 getAttribute('href')
  Object.defineProperty(node, 'href', {
    get() { return node.attrs.href != null ? node.attrs.href : ''; },
    set(v) { node.attrs.href = String(v); }
  });
  return node;
}

// 构造一项 .toc-sidebar-list（标题 → 锚点）；items 为 [{id, text, level}]。
function makeTocList(items) {
  const list = makeNode('div');
  list.className = 'toc-sidebar-list';
  items.forEach((it) => {
    const a = makeNode('a');
    a.className = 'toc-sidebar-link level-' + it.level;
    a.setAttribute('href', '#' + it.id);
    a.textContent = it.text;
    list.appendChild(a);
  });
  return list;
}

function installDom() {
  const reg = Object.create(null);
  const state = { list: null, headings: {} };
  const body = makeNode('body');
  const docEl = makeNode('html');
  docEl.scrollHeight = 1000;
  const doc = {
    documentElement: docEl,
    body,
    createElement: makeNode,
    getElementById(id) {
      if (id.indexOf('mc-') === 0) return state.headings[id.slice(3)] || null;
      return reg[id] || null;
    },
    querySelector(sel) { return sel === '.toc-sidebar-list' ? state.list : null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  // appendChild 需要把带 id 的节点登记进注册表（getElementById 由 id 实时取到）
  const origAppend = body.appendChild.bind(body);
  body.appendChild = (c) => {
    const r = origAppend(c);
    if (c.id) reg[c.id] = c;
    return r;
  };
  const origRemove = body.removeChild.bind(body);
  body.removeChild = (c) => {
    const r = origRemove(c);
    if (c.id) delete reg[c.id];
    return r;
  };
  global.document = doc;
  global.window = {
    __FEATURES__: { mobileToc: { enabled: true }, toc: {}, tocScrollSpy: {} },
    __SOFTNAV_HOOKS__: [],
    scrollY: 0,
    innerHeight: 500,
    __T: (k, d) => d || k,
    addEventListener() {},
    requestAnimationFrame: () => 1,
    getComputedStyle: () => ({ display: 'block' })
  };
  global.__T = global.window.__T;
  global.history = { replaceState() {} };
  return { state, reg, body, doc };
}

function drawerItems(reg) {
  const dr = reg.mTocDrawer;
  if (!dr) return [];
  const nav = dr.querySelector('.m-toc-list');
  return nav ? nav.children : [];
}

test('移动端浮动目录块随当前页重建/移除（文章→首页→另一篇文章）', async () => {
  const dom = installDom();
  const { init } = await load();
  // 首屏：文章页有 1 个章节（模板原本会渲染该块，这里从零验证创建路径）
  dom.state.list = makeTocList([{ id: 'h1', text: '第一节', level: 2 }]);
  dom.reg.h1 = makeNode('h2');
  init();

  assert.ok(dom.reg.mTocBtn, '文章页必须存在浮动目录按钮');
  assert.ok(dom.reg.mTocDrawer, '文章页必须存在目录抽屉');
  assert.deepStrictEqual(drawerItems(dom.reg).map((n) => n.children[0].getAttribute('href')), ['#h1']);

  const hooks = global.window.__SOFTNAV_HOOKS__;
  assert.strictEqual(hooks.length, 1, 'toc.js 必须把 bind 注册进 __SOFTNAV_HOOKS__');

  // 软导航到首页（无目录）：块必须整体移除，不得残留上一页章节
  dom.state.list = null;
  hooks.forEach((fn) => fn());
  assert.strictEqual(dom.reg.mTocBtn, undefined, '首页不得保留上一页的浮动目录按钮');
  assert.strictEqual(dom.reg.mTocDrawer, undefined, '首页不得保留上一页的目录抽屉');

  // 软导航到另一篇文章（2 个章节）：块重建且内容来自当前页
  dom.state.list = makeTocList([
    { id: 'a1', text: 'A 节', level: 2 },
    { id: 'a2', text: 'B 节', level: 3 }
  ]);
  dom.reg.a1 = makeNode('h2');
  dom.reg.a2 = makeNode('h3');
  hooks.forEach((fn) => fn());
  assert.ok(dom.reg.mTocBtn, '文章页必须重建浮动目录按钮');
  assert.strictEqual(dom.reg.mTocBtn.getAttribute('aria-expanded'), 'false');
  const hrefs = drawerItems(dom.reg).map((n) => n.children[0].getAttribute('href'));
  assert.deepStrictEqual(hrefs, ['#a1', '#a2'], '抽屉章节必须来自当前页（不得残留上一页 #h1）');
});
