'use strict';
// R-23 回归：#rp/#btt 常驻在内容区之外，软导航每次都会重跑 bind()。
// 监听器必须幂等，否则方向键步长按导航次数叠加、监听器随导航泄漏。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'core', 'reading.js'), 'utf-8');
const load = () => import('data:text/javascript;base64,' + Buffer.from(SRC, 'utf-8').toString('base64'));

function mkEl(tag) {
  return {
    tagName: tag,
    style: {},
    attrs: {},
    hidden: false,
    listeners: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(type) { this.listeners.push(type); },
    removeEventListener() {},
    closest() { return null; },
    querySelector() { return null; },
    getBoundingClientRect() { return { top: 0, height: 100 }; }
  };
}

function installDom() {
  const bar = mkEl('div');
  const btt = mkEl('button');
  const docEl = mkEl('html');
  docEl.scrollHeight = 1000;
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.window = {
    innerHeight: 500,
    scrollY: 0,
    __FEATURES__: {
      readingProgress: { enabled: true, clickToJump: true },
      backToTop: { enabled: true },
      readDock: { enabled: false },
      readMode: { persist: false }
    },
    __SOFTNAV_HOOKS__: [],
    __SB: () => 'auto',
    addEventListener() {},
    requestAnimationFrame: () => 1,
    scrollTo() {}
  };
  global.document = {
    documentElement: docEl,
    getElementById(id) {
      if (id === 'rp') return bar;
      if (id === 'btt') return btt;
      if (id === 'readDock') return null;
      if (id === 'rpTip' || id === 'rpDot') return null;
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement: mkEl
  };
  return { bar, btt };
}

test('R-23 重复 bind（软导航）不得线性增加进度条/返回顶部监听器', async () => {
  const dom = installDom();
  const { init } = await load();
  init();
  assert.ok(dom.bar.listeners.length > 0, '首轮必须绑定进度条交互');
  assert.ok(dom.btt.listeners.length > 0, '首轮必须绑定返回顶部');
  const barOnce = dom.bar.listeners.length;
  const bttOnce = dom.btt.listeners.length;

  const hooks = global.window.__SOFTNAV_HOOKS__;
  assert.strictEqual(hooks.length, 1, 'reading.js 必须把 bind 注册进 __SOFTNAV_HOOKS__');
  hooks.forEach((fn) => fn());
  hooks.forEach((fn) => fn());

  assert.strictEqual(dom.bar.listeners.length, barOnce, '进度条监听器必须幂等（方向键步长不得按导航次数叠加）');
  assert.strictEqual(dom.btt.listeners.length, bttOnce, '返回顶部监听器必须幂等');
});
