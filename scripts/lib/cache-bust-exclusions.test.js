'use strict';
// cacheBust 排除判定单测：产物重命名（scripts/build/minify.js）与搜索索引的
// featuredImage 最终路径预计算（scripts/lib/search-index.js）必须共用同一判定，否则索引会写入
// 「本轮从未被重命名」的哈希路径（搜索结果缩略图 404）。
// 运行：node --test scripts/lib/cache-bust-exclusions.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { isCacheBustExcluded, cacheBustExclusionOptions, EXCLUDED_SEGMENTS } = require('./cache-bust-exclusions');
const { DEFAULT_CONFIG } = require('./site-defaults');

test('isCacheBustExcluded：目录豁免作用于任意层级', () => {
  assert.deepStrictEqual([...EXCLUDED_SEGMENTS].sort(), ['assets', 'node_modules', 'og']);
  assert.strictEqual(isCacheBustExcluded('assets/js/app.js'), true);
  assert.strictEqual(isCacheBustExcluded('media/og/cover.png'), true, 'og 作为中间段同样豁免');
  assert.strictEqual(isCacheBustExcluded('local/node_modules/x/y.js'), true);
  assert.strictEqual(isCacheBustExcluded('media/pic.jpg'), false);
  assert.strictEqual(isCacheBustExcluded('/media/pic.jpg'), false, '站内绝对 URL 与相对路径等价');
  assert.strictEqual(isCacheBustExcluded('media\\pic.jpg'), false, 'Windows 分隔符归一化');
});

test('isCacheBustExcluded：仅目录段豁免，根级同名文件不受影响', () => {
  assert.strictEqual(isCacheBustExcluded('og'), false);
  assert.strictEqual(isCacheBustExcluded('/assets'), false);
  assert.strictEqual(isCacheBustExcluded(''), true, '空路径视为排除（防御）');
});

test('isCacheBustExcluded：SW 基名与 PWA 图标 basename 在任意目录豁免', () => {
  const opts = { swBaseName: 'sw.js', iconBaseNames: new Set(['logo.png', 'icon-192.png']) };
  assert.strictEqual(isCacheBustExcluded('sw.js', opts), true);
  assert.strictEqual(isCacheBustExcluded('media/sw.js', opts), true);
  assert.strictEqual(isCacheBustExcluded('media/logo.png', opts), true);
  assert.strictEqual(isCacheBustExcluded('deep/dir/icon-192.png', opts), true);
  assert.strictEqual(isCacheBustExcluded('media/pic.jpg', opts), false);
  // 数组形式同样支持（调用方不必先构造 Set）
  assert.strictEqual(isCacheBustExcluded('media/logo.png', { iconBaseNames: ['logo.png'] }), true);
});

test('cacheBustExclusionOptions：从 site.pwa 派生 SW 基名与图标名（去查询串/片段）', () => {
  const derived = cacheBustExclusionOptions({
    pwa: {
      serviceWorker: '/sw-v2.js?v=1',
      manifest: { icons: [{ src: '/icons/apple.png?v=2#x' }, { src: '' }, { nope: 1 }] }
    }
  });
  assert.strictEqual(derived.swBaseName, 'sw-v2.js');
  assert.deepStrictEqual([...derived.iconBaseNames], ['apple.png']);

  const fallback = cacheBustExclusionOptions(undefined);
  assert.strictEqual(
    fallback.swBaseName,
    path.basename(DEFAULT_CONFIG.site.pwa.serviceWorker.split('?')[0].split('#')[0])
  );
  assert.ok(fallback.iconBaseNames instanceof Set, '默认配置（manifest 无 icons）应返回空集合');
});
