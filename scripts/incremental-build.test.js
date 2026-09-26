'use strict';
// 增量构建（features.incrementalBuild）单测：指纹算法、稳定序列化、页面缓存键、增量上下文决策。
// 运行：node --test scripts/incremental-build.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const inc = require('./lib/incremental.js');

test('normalizeHashAlgo / hashContent：三种算法与非法回退', () => {
  assert.strictEqual(inc.normalizeHashAlgo('sha1'), 'sha1');
  assert.strictEqual(inc.normalizeHashAlgo('SHA256'), 'sha256');
  assert.strictEqual(inc.normalizeHashAlgo('md5'), 'md5');
  assert.strictEqual(inc.normalizeHashAlgo('bogus'), 'sha1');
  assert.strictEqual(inc.normalizeHashAlgo(undefined), 'sha1');
  assert.strictEqual(inc.hashContent('abc', 'sha1').length, 40);
  assert.strictEqual(inc.hashContent('abc', 'sha256').length, 64);
  assert.strictEqual(inc.hashContent('abc', 'md5').length, 32);
  assert.strictEqual(inc.hashContent('abc', 'bogus'), inc.hashContent('abc', 'sha1'));
  assert.notStrictEqual(inc.hashContent('abc', 'sha1'), inc.hashContent('abd', 'sha1'));
});

test('stableSerialize：键排序稳定、函数/undefined 跳过、nonce 归一化', () => {
  const a = inc.stableSerialize({ b: 1, a: { d: 2, c: 3 }, fn: function () {}, u: undefined });
  const b = inc.stableSerialize({ a: { c: 3, d: 2 }, b: 1, fn: function () { return 1; } });
  assert.strictEqual(a, b, '相同输入（含函数）必须得到相同串');
  assert.ok(!a.includes('fn'), '函数值不得进入序列化结果');
  const n1 = inc.stableSerialize({ directives: { 'script-src': ["'self'", "'nonce-AAA'"] } });
  const n2 = inc.stableSerialize({ directives: { 'script-src': ["'self'", "'nonce-BBB'"] } });
  assert.strictEqual(n1, n2, '构建期 nonce 必须归一化');
  const h1 = inc.stableSerialize({ html: '<style nonce="AAA">x</style><script nonce="AAA"></script>' });
  const h2 = inc.stableSerialize({ html: '<style nonce="BBB">x</style><script nonce="BBB"></script>' });
  assert.strictEqual(h1, h2, 'HTML nonce 属性必须归一化');
  assert.ok(JSON.parse(h1).html.includes('nonce="*"'), '保留 nonce 属性占位：' + h1);
  const arr = [1, undefined, function () {}, 'x'];
  assert.strictEqual(inc.stableSerialize(arr), '[1,null,null,"x"]');
});

test('stableSerialize：循环引用与 Date 处理', () => {
  const o = { name: 'x' };
  o.self = o;
  const s = inc.stableSerialize(o);
  assert.ok(s.includes('[circular]'));
  const d = inc.stableSerialize({ t: new Date('2026-01-02T00:00:00Z') });
  assert.ok(d.includes('2026-01-02T00:00:00.000Z'));
});

test('pageCacheKey：relPath 隔离 / 输入敏感 / 算法可切换', () => {
  const input = inc.stableSerialize({ title: 'Hello', body: 'x' });
  const k1 = inc.pageCacheKey('zh/index.html', input, 'sha1');
  const k2 = inc.pageCacheKey('zh/archive/index.html', input, 'sha1');
  assert.notStrictEqual(k1, k2, '不同 relPath 必须得到不同键');
  assert.strictEqual(k1, inc.pageCacheKey('zh/index.html', input, 'sha1'));
  const changed = inc.stableSerialize({ title: 'Hello2', body: 'x' });
  assert.notStrictEqual(k1, inc.pageCacheKey('zh/index.html', changed, 'sha1'));
  assert.notStrictEqual(k1, inc.pageCacheKey('zh/index.html', input, 'md5'));
});

test('hashTemplateDir：模板内容变化导致摘要变化', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-inc-'));
  try {
    fs.writeFileSync(path.join(dir, 'layout.ejs'), '<html></html>');
    fs.writeFileSync(path.join(dir, 'post.ejs'), '<article></article>');
    const d1 = inc.hashTemplateDir(dir, 'sha1');
    assert.ok(d1.length === 40);
    fs.writeFileSync(path.join(dir, 'post.ejs'), '<article class="x"></article>');
    const d2 = inc.hashTemplateDir(dir, 'sha1');
    assert.notStrictEqual(d1, d2, '模板变化必须改变摘要');
    assert.strictEqual(inc.hashTemplateDir(path.join(dir, 'nope'), 'sha1'), '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('computeIncrementalContext：watch / --incremental / --full / 开关组合', () => {
  const base = { enabled: true, fullFlag: '--full', watch: true, fingerprintHash: 'sha1', skipUnchanged: true };
  const watch = inc.computeIncrementalContext({ incrementalBuild: base }, { argv: ['node', 'build'], watchMode: true });
  assert.deepStrictEqual([watch.active, watch.requested, watch.forceFull, watch.fingerprintHash], [true, true, false, 'sha1']);
  const plain = inc.computeIncrementalContext({ incrementalBuild: base }, { argv: ['node', 'build'], watchMode: false });
  assert.strictEqual(plain.active, false, '普通构建默认全量');
  const explicit = inc.computeIncrementalContext({ incrementalBuild: base }, { argv: ['node', 'build', '--incremental'], watchMode: false });
  assert.strictEqual(explicit.active, true);
  const full = inc.computeIncrementalContext({ incrementalBuild: base }, { argv: ['node', 'build', '--full'], watchMode: true });
  assert.deepStrictEqual([full.active, full.forceFull], [false, true], '--full 强制全量');
  const noSkip = inc.computeIncrementalContext({ incrementalBuild: { ...base, skipUnchanged: false } }, { argv: ['node', 'build', '--incremental'], watchMode: false });
  assert.strictEqual(noSkip.active, false);
  const disabled = inc.computeIncrementalContext({ incrementalBuild: { ...base, enabled: false } }, { argv: ['node', 'build', '--incremental'], watchMode: false });
  assert.strictEqual(disabled.active, false);
  const noWatch = inc.computeIncrementalContext({ incrementalBuild: { ...base, watch: false } }, { argv: ['node', 'build'], watchMode: true });
  assert.strictEqual(noWatch.active, false, 'incrementalBuild.watch=false 时 watch 模式也全量');
});

test('computeIncrementalContext：fullFlag 自定义参数名（--full 兜底仍有效）', () => {
  const cfg = { incrementalBuild: { enabled: true, fullFlag: '--force-full', watch: true, skipUnchanged: true } };
  const custom = inc.computeIncrementalContext(cfg, { argv: ['node', 'build', '--force-full'], watchMode: true });
  assert.deepStrictEqual([custom.active, custom.forceFull, custom.fullFlag], [false, true, '--force-full']);
  const fallback = inc.computeIncrementalContext(cfg, { argv: ['node', 'build', '--full'], watchMode: true });
  assert.deepStrictEqual([fallback.active, fallback.forceFull], [false, true], '--full 始终强制全量');
  const empty = inc.computeIncrementalContext({ incrementalBuild: { enabled: true, fullFlag: '', watch: true, skipUnchanged: true } }, { argv: ['node', 'build', '--full'], watchMode: true });
  assert.strictEqual(empty.fullFlag, '--full', '空 fullFlag 回退默认');
});

test('computeIncrementalContext：缺省 features 时安全全量', () => {
  const ctx = inc.computeIncrementalContext({}, { argv: ['node', 'build', '--incremental'], watchMode: false });
  assert.strictEqual(ctx.active, false, '无 incrementalBuild 配置时不得启用增量（默认值由 schema 提供，缺失即保守）');
});
