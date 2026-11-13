'use strict';
// Release 描述生成的纯函数测试：CHANGELOG 段提取（存在/缺失/多版本）、
// 门禁渲染（与 RELEASE_GATES 同源）、SHA-256、上一 tag 选择、owner/repo 解析、
// compare 链接、确定性（同输入同字节）与 LF 行尾。
// 另含 canonical 仓库内的 CLI 端到端用例（无 git 或 tag 缺失时显式跳过）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  extractChangelogSection,
  pickPreviousTag,
  parseOwnerRepo,
  buildCompareUrl,
  sha256Hex,
  normalizeLineEndings,
  renderReleaseNotes,
  buildArchiveName
} = require('./lib/release-notes.js');
const { RELEASE_GATES, buildPassedChecks } = require('./lib/release-version.js');

const ROOT = path.resolve(__dirname, '..');
const HAS_GIT_REPO = fs.existsSync(path.join(ROOT, '.git'));

const SAMPLE_CHANGELOG = [
  '# Changelog',
  '',
  '## [1.2.1] - 2026-10-02',
  '',
  '### Fixed',
  '',
  '- 修复 A。',
  '- 修复 B。',
  '',
  '### Added',
  '',
  '- 新增 C。',
  '',
  '## [1.2.0] - 2026-10-01',
  '',
  '### Added',
  '',
  '- 旧版本条目。',
  '',
  '[1.2.1]: https://github.com/stop666two/S-ynapse/releases/tag/v1.2.1',
  '[1.2.0]: https://github.com/stop666two/S-ynapse/releases/tag/v1.2.0',
  ''
].join('\n');

// 审查 R-37 前这里写的是 checks: {}，而 renderGates() 无条件打 ✅——即空 checks 也宣称
// 「全部通过」。现在门禁清单按 checks 真实状态渲染，因此样例外显式给出全 true（与
// release:mark 正常产出等价），false/缺失 的渲染由专门用例覆盖。
const SAMPLE_STATE = {
  schemaVersion: 1,
  version: '1.2.1',
  status: 'verified',
  humanVerifiedBy: 'stop666two',
  verifiedAt: '2026-10-02T01:43:49.963Z',
  commit: 'beb7353d40b176a36b8994458ce3aea66c3aaabc',
  checks: buildPassedChecks()
};

function renderSample(overrides) {
  return renderReleaseNotes(Object.assign({
    tag: 'v1.2.1',
    version: '1.2.1',
    changelogText: SAMPLE_CHANGELOG,
    releaseState: SAMPLE_STATE,
    archive: { name: 'S-ynapse-1.2.1.zip', bytes: 123456, sha256: 'a'.repeat(64) },
    nodeVersion: '24',
    owner: 'stop666two',
    repo: 'S-ynapse',
    previousTag: 'v1.2.0',
    firstCommit: '1111111111111111111111111111111111111111'
  }, overrides || {}));
}

test('extractChangelogSection：提取命中版本段并保留子段，多版本互不串段', () => {
  const hit = extractChangelogSection(SAMPLE_CHANGELOG, '1.2.1');
  assert.equal(hit.found, true);
  assert.match(hit.body, /### Fixed/);
  assert.match(hit.body, /- 修复 A。/);
  assert.match(hit.body, /### Added/);
  assert.match(hit.body, /- 新增 C。/);
  assert.doesNotMatch(hit.body, /旧版本条目/);
  assert.doesNotMatch(hit.body, /## \[1\.2\.0\]/);

  const older = extractChangelogSection(SAMPLE_CHANGELOG, '1.2.0');
  assert.equal(older.found, true);
  assert.match(older.body, /旧版本条目/);
  assert.doesNotMatch(older.body, /修复 A/);
});

test('extractChangelogSection：版本段缺失时返回 found=false 而非抛错', () => {
  const miss = extractChangelogSection(SAMPLE_CHANGELOG, '9.9.9');
  assert.equal(miss.found, false);
  assert.equal(miss.body, '');
});

test('renderReleaseNotes：渲染标题、变更、门禁、安装、对比与附件', () => {
  const text = renderSample();
  assert.ok(text.startsWith('# S-ynapse v1.2.1\n'), '标题行应为 # S-ynapse vX.Y.Z');
  assert.match(text, /## 本版变更/);
  assert.match(text, /### Fixed/);
  assert.match(text, /### Added/);
  assert.match(text, /## 质量与校验/);
  assert.ok(text.includes('发布门禁（' + RELEASE_GATES.length + ' 项全部通过'), '全部 true 时才允许宣称全部通过');
  for (const gate of RELEASE_GATES) {
    assert.ok(text.includes('- ✅ ' + gate.label + '（`' + gate.command + '`）'), '门禁应逐项列出：' + gate.label);
  }
  assert.match(text, /status：verified/);
  assert.match(text, /humanVerifiedBy：stop666two/);
  assert.match(text, /verifiedAt：2026-10-02T01:43:49\.963Z/);
  assert.match(text, /commit：beb7353d40b176a36b8994458ce3aea66c3aaabc/);
  assert.match(text, /文件：S-ynapse-1\.2\.1\.zip/);
  assert.match(text, /大小：120\.6 KiB（123456 字节）/);
  assert.match(text, /SHA-256：a{64}/);
  assert.match(text, /Node 24/);
  assert.match(text, /## 安装与使用/);
  assert.match(text, /npm ci/);
  assert.match(text, /npm run build/);
  assert.match(text, /https:\/\/github\.com\/stop666two\/S-ynapse\/compare\/v1\.2\.0\.\.\.v1\.2\.1/);
  assert.match(text, /## 附件/);
});

test('renderReleaseNotes：无归档附件时注明由 CI 附件流程提供，无 RELEASE.json 时标注', () => {
  const text = renderSample({ archive: null, releaseState: null });
  assert.match(text, /由 CI 附件流程提供/);
  assert.match(text, /RELEASE\.json：未能读取/);
});

// 审查 R-37：release-notes.yml 可对任意 tag 补更正文，此前的 renderGates() 无条件打 ✅、
// 且固定输出「12 项全部通过」——checks 为 false 或缺失时也在撒谎。
test('renderGates：只对严格 true 打勾，false 记 ❌、缺失记 ⚠️ 未记录', () => {
  const checks = buildPassedChecks();
  checks['verify-compression'] = false;
  delete checks['lint'];
  const text = renderSample({ releaseState: Object.assign({}, SAMPLE_STATE, { checks }) });

  assert.doesNotMatch(text, /- ✅ 压缩无头对比/, '记录为 false 的门禁不得打勾');
  assert.ok(text.includes('- ❌ 压缩无头对比（`npm run verify:compression`）：RELEASE.json 记录为 false'),
    'false 项应渲染为 ❌ 并带记录值');
  assert.doesNotMatch(text, /- ✅ ESLint 静态检查/, '未记录的门禁不得打勾');
  assert.ok(text.includes('- ⚠️ ESLint 静态检查（`npm run lint`）：RELEASE.json 未记录该项'),
    '缺失项应渲染为 ⚠️ 未记录');
  assert.ok(text.includes('- ✅ 单元测试（`npm test`）'), '仍为 true 的门禁保持 ✅');

  const passed = RELEASE_GATES.length - 2;
  const notPassed = RELEASE_GATES.length - passed;
  assert.ok(text.includes('发布门禁（' + RELEASE_GATES.length + ' 项中 '
    + passed + ' 项通过，' + notPassed + ' 项未通过或未记录'),
  '引导句必须给出真实计数');
  assert.ok(!text.includes('项全部通过'), '存在非 true 项时不得宣称全部通过');
});

test('renderGates：RELEASE.json 不可读时逐项标未记录且不宣称通过，输出保持确定性', () => {
  const text = renderSample({ releaseState: null });
  assert.doesNotMatch(text, /- ✅ /, '读不到 RELEASE.json 时任何门禁都不得打勾');
  assert.equal((text.match(/- ⚠️ /g) || []).length, RELEASE_GATES.length, '每个门禁都标 ⚠️ 未记录');
  assert.ok(text.includes('发布门禁（' + RELEASE_GATES.length + ' 项中 0 项通过，'
    + RELEASE_GATES.length + ' 项未通过或未记录'));
  assert.ok(!text.includes('项全部通过'));
  assert.equal(text, renderSample({ releaseState: null }), '同输入必须同字节');
});

test('renderReleaseNotes：缺 CHANGELOG 版本段时报错并提示补 CHANGELOG', () => {
  assert.throws(
    () => renderSample({ version: '9.9.9', tag: 'v9.9.9' }),
    /CHANGELOG.*9\.9\.9|9\.9\.9.*CHANGELOG/
  );
});

test('renderReleaseNotes：无上一 tag 时用首个提交锚点生成对比链接', () => {
  const text = renderSample({ previousTag: null });
  assert.match(text, /compare\/1111111111111111111111111111111111111111\.\.\.v1\.2\.1/);
});

test('sha256Hex：已知内容哈希与确定性', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('abc'), sha256Hex(Buffer.from('abc')));
});

test('pickPreviousTag：按 creatordate 降序列表取目标之后的第一个 v* 标签', () => {
  assert.equal(pickPreviousTag(['v1.2.1', 'v1.1.0', 'v1.0.0'], 'v1.2.1'), 'v1.1.0');
  assert.equal(pickPreviousTag(['v1.2.1', 'v1.1.0-a2', 'v1.1.0-a1', 'v1.1.0'], 'v1.2.1'), 'v1.1.0-a2');
  assert.equal(pickPreviousTag(['v1.2.1', 'nightly-2026', 'v1.0.0'], 'v1.2.1'), 'v1.0.0');
  assert.equal(pickPreviousTag(['v1.0.0'], 'v1.0.0'), null);
  assert.equal(pickPreviousTag(['v1.2.1'], 'v9.9.9'), null);
  assert.equal(pickPreviousTag([], 'v1.2.1'), null);
});

test('parseOwnerRepo：解析 https/ssh 远端为 owner/repo，非法输入返回 null', () => {
  assert.deepEqual(parseOwnerRepo('https://github.com/stop666two/S-ynapse.git'), { owner: 'stop666two', repo: 'S-ynapse' });
  assert.deepEqual(parseOwnerRepo('https://github.com/stop666two/S-ynapse'), { owner: 'stop666two', repo: 'S-ynapse' });
  assert.deepEqual(parseOwnerRepo('git@github.com:stop666two/S-ynapse.git'), { owner: 'stop666two', repo: 'S-ynapse' });
  assert.deepEqual(parseOwnerRepo('ssh://git@github.com/stop666two/S-ynapse.git'), { owner: 'stop666two', repo: 'S-ynapse' });
  assert.equal(parseOwnerRepo(''), null);
  assert.equal(parseOwnerRepo('not a url'), null);
  assert.equal(parseOwnerRepo('https://github.com/only-owner'), null);
});

test('buildCompareUrl：拼装 GitHub compare 链接', () => {
  assert.equal(
    buildCompareUrl('stop666two', 'S-ynapse', 'v1.2.0', 'v1.2.1'),
    'https://github.com/stop666two/S-ynapse/compare/v1.2.0...v1.2.1'
  );
});

test('确定性：同输入两次输出逐字节一致且无 \\r（LF 行尾）', () => {
  const first = renderSample();
  const second = renderSample();
  assert.equal(first, second);
  assert.equal(normalizeLineEndings(first), first);
  assert.ok(!first.includes('\r'), '输出不得含 CR');
  assert.equal(buildArchiveName('1.2.1'), 'S-ynapse-1.2.1.zip');
});

test('CLI 端到端：真实仓库生成 v1.2.1 描述（无 git 或 tag 缺失时跳过）', (t) => {
  if (!HAS_GIT_REPO) {
    t.skip('发布包不含 .git，CLI 端到端检查在源码仓库执行');
    return;
  }
  const tags = spawnSync('git', ['tag', '--list', 'v1.2.1'], { cwd: ROOT, encoding: 'utf-8' });
  if (tags.status !== 0 || tags.stdout.trim() === '') {
    t.skip('本地缺少 v1.2.1 tag，CLI 端到端检查跳过');
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-notes-'));
  const out = path.join(dir, 'release-notes.md');
  try {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'release-notes.js'), '--tag', 'v1.2.1', '--out', out], {
      cwd: ROOT,
      encoding: 'utf-8'
    });
    assert.equal(result.status, 0, 'CLI 应成功：' + (result.stderr || ''));
    const text = fs.readFileSync(out, 'utf-8');
    assert.ok(text.startsWith('# S-ynapse v1.2.1\n'));
    assert.match(text, /## 本版变更/);
    assert.match(text, /### (Added|Changed|Fixed|Removed)/);
    assert.match(text, /compare\//);
    assert.ok(!text.includes('\r'), 'CLI 输出不得含 CR');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
