'use strict';
// 发布纯函数测试：版本计算（major/minor/patch/显式/非法）、tag 解析、
// CHANGELOG 改写（有/无 Unreleased、重复版本拒绝）、RELEASE.json 构造与门禁清单。
const test = require('node:test');
const assert = require('node:assert');
const {
  RELEASE_GATES,
  isSemver,
  compareSemver,
  computeNextVersion,
  normalizeTagVersion,
  formatUtcDate,
  rewriteChangelog,
  buildReleaseState,
  buildPassedChecks
} = require('./lib/release-version.js');

test('computeNextVersion：major/minor/patch 递增并归零低位', () => {
  assert.strictEqual(computeNextVersion('1.2.3', 'major'), '2.0.0');
  assert.strictEqual(computeNextVersion('1.2.3', 'minor'), '1.3.0');
  assert.strictEqual(computeNextVersion('1.2.3', 'patch'), '1.2.4');
  assert.strictEqual(computeNextVersion('0.0.0', 'patch'), '0.0.1');
});

test('computeNextVersion：显式版本必须大于当前版本，非法输入抛错', () => {
  assert.strictEqual(computeNextVersion('1.2.3', '1.5.0'), '1.5.0');
  assert.throws(() => computeNextVersion('1.2.3', '1.2.3'), /必须大于当前版本/);
  assert.throws(() => computeNextVersion('1.2.3', '1.2.2'), /必须大于当前版本/);
  assert.throws(() => computeNextVersion('1.2.3', 'v1.5.0'), /无效的版本参数/);
  assert.throws(() => computeNextVersion('1.2.3', 'latest'), /无效的版本参数/);
  assert.throws(() => computeNextVersion('bad', 'patch'), /当前版本/);
});

test('normalizeTagVersion：只接受 vX.Y.Z，返回裸版本号', () => {
  assert.strictEqual(normalizeTagVersion('v1.2.3'), '1.2.3');
  assert.throws(() => normalizeTagVersion('1.2.3'), /vX\.Y\.Z/);
  assert.throws(() => normalizeTagVersion('v1.2'), /vX\.Y\.Z/);
  assert.throws(() => normalizeTagVersion('v1.2.3-rc.1'), /vX\.Y\.Z/);
  assert.throws(() => normalizeTagVersion(''), /vX\.Y\.Z/);
});

test('semver 工具：isSemver / compareSemver / formatUtcDate', () => {
  assert.strictEqual(isSemver('1.0.0'), true);
  assert.strictEqual(isSemver('1.0'), false);
  assert.strictEqual(isSemver(100), false);
  assert.ok(compareSemver('2.0.0', '1.9.9') > 0);
  assert.ok(compareSemver('1.2.3', '1.2.3') === 0);
  assert.ok(compareSemver('1.2.3', '1.2.4') < 0);
  assert.strictEqual(formatUtcDate(new Date('2026-09-27T23:59:59.000Z')), '2026-09-27');
});

test('rewriteChangelog：Unreleased 内容归入新版本段并补链接', () => {
  const input = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '',
    '- 新功能 A',
    '',
    '[1.0.0]: https://example.com/tag/v1.0.0',
    ''
  ].join('\n');
  const output = rewriteChangelog(input, '1.2.0', '2026-09-27');
  const unreleasedIndex = output.indexOf('## [Unreleased]');
  const versionIndex = output.indexOf('## [1.2.0] - 2026-09-27');
  const contentIndex = output.indexOf('### Added');
  assert.ok(unreleasedIndex >= 0, 'Unreleased 标题保留');
  assert.ok(versionIndex > unreleasedIndex, '版本段位于 Unreleased 之后');
  assert.ok(contentIndex > versionIndex, '原内容归入版本段');
  assert.ok(output.includes('[1.2.0]: https://github.com/stop666two/S-ynapse/releases/tag/v1.2.0'), '补版本链接');
  assert.ok(output.endsWith('\n'), '文件以换行结尾');
  assert.throws(() => rewriteChangelog(output, '1.2.0', '2026-09-28'), /已存在/);
});

test('rewriteChangelog：缺少 Unreleased 标题、非法日期或版本时抛错', () => {
  assert.throws(() => rewriteChangelog('# Changelog\n\n## [1.0.0] - 2026-01-01\n', '1.1.0', '2026-09-27'), /未找到/);
  assert.throws(() => rewriteChangelog('## [Unreleased]\n', '1.1.0', '2026/09/27'), /YYYY-MM-DD/);
  assert.throws(() => rewriteChangelog('## [Unreleased]\n', 'v1.1.0', '2026-09-27'), /X\.Y\.Z/);
  assert.throws(() => rewriteChangelog('', '1.1.0', '2026-09-27'), /为空/);
});

test('buildReleaseState：字段顺序与默认值符合发布标记契约', () => {
  const state = buildReleaseState({
    version: '1.2.0',
    status: 'verified',
    humanVerifiedBy: '张三',
    verifiedAt: '2026-09-27T10:00:00.000Z',
    commit: 'a'.repeat(40),
    checks: buildPassedChecks()
  });
  assert.deepStrictEqual(Object.keys(state), [
    'schemaVersion', 'version', 'status', 'humanVerifiedBy', 'verifiedAt', 'commit', 'checks'
  ]);
  assert.strictEqual(state.schemaVersion, 1);
  assert.strictEqual(state.status, 'verified');
  const empty = buildReleaseState({ version: '1.1.0' });
  assert.strictEqual(empty.status, 'unverified');
  assert.deepStrictEqual(empty.checks, {});
});

test('buildPassedChecks：门禁键与 RELEASE_GATES 一一对应且恒为 true', () => {
  const checks = buildPassedChecks();
  assert.deepStrictEqual(Object.keys(checks), RELEASE_GATES.map(function (gate) { return gate.key; }));
  for (const value of Object.values(checks)) assert.strictEqual(value, true);
  assert.strictEqual(Object.keys(checks).length, 11, '前置门禁共 11 项');
});
