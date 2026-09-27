'use strict';
// RELEASE.json 双重校验的单元测试：status/version/tag/commit/checks/时间/schema 的正反例。
// 校验逻辑同时服务 CI tag 触发与本地 release:publish，任一字段失配都必须逐条报错并拒绝发布。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateReleaseState } = require('./lib/release-validate.js');
const { buildPassedChecks, RELEASE_GATES } = require('./lib/release-version.js');

const COMMIT = 'a'.repeat(40);

function validState(overrides) {
  return Object.assign({
    schemaVersion: 1,
    version: '1.2.3',
    status: 'verified',
    humanVerifiedBy: '张三',
    verifiedAt: '2026-09-27T10:00:00.000Z',
    commit: COMMIT,
    checks: buildPassedChecks()
  }, overrides || {});
}

test('validateReleaseState：合法 verified 状态 + tag/commit 一致时通过', () => {
  const result = validateReleaseState(validState(), { tag: 'v1.2.3', commit: COMMIT });
  assert.deepStrictEqual(result, { ok: true, errors: [] });
});

test('validateReleaseState：status 必须是 verified（未完成标记拒绝发布）', () => {
  const result = validateReleaseState(validState({ status: 'unverified' }));
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some(function (e) { return e.includes('status 必须为 verified'); }));
});

test('validateReleaseState：version 必须是 X.Y.Z 且与 tag/期望版本一致', () => {
  assert.strictEqual(validateReleaseState(validState({ version: '1.2' })).ok, false);
  const mismatchTag = validateReleaseState(validState({ version: '1.2.3' }), { tag: 'v1.2.4' });
  assert.strictEqual(mismatchTag.ok, false);
  assert.ok(mismatchTag.errors.some(function (e) { return e.includes('version 与 tag 不一致'); }));
  const mismatchVersion = validateReleaseState(validState(), { version: '2.0.0' });
  assert.strictEqual(mismatchVersion.ok, false);
  const badTag = validateReleaseState(validState(), { tag: 'release-1.2.3' });
  assert.strictEqual(badTag.ok, false);
  assert.ok(badTag.errors.some(function (e) { return e.includes('tag 必须是 vX.Y.Z'); }));
});

test('validateReleaseState：commit 必须是 40 位 SHA 且与 tag 指向一致', () => {
  const badFormat = validateReleaseState(validState({ commit: 'abc123' }), { commit: COMMIT });
  assert.strictEqual(badFormat.ok, false);
  assert.ok(badFormat.errors.some(function (e) { return e.includes('40 位'); }));
  const mismatch = validateReleaseState(validState(), { commit: 'b'.repeat(40) });
  assert.strictEqual(mismatch.ok, false);
  assert.ok(mismatch.errors.some(function (e) { return e.includes('commit 与期望提交'); }));
});

test('validateReleaseState：checks 必须非空、全 true、包含全部必需门禁', () => {
  const empty = validateReleaseState(validState({ checks: {} }));
  assert.strictEqual(empty.ok, false);
  assert.ok(empty.errors.some(function (e) { return e.includes('非空对象'); }));

  const failed = validateReleaseState(validState({ checks: Object.assign(buildPassedChecks(), { lint: false }) }));
  assert.strictEqual(failed.ok, false);
  assert.ok(failed.errors.some(function (e) { return e.includes('非 true 项') && e.includes('lint'); }));

  const partial = Object.assign(buildPassedChecks(), {});
  delete partial['verify-compression'];
  const missing = validateReleaseState(validState({ checks: partial }));
  assert.strictEqual(missing.ok, false);
  assert.ok(missing.errors.some(function (e) { return e.includes('缺少必需门禁项') && e.includes('verify-compression'); }));

  assert.strictEqual(RELEASE_GATES.some(function (g) { return g.key === 'verify-compression'; }), true);
});

test('validateReleaseState：humanVerifiedBy 必须非空', () => {
  for (const value of ['', '   ']) {
    const result = validateReleaseState(validState({ humanVerifiedBy: value }));
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some(function (e) { return e.includes('humanVerifiedBy'); }));
  }
});

test('validateReleaseState：verifiedAt 必须是合法 ISO 8601 UTC 时间', () => {
  for (const value of ['', '2026-09-27', '2026/09/27 10:00', '2026-02-30T10:00:00.000Z']) {
    const result = validateReleaseState(validState({ verifiedAt: value }));
    assert.strictEqual(result.ok, false, JSON.stringify(value) + ' 应不合法');
    assert.ok(result.errors.some(function (e) { return e.includes('verifiedAt'); }));
  }
});

test('validateReleaseState：schemaVersion 必须为 1，输入必须是对象', () => {
  assert.strictEqual(validateReleaseState(validState({ schemaVersion: 2 })).ok, false);
  assert.strictEqual(validateReleaseState(validState({ schemaVersion: undefined })).ok, false);
  const notObject = validateReleaseState(null);
  assert.strictEqual(notObject.ok, false);
  assert.deepStrictEqual(notObject.errors, ['RELEASE.json 必须是 JSON 对象']);
  assert.strictEqual(validateReleaseState([]).ok, false);
});

test('validateReleaseState：多个字段同时失配时逐条返回错误', () => {
  const result = validateReleaseState({
    schemaVersion: 1,
    version: '1.2.3',
    status: 'unverified',
    humanVerifiedBy: '',
    verifiedAt: 'bad',
    commit: '',
    checks: {}
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.length >= 5, '应逐条报告所有问题（实际 ' + result.errors.length + ' 条）');
});

test('git 语义回归：单提交发布流程中 commit = tag 父提交，父提交比对校验通过', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's-ynapse-reltag-'));
  try {
    const git = function (args) {
      const result = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
      assert.strictEqual(result.status, 0, 'git ' + args.join(' ') + ' 失败：' + (result.stderr || ''));
      return result.stdout.trim();
    };
    git(['init']);
    git(['config', 'user.email', 'release-test@example.com']);
    git(['config', 'user.name', 'release-test']);
    git(['config', 'commit.gpgsign', 'false']);
    git(['config', 'tag.gpgsign', 'false']);
    fs.writeFileSync(path.join(dir, 'app.txt'), 'source', 'utf-8');
    git(['add', '.']);
    git(['commit', '-m', 'source']);

    const verifiedCommit = git(['rev-parse', 'HEAD']);
    fs.writeFileSync(
      path.join(dir, 'RELEASE.json'),
      JSON.stringify(validState({ commit: verifiedCommit }), null, 2) + '\n',
      'utf-8'
    );
    git(['add', '.']);
    git(['commit', '-m', 'chore(release): v1.2.3']);
    git(['tag', '-a', 'v1.2.3', '-m', 'Release v1.2.3']);

    const parent = git(['rev-parse', 'v1.2.3^{commit}^']);
    assert.strictEqual(parent, verifiedCommit, 'tag 的父提交应等于被核验提交');
    const marker = JSON.parse(git(['show', 'v1.2.3:RELEASE.json']));
    assert.deepStrictEqual(validateReleaseState(marker, { tag: 'v1.2.3', commit: parent }), { ok: true, errors: [] });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
