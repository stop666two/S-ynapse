'use strict';

// 配置单一事实源守卫的自检：盘点器、marker 解析、豁免表与绑定校验的纯函数行为。
// 真实仓库的完整守卫由 npm run verify:config-single-source 执行（CI 门禁）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
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

test('sanitizeCode：注释与字符串字面量置空，真实代码原样保留', () => {
  // 审查 R-33：旧索引直接按原文切词，于是注释/文案里的键名也能当「既有引用」
  assert.strictEqual(inv.sanitizeCode('var a = 1; // enabled').trim(), 'var a = 1;');
  assert.ok(!inv.sanitizeCode('var a = 1; // enabled').includes('enabled'));
  assert.ok(!inv.sanitizeCode("var s = 'features.anchorStabilize.enabled';").includes('anchorStabilize'));
  assert.ok(inv.sanitizeCode('var keepName = 1;').includes('keepName'));
  // 块注释跨行：换行保留（行号不变），内容置空
  const blocked = inv.sanitizeCode('/* enabled\n enabled */\nvar keep = 2;');
  assert.strictEqual(blocked.split('\n').length, 3);
  assert.ok(!blocked.includes('enabled'));
  assert.ok(blocked.includes('var keep = 2;'));
  // 正则字面量里的引号不得让扫描器误判字符串起点
  const regexLine = inv.sanitizeCode("const re = /['\"]/g; var ok = 1;");
  assert.ok(regexLine.includes('var ok = 1;'));
});

test('scanTestBlocks：只认 test()/it() 调用，断言判定忽略注释里的 assert', () => {
  const blocks = inv.scanTestBlocks([
    "const { test } = require('node:test');",
    "describe('g', () => {",
    "  test('with assert', () => {",
    "    assert.strictEqual(1, 1);",
    "  });",
    "  test('no assert', () => {",
    "    // assert 只出现在注释里，不算断言",
    "    const x = 1;",
    "  });",
    "});"
  ].join('\n'));
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0].hasAssert, true);
  assert.strictEqual(blocks[1].hasAssert, false);
});

test('collectSwitchMarkers：marker 必须绑定到含断言的测试（审查 R-33 回归）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'switch-marker-'));
  const file = path.join(dir, 'sample.test.js');
  // 标签文本在运行时拼接：本文件本身是被扫描的 *.test.js，不能把 marker 逐字写进源码，
  // 否则这些测试用的假键会被 collectAllMarkers 当成「指向未知开关」。
  const tag = '// sw' + 'itch: ';
  fs.writeFileSync(file, [
    "'use strict';",
    "const { test, describe } = require('node:test');",
    "const assert = require('node:assert');",
    "describe('悬空 marker', () => {",
    "  " + tag + "features.demoDangling.enabled",
    "  test('没有断言', () => {",
    "    const x = 1;",
    "  });",
    "});",
    "describe('正常 marker', () => {",
    "  " + tag + "features.demoAttached.enabled",
    "  test('有断言', () => {",
    "    assert.ok(true);",
    "  });",
    "  test('体内 marker', () => {",
    "    " + tag + "features.demoInside.enabled",
    "    assert.strictEqual(1, 1);",
    "  });",
    "});",
    tag + "features.demoTrailing.enabled"
  ].join('\n'), 'utf-8');
  const markers = inv.collectSwitchMarkers([file]);
  assert.ok(!markers.has('features.demoDangling.enabled'), '紧邻无断言测试的 marker 不得算覆盖（旧实现会放行）');
  assert.ok(!markers.has('features.demoTrailing.enabled'), '文件末尾悬空 marker 不得算覆盖（旧实现会放行）');
  assert.ok(markers.has('features.demoAttached.enabled'));
  assert.ok(markers.has('features.demoInside.enabled'));
});

test('既有引用证据：注释与同名 token 不再替开关作证（审查 R-33 回归）', () => {
  const rows = inv.collectInventory();
  // 旧矩阵把 features.anchorStabilize.enabled / contentPolicy.enabled 的覆盖证据指到
  // scripts/auto-cover.test.js:22——那里只是 features.listCover.autoGenerate.* 的 marker 与
  // 一个无关配置对象。这两条错误引用必须消失。
  for (const keyPath of ['features.anchorStabilize.enabled', 'contentPolicy.enabled']) {
    const row = rows.find((item) => item.keyPath === keyPath);
    assert.ok(row, '缺少开关：' + keyPath);
    const cited = row.tested.concat(row.existing);
    assert.ok(!cited.some((hit) => hit.startsWith('scripts/auto-cover.test.js:')),
      keyPath + ' 不得引用 auto-cover.test.js（该文件不测这个开关）：' + cited.join(','));
  }
  // 更强的通用不变式：既有引用必须落在真实代码行，注释行不能作证据
  for (const row of rows) {
    for (const hit of row.existing) {
      const parts = hit.split(':');
      const code = inv.sanitizeCode(fs.readFileSync(path.join(ROOT, parts[0]), 'utf-8')).split(/\r?\n/)[Number(parts[1]) - 1] || '';
      assert.ok(code.trim().length > 0, '既有引用落在注释/空行：' + hit + '（' + row.keyPath + '）');
    }
  }
});

test('基线棘轮：基线键集合与当前缺失集合一致，且基线不为已覆盖键留条目', () => {
  const baseline = source.loadBaseline();
  const rows = inv.collectInventory();
  const missing = rows.filter((row) => row.status === 'MISSING').map((row) => row.keyPath).sort();
  assert.deepStrictEqual([...baseline].sort(), missing,
    '新增未覆盖开关必须补证据或登记豁免；已覆盖的开关必须从基线删除（基线只允许缩小）');
  assert.ok(baseline.size > 0, '基线不应为空（否则等于零容忍，需同步清理豁免表）');
  assert.deepStrictEqual(source.checkCoverage(rows, baseline), []);
});

test('checkMatrix：提交版矩阵与生成结果一致（防手改）', () => {
  const rows = inv.collectInventory();
  assert.deepStrictEqual(source.checkMatrix(rows), []);
  assert.strictEqual(fs.existsSync(path.join(ROOT, 'docs', 'config-switch-matrix.md')), true);
});
