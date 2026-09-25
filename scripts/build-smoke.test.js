// 构建管线集成冒烟测试（审计 F-6）：用 `--out <临时目录>` 执行真实构建，
// 断言关键产物与 CSP nonce；再注入一篇坏文章，验证预校验阻断构建且不破坏上一轮产物。
// 运行：npm run test:build（CI 门禁）；也可直接 node --test scripts/build-smoke.test.js。
// 注意：`npm test` 的 glob（scripts/*.test.js）会匹配到本文件，此时按 npm 生命周期事件跳过，
// 避免拖慢单测套件，并与并发改写 workers/security-config.js 的 security-worker.test.js 互斥。

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BAD_SLUG = 'zz-smoke-bad-' + process.pid;
const BAD_ARTICLE = path.join(ROOT, 'articles', 'zh', BAD_SLUG + '.md');
const SKIP_IN_UNIT_SUITE = process.env.npm_lifecycle_event === 'test';

let tmpDir = null;

function runBuild() {
  return execFileSync(process.execPath, ['scripts/build.js', '--out', tmpDir], {
    cwd: ROOT,
    env: { ...process.env, SYNAPSE_OUT_DIR: tmpDir, NODE_ENV: 'production' },
    stdio: 'pipe',
    timeout: 240000
  });
}

// 失败时把子进程输出尾部带给断言消息，避免只看到 "Command failed"。
function outputTail(err) {
  const text = String(err.stdout || '') + String(err.stderr || '');
  return text.length > 4000 ? '...(truncated)\n' + text.slice(-4000) : text;
}

describe('build pipeline smoke', { skip: SKIP_IN_UNIT_SUITE ? 'run via npm run test:build (integration, not the unit suite)' : false }, () => {
  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-build-smoke-'));
    fs.rmSync(BAD_ARTICLE, { force: true });
  });

  after(() => {
    fs.rmSync(BAD_ARTICLE, { force: true });
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  it('clean build writes the expected artifacts and a nonce-based CSP', () => {
    try {
      runBuild();
    } catch (err) {
      assert.fail('build must exit 0, got status ' + err.status + ':\n' + outputTail(err));
    }
    const required = [
      path.join(tmpDir, 'zh', 'index.html'),
      path.join(tmpDir, 'en', 'index.html'),
      path.join(tmpDir, 'zh', 'search-index.json'),
      path.join(tmpDir, 'zh', 'sitemap.xml'),
      path.join(tmpDir, 'zh', 'feed.xml'),
      path.join(tmpDir, '404.html')
    ];
    for (const file of required) {
      assert.ok(fs.existsSync(file), 'missing artifact: ' + path.relative(tmpDir, file));
    }
    const headers = fs.readFileSync(path.join(tmpDir, '_headers'), 'utf-8');
    const cspLine = headers.split('\n').find((line) => line.includes('Content-Security-Policy')) || '';
    const scriptSrc = cspLine.split(';').map((part) => part.trim()).find((part) => part.startsWith('script-src')) || '';
    assert.ok(scriptSrc.includes('nonce-'), 'script-src must carry the build-time nonce');
    assert.ok(!scriptSrc.includes("'unsafe-inline'"), "script-src must not allow 'unsafe-inline'");
    const html = fs.readFileSync(path.join(tmpDir, 'zh', 'index.html'), 'utf-8');
    const appMatch = html.match(/\/assets\/js\/app\.[0-9A-Za-z]+\.js/);
    const deferredMatch = html.match(/__DEFERRED_URL__=[`"'](\/assets\/js\/deferred\.[0-9A-Za-z]+\.js)[`"']/);
    assert.ok(appMatch, 'index.html must reference the hashed app chunk');
    assert.ok(deferredMatch, 'index.html must expose the hashed deferred chunk URL');
    const toAbs = (url) => path.join(tmpDir, url.replace(/^\//, '').split('/').join(path.sep));
    assert.ok(fs.existsSync(toAbs(appMatch[0])), 'app chunk must exist on disk');
    assert.ok(fs.existsSync(toAbs(deferredMatch[1])), 'deferred chunk must exist on disk');
    const runtimeMatch = html.match(/\/assets\/js\/runtime\.[0-9A-Za-z]+\.js/);
    assert.ok(runtimeMatch, 'index.html must reference the hashed runtime bootstrap');
    assert.ok(fs.existsSync(toAbs(runtimeMatch[0])), 'runtime bootstrap must exist on disk');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'assets', 'js', 'core', 'main.js')), 'raw ESM sources must not be copied when bundling');
  });

  it('bad content blocks the build and leaves previous output untouched', () => {
    const indexHtml = path.join(tmpDir, 'zh', 'index.html');
    const beforeHash = fs.readFileSync(indexHtml);
    fs.writeFileSync(BAD_ARTICLE, [
      '---',
      'title: Smoke Bad Article',
      'slug: ' + BAD_SLUG,
      'date: 2026-01-01',
      'tags: [""]',
      '---',
      '# Smoke bad',
      'Body.'
    ].join('\n'), 'utf-8');
    let failed = false;
    let output = '';
    try {
      runBuild();
    } catch (err) {
      failed = true;
      output = outputTail(err);
    } finally {
      fs.rmSync(BAD_ARTICLE, { force: true });
    }
    assert.ok(failed, 'build must fail on an empty taxonomy entry');
    assert.match(output, /PREFLIGHT|taxonomy/);
    assert.deepStrictEqual(fs.readFileSync(indexHtml), beforeHash, 'preflight abort must not rewrite previous output');
  });
});
