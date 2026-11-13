'use strict';
// R-25 回归：配置外置加载失败时 features.readingHistory 只剩 enabled（降级子集仅内联 guards），
// storageKey 缺失必须回退默认键 's-history'，而不是写入字符串 "undefined" 键。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'domains', 'features', 'reading-history.js'), 'utf-8');
const load = () => import('data:text/javascript;base64,' + Buffer.from(SRC, 'utf-8').toString('base64'));

function installDom() {
  const store = {};
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  global.location = { pathname: '/zh/post/', origin: 'https://site.example', search: '' };
  global.window = {
    // 降级形态：只有 enabled（配置加载失败后的 __CRIT__ 子集语义）
    __FEATURES__: { readingHistory: { enabled: true } },
    __T: (k, d) => d || k,
    langOf: () => 'zh',
    innerHeight: 500,
    scrollY: 0,
    addEventListener() {},
    __SOFTNAV_HOOKS__: []
  };
  global.document = {
    documentElement: { scrollHeight: 1000 },
    title: 'Doc title',
    prerendering: false,
    querySelector(sel) {
      if (sel === '.post-content') return {};
      if (sel === 'h1') return { textContent: '  Title  ' };
      return null;
    },
    getElementById() { return null; },
    addEventListener() {}
  };
  return store;
}

test('R-25 配置缺 storageKey 时不得写入 "undefined" 键', async () => {
  const store = installDom();
  const { init } = await load();
  init();
  assert.ok(Object.prototype.hasOwnProperty.call(store, 's-history'), '必须写入默认键 s-history（与 continue-reading 同源）');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(store, 'undefined'), false, '不得写入字符串 undefined 键');
  const list = JSON.parse(store['s-history']);
  assert.ok(Array.isArray(list) && list.length === 1 && list[0].url === '/zh/post/');
});
