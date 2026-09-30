const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { findDuplicateKeys, filterAllowlisted, matchesAllowlistFile } = require('./lib/config-duplicates');

const CLI = path.join(__dirname, 'check-config-duplicates.js');
const FIXTURES = path.join(__dirname, 'test-fixtures', 'config-duplicates');

function runCli(args) {
  return spawnSync(process.execPath, [CLI].concat(args || []), { encoding: 'utf-8' });
}

describe('findDuplicateKeys 同对象重复', () => {
  it('双引号键在同一对象内重复：记录首次与重复行号', () => {
    const text = '{\n  "a": 1,\n  "a": 2\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, [{ key: 'a', firstLine: 2, duplicateLine: 3 }]);
    assert.strictEqual(result.keyCount, 2);
  });

  it('引号/无引号/单引号混合：按键名判定，重复全部报出', () => {
    const text = "{\n  a: 1,\n  \"a\": 2,\n  'a': 3\n}";
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, [
      { key: 'a', firstLine: 2, duplicateLine: 3 },
      { key: 'a', firstLine: 2, duplicateLine: 4 },
    ]);
    assert.strictEqual(result.keyCount, 3);
  });

  it('注释与换行穿插在键与冒号之间仍能识别', () => {
    const text = '{\n  "a" /* x */ : 1,\n  a\n  : 2\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, [{ key: 'a', firstLine: 2, duplicateLine: 3 }]);
  });
});

describe('findDuplicateKeys 作用域隔离', () => {
  it('数组内不同对象的同名键各自独立，不误报', () => {
    const text = '{\n  list: [\n    { id: 1, name: "x" },\n    { id: 2, name: "y" },\n  ]\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, []);
  });

  it('嵌套对象与外层同名键互不干扰，仅报同作用域重复', () => {
    const text = '{\n  outer: {\n    same: 1,\n    same: 2\n  },\n  same: 3,\n  inner: { same: 4 }\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, [{ key: 'same', firstLine: 3, duplicateLine: 4 }]);
  });

  it('深嵌套对象内重复只在其自身作用域内报出', () => {
    const text = '{\n  a: { b: { c: 1, c: 2 } }\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, [{ key: 'c', firstLine: 2, duplicateLine: 2 }]);
  });
});

describe('findDuplicateKeys 干扰排除', () => {
  it('字符串中的 {、key: 与注释符不参与判定', () => {
    const text = '{\n  a: "text { not: a key // nope /* still */",\n  b: \'another "a": fake\'\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, []);
  });

  it('行注释与块注释中的伪键不参与判定', () => {
    const text = '{\n  // a: 1\n  /* b: 2\n     c: 3 */\n  a: 1,\n  b: 2\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, []);
  });

  it('转义引号键按解码后的键名比较', () => {
    const text = '{\n  "quote\\"key": 1,\n  \'quote"key\': 2\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, [{ key: 'quote"key', firstLine: 2, duplicateLine: 3 }]);
  });

  it('反斜杠转义与 \\u 转义键按解码后的键名比较', () => {
    const text = '{\n  "\\u0061": 1,\n  a: 2,\n  "back\\\\slash": 3,\n  "back\\\\slash": 4\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, [
      { key: 'a', firstLine: 2, duplicateLine: 3 },
      { key: 'back\\slash', firstLine: 4, duplicateLine: 5 },
    ]);
  });

  it('零重复文本返回空清单并统计键数', () => {
    const text = '{\n  a: 1,\n  b: { a: 2 }\n}';
    const result = findDuplicateKeys(text);
    assert.deepStrictEqual(result.findings, []);
    assert.strictEqual(result.keyCount, 3);
  });

  it('空文本与 BOM 开头的文本均可处理', () => {
    assert.deepStrictEqual(findDuplicateKeys('').findings, []);
    assert.deepStrictEqual(findDuplicateKeys('\uFEFF{ a: 1, a: 2 }').findings, [
      { key: 'a', firstLine: 1, duplicateLine: 1 },
    ]);
  });
});

describe('filterAllowlisted 豁免匹配', () => {
  const findings = [
    { key: 'x', firstLine: 1, duplicateLine: 2 },
    { key: 'y', firstLine: 1, duplicateLine: 3 },
  ];

  it('按路径后缀 + 键名命中豁免，其余保留', () => {
    const split = filterAllowlisted(findings, [{ file: 'site.json5', key: 'x', reason: '文案待确认' }], 'real-site/site.json5');
    assert.deepStrictEqual(split.kept, [{ key: 'y', firstLine: 1, duplicateLine: 3 }]);
    assert.deepStrictEqual(split.suppressed, [{ key: 'x', firstLine: 1, duplicateLine: 2, reason: '文案待确认' }]);
  });

  it('键相同但文件不同不豁免；理由缺失不豁免', () => {
    const split = filterAllowlisted(findings, [
      { file: 'other.json5', key: 'x', reason: 'r' },
      { file: 'site.json5', key: 'y', reason: '' },
    ], 'site.json5');
    assert.strictEqual(split.kept.length, 2);
    assert.strictEqual(split.suppressed.length, 0);
  });

  it('豁免名单容错非数组', () => {
    const split = filterAllowlisted(findings, null, 'site.json5');
    assert.strictEqual(split.kept.length, 2);
  });

  it('matchesAllowlistFile 支持精确路径与路径后缀', () => {
    assert.strictEqual(matchesAllowlistFile('real-site/site.json5', 'site.json5'), true);
    assert.strictEqual(matchesAllowlistFile('site.json5', 'site.json5'), true);
    assert.strictEqual(matchesAllowlistFile('real-site/site.json5', 'real-site/site.json5'), true);
    assert.strictEqual(matchesAllowlistFile('site.json5', 'other.json5'), false);
    assert.strictEqual(matchesAllowlistFile('real-site/mysite.json5', 'site.json5'), false);
  });
});

describe('CLI 真实文件夹具', () => {
  it('夹具目录：检出真重复并以退出码 1 报出（含首次位置）', () => {
    const result = runCli([FIXTURES]);
    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /dupes\.json5:5: title（首次 .*dupes\.json5:4）/);
    assert.match(result.stderr, /dupes\.json5:8: mode（首次 .*dupes\.json5:7）/);
    assert.doesNotMatch(result.stderr, /clean\.json5/);
  });

  it('夹具目录内 clean.json5 不产生误报', () => {
    const result = runCli([FIXTURES]);
    const dupOnly = result.stderr.split(/\r?\n/).filter((line) => line.trim().startsWith('- '));
    assert.strictEqual(dupOnly.length, 2);
  });
});

describe('CLI 真实仓库', () => {
  it('默认扫描（仓库根 + real-site）零未豁免重复键，退出码 0', () => {
    const result = runCli([]);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS：零未豁免重复键/);
    assert.match(result.stdout, /扫描 \d+ 个 JSON5 文件/);
  });

  it('豁免项在输出中显式打印而非静默跳过', () => {
    const result = runCli([]);
    assert.match(result.stdout, /\[豁免\] .*site\.json5:\d+: descriptionEn/);
  });
});
