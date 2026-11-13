'use strict';

// site.build.relatedArticles 接线的单测（审查 R-33 覆盖）。
// 该开关此前只是构建管线里的一句内联判断（`config.site.build.relatedArticles !== false`），
// 没有可单测的入口，覆盖证据只能靠跑两次完整构建。抽成 relatedEnabled() 后在此锁定两种取值，
// 并确认 computeRelatedArticles 在关闭态不会被触发（由调用点保证，这里断言判据本身）。
const { test } = require('node:test');
const assert = require('node:assert');
const { relatedEnabled, computeRelatedArticles } = require('./lib/related.js');

// switch: site.build.relatedArticles
test('relatedEnabled：仅当 site.build.relatedArticles 为 false 时关闭', () => {
  const on =relatedEnabled({ build: { relatedArticles: true } });
  const off = relatedEnabled({ build: { relatedArticles: false } });
  assert.strictEqual(on, true, '显式 true 应开启');
  assert.strictEqual(off, false, '显式 false 应关闭');
  // 默认口径：键缺失时必须是开启（历史行为，不能因为少写配置而悄悄丢功能）
  assert.strictEqual(relatedEnabled({ build: {} }), true, '缺键默认开启');
  assert.strictEqual(relatedEnabled({}), true, 'site 无 build 段默认开启');
  assert.strictEqual(relatedEnabled(undefined), true, '无 site 默认开启');
  // 只有严格的 false 才算关闭：字符串 'false' / 0 等不改变默认语义（与既有 !== false 判断一致）
  assert.strictEqual(relatedEnabled({ build: { relatedArticles: 'false' } }), true);
  assert.strictEqual(relatedEnabled({ build: { relatedArticles: 0 } }), true);
});

test('relatedEnabled 关闭时不会计算相关文章（调用点契约）', () => {
  const articles = [
    { lang: 'zh', slug: 'a', title: 'A', tags: ['x'], categories: [], date: '2026-01-01', url: '/zh/a/' },
    { lang: 'zh', slug: 'b', title: 'B', tags: ['x'], categories: [], date: '2026-01-02', url: '/zh/b/' }
  ];
  // 模拟构建管线：先按判据决定是否写入 article.relatedArticles
  for (const enabled of [true, false]) {
    const site = { build: { relatedArticles: enabled } };
    const copies = articles.map((item) => Object.assign({}, item));
    if (relatedEnabled(site)) computeRelatedArticles(copies, { topN: 4 });
    for (const item of copies) {
      if (enabled) assert.ok(Array.isArray(item.relatedArticles), '开启态必须写入 relatedArticles');
      else assert.strictEqual(item.relatedArticles, undefined, '关闭态不得写入 relatedArticles');
    }
  }
});
