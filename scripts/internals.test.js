'use strict';
// internals 工程内部参数基建单测：加载/深合并/校验、Chrome 探测优先级、输出目录解析、TTL 判定。

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadInternals, clearInternalsCache } = require('./lib/internals');
const { resolveChromePath } = require('./lib/chrome-path');
const { resolveOutputDir } = require('./lib/output-dir');
const { ttlExpired, getFresh, buildCacheKey } = require('./lib/asset-cache');

function withTempInternals(content, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-internals-'));
  const file = path.join(dir, 'internals.json5');
  fs.writeFileSync(file, content, 'utf-8');
  clearInternalsCache();
  try {
    return run(file);
  } finally {
    clearInternalsCache();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('loadInternals：仓库默认值与冻结语义', () => {
  clearInternalsCache();
  const internals = loadInternals();
  assert.strictEqual(internals.ports.serve, 3000);
  assert.strictEqual(internals.ports.a11y, 3224);
  assert.strictEqual(internals.chrome.path, null);
  assert.strictEqual(internals.paths.cacheDir, '.cache');
  assert.strictEqual(internals.cache.fontsTtlDays, 7);
  assert.strictEqual(internals.ci.nodeVersion, '24');
  assert.strictEqual(internals.ui.reportColors.good, '#16a34a');
  assert.ok(Object.isFrozen(internals), '顶层结果应冻结');
  assert.strictEqual(loadInternals(), internals, '同路径重复调用返回缓存实例');
});

test('loadInternals：局部覆盖深合并、未覆盖键保持默认', () => {
  withTempInternals('{ ports: { serve: 4100 }, ci: { aggregate: false } }\n', (file) => {
    const internals = loadInternals({ path: file });
    assert.strictEqual(internals.ports.serve, 4100);
    assert.strictEqual(internals.ports.a11y, 3224, '兄弟键保持默认');
    assert.strictEqual(internals.ci.aggregate, false);
    assert.strictEqual(internals.deploy.pagesProject, 's-ynapse');
  });
});

test('loadInternals：类型/范围/枚举/pathLike 校验失败均抛错', () => {
  const cases = [
    '{ ports: { serve: "3000" } }',
    '{ ports: { serve: 0 } }',
    '{ ports: { serve: 70000 } }',
    '{ deploy: { verifyOnDeploy: "yes" } }',
    '{ ui: { reportColors: { good: "green" } } }',
    '{ ci: { nodeVersion: "24.1.2.3" } }',
    '{ paths: { cacheDir: "../outside" } }',
    '{ paths: { outDir: "/abs/path" } }',
    '{ unknownModule: {} }',
    '{ ports: { serve: 3000, extra: 1 } }',
    '{ "__proto__": {} }'
  ];
  for (const content of cases) {
    withTempInternals(content + '\n', (file) => {
      assert.throws(() => loadInternals({ path: file }), /internals/, '应拒绝：' + content);
    });
  }
});

test('loadInternals：空对象合法（全量默认）与语法错误报错', () => {
  withTempInternals('{}\n', (file) => {
    const internals = loadInternals({ path: file });
    assert.strictEqual(internals.ports.serve, 3000);
  });
  withTempInternals('{ ports: { serve: }\n', (file) => {
    assert.throws(() => loadInternals({ path: file }), /解析失败/);
  });
});

test('resolveChromePath：显式 > CHROME_PATH > internals > 平台默认', () => {
  const deps = {
    platform: 'win32',
    exists: (p) => ['explicit.exe', 'env.exe', 'internal.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].includes(p),
    which: () => null
  };
  assert.strictEqual(resolveChromePath('explicit.exe', Object.assign({ env: { CHROME_PATH: 'env.exe' }, internalsChromePath: 'internal.exe' }, deps)), 'explicit.exe');
  assert.strictEqual(resolveChromePath('', Object.assign({ env: { CHROME_PATH: 'env.exe' }, internalsChromePath: 'internal.exe' }, deps)), 'env.exe');
  assert.strictEqual(resolveChromePath('', Object.assign({ env: {}, internalsChromePath: 'internal.exe' }, deps)), 'internal.exe');
  assert.strictEqual(resolveChromePath('', Object.assign({ env: {}, internalsChromePath: '' }, deps)), 'C:/Program Files/Google/Chrome/Application/chrome.exe');
  assert.strictEqual(resolveChromePath('', Object.assign({ env: {}, internalsChromePath: '' }, deps, { exists: () => false })), null);
});

test('resolveOutputDir：--out > SYNAPSE_OUT_DIR > internals.outDir > dist', () => {
  const root = path.resolve('C:/repo');
  const env = {};
  assert.strictEqual(resolveOutputDir([], root, { outDir: null, env }).dir, path.join(root, 'dist'));
  assert.strictEqual(resolveOutputDir([], root, { outDir: 'out/site', env }).dir, path.resolve(root, 'out/site'));
  assert.strictEqual(resolveOutputDir([], root, { outDir: 'ignored', env: { SYNAPSE_OUT_DIR: 'tmp/out' } }).dir, path.resolve(root, 'tmp/out'));
  assert.strictEqual(resolveOutputDir(['--out', 'cli-out'], root, { outDir: 'ignored', env: { SYNAPSE_OUT_DIR: 'tmp/out' } }).dir, path.resolve(root, 'cli-out'));
  assert.strictEqual(resolveOutputDir([], root, { outDir: null, env }).custom, false);
  assert.strictEqual(resolveOutputDir(['--out', 'x'], root, { outDir: null, env }).custom, true);
});

test('ttlExpired：0=永不过期；文件缺失=过期；超天数=过期', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-ttl-'));
  const file = path.join(dir, 'cache.bin');
  try {
    fs.writeFileSync(file, 'x');
    const now = Date.now();
    assert.strictEqual(ttlExpired(file, 0, now), false, 'TTL 0 不参与过期判定');
    assert.strictEqual(ttlExpired(path.join(dir, 'missing.bin'), 7, now), true, '文件缺失视为过期');
    const old = now - 8 * 24 * 60 * 60 * 1000;
    fs.utimesSync(file, new Date(old), new Date(old));
    assert.strictEqual(ttlExpired(file, 7, now), true, '超过 7 天过期');
    assert.strictEqual(ttlExpired(file, 30, now), false, '未超过 30 天不过期');
    // 与内容缓存键共存：TTL=0 时命中判定与历史一致
    const cache = { media: { key: buildCacheKey({ mtimeMs: 1, size: 1 }, 'fp') } };
    assert.ok(getFresh(cache, 'media', buildCacheKey({ mtimeMs: 1, size: 1 }, 'fp')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
