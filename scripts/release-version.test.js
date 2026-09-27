'use strict';
// 发布纯函数测试：版本计算与目标解析（递增/同版本标记/非法）、tag 解析、
// CHANGELOG 变换三态（重命名/合并/确保）、真实仓库态、幂等性、RELEASE.json 构造与门禁清单。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  RELEASE_GATES,
  isSemver,
  compareSemver,
  computeNextVersion,
  resolveReleaseTarget,
  normalizeTagVersion,
  formatUtcDate,
  planChangelogRewrite,
  rewriteChangelog,
  buildReleaseState,
  buildPassedChecks
} = require('./lib/release-version.js');

const ROOT = path.resolve(__dirname, '..');

test('computeNextVersion：major/minor/patch 递增并归零低位', () => {
  assert.strictEqual(computeNextVersion('1.2.3', 'major'), '2.0.0');
  assert.strictEqual(computeNextVersion('1.2.3', 'minor'), '1.3.0');
  assert.strictEqual(computeNextVersion('1.2.3', 'patch'), '1.2.4');
  assert.strictEqual(computeNextVersion('0.0.0', 'patch'), '0.0.1');
});

test('computeNextVersion：显式版本必须大于当前版本（同核心预发布为例外），非法输入抛错', () => {
  assert.strictEqual(computeNextVersion('1.2.3', '1.5.0'), '1.5.0');
  assert.throws(() => computeNextVersion('1.2.3', '1.2.3'), /必须大于当前版本/);
  assert.throws(() => computeNextVersion('1.2.3', '1.2.2'), /必须大于当前版本/);
  assert.throws(() => computeNextVersion('1.2.3', 'v1.5.0'), /无效的版本参数/);
  assert.throws(() => computeNextVersion('1.2.3', 'latest'), /无效的版本参数/);
  assert.throws(() => computeNextVersion('bad', 'patch'), /当前版本/);
  // 预发布：当前为正式版时可标记同核心预发布；预发布升级/换正式版按 SemVer 比较；回退拒绝
  assert.strictEqual(computeNextVersion('1.2.3', '1.2.3-rc.1'), '1.2.3-rc.1');
  assert.strictEqual(computeNextVersion('1.2.3-rc.1', '1.2.3-rc.2'), '1.2.3-rc.2');
  assert.strictEqual(computeNextVersion('1.2.3-rc.1', '1.2.3'), '1.2.3');
  assert.throws(() => computeNextVersion('1.2.3', '1.2.2-rc.1'), /必须大于当前版本/);
  assert.throws(() => computeNextVersion('1.2.3-rc.1', '1.2.3-rc.0'), /必须大于当前版本/);
});

test('resolveReleaseTarget：关键字/显式更高版本走递增，显式同版本走同版本标记', () => {
  assert.deepStrictEqual(resolveReleaseTarget('1.2.3', 'patch'), { version: '1.2.4', sameVersion: false });
  assert.deepStrictEqual(resolveReleaseTarget('1.2.3', 'minor'), { version: '1.3.0', sameVersion: false });
  assert.deepStrictEqual(resolveReleaseTarget('1.2.3', 'major'), { version: '2.0.0', sameVersion: false });
  assert.deepStrictEqual(resolveReleaseTarget('1.2.3', '2.0.0'), { version: '2.0.0', sameVersion: false });
  assert.deepStrictEqual(resolveReleaseTarget('1.2.3', '1.2.3'), { version: '1.2.3', sameVersion: true });
  assert.deepStrictEqual(resolveReleaseTarget('1.2.3', '1.2.3-rc.1'), { version: '1.2.3-rc.1', sameVersion: false });
  assert.deepStrictEqual(resolveReleaseTarget('1.2.3-rc.1', '1.2.3-rc.1'), { version: '1.2.3-rc.1', sameVersion: true });
  assert.throws(() => resolveReleaseTarget('1.2.3', '1.2.2'), /必须大于当前版本/);
  assert.throws(() => resolveReleaseTarget('1.2.3', 'latest'), /无效的版本参数/);
});

test('normalizeTagVersion：接受 vX.Y.Z 与 vX.Y.Z-预发布，返回裸版本号', () => {
  assert.strictEqual(normalizeTagVersion('v1.2.3'), '1.2.3');
  assert.strictEqual(normalizeTagVersion('v1.2.3-rc.1'), '1.2.3-rc.1');
  assert.strictEqual(normalizeTagVersion('v1.1.0-a1'), '1.1.0-a1');
  assert.throws(() => normalizeTagVersion('1.2.3'), /vX\.Y\.Z/);
  assert.throws(() => normalizeTagVersion('v1.2'), /vX\.Y\.Z/);
  assert.throws(() => normalizeTagVersion('v1.2.3-'), /vX\.Y\.Z/);
  assert.throws(() => normalizeTagVersion('v1.2.3-rc_1'), /vX\.Y\.Z/);
  assert.throws(() => normalizeTagVersion('v1.2.3-01'), /vX\.Y\.Z/);
  assert.throws(() => normalizeTagVersion(''), /vX\.Y\.Z/);
});

test('semver 工具：isSemver / compareSemver / formatUtcDate', () => {
  assert.strictEqual(isSemver('1.0.0'), true);
  assert.strictEqual(isSemver('1.0'), false);
  assert.strictEqual(isSemver(100), false);
  assert.strictEqual(isSemver('1.0.0-a1'), true);
  assert.strictEqual(isSemver('1.0.0-a.1'), true);
  assert.strictEqual(isSemver('1.0.0-'), false);
  assert.strictEqual(isSemver('1.0.0-a..b'), false);
  assert.strictEqual(isSemver('1.0.0-01'), false, '数字标识符不得有前导零');
  assert.ok(compareSemver('2.0.0', '1.9.9') > 0);
  assert.ok(compareSemver('1.2.3', '1.2.3') === 0);
  assert.ok(compareSemver('1.2.3', '1.2.4') < 0);
  assert.ok(compareSemver('1.1.0-a1', '1.1.0') < 0, '预发布 < 正式版');
  assert.ok(compareSemver('1.1.0-a2', '1.1.0-a1') > 0);
  assert.ok(compareSemver('1.1.0-10', '1.1.0-9') > 0, '数字标识符按数值比较');
  assert.ok(compareSemver('1.1.0-a10', '1.1.0-a9') < 0, '字母数字标识符按 ASCII 字典序');
  assert.ok(compareSemver('1.1.0-rc.1', '1.1.0-a1') > 0, 'ASCII 字典序：rc > a1');
  assert.ok(compareSemver('1.1.0-alpha', '1.1.0-alpha.1') < 0, '公共前缀时标识符更少者更小');
  assert.ok(compareSemver('1.1.0-1', '1.1.0-a') < 0, '数字标识符优先级低于字母数字');
  assert.strictEqual(formatUtcDate(new Date('2026-09-27T23:59:59.000Z')), '2026-09-27');
});

// 状态②（合并）夹具：[Unreleased]（Added/Changed）与已有版本段（Added/Fixed）并存。
const MERGE_FIXTURE = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '',
  '- 新条目 A',
  '',
  '### Changed',
  '',
  '- 变更条目 B',
  '',
  '## [1.1.0] - 2026-09-26',
  '',
  '### Added',
  '',
  '- 旧条目 C',
  '',
  '### Fixed',
  '',
  '- 修复条目 D',
  '',
  '[1.1.0]: https://example.com/tag/v1.1.0',
  ''
].join('\n');

test('rewriteChangelog：状态① 有 Unreleased、无目标版本段 → 重命名并补链接', () => {
  const input = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '',
    '- 新功能 A',
    '',
    '## [1.0.0] - 2026-01-01',
    '',
    '### Added',
    '',
    '- 旧功能 B',
    '',
    '[1.0.0]: https://example.com/tag/v1.0.0',
    ''
  ].join('\n');
  const plan = planChangelogRewrite(input, '1.1.0', '2026-09-27');
  assert.strictEqual(plan.mode, 'rename');
  assert.deepStrictEqual(plan.sectionsRenamed, ['Unreleased']);
  assert.ok(plan.text.includes('## [1.1.0] - 2026-09-27'), 'Unreleased 标题重命名为目标版本段');
  assert.ok(!plan.text.includes('## [Unreleased]'), 'Unreleased 标题不再存在');
  assert.ok(plan.text.includes('- 新功能 A'), '原 Unreleased 条目保留');
  assert.ok(plan.text.includes('## [1.0.0] - 2026-01-01') && plan.text.includes('- 旧功能 B'), '旧版本段原样保留');
  assert.ok(plan.text.includes('[1.1.0]: https://github.com/stop666two/S-ynapse/releases/tag/v1.1.0'), '补版本链接');
  assert.strictEqual(plan.linkAdded, true);
  assert.ok(plan.text.endsWith('\n'), '文件以换行结尾');
});

test('rewriteChangelog：预发布版本段（X.Y.Z-a1）可正确重命名并补链接', () => {
  const input = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '',
    '- 预发布条目 A',
    ''
  ].join('\n');
  const plan = planChangelogRewrite(input, '1.2.0-a1', '2026-09-27');
  assert.strictEqual(plan.mode, 'rename');
  assert.ok(plan.text.includes('## [1.2.0-a1] - 2026-09-27'), '预发布段标题');
  assert.ok(plan.text.includes('- 预发布条目 A'), '条目保留');
  assert.ok(plan.text.includes('[1.2.0-a1]: https://github.com/stop666two/S-ynapse/releases/tag/v1.2.0-a1'), '预发布版本链接');
  assert.strictEqual(plan.linkAdded, true);
});

test('rewriteChangelog：状态② 有 Unreleased 与目标版本段 → 合并、删段、改日期', () => {
  const plan = planChangelogRewrite(MERGE_FIXTURE, '1.1.0', '2026-09-27');
  assert.strictEqual(plan.mode, 'merge');
  assert.deepStrictEqual(plan.sectionsRemoved, ['Unreleased']);
  assert.ok(plan.text.includes('## [1.1.0] - 2026-09-27'), '版本段日期更新为发布日');
  assert.ok(!plan.text.includes('## [Unreleased]'), 'Unreleased 段被删除');
  const addedIndex = plan.text.indexOf('### Added');
  const newIndex = plan.text.indexOf('- 新条目 A');
  const oldIndex = plan.text.indexOf('- 旧条目 C');
  assert.ok(addedIndex >= 0 && newIndex > addedIndex && oldIndex > newIndex, '同标题小节合并且新条目在前');
  assert.ok(plan.text.includes('### Fixed') && plan.text.includes('- 修复条目 D'), '既有小节与条目保留');
  assert.ok(plan.text.includes('### Changed') && plan.text.includes('- 变更条目 B'), '目标段没有的小节追加');
  assert.ok(plan.text.indexOf('### Fixed') < plan.text.indexOf('### Changed'), '新小节追加在既有小节之后');
  assert.ok(plan.text.includes('[1.1.0]: https://example.com/tag/v1.1.0'), '原有链接引用块保留');
  assert.strictEqual(plan.linkAdded, false, '链接已存在时不重复补');
});

test('planChangelogRewrite：合并计划列出待合并小节与条目数', () => {
  const plan = planChangelogRewrite(MERGE_FIXTURE, '1.1.0', '2026-09-27');
  assert.deepStrictEqual(plan.mergedSubsections, [
    { title: 'Added', entries: 1 },
    { title: 'Changed', entries: 1 }
  ]);
  assert.strictEqual(plan.headingCreated, false);
});

test('rewriteChangelog：状态③ 无 Unreleased 且已有版本段 → 仅补链接、不改日期', () => {
  const input = [
    '# Changelog',
    '',
    '## [1.1.0] - 2026-09-26',
    '',
    '### Added',
    '',
    '- 条目 A',
    ''
  ].join('\n');
  const plan = planChangelogRewrite(input, '1.1.0', '2026-09-27');
  assert.strictEqual(plan.mode, 'ensure');
  assert.strictEqual(plan.linkAdded, true);
  assert.ok(plan.text.includes('## [1.1.0] - 2026-09-26'), 'ensure 不改写已有版本段日期');
  assert.ok(plan.text.includes('- 条目 A'));
  assert.ok(plan.text.includes('[1.1.0]: https://github.com/stop666two/S-ynapse/releases/tag/v1.1.0'));
});

test('rewriteChangelog：状态③ 无 Unreleased 且无版本段 → 新建空段并补链接', () => {
  const input = [
    '# Changelog',
    '',
    '## [1.0.0] - 2026-01-01',
    '',
    '### Added',
    '',
    '- 旧条目 A',
    '',
    '[1.0.0]: https://example.com/tag/v1.0.0',
    ''
  ].join('\n');
  const plan = planChangelogRewrite(input, '1.2.0', '2026-09-27');
  assert.strictEqual(plan.mode, 'create');
  assert.strictEqual(plan.headingCreated, true);
  assert.ok(plan.text.includes('## [1.2.0] - 2026-09-27'));
  assert.ok(plan.text.indexOf('## [1.2.0]') < plan.text.indexOf('## [1.0.0]'), '新段位于旧版本段之前');
  assert.ok(plan.text.includes('[1.2.0]: https://github.com/stop666two/S-ynapse/releases/tag/v1.2.0'));
  assert.ok(plan.text.includes('- 旧条目 A'));
});

test('rewriteChangelog：变换幂等（同版本再次调用保持 ensure 且文本不变）', () => {
  const once = rewriteChangelog(MERGE_FIXTURE, '1.1.0', '2026-09-27');
  const plan = planChangelogRewrite(once, '1.1.0', '2026-09-27');
  assert.strictEqual(plan.mode, 'ensure');
  assert.strictEqual(plan.text, once);
});

test('rewriteChangelog：真实仓库态（[Unreleased] 与静态版本段并存时执行合并）', () => {
  const realText = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
  const currentVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).version;
  const versionRe = new RegExp('^## \\[' + currentVersion.replace(/\./g, '\\.') + '\\]', 'm');
  const hasUnreleased = /^## \[Unreleased\]/m.test(realText);
  const hasVersionSection = versionRe.test(realText);
  const plan = planChangelogRewrite(realText, currentVersion, '2026-09-27');
  assert.ok(plan.text.includes('[' + currentVersion + ']: '), '版本链接保留或补齐');
  if (hasUnreleased && hasVersionSection) {
    assert.strictEqual(plan.mode, 'merge', '当前仓库态应走合并分支');
    assert.ok(!/^## \[Unreleased\]/m.test(plan.text), 'Unreleased 段被删除');
    assert.ok(new RegExp('^## \\[' + currentVersion + '\\] - 2026-09-27$', 'm').test(plan.text), '版本段日期更新');
    assert.ok(plan.text.includes('自动发布 Release 机制'), 'Unreleased 代表性条目保留');
    assert.ok(plan.text.includes('无封面文章自动生成封面'), '已有版本段代表性条目保留');
    assert.ok(plan.mergedSubsections.length >= 2, '至少合并 Added/Changed 两个小节');
  } else {
    assert.ok(!/^## \[Unreleased\]/m.test(plan.text), 'Unreleased 若存在必被处理');
  }
});

test('rewriteChangelog：非法日期、版本或空内容时抛错', () => {
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
