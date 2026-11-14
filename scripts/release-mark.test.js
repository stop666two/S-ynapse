'use strict';
// release:mark 命令行行为测试：dry-run 端到端（不写文件、输出计划、退出码 0）、
// 递增路径与同版本标记路径的分支输出、参数拒绝矩阵。
// 真实发布会执行门禁、改版本、提交与打 tag，因此测试只覆盖 dry-run、前置拒绝路径
// 与门禁结果核对（自跳过 → checks 记 false，）。
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
const { evaluateGateReport, recordGateResult } = require('./release-mark.js');
const { RELEASE_GATES, COMPRESSION_VERIFY_REPORT } = require('./lib/release-version.js');

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

// —— 退出码 0 但「自跳过」的门禁不得记入 RELEASE.json.checks 为 true ——
// 旧实现只按退出码判定（buildPassedChecks 预置全 true 后不再改动），无 Chrome 时
// verify:compression 以 status=skipped 退出 0，于是 checks['verify-compression'] 谎报通过。
// 下面以临时根目录中的报告文件驱动核对逻辑（真实门禁条目 + 真实报告路径约定）。

// 在临时根目录写入压缩验证报告：report 为 null 表示不产出报告文件。
function createReportRoot(report) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-gate-report-'));
  const file = path.join(root, '.cache', 'compression-verify', 'cli-last.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (report !== null) fs.writeFileSync(file, JSON.stringify(report), 'utf-8');
  return root;
}

test('压缩验证报告路径单源：写方与读方都从 RELEASE_GATES 取，不各自硬编码', function () {
  assert.strictEqual(COMPRESSION_VERIFY_REPORT, '.cache/compression-verify/cli-last.json');
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'verify-compression.js'), 'utf-8');
  assert.ok(source.includes("require('./lib/release-version')"), '写方必须从 release-version 取路径常量');
  assert.ok(source.includes('COMPRESSION_VERIFY_REPORT'), '写方必须使用共享常量');
  assert.ok(!source.includes('compression-verify/cli-last.json'), '写方不得重复硬编码报告路径');
});

test('evaluateGateReport：压缩门禁自跳过（status=skipped）记 false 并大声告警', function () {
  const gate = RELEASE_GATES.filter(function (item) { return item.key === 'verify-compression'; })[0];
  assert.ok(gate && gate.reportFile, '压缩门禁必须声明 reportFile（与 verify-compression 的写入路径同源）');
  assert.ok(!gate.reportFile.includes('\\'), 'reportFile 用 / 分隔，跨平台由 path.join 归一化');
  const root = createReportRoot({ status: 'skipped', reason: '未找到 Chrome / Chromium' });
  try {
    const verdict = evaluateGateReport(root, gate);
    assert.strictEqual(verdict.passed, false, '自跳过的门禁不得判为通过');
    assert.match(verdict.warning, /压缩无头对比/, '告警必须指名门禁');
    assert.match(verdict.warning, /门禁自跳过：未找到 Chrome/, '告警必须带上自跳过原因');
    assert.match(verdict.warning, /verify-compression=false/, '告警必须说明写入的 checks 值');
    assert.match(verdict.warning, /release-validate|release:publish/, '告警必须说明后续发布校验会拒绝');

    // recordGateResult 是 runGates 实际调用的落盘路径：checks 必须变 false。
    const checks = { 'verify-compression': true };
    recordGateResult(checks, root, gate);
    assert.strictEqual(checks['verify-compression'], false, 'RELEASE.json 该项必须落盘为 false 而非 true');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('evaluateGateReport：passed 记通过，报告缺失/状态异常一律 fail-closed', function () {
  const gate = RELEASE_GATES.filter(function (item) { return item.key === 'verify-compression'; })[0];
  const roots = [createReportRoot({ status: 'passed' }), createReportRoot(null), createReportRoot({ status: 'failed' })];
  try {
    const passed = evaluateGateReport(roots[0], gate);
    assert.strictEqual(passed.passed, true);
    assert.strictEqual(passed.reason, '');

    const missing = evaluateGateReport(roots[1], gate);
    assert.strictEqual(missing.passed, false, '报告缺失时不得乐观放行');
    assert.match(missing.reason, /未产出验证结果/);

    const failed = evaluateGateReport(roots[2], gate);
    assert.strictEqual(failed.passed, false);
    assert.match(failed.reason, /failed/);

    // 不声明 reportFile 的门禁仍只看退出码：无需任何报告文件即视为通过。
    const plain = RELEASE_GATES.filter(function (item) { return item.key === 'lint'; })[0];
    assert.strictEqual(evaluateGateReport(roots[1], plain).passed, true);
  } finally {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  }
});
