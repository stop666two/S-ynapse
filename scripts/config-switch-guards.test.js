'use strict';

// 配置单一事实源守卫的自检：盘点器、marker 解析、豁免表与绑定校验的纯函数行为。
// 真实仓库的完整守卫由 npm run verify:config-single-source 执行（CI 门禁）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const inv = require('./lib/config-switch-inventory.js');
const source = require('./check-config-single-source.js');

test('collectRows：覆盖 features/tuning/site/navigation/sidebar/theme/security/friends/internals', () => {
  const rows = inv.collectRows();
  const byKey = new Map(rows.map((row) => [row.keyPath, row]));
  assert.ok(rows.length > 700, '开关基数应完整（当前 ' + rows.length + '）');
  for (const key of [
    'features.lightbox.openDurationMs',
    'features.motion.revealStaggerMax',
    'features.guards.preset',
    'tuning.morphicons.stiffness',
    'site.build.minifyHTML',
    'site.rss.enabled',
    'navigation.search.enabled',
    'sidebar.recentPoolSize',
    'theme.darkMode.enabled',
    'security.rateLimiting.enabled',
    'friends.enabled',
    'internals.ci.aggregate',
    'internals.ci.skip.enabled'
  ]) {
    assert.ok(byKey.has(key), '缺少开关：' + key);
  }
  assert.strictEqual(byKey.get('features.guards.preset').type, 'enum');
  assert.strictEqual(byKey.get('theme.darkMode.enabled').type, 'bool');
  assert.strictEqual(byKey.get('sidebar.recentPoolSize').type, 'number');
  for (const row of rows) {
    assert.ok(['bool', 'enum', 'number'].includes(row.type), row.keyPath + ' 类型非法');
    assert.notStrictEqual(row.def, undefined, row.keyPath + ' 默认值缺失');
  }
  const inventory = inv.collectInventory();
  const located = inventory.filter((row) => row.consumers.length > 0);
  assert.ok(located.length >= inventory.length * 0.95,
    '消费点定位率过低：' + located.length + '/' + inventory.length + '（未定位键见矩阵「—」）');
});

test('collectAllMarkers：真实测试 marker 均指向注册表叶子', () => {
  const registry = inv.collectRegistryPaths();
  const markers = inv.collectAllMarkers();
  assert.ok(markers.size >= 150, 'marker 数量异常：' + markers.size);
  for (const [key, hits] of markers) {
    assert.ok(registry.has(key), 'marker 指向未知键：' + key + '（' + hits[0] + '）');
    assert.ok(hits.every((hit) => hit.includes('.test.js:')), 'marker 必须位于测试文件：' + hits[0]);
  }
  assert.ok(markers.has('features.lightbox.openDurationMs'));
});

test('resolveDefault：各配置段可解析；未知键返回 found=false', () => {
  assert.deepStrictEqual(source.resolveDefault('features.lightbox.zoom.enabled'), { found: true, value: true });
  assert.deepStrictEqual(source.resolveDefault('tuning.search.indexRetry'), { found: true, value: 1 });
  assert.deepStrictEqual(source.resolveDefault('sidebar.enabled'), { found: true, value: false });
  assert.deepStrictEqual(source.resolveDefault('internals.report.topN'), { found: true, value: 10 });
  assert.strictEqual(source.resolveDefault('site.nope').found, false);
  assert.strictEqual(source.resolveDefault('nope.x').found, false);
});

test('checkBindings：snippet 失配与字面量漂移都会失败', () => {
  const readFile = () => 'const x = parse(\'v\') || 300;';
  const ok = source.checkBindings([{ file: 'a.js', snippet: "|| 300;", key: 'features.anchorStabilize.settleMs', literal: 300 }], readFile);
  assert.deepStrictEqual(ok, []);
  const missing = source.checkBindings([{ file: 'a.js', snippet: '|| 999;', key: 'features.anchorStabilize.settleMs', literal: 300 }], readFile);
  assert.ok(missing[0].includes('snippet 失配'));
  const drift = source.checkBindings([{ file: 'a.js', snippet: '|| 300;', key: 'features.anchorStabilize.settleMs', literal: 250 }], readFile);
  assert.ok(drift[0].includes('回退字面量漂移'));
  const unknown = source.checkBindings([{ file: 'a.js', snippet: '|| 300;', key: 'features.nope', literal: 300 }], readFile);
  assert.ok(unknown[0].includes('不在注册表'));
});

test('豁免表：类别理由非空、键均指向注册表、无冗余', () => {
  const exemptions = inv.loadExemptions();
  for (const [category, reason] of Object.entries(exemptions.categories)) {
    assert.ok(typeof reason === 'string' && reason.length >= 20, '豁免类别理由过短：' + category);
  }
  const registry = inv.collectRegistryPaths();
  for (const [key, category] of Object.entries(exemptions.keys)) {
    assert.ok(registry.has(key), '豁免键未知：' + key);
    assert.ok(exemptions.categories[category], '豁免键类别未定义：' + key + ' -> ' + category);
  }
  const rows = inv.collectInventory();
  const redundant = rows.filter((row) => row.exemptReason && row.status !== 'exempt');
  assert.deepStrictEqual(redundant.map((row) => row.keyPath), []);
});

test('buildMatrix：行数与开关数一致，含统计与状态图例', () => {
  const rows = inv.collectInventory();
  const text = inv.buildMatrix(rows);
  assert.ok(text.startsWith('# 配置开关矩阵'));
  assert.ok(text.includes('统计：开关共 ' + rows.length));
  const tableRows = text.split('\n').filter((line) => line.startsWith('| `'));
  assert.strictEqual(tableRows.length, rows.length);
  for (const row of rows) {
    assert.ok(!row.keyPath.includes('|'), '键路径不得含表格分隔符');
  }
});

test('checkMatrix：提交版矩阵与生成结果一致（防手改）', () => {
  const rows = inv.collectInventory();
  assert.deepStrictEqual(source.checkMatrix(rows), []);
  assert.strictEqual(fs.existsSync(path.join(ROOT, 'docs', 'config-switch-matrix.md')), true);
});
