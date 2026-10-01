'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  DEFAULT_COMPRESSION,
  loadCompressionConfig,
  isExcluded,
  compressionActive
} = require('./lib/compression-config');

const ROOT = path.resolve(__dirname, '..');

function tempRoot(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-compression-'));
  if (content !== undefined) {
    fs.writeFileSync(path.join(dir, 'compression.json5'), content, 'utf-8');
  }
  return dir;
}

test('文件缺失：返回全默认值且无错误', () => {
  const { config, errors, warnings } = loadCompressionConfig(tempRoot());
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(warnings, []);
  assert.deepStrictEqual(config, DEFAULT_COMPRESSION);
});

test('深合并：仅覆盖显式字段，其余回退默认', () => {
  const { config, errors, warnings } = loadCompressionConfig(tempRoot(
    "{ html: { aggressive: true }, js: { obfuscate: { enabled: true, preset: 'high' } } }"
  ));
  assert.deepStrictEqual(errors, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /html\.aggressive/);
  assert.equal(config.html.enabled, true);
  assert.equal(config.html.removeComments, true);
  assert.equal(config.html.aggressive, true);
  assert.equal(config.js.enabled, true);
  assert.equal(config.js.minify, true);
  assert.equal(config.js.obfuscate.enabled, true);
  assert.equal(config.js.obfuscate.preset, 'high');
  assert.equal(config.js.obfuscate.seed, 0);
  assert.equal(config.verify.headless, true);
});

test("深合并：'__proto__' 键保留为自有属性且不改写原型", () => {
  const { config, errors } = loadCompressionConfig(tempRoot("{ '__proto__': { marker: true } }"));
  assert.deepStrictEqual(errors, []);
  assert.ok(Object.prototype.hasOwnProperty.call(config, '__proto__'));
  assert.deepStrictEqual(config.__proto__, { marker: true });
  assert.strictEqual(Object.getPrototypeOf(config), Object.prototype);
});

test('exclude 为整体替换：不与默认项拼接', () => {
  const { config, errors } = loadCompressionConfig(tempRoot("{ exclude: ['keep/**'] }"));
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(config.exclude, ['keep/**']);
});

test('非法类型：布尔字段逐项报错', () => {
  const { errors } = loadCompressionConfig(tempRoot(
    "{ enabled: 'yes', html: { collapseWhitespace: 1 }, verify: { headless: 'yes' }, js: { minify: null } }"
  ));
  assert.equal(errors.length, 4);
  assert.ok(errors.some(e => /compression\.enabled 必须是布尔值/.test(e)));
  assert.ok(errors.some(e => /compression\.html\.collapseWhitespace 必须是布尔值/.test(e)));
  assert.ok(errors.some(e => /compression\.verify\.headless 必须是布尔值/.test(e)));
  assert.ok(errors.some(e => /compression\.js\.minify 必须是布尔值/.test(e)));
});

test('枚举：obfuscate.preset 仅接受 low | medium | high', () => {
  const bad = loadCompressionConfig(tempRoot("{ js: { obfuscate: { preset: 'max' } } }"));
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /js\.obfuscate\.preset/);
  const good = loadCompressionConfig(tempRoot("{ js: { obfuscate: { preset: 'low' } } }"));
  assert.deepStrictEqual(good.errors, []);
});

test('seed：必须为非负整数', () => {
  for (const value of ['-1', '1.5', "'7'", 'null']) {
    const { errors } = loadCompressionConfig(tempRoot('{ js: { obfuscate: { seed: ' + value + ' } } }'));
    assert.equal(errors.length, 1, 'seed 非法值应报错：' + value);
    assert.match(errors[0], /js\.obfuscate\.seed/);
  }
  const { errors } = loadCompressionConfig(tempRoot('{ js: { obfuscate: { seed: 20260927 } } }'));
  assert.deepStrictEqual(errors, []);
});

test('exclude 校验：非空字符串数组，逐项检查', () => {
  const cases = [
    ['{ exclude: {} }', /exclude 必须是非空字符串数组/],
    ['{ exclude: [] }', /exclude 必须是非空字符串数组/],
    ["{ exclude: ['ok', ''] }", /exclude\[1\] 必须是非空字符串/],
    ["{ exclude: ['ok', 7] }", /exclude\[1\] 必须是非空字符串/]
  ];
  for (const [source, expected] of cases) {
    const { errors } = loadCompressionConfig(tempRoot(source));
    assert.equal(errors.length, 1, source);
    assert.match(errors[0], expected, source);
  }
});

test('未知键：顶层与嵌套仅告警，不报错', () => {
  const { errors, warnings } = loadCompressionConfig(tempRoot(
    '{ unknownTop: 1, html: { unknownHtml: true } }'
  ));
  assert.deepStrictEqual(errors, []);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.some(w => /compression\.unknownTop 不是已知配置键/.test(w)));
  assert.ok(warnings.some(w => /compression\.html\.unknownHtml 不是已知配置键/.test(w)));
});

test('解析失败：返回错误与默认值，不抛出', () => {
  const { config, errors } = loadCompressionConfig(tempRoot('{ enabled: true'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /compression\.json5 解析失败/);
  assert.deepStrictEqual(config, DEFAULT_COMPRESSION);
});

test('顶层非对象：报错并回退默认值', () => {
  const { config, errors } = loadCompressionConfig(tempRoot('[1, 2]'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /顶层必须是对象/);
  assert.deepStrictEqual(config, DEFAULT_COMPRESSION);
});

test('默认值注册表：exclude 覆盖计划约定的 12 项豁免', () => {
  assert.deepStrictEqual(DEFAULT_COMPRESSION.exclude, [
    'report.txt', 'build-report.html', 'assets/vendor/**', 'media/**', 'og/**',
    'assets/fonts/**', '**/*.woff2', '**/*.avif', '**/*.webp', '**/*.png', '**/*.jpg', '**/*.svg'
  ]);
});

test('仓库内 compression.json5 可被无告警加载', () => {
  const { config, errors, warnings } = loadCompressionConfig(ROOT);
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(warnings, []);
  assert.equal(config.enabled, true);
  assert.equal(config.html.aggressive, false);
  assert.equal(config.js.obfuscate.enabled, false);
});

test('isExcluded 默认名单：vendor / media / 报告 / 二进制资源命中，普通文本不命中', () => {
  const hits = [
    'assets/vendor/x.js',
    'assets/vendor',
    'media/a/b.png',
    'og/card.png',
    'assets/fonts/subset.woff2',
    'zh/deep/card.svg',
    'report.txt',
    'build-report.html'
  ];
  for (const rel of hits) assert.equal(isExcluded(rel), true, rel + ' 应命中豁免');
  const misses = ['index.html', 'assets/css/main.css', 'assets/js/app.js', 'assets/vendor-not/x.js'];
  for (const rel of misses) assert.equal(isExcluded(rel), false, rel + ' 不应命中豁免');
});

test('isExcluded glob 语义：** 跨目录、* 段内、? 单字符、大小写敏感', () => {
  assert.equal(isExcluded('a.woff2', ['**/*.woff2']), true);
  assert.equal(isExcluded('assets/fonts/sub/a.woff2', ['**/*.woff2']), true);
  assert.equal(isExcluded('a/b.js', ['a/*.js']), true);
  assert.equal(isExcluded('a/b/c.js', ['a/*.js']), false);
  assert.equal(isExcluded('a/b.js', ['a/**/*.js']), true);
  assert.equal(isExcluded('a/x/b.js', ['a/**/*.js']), true);
  assert.equal(isExcluded('a/b/c.js', ['a/**']), true);
  assert.equal(isExcluded('a.txt', ['?.txt']), true);
  assert.equal(isExcluded('ab.txt', ['?.txt']), false);
  assert.equal(isExcluded('Report.TXT', ['report.txt']), false);
  assert.equal(isExcluded('report.txt', ['report.txt']), true);
  assert.equal(isExcluded('x/report.txt', ['report.txt']), false);
});

test('isExcluded 路径归一化：反斜杠 / 前导斜杠 / ./ 一律按 dist 相对路径处理', () => {
  assert.equal(isExcluded('assets\\vendor\\x.js'), true);
  assert.equal(isExcluded('./media/a.png'), true);
  assert.equal(isExcluded('/assets/vendor/x.js'), true);
  assert.equal(isExcluded('assets\\vendor\\x.js', ['assets/vendor/**']), true);
});

test('compressionActive：serve / watch 强制关闭，其余按总开关', () => {
  assert.equal(compressionActive({ enabled: true }, { serve: true }), false);
  assert.equal(compressionActive({ enabled: true }, { watch: true }), false);
  assert.equal(compressionActive({ enabled: true }, { serve: true, watch: false }), false);
  assert.equal(compressionActive({ enabled: false }, {}), false);
  assert.equal(compressionActive({ enabled: true }, {}), true);
  assert.equal(compressionActive({}, {}), true);
  assert.equal(compressionActive(undefined, {}), true);
  assert.equal(compressionActive(DEFAULT_COMPRESSION, { serve: false, watch: false }), true);
});
