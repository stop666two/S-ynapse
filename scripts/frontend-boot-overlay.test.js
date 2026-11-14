'use strict';
// 回归：外置配置加载缓慢时，加载遮罩必须在 await __CONFIG_READY__ 之前就出现。
// 旧实现把遮罩创建放在 await 之后，最长 features.boot.configTimeoutMs（默认 3s）内
// 关键队列全部排队等待、且没有任何视觉反馈。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'core', 'boot.js'), 'utf-8');
const load = () => import('data:text/javascript;base64,' + Buffer.from(SRC, 'utf-8').toString('base64'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkEl(tag) {
  const node = {
    tagName: tag,
    className: '',
    textContent: '',
    style: {},
    children: [],
    attrs: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(n) { this.children.push(n); return n; },
    querySelector() { return null; },
    remove() { this.removed = true; }
  };
  return node;
}

test('配置等待期间必须先挂遮罩，且展示时刻早于配置就绪', async () => {
  let resolveConfig = null;
  const ready = new Promise((r) => { resolveConfig = r; });
  const body = mkEl('body');
  global.window = {
    __CONFIG_READY__: ready,
    __FEATURES__: { loading: { enabled: true, delayMs: 0 }, boot: { interactionWake: false } },
    matchMedia: () => ({ matches: false }),
    addEventListener() {}
  };
  global.document = {
    documentElement: { classList: { add() {}, remove() {}, contains() { return false; } }, getAttribute: () => '' },
    body,
    createElement: mkEl,
    addEventListener() {},
    hidden: false,
    visibilityState: 'visible',
    readyState: 'complete'
  };
  global.requestAnimationFrame = (cb) => { setTimeout(() => cb(0), 0); return 1; };

  const { boot } = await load();
  const pending = boot({ critical: [() => {}], idle: [], heavy: [] });
  // 配置迟迟不就绪：此时遮罩必须已经出现（默认 delayMs=120）
  await sleep(220);
  assert.ok(body.children.length >= 1, '等待配置期间（>120ms 未就绪）遮罩必须已在 DOM 中');

  resolveConfig();
  await pending;
  const stats = global.window.__BOOT__;
  assert.strictEqual(typeof stats.preConfigOverlayAt, 'number', '必须记录等待期间遮罩的展示时刻');
  assert.ok(stats.preConfigOverlayAt < stats.configReadyAt, '遮罩展示必须早于配置就绪');
  assert.strictEqual(body.children.length, 1, '配置就绪后必须复用同一遮罩（不得重建第二个）');
});
