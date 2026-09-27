'use strict';
// Release 归档白名单与归档内容断言的单元测试。
// 覆盖：包含矩阵（目录/根文件/根 JSON5）、排除矩阵（docs/.github/real-site 等）、
// 路径归一化与默认拒绝、assertArchiveContents 的越界检测、pathspec 生成。
const test = require('node:test');
const assert = require('node:assert');
const {
  RELEASE_DIRS,
  RELEASE_ROOT_FILES,
  isReleaseAllowed,
  normalizeRelPath,
  listReleaseIncludePaths,
  assertArchiveContents
} = require('./lib/release-manifest.js');

test('白名单包含：4 个顶层目录（任意深度）、根 JSON5、根文件清单', () => {
  for (const dir of RELEASE_DIRS) {
    assert.strictEqual(isReleaseAllowed(dir + '/index.js'), true, dir + ' 顶层文件应包含');
    assert.strictEqual(isReleaseAllowed(dir + '/nested/deep/file.txt'), true, dir + ' 深层文件应包含');
  }
  assert.strictEqual(isReleaseAllowed('scripts/release-mark.js'), true);
  assert.strictEqual(isReleaseAllowed('workers/lib/rate-limit.mjs'), true);
  assert.strictEqual(isReleaseAllowed('site.json5'), true, '根 JSON5 应包含');
  assert.strictEqual(isReleaseAllowed('features.json5'), true);
  for (const file of RELEASE_ROOT_FILES) {
    assert.strictEqual(isReleaseAllowed(file), true, file + ' 应包含');
  }
});

test('白名单排除：开发目录/派生副本/内容目录/构建产物一律拒绝', () => {
  const denied = [
    'docs/runbook/release.md',
    '.github/workflows/release.yml',
    '.githooks/pre-commit',
    '.tmp-scripts/run-c5.js',
    'backups/2026.zip',
    'real-site/js/app.js',
    'dist/index.html',
    'build-artifacts/sbom.cdx.json',
    'release-artifacts/S-ynapse-1.1.0.zip',
    '.cache/compression-verify/last.json',
    'node_modules/foo/index.js',
    'articles/zh/hello.md',
    'pages/about.md',
    'media/photo.webp',
    'static/robots.txt',
    'workers/security-config.js'
  ];
  for (const file of denied) {
    assert.strictEqual(isReleaseAllowed(file), false, file + ' 必须被排除');
  }
});

test('默认拒绝：未知根文件与非白名单顶层目录', () => {
  const denied = [
    'serve.bat',
    'build.bat',
    'eslint.config.js',
    'tsconfig.json',
    'wrangler.toml',
    'SECURITY.md',
    'AGENTS.md',
    'videos/clip.md',
    'assets/logo.png',
    'scripts/../real-site/x.js'
  ];
  for (const file of denied) {
    assert.strictEqual(isReleaseAllowed(file), false, file + ' 必须默认拒绝');
  }
  assert.strictEqual(isReleaseAllowed(''), false);
  assert.strictEqual(isReleaseAllowed(null), false);
});

test('路径归一化：反斜杠/./ 前缀可接受，绝对路径与 .. 拒绝', () => {
  assert.strictEqual(normalizeRelPath('js\\app.js'), 'js/app.js');
  assert.strictEqual(normalizeRelPath('./scripts/lib/release-manifest.js'), 'scripts/lib/release-manifest.js');
  assert.strictEqual(normalizeRelPath('js//app.js'), 'js/app.js');
  assert.strictEqual(normalizeRelPath('../real-site/x.js'), null);
  assert.strictEqual(normalizeRelPath('C:/secrets.txt'), null);
  assert.strictEqual(normalizeRelPath('/etc/passwd'), null);
  assert.strictEqual(isReleaseAllowed('js\\deep\\file.js'), true);
});

test('assertArchiveContents：合法归档通过（含目录条目与统一前缀）', () => {
  const entries = [
    'S-ynapse-1.1.0/',
    'S-ynapse-1.1.0/README.md',
    'S-ynapse-1.1.0/package.json',
    'S-ynapse-1.1.0/js/app.js',
    'S-ynapse-1.1.0/scripts/lib/release-manifest.js',
    'S-ynapse-1.1.0/workers/wrangler.toml',
    'S-ynapse-1.1.0/features.json5'
  ];
  const result = assertArchiveContents(entries, { prefix: 'S-ynapse-1.1.0/' });
  assert.deepStrictEqual(result, { ok: true, checked: 6 });
});

test('assertArchiveContents：越界条目抛错并列出 offenders（前缀不匹配也算越界）', () => {
  const entries = [
    'S-ynapse-1.1.0/README.md',
    'S-ynapse-1.1.0/docs/secret.md',
    'S-ynapse-1.1.0/real-site/js/app.js',
    'other-prefix/README.md'
  ];
  let thrown = null;
  try {
    assertArchiveContents(entries, { prefix: 'S-ynapse-1.1.0/' });
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown, '越界条目必须抛错');
  assert.strictEqual(thrown.offenders.length, 3);
  assert.ok(thrown.message.includes('docs/secret.md'));
  assert.ok(thrown.message.includes('real-site/js/app.js'));
  assert.ok(thrown.message.includes('前缀'));
});

test('listReleaseIncludePaths：pathspec 锚定仓库根，覆盖目录/根 JSON5/根文件', () => {
  const paths = listReleaseIncludePaths();
  for (const dir of RELEASE_DIRS) {
    assert.ok(paths.includes(':(top,glob)' + dir + '/**'), dir + ' pathspec 缺失');
  }
  assert.ok(paths.includes(':(top,glob)*.json5'), '根 JSON5 pathspec 缺失');
  for (const file of RELEASE_ROOT_FILES) {
    assert.ok(paths.includes(':(top)' + file), file + ' pathspec 缺失');
  }
  assert.ok(paths.includes(':(top)workers/wrangler.toml') === false, 'workers 下文件由目录 pathspec 覆盖，不重复列出');
  assert.ok(paths.some(function (p) { return p.startsWith(':(top,glob)workers/'); }), 'workers 目录 pathspec 应覆盖 wrangler.toml');
});
