'use strict';
// Release 归档白名单与归档内容断言的单元测试。
// 覆盖：包含矩阵（必需目录/根文件/根 JSON5/构建入口）、骨架目录（仅 .gitkeep，
// 示例文章与演示媒体一律拒绝）、排除矩阵（docs/.github/real-site 等）、
// 路径归一化与默认拒绝、必需清单自洽、assertArchiveContents 的越界检测与骨架违规说明、
// pathspec 生成（骨架目录只注入 .gitkeep 标记）。
const test = require('node:test');
const assert = require('node:assert');
const {
  RELEASE_DIRS,
  RELEASE_REQUIRED_DIRS,
  RELEASE_SKELETON_DIRS,
  RELEASE_SKELETON_MARKER,
  RELEASE_ROOT_FILES,
  RELEASE_REQUIRED_FILES,
  isReleaseAllowed,
  normalizeRelPath,
  describeSkeletonViolation,
  listReleaseIncludePaths,
  assertArchiveContents
} = require('./lib/release-manifest.js');

test('白名单包含：必需目录（任意深度）、根 JSON5、根文件清单', () => {
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

test('白名单包含：构建入口/检查配置/git hooks/示例页面与默认资源（README 能力所需文件）', () => {
  const included = [
    'build.bat',
    'serve.bat',
    'eslint.config.js',
    'tsconfig.json',
    'wrangler.toml',
    '.githooks/pre-commit',
    'scripts/build.test.js',
    'scripts/release-archive.js',
    'pages/about.md',
    'static/icons/favicon.svg',
    'static/media/avatar.svg',
    'templates/layout.ejs',
    'js/core/main.js'
  ];
  for (const file of included) {
    assert.strictEqual(isReleaseAllowed(file), true, file + ' 应包含（解压可构建）');
  }
});

test('白名单包含：默认站点数据 data/**（每日一言数据文件属于可体验功能）', () => {
  assert.strictEqual(isReleaseAllowed('data/quotes.json5'), true, 'data/quotes.json5 应包含');
  assert.strictEqual(isReleaseAllowed('data/nested/deep.json5'), true, 'data/** 任意深度应包含');
  assert.ok(RELEASE_REQUIRED_DIRS.includes('data'), 'data 应列入必需目录');
  assert.ok(RELEASE_REQUIRED_FILES.includes('data/quotes.json5'), 'data/quotes.json5 应列入必需文件');
});

test('骨架目录：只允许 .gitkeep 标记，示例文章与演示媒体一律拒绝', () => {
  for (const dir of RELEASE_SKELETON_DIRS) {
    assert.strictEqual(isReleaseAllowed(dir + '/' + RELEASE_SKELETON_MARKER), true, dir + ' 根标记应包含');
    assert.strictEqual(isReleaseAllowed(dir + '/nested/' + RELEASE_SKELETON_MARKER), true, dir + ' 深层标记应包含');
    assert.strictEqual(isReleaseAllowed(dir + '/uploaded.js'), false, dir + ' 实体文件必须拒绝');
  }
  const denied = [
    'articles/zh/hello-world.md',
    'articles/en/deep/nested.md',
    'articles/zh/code-showcase.md',
    'media/test-photo-1.jpg',
    'media/sub/nested.webp',
    'media/archive.tar.gz'
  ];
  for (const file of denied) {
    assert.strictEqual(isReleaseAllowed(file), false, file + ' 属示例内容，不得入包');
  }
  assert.strictEqual(describeSkeletonViolation('articles/zh/hello-world.md'), '骨架目录 articles/ 只允许 .gitkeep 标记，实体内容不得入包');
  assert.strictEqual(describeSkeletonViolation('media/test-photo-1.jpg'), '骨架目录 media/ 只允许 .gitkeep 标记，实体内容不得入包');
  assert.strictEqual(describeSkeletonViolation('articles/zh/.gitkeep'), null, '合法标记不应判为违规');
  assert.strictEqual(describeSkeletonViolation('js/core/main.js'), null, '非骨架目录不应判为违规');
});

test('白名单排除：开发目录/派生副本/构建产物一律拒绝', () => {
  const denied = [
    'docs/runbook/release.md',
    '.github/workflows/release.yml',
    '.tmp-scripts/run-c5.js',
    '.playwright-mcp/shots/a.png',
    'backups/2026.zip',
    'real-site/js/app.js',
    'dist/index.html',
    'build-artifacts/sbom.cdx.json',
    'release-artifacts/S-ynapse-1.1.0.zip',
    '.cache/compression-verify/last.json',
    'node_modules/foo/index.js',
    'workers/security-config.js'
  ];
  for (const file of denied) {
    assert.strictEqual(isReleaseAllowed(file), false, file + ' 必须被排除');
  }
});

test('默认拒绝：未知根文件与非白名单顶层目录', () => {
  const denied = [
    'SECURITY.md',
    'CHANGELOG.md',
    'AGENTS.md',
    'database.db',
    '.env',
    'videos/clip.md',
    'assets/logo.png',
    'index.html',
    'scripts/../real-site/x.js'
  ];
  for (const file of denied) {
    assert.strictEqual(isReleaseAllowed(file), false, file + ' 必须默认拒绝');
  }
  assert.strictEqual(isReleaseAllowed(''), false);
  assert.strictEqual(isReleaseAllowed(null), false);
});

test('必需清单自洽：必需文件均在白名单内，必需目录均为包含目录，骨架标记齐备', () => {
  for (const file of RELEASE_REQUIRED_FILES) {
    assert.strictEqual(isReleaseAllowed(file), true, file + ' 必须在白名单内');
  }
  for (const dir of RELEASE_REQUIRED_DIRS) {
    assert.ok(RELEASE_DIRS.includes(dir), dir + ' 必须在 RELEASE_DIRS 内');
  }
  for (const file of ['build.bat', 'serve.bat', 'eslint.config.js', 'tsconfig.json', 'package-lock.json', 'scripts/build.test.js']) {
    assert.ok(RELEASE_REQUIRED_FILES.includes(file), file + ' 应列入必需文件');
  }
  for (const marker of ['articles/zh/.gitkeep', 'articles/en/.gitkeep', 'media/.gitkeep']) {
    assert.ok(RELEASE_REQUIRED_FILES.includes(marker), marker + ' 应列入必需文件（空站骨架）');
  }
  assert.strictEqual(RELEASE_REQUIRED_DIRS.includes('pages'), true);
  assert.strictEqual(RELEASE_REQUIRED_DIRS.includes('static'), true);
  assert.strictEqual(RELEASE_REQUIRED_DIRS.includes('articles'), false, 'articles 应为骨架目录而非必需内容目录');
  assert.strictEqual(RELEASE_REQUIRED_DIRS.includes('media'), false, 'media 应为骨架目录而非必需内容目录');
  for (const dir of RELEASE_SKELETON_DIRS) {
    assert.strictEqual(RELEASE_DIRS.includes(dir), false, dir + ' 不应与整目录包含列表混淆');
  }
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

test('assertArchiveContents：合法归档通过（含目录条目、统一前缀与骨架标记）', () => {
  const entries = [
    'S-ynapse-1.1.0/',
    'S-ynapse-1.1.0/README.md',
    'S-ynapse-1.1.0/package.json',
    'S-ynapse-1.1.0/js/app.js',
    'S-ynapse-1.1.0/scripts/lib/release-manifest.js',
    'S-ynapse-1.1.0/scripts/lib/release-manifest.test.js',
    'S-ynapse-1.1.0/workers/wrangler.toml',
    'S-ynapse-1.1.0/features.json5',
    'S-ynapse-1.1.0/articles/zh/.gitkeep',
    'S-ynapse-1.1.0/media/.gitkeep'
  ];
  const result = assertArchiveContents(entries, { prefix: 'S-ynapse-1.1.0/' });
  assert.deepStrictEqual(result, { ok: true, checked: 9 });
});

test('assertArchiveContents：越界条目抛错并列出 offenders（骨架实体内容带专项说明）', () => {
  const entries = [
    'S-ynapse-1.1.0/README.md',
    'S-ynapse-1.1.0/docs/secret.md',
    'S-ynapse-1.1.0/real-site/js/app.js',
    'S-ynapse-1.1.0/articles/zh/hello-world.md',
    'S-ynapse-1.1.0/media/test-photo-1.jpg',
    'other-prefix/README.md'
  ];
  let thrown = null;
  try {
    assertArchiveContents(entries, { prefix: 'S-ynapse-1.1.0/' });
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown, '越界条目必须抛错');
  assert.strictEqual(thrown.offenders.length, 5);
  assert.ok(thrown.message.includes('docs/secret.md'));
  assert.ok(thrown.message.includes('real-site/js/app.js'));
  assert.ok(thrown.message.includes('articles/zh/hello-world.md（骨架目录 articles/'));
  assert.ok(thrown.message.includes('media/test-photo-1.jpg（骨架目录 media/'));
  assert.ok(thrown.message.includes('前缀'));
});

test('listReleaseIncludePaths：pathspec 锚定仓库根，骨架目录只注入 .gitkeep 标记', () => {
  const paths = listReleaseIncludePaths();
  for (const dir of RELEASE_DIRS) {
    assert.ok(paths.includes(':(top,glob)' + dir + '/**'), dir + ' pathspec 缺失');
  }
  assert.ok(paths.includes(':(top,glob)*.json5'), '根 JSON5 pathspec 缺失');
  for (const file of RELEASE_ROOT_FILES) {
    assert.ok(paths.includes(':(top)' + file), file + ' pathspec 缺失');
  }
  assert.ok(paths.includes(':(top)build.bat'), 'build.bat pathspec 缺失');
  assert.ok(paths.includes(':(top)eslint.config.js'), 'eslint.config.js pathspec 缺失');
  assert.ok(paths.includes(':(top,glob).githooks/**'), '.githooks pathspec 缺失');
  assert.ok(paths.includes(':(top,glob)articles/**/.gitkeep'), 'articles 骨架 pathspec 缺失');
  assert.ok(paths.includes(':(top,glob)media/**/.gitkeep'), 'media 骨架 pathspec 缺失');
  assert.ok(!paths.includes(':(top,glob)articles/**'), 'articles 不得使用整目录 pathspec');
  assert.ok(!paths.includes(':(top,glob)media/**'), 'media 不得使用整目录 pathspec');
  assert.ok(paths.includes(':(top)workers/wrangler.toml') === false, 'workers 下文件由目录 pathspec 覆盖，不重复列出');
  assert.ok(paths.some(function (p) { return p.startsWith(':(top,glob)workers/'); }), 'workers 目录 pathspec 应覆盖 wrangler.toml');
});
