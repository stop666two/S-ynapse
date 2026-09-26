// 打包层单测（优化 Task 1.2）：开关判定、入口存在性、main.js 队列与 deferred 注册表一致性。
// 一致性检查用源码级正则（不 import deferred.js，避免其静态依赖在 Node 下触碰 DOM）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { APP_ENTRY, DEFERRED_ENTRY, bundleEnabled } = require('./lib/bundle');

const ROOT = path.resolve(__dirname, '..');
const MAIN_SRC = fs.readFileSync(path.join(ROOT, 'js', 'core', 'main.js'), 'utf-8');
const DEFERRED_SRC = fs.readFileSync(path.join(ROOT, DEFERRED_ENTRY), 'utf-8');

test('bundleEnabled: 默认启用，--no-bundle 或 esbuild 缺失时回退', () => {
  assert.strictEqual(bundleEnabled(['node', 'scripts/build.js'], true), true);
  assert.strictEqual(bundleEnabled(['node', 'scripts/build.js', '--no-bundle'], true), false);
  assert.strictEqual(bundleEnabled(['node', 'scripts/build.js'], false), false);
});

test('打包入口文件存在', () => {
  assert.strictEqual(fs.existsSync(path.join(ROOT, APP_ENTRY)), true);
  assert.strictEqual(fs.existsSync(path.join(ROOT, DEFERRED_ENTRY)), true);
});

test('main.js 的 dyn(name) 与 deferred 注册表一一对应', () => {
  const dynNames = [...MAIN_SRC.matchAll(/dyn\('([a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(dynNames.length >= 20, 'main.js dyn 数量异常：' + dynNames.length);
  for (const name of dynNames) {
    assert.match(DEFERRED_SRC, new RegExp('(^|\\n)\\s*(?:\'' + name + '\'|' + name + '):'), 'deferred 注册表缺少 ' + name);
  }
});

test('guard 在两种模式下均有加载路径', () => {
  assert.match(MAIN_SRC, /loadFeature\('guard'\)/);
  assert.match(MAIN_SRC, /import\('\.\.\/domains\/guard\/core\.js'\)/);
  assert.match(DEFERRED_SRC, /guard: guardInit/);
});

test('deferred 注册表键数量与 load/has 导出存在', () => {
  const keys = [...DEFERRED_SRC.matchAll(/^\s{2}(?:'([a-z-]+)'|([a-z-]+)):/gm)].map((m) => m[1] || m[2]);
  assert.strictEqual(keys.length, 23, '注册表键数量应为 23，实际 ' + keys.length + '：' + keys.join(','));
  assert.match(DEFERRED_SRC, /export function load\(/);
  assert.match(DEFERRED_SRC, /export function has\(/);
});
