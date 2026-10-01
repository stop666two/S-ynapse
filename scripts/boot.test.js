'use strict';
// boot 调度器单测：首帧让步在隐藏/预渲染页必须直接放行（rAF 无回调），
// 不得让关键队列在后台标签页等待首帧而永久挂起（交互初始化不执行的回归）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'core', 'boot.js'), 'utf-8');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(MODULE_SOURCE, 'utf-8').toString('base64'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 最小浏览器桩：仅覆盖 boot() 读取的接口；loading.enabled=false 跳过加载遮罩与遮罩定时器。
function installDomStubs(hidden) {
  const state = { rafCallbacks: [] };
  global.window = {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    __FEATURES__: { loading: { enabled: false }, boot: { interactionWake: false } }
  };
  global.document = {
    hidden,
    visibilityState: hidden ? 'hidden' : 'visible',
    documentElement: { classList: { contains: () => false, add: () => {}, remove: () => {} } },
    body: { setAttribute: () => {}, removeAttribute: () => {} },
    addEventListener: () => {}
  };
  global.requestAnimationFrame = (cb) => { state.rafCallbacks.push(cb); };
  return state;
}

test('隐藏页首帧让步直接放行：rAF 无回调时关键队列仍执行', async () => {
  installDomStubs(true);
  const { boot } = await modulePromise;
  let criticalRan = 0;
  await boot({ critical: [() => { criticalRan += 1; }], idle: [], heavy: [] });
  assert.strictEqual(criticalRan, 1, '隐藏页不得等待首帧：rAF 回调从未触发时关键队列仍应执行');
});

test('可见页首帧让步保留：rAF 回调前关键队列不执行', async () => {
  const stubs = installDomStubs(false);
  const { boot } = await modulePromise;
  let criticalRan = 0;
  const bootPromise = boot({ critical: [() => { criticalRan += 1; }], idle: [], heavy: [] });
  await sleep(20);
  assert.strictEqual(criticalRan, 0, '可见页必须等待首帧回调');
  assert.ok(stubs.rafCallbacks.length >= 1, '可见页应请求 rAF');
  const firstFrame = stubs.rafCallbacks[0];
  firstFrame();
  await bootPromise;
  assert.strictEqual(criticalRan, 1, '首帧回调后关键队列应执行');
});
