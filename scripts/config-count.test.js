'use strict';
// 配置计数一致性测试：README/config-reference 声明的配置项计数必须与实测一致。
// 口径（canonical）：对象逐层展开；数组元素逐项计入且元素为对象时不再展开。
// 实现：scripts/lib/config-count.js。任何配置键增删都必须同步更新文档计数，
// 否则本测试失败——防止「文档计数漂移」再次发生。
// 派生副本（如 real-site/）允许真实站点值覆盖配置而无需同步 canonical 计数，
// 故设 SYNAPSE_DERIVED_COPY=1 时精确计数断言显式跳过并声明原因；
// 主仓库/CI 不设该变量，断言与行为保持全量不变。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { countLeaves, countConfigFiles, ALL_CONFIG_FILES, readJson5 } = require('./lib/config-count.js');

const ROOT = path.resolve(__dirname, '..');
const DERIVED_COPY = process.env.SYNAPSE_DERIVED_COPY === '1';
const DERIVED_SKIP_REASON =
  '派生副本（SYNAPSE_DERIVED_COPY=1）：站点真实值允许覆盖配置计数，精确计数断言跳过；主仓库/CI 不设该变量时全量执行、断言不弱化';

test('countLeaves：对象逐层展开、数组逐项、数组内对象不展开', () => {
  assert.strictEqual(countLeaves(1), 1);
  assert.strictEqual(countLeaves('x'), 1);
  assert.strictEqual(countLeaves({ a: 1, b: { c: 2 } }), 2);
  assert.strictEqual(countLeaves({ a: [1, 2, 3] }), 3);
  assert.strictEqual(countLeaves({ a: [{ x: 1 }, { y: 2 }] }), 2, '数组内对象各计 1、不再展开');
  assert.strictEqual(countLeaves({ a: [[1, 2], { z: 1 }] }), 2, '嵌套数组按元素计');
  assert.strictEqual(countLeaves({ a: [] }), 0);
});

test('实测计数：features 100 模块/993 项、tuning 37 分类/273 项、全仓 2802 项', (t) => {
  if (DERIVED_COPY) {
    t.skip(DERIVED_SKIP_REASON);
    return;
  }
  const { perFile, total } = countConfigFiles(ROOT, ALL_CONFIG_FILES);
  assert.strictEqual(perFile['features.json5'].topKeys, 100, 'features 模块数');
  assert.strictEqual(perFile['features.json5'].items, 993, 'features 配置项');
  assert.strictEqual(perFile['tuning.json5'].topKeys, 37, 'tuning 分类数');
  assert.strictEqual(perFile['tuning.json5'].items, 273, 'tuning 配置项');
  assert.strictEqual(perFile['guard.json5'].topKeys, 11, 'guard 模块数');
  assert.strictEqual(perFile['guard.json5'].items, 179, 'guard 配置项');
  assert.strictEqual(total, 2802, '14 个配置文件总项');
});

test('README：总数/features/tuning 计数与实测一致，无旧计数残留', (t) => {
  if (DERIVED_COPY) {
    t.skip(DERIVED_SKIP_REASON);
    return;
  }
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf-8');
  const totalMatch = /实测 (\d+) 项/.exec(readme);
  assert.ok(totalMatch, 'README 应声明「实测 N 项」');
  assert.strictEqual(Number(totalMatch[1]), 2802, 'README 总项数');
  const featMatch = /\*\*(\d+) 个模块、(\d+) 个配置项\*\*/.exec(readme);
  assert.ok(featMatch, 'README 应声明 features 模块数/配置项数');
  assert.strictEqual(Number(featMatch[1]), 100, 'README features 模块数');
  assert.strictEqual(Number(featMatch[2]), 993, 'README features 配置项');
  const tunMatch = /（(\d+) 分类 \/ (\d+) 项）/.exec(readme);
  assert.ok(tunMatch, 'README 应声明 tuning 分类数/项数');
  assert.strictEqual(Number(tunMatch[1]), 37, 'README tuning 分类数');
  assert.strictEqual(Number(tunMatch[2]), 273, 'README tuning 项数');
  assert.ok(readme.includes('100 模块/993 项'), 'README 目录树 features 计数应同步');
  assert.ok(readme.includes('37 分类/273 项'), 'README 目录树 tuning 计数应同步');
  assert.ok(readme.includes('11 个模块/179 项'), 'README 目录树 guard 计数应同步');
  assert.ok(!readme.includes('2692'), 'README 不得残留旧总数 2692');
  assert.ok(!readme.includes('919 项'), 'README 不得残留旧 features 计数 919');
  assert.ok(!readme.includes('936 项'), 'README 不得残留旧 features 计数 936');
  assert.ok(!readme.includes('177 项'), 'README 不得残留旧 guard 计数 177');
  assert.ok(!readme.includes('2718'), 'README 不得残留旧总数 2718');
  assert.ok(!readme.includes('2728'), 'README 不得残留旧总数 2728');
  assert.ok(!readme.includes('944 个配置项'), 'README 不得残留旧 features 计数 944');
  assert.ok(!readme.includes('2753'), 'README 不得残留旧总数 2753');
  assert.ok(!readme.includes('964 个配置项'), 'README 不得残留旧 features 计数 964');
  assert.ok(!readme.includes('2758'), 'README 不得残留旧总数 2758');
  assert.ok(!readme.includes('965 个配置项'), 'README 不得残留旧 features 计数 965');
  assert.ok(!readme.includes('2760'), 'README 不得残留旧总数 2760');
  assert.ok(!readme.includes('967 个配置项'), 'README 不得残留旧 features 计数 967');
  assert.ok(!readme.includes('2767'), 'README 不得残留旧总数 2767');
  assert.ok(!readme.includes('972 个配置项'), 'README 不得残留旧 features 计数 972');
  assert.ok(!readme.includes('2792'), 'README 不得残留旧总数 2792');
  assert.ok(!readme.includes('989 个配置项'), 'README 不得残留旧 features 计数 989');
});

test('config-reference：tuning 章节计数与 search 分类计数与实测一致', function (t) {
  if (DERIVED_COPY) {
    t.skip(DERIVED_SKIP_REASON);
    return;
  }
  const docsPath = path.join(ROOT, 'docs', 'config-reference.md');
  if (!fs.existsSync(docsPath)) {
    t.skip('发布包不含 docs/config-reference.md（文档不进包），计数一致性检查在源码仓库执行');
    return;
  }
  const doc = fs.readFileSync(docsPath, 'utf-8');
  const header = /独立 UI 参数文件\((\d+) 分类 \/ (\d+) 项/.exec(doc);
  assert.ok(header, 'config-reference 应有 tuning 计数声明');
  assert.strictEqual(Number(header[1]), 37, 'tuning 分类数');
  assert.strictEqual(Number(header[2]), 273, 'tuning 项数');
  const searchCount = /\*\*search（(\d+) 项）\*\*/.exec(doc);
  assert.ok(searchCount, 'config-reference 应有 tuning.search 项数声明');
  const tuning = readJson5(path.join(ROOT, 'tuning.json5'));
  assert.strictEqual(Number(searchCount[1]), Object.keys(tuning.search).length, 'tuning.search 声明项数应等于实际键数');
});
