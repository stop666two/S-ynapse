'use strict';
// release:mark 命令行行为测试：dry-run 端到端（不写文件、输出计划、退出码 0）、
// 递增路径与同版本标记路径的分支输出、参数拒绝矩阵。
// 真实发布会执行门禁、改版本、提交与打 tag，因此测试只覆盖 dry-run 与前置拒绝路径。
//
// 被测脚本以自身位置解析仓库根（__dirname/..），因此测试在临时目录搭建最小夹具仓库：
// 复制 release-mark.js 与 lib 依赖，写入固定 package.json、CHANGELOG（含 [Unreleased]）、
// package-lock.json 与 RELEASE.json，再以夹具副本运行。测试因而与主仓当前版本号、
// CHANGELOG 是否仍有 [Unreleased] 段完全解耦，且不修改主仓任何文件。
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

// 夹具当前版本固定为无预发布标识的 X.Y.Z，使递增/比较用例的分支稳定可预期。
const FIXTURE_VERSION = '1.1.0';
// 夹具 CHANGELOG 同时含 [Unreleased] 与 [1.1.0] 段：同版本标记演练合并分支，
// 递增标记演练重命名分支，两类变换计划均可脱离仓库历史断言。
const FIXTURE_CHANGELOG = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '',
  '- 夹具：待发布新增条目',
  '',
  '### Fixed',
  '',
  '- 夹具：待发布修复条目',
  '',
  '## [1.1.0] - 2026-01-01',
  '',
  '### Added',
  '',
  '- 夹具：1.1.0 既有条目',
  '',
  '## [1.0.0] - 2025-01-01',
  '',
  '### Added',
  '',
  '- 夹具：初始版本',
  '',
  '[Unreleased]: https://example.com/fixture/compare/v1.1.0...HEAD',
  '[1.1.0]: https://example.com/fixture/releases/tag/v1.1.0',
  '[1.0.0]: https://example.com/fixture/releases/tag/v1.0.0',
  ''
].join('\n');

const FIXTURE = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-release-mark-'));
const FIXTURE_SCRIPT = path.join(FIXTURE, 'scripts', 'release-mark.js');
const FIXTURE_PACKAGE_JSON = path.join(FIXTURE, 'package.json');
const FIXTURE_CHANGELOG_PATH = path.join(FIXTURE, 'CHANGELOG.md');
const FIXTURE_RELEASE_JSON = path.join(FIXTURE, 'RELEASE.json');

function createFixture() {
  fs.mkdirSync(path.join(FIXTURE, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts', 'release-mark.js'), FIXTURE_SCRIPT);
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'lib', 'release-version.js'),
    path.join(FIXTURE, 'scripts', 'lib', 'release-version.js')
  );
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'lib', 'atomic-write.js'),
    path.join(FIXTURE, 'scripts', 'lib', 'atomic-write.js')
  );
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'lib', 'process-guard.js'),
    path.join(FIXTURE, 'scripts', 'lib', 'process-guard.js')
  );
  fs.writeFileSync(FIXTURE_PACKAGE_JSON, JSON.stringify({
    name: 's-ynapse-release-mark-fixture',
    version: FIXTURE_VERSION
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(FIXTURE, 'package-lock.json'), JSON.stringify({
    name: 's-ynapse-release-mark-fixture',
    version: FIXTURE_VERSION,
    lockfileVersion: 3,
    packages: {
      '': { name: 's-ynapse-release-mark-fixture', version: FIXTURE_VERSION }
    }
  }, null, 2) + '\n');
  fs.writeFileSync(FIXTURE_CHANGELOG_PATH, FIXTURE_CHANGELOG);
  fs.writeFileSync(FIXTURE_RELEASE_JSON, JSON.stringify({
    schemaVersion: 1,
    version: FIXTURE_VERSION,
    status: 'unverified',
    humanVerifiedBy: '',
    verifiedAt: '',
    commit: '',
    checks: {}
  }, null, 2) + '\n');
}

createFixture();

after(function () {
  fs.rmSync(FIXTURE, { recursive: true, force: true });
});

function run(args) {
  return spawnSync(process.execPath, [FIXTURE_SCRIPT].concat(args), { cwd: FIXTURE, encoding: 'utf-8' });
}

function snapshot() {
  return {
    pkg: fs.readFileSync(FIXTURE_PACKAGE_JSON, 'utf-8'),
    changelog: fs.readFileSync(FIXTURE_CHANGELOG_PATH, 'utf-8'),
    release: fs.readFileSync(FIXTURE_RELEASE_JSON, 'utf-8')
  };
}

// 所有被拒绝路径与 dry-run 都不得产生写入：逐文件比对运行前后快照。
function assertNoWrites(before) {
  const current = snapshot();
  assert.strictEqual(current.pkg, before.pkg, 'package.json 不得变化');
  assert.strictEqual(current.changelog, before.changelog, 'CHANGELOG.md 不得变化');
  assert.strictEqual(current.release, before.release, 'RELEASE.json 不得变化');
}

// 门禁命令只在 dry-run 计划输出中出现；参数拒绝路径必须先于门禁返回。
function assertNoGates(stdout) {
  assert.ok(!stdout.includes('npm run lint'), '参数失败时不得执行门禁');
}

function nextPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match[1] + '.' + match[2] + '.' + (Number(match[3]) + 1);
}

function previousVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (patch > 0) return major + '.' + minor + '.' + (patch - 1);
  if (minor > 0) return major + '.' + (minor - 1) + '.0';
  return (major - 1) + '.0.0';
}

test('release-mark --dry-run：输出完整计划、不写入任何文件、退出码 0', function () {
  const before = snapshot();
  const target = nextPatch(FIXTURE_VERSION);
  const result = run(['patch', '--human-verified', '测试员', '--confirm', target, '--dry-run']);
  assert.strictEqual(result.status, 0, 'dry-run 应成功：' + (result.stderr || ''));
  assert.ok(result.stdout.includes('[release:mark] dry-run'), '应标明 dry-run');
  assert.ok(result.stdout.includes('当前版本：' + FIXTURE_VERSION), '应输出当前版本');
  assert.ok(result.stdout.includes(target), '应输出目标版本 ' + target);
  assert.ok(result.stdout.includes('[Unreleased] → [' + target + ']'), '夹具含 [Unreleased] 时应输出重命名计划');
  assert.ok(result.stdout.includes('npm run lint'), '应列出将执行的门禁');
  assert.ok(result.stdout.includes('npm version --no-git-tag-version'), '递增路径应输出版本同步命令');
  assert.ok(!result.stdout.includes('同版本标记'), '递增路径不得出现同版本分支');
  assert.ok(result.stdout.includes('chore(release): v' + target), '应输出计划提交');
  assert.ok(result.stdout.includes('RELEASE.json'), '应输出 RELEASE.json 计划');
  assert.ok(result.stdout.includes('未写入任何文件'), '应声明未写文件');
  assertNoWrites(before);
});

test('release-mark --dry-run：同版本标记输出同版本分支与 CHANGELOG 合并计划、不写入任何文件', function () {
  const before = snapshot();
  const result = run([FIXTURE_VERSION, '--human-verified', '测试员', '--confirm', FIXTURE_VERSION, '--dry-run']);
  assert.strictEqual(result.status, 0, '同版本 dry-run 应成功：' + (result.stderr || ''));
  assert.ok(result.stdout.includes('同版本标记'), '应标明同版本分支');
  assert.ok(result.stdout.includes('跳过 npm version'), '同版本分支应跳过 npm version');
  assert.ok(!result.stdout.includes('npm version --no-git-tag-version'), '同版本分支不得执行 npm version');
  assert.ok(result.stdout.includes('CHANGELOG 变换计划'), '应输出 CHANGELOG 变换计划');
  assert.ok(result.stdout.includes('合并小节'), '夹具同时含 [Unreleased] 与 [1.1.0] 段，应输出合并小节计划');
  assert.ok(result.stdout.includes('删除 [Unreleased] 段'), '应输出删除 [Unreleased] 段的计划');
  assert.ok(result.stdout.includes('chore(release): v' + FIXTURE_VERSION), '应输出计划提交');
  assertNoWrites(before);
});

test('release-mark：无参数时打印用法并退出码 1', function () {
  const before = snapshot();
  const result = run([]);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stdout.includes('用法：'), '应打印用法');
  assertNoGates(result.stdout);
  assertNoWrites(before);
});

test('release-mark：非法版本参数被拒绝', function () {
  const before = snapshot();
  const result = run(['latest', '--human-verified', '测试员', '--confirm', '9.9.9', '--dry-run']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('无效的版本参数'), '应提示版本参数非法');
  assertNoGates(result.stdout);
  assertNoWrites(before);
});

test('release-mark：显式版本低于当前版本被拒绝', function () {
  const before = snapshot();
  const lower = previousVersion(FIXTURE_VERSION);
  const result = run([lower, '--human-verified', '测试员', '--confirm', lower, '--dry-run']);
  assert.strictEqual(result.status, 1, '低于当前版本应被拒绝');
  assert.ok(result.stderr.includes('必须大于当前版本'));
  assertNoGates(result.stdout);
  assertNoWrites(before);
});

test('release-mark --dry-run：显式预发布版本（核心等于当前）被接受并标明预发布', function () {
  const before = snapshot();
  const target = FIXTURE_VERSION + '-a1';
  const result = run([target, '--human-verified', '测试员', '--confirm', target, '--dry-run']);
  assert.strictEqual(result.status, 0, '预发布 dry-run 应成功：' + (result.stderr || ''));
  assert.ok(result.stdout.includes(target), '应输出目标版本 ' + target);
  assert.ok(result.stdout.includes('预发布'), '应标明预发布发布类型');
  assert.ok(result.stdout.includes('Latest'), '应说明 GitHub Release 以 Latest 发布');
  assert.ok(result.stdout.includes('npm version --no-git-tag-version'), '预发布不是同版本标记，应执行版本同步');
  assertNoWrites(before);
});

test('release-mark：核心版本更低的预发布被拒绝', function () {
  const before = snapshot();
  const target = previousVersion(FIXTURE_VERSION) + '-a1';
  const result = run([target, '--human-verified', '测试员', '--confirm', target, '--dry-run']);
  assert.strictEqual(result.status, 1, '核心版本更低的预发布应被拒绝');
  assert.ok(result.stderr.includes('必须大于当前版本'));
  assertNoGates(result.stdout);
  assertNoWrites(before);
});

test('release-mark：同版本标记 --confirm 不一致被拒绝', function () {
  const before = snapshot();
  const result = run([FIXTURE_VERSION, '--human-verified', '测试员', '--confirm', '9.9.9', '--dry-run']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('--confirm 与目标版本不一致'));
  assertNoGates(result.stdout);
  assertNoWrites(before);
});

test('release-mark：缺少 --human-verified 被拒绝且不执行门禁', function () {
  const before = snapshot();
  const target = nextPatch(FIXTURE_VERSION);
  const result = run(['patch', '--confirm', target, '--dry-run']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('human-verified'), '应提示缺少人工核验人');
  assertNoGates(result.stdout);
  assertNoWrites(before);
});

test('release-mark：--confirm 与目标版本不一致被拒绝', function () {
  const before = snapshot();
  const result = run(['patch', '--human-verified', '测试员', '--confirm', '9.9.9', '--dry-run']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('--confirm 与目标版本不一致'));
  assertNoGates(result.stdout);
  assertNoWrites(before);
});

test('release-mark：--push 缺少 --confirm-push 二次确认被拒绝', function () {
  const before = snapshot();
  const target = nextPatch(FIXTURE_VERSION);
  const result = run(['patch', '--human-verified', '测试员', '--confirm', target, '--dry-run', '--push']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('--confirm-push'), '应提示需要二次确认');
  assert.ok(!result.stdout.includes('推送'), '拒绝路径不得进入推送流程');
  assertNoGates(result.stdout);
  assertNoWrites(before);
});
