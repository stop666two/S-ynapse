'use strict';
// R-22 回归：封面块随软导航重建，init() 只跑一次 —— 缩略图点击与默认样式都必须在新节点上继续生效。
// js/domains/features/cover.js 无相对导入，经 data URL 动态导入。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'cover.js'), 'utf-8');
const load = () => import('data:text/javascript;base64,' + Buffer.from(SRC, 'utf-8').toString('base64'));

function mkEl(tag, created) {
  const node = {
    tagName: tag,
    className: '',
    style: {},
    textContent: '',
    attrs: {},
    _children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; },
    appendChild(n) { this._children.push(n); return n; },
    insertBefore(n) { this._children.push(n); return n; },
    querySelectorAll() { return []; },
    closest() { return null; }
  };
  node.parentNode = { insertBefore: (n, anchor) => { node._children.push([n, anchor]); return n; } };
  if (created) created.push(node);
  return node;
}

function installDom() {
  const state = { q: {}, clicks: [], created: [] };
  global.window = {
    __FEATURES__: { cover: { enabled: true, preferImage: false, patterns: ['gradient', 'dots'], defaultPattern: 'dots' } },
    __SOFTNAV_HOOKS__: []
  };
  global.document = {
    querySelector: (sel) => state.q[sel] || null,
    createElement: (tag) => mkEl(tag, state.created),
    addEventListener(type, fn) { if (type === 'click') state.clicks.push(fn); },
    querySelectorAll() { return []; }
  };
  return state;
}

test('R-22 首屏无封面时，软导航后（新节点）缩略图点击仍然生效', async () => {
  const state = installDom();
  const { init } = await load();
  init();
  assert.ok(state.clicks.length > 0, '点击监听必须绑定在文档上（封面节点每次换页重建）');

  // 软导航后出现封面块
  const strip = mkEl('div', state.created);
  state.q['.cover-strip[data-article]'] = strip;
  state.q['.post-featured-image'] = mkEl('img', state.created);

  const thumb = {
    getAttribute: (n) => (n === 'data-cover' ? 'gradient' : null),
    closest: (sel) => (sel === '.cover-strip[data-article]' ? strip : null)
  };
  state.clicks.forEach((fn) => fn({ target: { closest: (sel) => (sel === '[data-cover]' ? thumb : null) } }));

  const blocks = state.created.filter((n) => /cover-render/.test(n.className));
  assert.strictEqual(blocks.length, 1, '点击缩略图必须按当前节点生成/更新合成块');
  assert.strictEqual(blocks[0].className, 'cover-render cover-pattern-gradient');
});

test('R-22 软导航钩子会把 preferImage=false 的默认样式应用到新文章', async () => {
  const state = installDom();
  const { init } = await load();
  init();
  const hooks = global.window.__SOFTNAV_HOOKS__;
  assert.strictEqual(hooks.length, 1, 'applyDefault 必须注册进 __SOFTNAV_HOOKS__');

  const strip = mkEl('div', state.created);
  const img = mkEl('img', state.created);
  state.q['.cover-strip[data-article]'] = strip;
  state.q['.post-featured-image'] = img;

  hooks.forEach((fn) => fn());
  const blocks = state.created.filter((n) => /cover-pattern-dots/.test(n.className));
  assert.strictEqual(blocks.length, 1, '软导航后必须按 defaultPattern 合成封面');
  assert.strictEqual(img.style.display, 'none', '合成封面时头图应隐藏');
});
