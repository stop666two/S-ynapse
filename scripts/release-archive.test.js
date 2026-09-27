'use strict';
// release:archive 的端到端测试：真实对 HEAD 执行 git archive 到临时目录，
// 解析 zip 后核对文件清单 ⊆ 白名单，断言必需文件（含骨架标记与测试）存在、
// 骨架目录 articles/media 只含 .gitkeep（示例文章与演示媒体被过滤），
// 并覆盖 CLI 摘要、版本一致性校验与 ZIP 解析错误路径。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readZipEntries, archiveRelease, assertVersionConsistency, resolveVersion } = require('./release-archive.js');
const { assertArchiveContents, isReleaseAllowed, RELEASE_REQUIRED_FILES, RELEASE_REQUIRED_DIRS, RELEASE_EXCLUDE_PATTERNS } = require('./lib/release-manifest.js');

const ROOT = path.resolve(__dirname, '..');

// 发布包是 zip 解压产物、不含 .git：端到端 git archive / 版本读取用例在源码仓库执行；
// 白名单判定、ZIP 解析与版本一致性校验仍有纯函数用例在包内全量运行。
const HAS_GIT_REPO = fs.existsSync(path.join(ROOT, '.git'));

// 派生副本（如 real-site/）不维护发布标记 RELEASE.json，也不产出发布归档：
// 依赖 HEAD/tag 发布标记的端到端用例显式跳过并声明；纯函数用例仍全量运行。
const DERIVED_COPY = process.env.SYNAPSE_DERIVED_COPY === '1';
const DERIVED_SKIP_REASON =
  '派生副本（SYNAPSE_DERIVED_COPY=1）：RELEASE.json 发布标记仅在 canonical 仓库维护，发布归档端到端检查在 canonical 仓库执行';

function gitText(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf-8' });
  assert.strictEqual(result.status, 0, 'git ' + args.join(' ') + ' 应成功：' + (result.stderr || ''));
  return result.stdout.trim();
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-release-'));
}

test('archiveRelease：真实 git archive HEAD → 内容全部落在白名单内且必需文件齐全', function (t) {
  if (DERIVED_COPY) {
    t.skip(DERIVED_SKIP_REASON);
    return;
  }
  if (!HAS_GIT_REPO) {
    t.skip('发布包不含 .git，端到端归档检查在源码仓库执行');
    return;
  }
  const dir = makeTempDir();
  try {
    const version = JSON.parse(gitText(['show', 'HEAD:RELEASE.json'])).version;
    const out = path.join(dir, 'S-ynapse-' + version + '.zip');
    const result = archiveRelease({ ref: 'HEAD', out });
    assert.strictEqual(result.version, version);
    assert.ok(fs.existsSync(out), '归档文件应生成');
    assert.ok(result.bytes > 0);
    assert.ok(result.tests > 0, '应有 *.test.js 随包分发');

    const prefix = 'S-ynapse-' + version + '/';
    const entries = readZipEntries(out);
    assertArchiveContents(entries, { prefix }); // 任一条目越界即抛错

    const files = entries.filter(function (e) { return !e.endsWith('/'); }).map(function (e) { return e.slice(prefix.length); });
    for (const required of RELEASE_REQUIRED_FILES) {
      assert.ok(files.includes(required), '归档应包含 ' + required);
    }
    for (const dir of RELEASE_REQUIRED_DIRS) {
      assert.ok(files.some(function (f) { return f.startsWith(dir + '/'); }), '归档应包含 ' + dir + '/ 内容');
    }
    for (const file of ['build.bat', 'serve.bat', 'eslint.config.js', 'tsconfig.json', 'wrangler.toml', '.githooks/pre-commit', 'scripts/build.test.js', 'templates/layout.ejs', 'js/core/main.js']) {
      assert.ok(files.includes(file), '归档应包含 ' + file);
    }
    for (const contentDir of ['pages', 'static']) {
      assert.ok(files.some(function (f) { return f.startsWith(contentDir + '/'); }), '归档应包含示例内容目录 ' + contentDir + '/');
    }
    for (const marker of ['articles/zh/.gitkeep', 'articles/en/.gitkeep', 'media/.gitkeep']) {
      assert.ok(files.includes(marker), '归档应包含骨架标记 ' + marker);
    }
    const articlesFiles = files.filter(function (f) { return f.startsWith('articles/'); });
    const mediaFiles = files.filter(function (f) { return f.startsWith('media/'); });
    assert.ok(articlesFiles.length > 0, 'articles/ 应以骨架标记存在于归档');
    assert.ok(articlesFiles.every(function (f) { return f.endsWith('/.gitkeep'); }), 'articles/ 只允许 .gitkeep：' + articlesFiles.join(', '));
    assert.ok(mediaFiles.length > 0, 'media/ 应以骨架标记存在于归档');
    assert.ok(mediaFiles.every(function (f) { return f.endsWith('/.gitkeep'); }), 'media/ 只允许 .gitkeep：' + mediaFiles.join(', '));
    assert.ok(!files.some(function (f) { return f.endsWith('.md') && f.startsWith('articles/'); }), '不得包含示例文章');
    assert.ok(!files.some(function (f) { return f.startsWith('media/') && !f.endsWith('/.gitkeep'); }), '不得包含演示媒体');
    assert.ok(files.some(function (f) { return f.startsWith('js/'); }), '归档应包含 js/ 内容');
    assert.ok(files.some(function (f) { return f.endsWith('.test.js'); }), '归档应包含测试文件');
    assert.ok(files.some(function (f) { return f === 'features.json5'; }), '归档应包含根 JSON5');
    assert.ok(!files.some(function (f) { return f.startsWith('docs/') || f.startsWith('.github/') || f.startsWith('real-site/'); }), '不得包含排除目录');
    assert.deepStrictEqual(result.skeleton, { articles: 2, media: 1 }, '骨架统计应为 articles 2 个、media 1 个 .gitkeep');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('release-archive CLI：--ref HEAD --out 临时路径，退出码 0 且输出骨架与测试摘要', function (t) {
  if (DERIVED_COPY) {
    t.skip(DERIVED_SKIP_REASON);
    return;
  }
  if (!HAS_GIT_REPO) {
    t.skip('发布包不含 .git，端到端归档检查在源码仓库执行');
    return;
  }
  const dir = makeTempDir();
  try {
    const out = path.join(dir, 'S-ynapse.zip');
    const result = spawnSync(process.execPath, ['scripts/release-archive.js', '--ref', 'HEAD', '--out', out], {
      cwd: ROOT,
      encoding: 'utf-8'
    });
    assert.strictEqual(result.status, 0, 'CLI 应成功：' + (result.stderr || ''));
    assert.ok(result.stdout.includes('白名单校验通过'), '应打印白名单校验结论');
    assert.ok(result.stdout.includes('骨架目录：articles/ 2 个 .gitkeep、media/ 1 个 .gitkeep'), '应打印骨架目录摘要');
    assert.ok(result.stdout.includes('测试随包：'), '应打印测试随包摘要');
    assert.ok(fs.existsSync(out));

    const entries = readZipEntries(out);
    for (const entry of entries) {
      if (entry.endsWith('/')) continue;
      const rel = entry.replace(/^S-ynapse-[^/]+\//, '');
      assert.strictEqual(isReleaseAllowed(rel), true, rel + ' 不应出现在归档中');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('release-archive CLI：ref 缺少 RELEASE.json（历史 tag）时退出码 1 且报错可读', function (t) {
  if (!HAS_GIT_REPO) {
    t.skip('发布包不含 .git，历史 tag 检查在源码仓库执行');
    return;
  }
  const result = spawnSync(process.execPath, ['scripts/release-archive.js', '--ref', 'v1.0.0'], {
    cwd: ROOT,
    encoding: 'utf-8'
  });
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('RELEASE.json'), '错误信息应指明 RELEASE.json');
});

test('assertVersionConsistency：RELEASE.json/package.json/tag 三方一致校验（预发布同样支持）', function () {
  assert.strictEqual(assertVersionConsistency('HEAD', '1.1.0-a1', '1.1.0-a1'), true);
  assert.strictEqual(assertVersionConsistency('v1.1.0-a1', '1.1.0-a1', '1.1.0-a1'), true);
  assert.strictEqual(assertVersionConsistency('HEAD', '1.1.0', '1.1.0'), true, 'HEAD 跳过 tag 名比对');
  assert.throws(function () { assertVersionConsistency('HEAD', '1.1.0', '1.1.0-a1'); }, /版本不一致/);
  assert.throws(function () { assertVersionConsistency('v1.1.0', '1.1.0-a1', '1.1.0-a1'); }, /tag 与版本不一致/);
  assert.throws(function () { assertVersionConsistency('v1.1.1', '1.1.0', '1.1.0'); }, /tag 与版本不一致/);
});

test('resolveVersion：真实 HEAD 返回 package.json 一致的版本（版本校验接入归档入口）', function (t) {
  if (DERIVED_COPY) {
    t.skip(DERIVED_SKIP_REASON);
    return;
  }
  if (!HAS_GIT_REPO) {
    t.skip('发布包不含 .git，真实 HEAD 版本读取在源码仓库执行');
    return;
  }
  const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).version;
  assert.strictEqual(resolveVersion('HEAD'), current);
});

test('readZipEntries：非 ZIP 文件抛错；排除模式覆盖关键敏感目录', function () {
  const dir = makeTempDir();
  try {
    const fake = path.join(dir, 'not-a-zip.txt');
    fs.writeFileSync(fake, 'hello', 'utf-8');
    assert.throws(function () { readZipEntries(fake); }, /ZIP/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(RELEASE_EXCLUDE_PATTERNS.includes('real-site/**'));
  assert.ok(RELEASE_EXCLUDE_PATTERNS.includes('workers/security-config.js'));
});
