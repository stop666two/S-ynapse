'use strict';
// release:mark 命令行行为测试：dry-run 端到端（不写文件、输出计划、退出码 0）、
// 递增路径与同版本标记路径的分支输出、参数拒绝矩阵。
// 真实发布会执行门禁、改版本、提交与打 tag，因此测试只覆盖 dry-run 与前置拒绝路径。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');
const RELEASE_JSON = path.join(ROOT, 'RELEASE.json');

function run(args) {
  return spawnSync(process.execPath, ['scripts/release-mark.js'].concat(args), { cwd: ROOT, encoding: 'utf-8' });
}

function snapshot() {
  return {
    pkg: fs.readFileSync(PACKAGE_JSON, 'utf-8'),
    changelog: fs.readFileSync(CHANGELOG, 'utf-8'),
    release: fs.readFileSync(RELEASE_JSON, 'utf-8')
  };
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
  const target = nextPatch(JSON.parse(before.pkg).version);
  const result = run(['patch', '--human-verified', '测试员', '--confirm', target, '--dry-run']);
  assert.strictEqual(result.status, 0, 'dry-run 应成功：' + (result.stderr || ''));
  assert.ok(result.stdout.includes('[release:mark] dry-run'), '应标明 dry-run');
  assert.ok(result.stdout.includes('当前版本：'), '应输出当前版本');
  assert.ok(result.stdout.includes(target), '应输出目标版本 ' + target);
  assert.ok(result.stdout.includes('npm run lint'), '应列出将执行的门禁');
  assert.ok(result.stdout.includes('npm version --no-git-tag-version'), '递增路径应输出版本同步命令');
  assert.ok(!result.stdout.includes('同版本标记'), '递增路径不得出现同版本分支');
  assert.ok(result.stdout.includes('chore(release): v' + target), '应输出计划提交');
  assert.ok(result.stdout.includes('RELEASE.json'), '应输出 RELEASE.json 计划');
  assert.ok(result.stdout.includes('未写入任何文件'), '应声明未写文件');

  const after = snapshot();
  assert.strictEqual(after.pkg, before.pkg, 'package.json 不得变化');
  assert.strictEqual(after.changelog, before.changelog, 'CHANGELOG.md 不得变化');
  assert.strictEqual(after.release, before.release, 'RELEASE.json 不得变化');
});

test('release-mark --dry-run：同版本标记输出同版本分支与 CHANGELOG 计划、不写入任何文件', function () {
  const before = snapshot();
  const current = JSON.parse(before.pkg).version;
  const result = run([current, '--human-verified', '测试员', '--confirm', current, '--dry-run']);
  assert.strictEqual(result.status, 0, '同版本 dry-run 应成功：' + (result.stderr || ''));
  assert.ok(result.stdout.includes('同版本标记'), '应标明同版本分支');
  assert.ok(result.stdout.includes('跳过 npm version'), '同版本分支应跳过 npm version');
  assert.ok(!result.stdout.includes('npm version --no-git-tag-version'), '同版本分支不得执行 npm version');
  assert.ok(result.stdout.includes('CHANGELOG 变换计划'), '应输出 CHANGELOG 变换计划');
  const changelogHasUnreleased = /^## \[Unreleased\]/m.test(before.changelog);
  const hasVersionSection = new RegExp('^## \\[' + current.replace(/\./g, '\\.') + '\\]', 'm').test(before.changelog);
  if (changelogHasUnreleased && hasVersionSection) {
    assert.ok(result.stdout.includes('合并小节'), '当前仓库态应输出合并小节计划');
    assert.ok(result.stdout.includes('删除 [Unreleased] 段'), '当前仓库态应输出删除 Unreleased 的计划');
  }
  assert.ok(result.stdout.includes('chore(release): v' + current), '应输出计划提交');

  const after = snapshot();
  assert.strictEqual(after.pkg, before.pkg, 'package.json 不得变化（同版本不改版本号）');
  assert.strictEqual(after.changelog, before.changelog, 'CHANGELOG.md 不得变化');
  assert.strictEqual(after.release, before.release, 'RELEASE.json 不得变化');
});

test('release-mark：无参数时打印用法并退出码 1', function () {
  const result = run([]);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stdout.includes('用法：'), '应打印用法');
});

test('release-mark：非法版本参数被拒绝', function () {
  const result = run(['latest', '--human-verified', '测试员', '--confirm', '9.9.9', '--dry-run']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('无效的版本参数'), '应提示版本参数非法');
});

test('release-mark：显式版本低于当前版本被拒绝', function () {
  const current = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')).version;
  const lower = previousVersion(current);
  const result = run([lower, '--human-verified', '测试员', '--confirm', lower, '--dry-run']);
  assert.strictEqual(result.status, 1, '低于当前版本应被拒绝');
  assert.ok(result.stderr.includes('必须大于当前版本'));
});

test('release-mark：同版本标记 --confirm 不一致被拒绝', function () {
  const current = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')).version;
  const result = run([current, '--human-verified', '测试员', '--confirm', '9.9.9', '--dry-run']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('--confirm 与目标版本不一致'));
});

test('release-mark：缺少 --human-verified 被拒绝且不执行门禁', function () {
  const target = nextPatch(JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')).version);
  const result = run(['patch', '--confirm', target, '--dry-run']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('human-verified'), '应提示缺少人工核验人');
  assert.ok(!result.stdout.includes('npm run lint'), '参数失败时不得执行门禁');
});

test('release-mark：--confirm 与目标版本不一致被拒绝', function () {
  const result = run(['patch', '--human-verified', '测试员', '--confirm', '9.9.9', '--dry-run']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('--confirm 与目标版本不一致'));
});

test('release-mark：--push 缺少 --confirm-push 二次确认被拒绝', function () {
  const target = nextPatch(JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')).version);
  const result = run(['patch', '--human-verified', '测试员', '--confirm', target, '--dry-run', '--push']);
  assert.strictEqual(result.status, 1);
  assert.ok(result.stderr.includes('--confirm-push'), '应提示需要二次确认');
});
