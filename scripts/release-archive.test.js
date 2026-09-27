'use strict';
// release:archive 的端到端测试：真实对 HEAD 执行 git archive 到临时目录，
// 解析 zip 后核对文件清单 ⊆ 白名单，并断言 README/LICENSE/package.json/RELEASE.json 等必需文件存在。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readZipEntries, archiveRelease } = require('./release-archive.js');
const { assertArchiveContents, isReleaseAllowed, RELEASE_REQUIRED_FILES, RELEASE_EXCLUDE_PATTERNS } = require('./lib/release-manifest.js');

const ROOT = path.resolve(__dirname, '..');

function gitText(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf-8' });
  assert.strictEqual(result.status, 0, 'git ' + args.join(' ') + ' 应成功：' + (result.stderr || ''));
  return result.stdout.trim();
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-release-'));
}

test('archiveRelease：真实 git archive HEAD → 内容全部落在白名单内且必需文件齐全', function () {
  const dir = makeTempDir();
  try {
    const version = JSON.parse(gitText(['show', 'HEAD:RELEASE.json'])).version;
    const out = path.join(dir, 'S-ynapse-' + version + '.zip');
    const result = archiveRelease({ ref: 'HEAD', out });
    assert.strictEqual(result.version, version);
    assert.ok(fs.existsSync(out), '归档文件应生成');
    assert.ok(result.bytes > 0);

    const prefix = 'S-ynapse-' + version + '/';
    const entries = readZipEntries(out);
    assertArchiveContents(entries, { prefix }); // 任一条目越界即抛错

    const files = entries.filter(function (e) { return !e.endsWith('/'); }).map(function (e) { return e.slice(prefix.length); });
    for (const required of RELEASE_REQUIRED_FILES) {
      assert.ok(files.includes(required), '归档应包含 ' + required);
    }
    assert.ok(files.some(function (f) { return f.startsWith('js/'); }), '归档应包含 js/ 内容');
    assert.ok(files.some(function (f) { return f.endsWith('.test.js'); }), '归档应包含测试文件');
    assert.ok(files.some(function (f) { return f === 'features.json5'; }), '归档应包含根 JSON5');
    assert.ok(!files.some(function (f) { return f.startsWith('docs/') || f.startsWith('.github/') || f.startsWith('real-site/'); }), '不得包含排除目录');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('release-archive CLI：--ref HEAD --out 临时路径，退出码 0 且输出校验摘要', function () {
  const dir = makeTempDir();
  try {
    const out = path.join(dir, 'S-ynapse.zip');
    const result = spawnSync(process.execPath, ['scripts/release-archive.js', '--ref', 'HEAD', '--out', out], {
      cwd: ROOT,
      encoding: 'utf-8'
    });
    assert.strictEqual(result.status, 0, 'CLI 应成功：' + (result.stderr || ''));
    assert.ok(result.stdout.includes('白名单校验通过'), '应打印白名单校验结论');
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

test('release-archive CLI：ref 缺少 RELEASE.json（历史 tag）时退出码 1 且报错可读', function () {
  const result = spawnSync(process.execPath, ['scripts/release-archive.js', '--ref', 'v1.0.0'], {
    cwd: ROOT,
    encoding: 'utf-8'
  });
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('RELEASE.json'), '错误信息应指明 RELEASE.json');
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
