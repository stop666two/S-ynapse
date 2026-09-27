'use strict';
// release:prune（「只保留最新版本」清理器）的单元测试：
// 参数解析、待删除选择（保留 keep）、gh 假执行器的列表/删除/失败收集、CLI 参数错误退出码。
// 测试全程使用注入的假执行器，不调用真实 gh、不触碰任何远端资源。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs, selectObsoleteTags, listReleaseTags, pruneOlderReleases } = require('./release-prune.js');

const ROOT = path.resolve(__dirname, '..');

function fakeRunner(handlers) {
  const calls = [];
  const runner = function (args) {
    calls.push(args.slice());
    return handlers(args);
  };
  runner.calls = calls;
  return runner;
}

test('selectObsoleteTags：保留 keep，其余全部待删', () => {
  assert.deepStrictEqual(selectObsoleteTags(['v1.0.0', 'v1.1.0', 'v1.1.0-a1'], 'v1.1.0'), ['v1.0.0', 'v1.1.0-a1']);
  assert.deepStrictEqual(selectObsoleteTags(['v1.1.0'], 'v1.1.0'), []);
  assert.deepStrictEqual(selectObsoleteTags([], 'v1.1.0'), []);
  assert.throws(() => selectObsoleteTags(null, 'v1.1.0'), /字符串数组/);
});

test('parseArgs：--keep 两种形式与 --dry-run/--help；未知参数抛错', () => {
  assert.deepStrictEqual(parseArgs(['--keep', 'v1.1.0']), { keep: 'v1.1.0', dryRun: false, help: false });
  assert.deepStrictEqual(parseArgs(['--keep=v1.1.0', '--dry-run']), { keep: 'v1.1.0', dryRun: true, help: false });
  assert.strictEqual(parseArgs(['--help']).help, true);
  assert.throws(() => parseArgs(['--unknown']), /未知参数/);
});

test('listReleaseTags：解析 gh JSON 并过滤空值；gh 失败与非法 JSON 抛错', () => {
  const ok = fakeRunner(() => ({
    status: 0,
    stdout: JSON.stringify([{ tagName: 'v1.1.0' }, { tagName: '' }, { tagName: 'v1.0.0' }]),
    stderr: ''
  }));
  assert.deepStrictEqual(listReleaseTags(ok), ['v1.1.0', 'v1.0.0']);
  const failed = fakeRunner(() => ({ status: 1, stdout: '', stderr: 'auth required' }));
  assert.throws(() => listReleaseTags(failed), /gh release list 失败/);
  const badJson = fakeRunner(() => ({ status: 0, stdout: 'not-json', stderr: '' }));
  assert.throws(() => listReleaseTags(badJson), /不是合法 JSON/);
  const notArray = fakeRunner(() => ({ status: 0, stdout: '{}', stderr: '' }));
  assert.throws(() => listReleaseTags(notArray), /结构异常/);
});

test('pruneOlderReleases：删除除 keep 外的 Release（--yes --cleanup-tag），失败逐条收集', () => {
  const runner = fakeRunner((args) => {
    if (args[0] === 'release' && args[1] === 'list') {
      return {
        status: 0,
        stdout: JSON.stringify([{ tagName: 'v1.1.0' }, { tagName: 'v1.0.0' }, { tagName: 'v1.1.0-a1' }]),
        stderr: ''
      };
    }
    if (args[2] === 'v1.0.0') return { status: 0, stdout: '', stderr: '' };
    return { status: 1, stdout: '', stderr: 'permission denied' };
  });
  const result = pruneOlderReleases({ keep: 'v1.1.0' }, runner);
  assert.deepStrictEqual(result.deleted, ['v1.0.0']);
  assert.strictEqual(result.failed.length, 1);
  assert.strictEqual(result.failed[0].tag, 'v1.1.0-a1');
  const deleteCalls = runner.calls.filter((args) => args[1] === 'delete');
  assert.strictEqual(deleteCalls.length, 2);
  for (const call of deleteCalls) {
    assert.ok(call.includes('--yes') && call.includes('--cleanup-tag'), '删除必须带 --yes --cleanup-tag');
  }
  assert.ok(!runner.calls.some((args) => args[1] === 'delete' && args[2] === 'v1.1.0'), '不得删除 keep 自身');
});

test('pruneOlderReleases：dry-run 只给出计划、不调用删除', () => {
  const runner = fakeRunner(() => ({
    status: 0,
    stdout: JSON.stringify([{ tagName: 'v1.1.0' }, { tagName: 'v1.0.0' }]),
    stderr: ''
  }));
  const result = pruneOlderReleases({ keep: 'v1.1.0', dryRun: true }, runner);
  assert.deepStrictEqual(result.deleted, ['v1.0.0']);
  assert.ok(!runner.calls.some((args) => args[1] === 'delete'), 'dry-run 不得调用删除');
});

test('pruneOlderReleases：缺少 --keep 抛错', () => {
  const runner = fakeRunner(() => ({ status: 0, stdout: '[]', stderr: '' }));
  assert.throws(() => pruneOlderReleases({}, runner), /--keep/);
});

test('release-prune CLI：缺少 --keep 时打印用法并以退出码 1 结束（不触碰 gh）', () => {
  const result = spawnSync(process.execPath, ['scripts/release-prune.js'], { cwd: ROOT, encoding: 'utf-8' });
  assert.strictEqual(result.status, 1);
  assert.ok(result.stdout.includes('用法：'), '应打印用法');
});
