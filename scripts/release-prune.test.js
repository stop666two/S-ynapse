'use strict';
// release:prune（「只保留最新版本」清理器）的单元测试：
// 参数解析；纯函数选择（Release tag、远端 v* tag、扣除随 Release 清理项）；
// gh/git 假执行器的列表/删除/失败收集、「先 Release 后 tag」顺序、双列表先于删除。
// 测试全程使用注入的假执行器，不调用真实 gh/git、不触碰任何远端资源。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  parseArgs,
  selectObsoleteTags,
  selectObsoleteRemoteTags,
  planRemoteTagDeletions,
  listReleaseTags,
  listRemoteTags,
  pruneOlderReleases
} = require('./release-prune.js');

const ROOT = path.resolve(__dirname, '..');

function fakeGh(runner) {
  const calls = [];
  const gh = function (args) {
    calls.push(args.slice());
    return runner(args);
  };
  gh.calls = calls;
  return gh;
}

function makeRunners(options) {
  const opts = options || {};
  const sequence = [];
  const gh = function (args) {
    sequence.push({ cli: 'gh', args: args.slice() });
    if (args[0] === 'release' && args[1] === 'list') {
      return {
        status: 0,
        stdout: JSON.stringify((opts.releases || []).map(function (tag) { return { tagName: tag }; })),
        stderr: ''
      };
    }
    return opts.ghDelete ? opts.ghDelete(args) : { status: 0, stdout: '', stderr: '' };
  };
  const git = function (args) {
    sequence.push({ cli: 'git', args: args.slice() });
    if (args[0] === 'ls-remote') {
      if (opts.gitListFailed) return { status: 1, stdout: '', stderr: 'no remote' };
      const lines = (opts.remoteTags || []).map(function (tag) { return 'abc123\trefs/tags/' + tag; });
      return { status: 0, stdout: lines.length ? lines.join('\n') + '\n' : '', stderr: '' };
    }
    return opts.gitPush ? opts.gitPush(args) : { status: 0, stdout: '', stderr: '' };
  };
  return { gh: gh, git: git, sequence: sequence };
}

test('selectObsoleteTags：保留 keep，其余全部待删', () => {
  assert.deepStrictEqual(selectObsoleteTags(['v1.0.0', 'v1.1.0', 'v1.1.0-a1'], 'v1.1.0'), ['v1.0.0', 'v1.1.0-a1']);
  assert.deepStrictEqual(selectObsoleteTags(['v1.1.0'], 'v1.1.0'), []);
  assert.deepStrictEqual(selectObsoleteTags([], 'v1.1.0'), []);
  assert.throws(() => selectObsoleteTags(null, 'v1.1.0'), /字符串数组/);
});

test('selectObsoleteRemoteTags：多个旧 v* tag 全部列入，keep 与无旧 tag 两态', () => {
  assert.deepStrictEqual(
    selectObsoleteRemoteTags(['v0.9.0', 'v1.0.0', 'v1.1.0', 'v1.1.0-a1'], 'v1.1.0'),
    ['v0.9.0', 'v1.0.0', 'v1.1.0-a1']
  );
  assert.deepStrictEqual(selectObsoleteRemoteTags(['v1.1.0'], 'v1.1.0'), []);
  assert.deepStrictEqual(selectObsoleteRemoteTags([], 'v1.1.0'), []);
});

test('selectObsoleteRemoteTags：当前 tag 受保护，非 v* tag 一律不动', () => {
  const selected = selectObsoleteRemoteTags(['v1.1.0', 'v1.1.0-a1', 'release-notes', '2026.01', 'backup/x'], 'v1.1.0');
  assert.deepStrictEqual(selected, ['v1.1.0-a1']);
  assert.ok(!selected.includes('v1.1.0'), 'keep 不得出现在删除清单');
  assert.throws(() => selectObsoleteRemoteTags(null, 'v1.1.0'), /字符串数组/);
});

test('planRemoteTagDeletions：扣除随 Release 清理的 tag，避免二次删除', () => {
  const remote = ['v1.0.0', 'v1.0.1', 'v1.0.2', 'release-notes'];
  assert.deepStrictEqual(planRemoteTagDeletions(remote, 'v1.1.0', ['v1.0.0']), ['v1.0.1', 'v1.0.2']);
  assert.deepStrictEqual(planRemoteTagDeletions(remote, 'v1.1.0', []), ['v1.0.0', 'v1.0.1', 'v1.0.2']);
  assert.deepStrictEqual(planRemoteTagDeletions(remote, 'v1.1.0'), ['v1.0.0', 'v1.0.1', 'v1.0.2']);
  assert.deepStrictEqual(planRemoteTagDeletions(remote, 'v1.1.0', ['release-notes']), ['v1.0.0', 'v1.0.1', 'v1.0.2']);
});

test('parseArgs：--keep 两种形式与 --dry-run/--help；未知参数抛错', () => {
  assert.deepStrictEqual(parseArgs(['--keep', 'v1.1.0']), { keep: 'v1.1.0', dryRun: false, help: false });
  assert.deepStrictEqual(parseArgs(['--keep=v1.1.0', '--dry-run']), { keep: 'v1.1.0', dryRun: true, help: false });
  assert.strictEqual(parseArgs(['--help']).help, true);
  assert.throws(() => parseArgs(['--unknown']), /未知参数/);
});

test('listReleaseTags：解析 gh JSON 并过滤空值；gh 失败与非法 JSON 抛错', () => {
  const ok = fakeGh(() => ({
    status: 0,
    stdout: JSON.stringify([{ tagName: 'v1.1.0' }, { tagName: '' }, { tagName: 'v1.0.0' }]),
    stderr: ''
  }));
  assert.deepStrictEqual(listReleaseTags(ok), ['v1.1.0', 'v1.0.0']);
  const failed = fakeGh(() => ({ status: 1, stdout: '', stderr: 'auth required' }));
  assert.throws(() => listReleaseTags(failed), /gh release list 失败/);
  const badJson = fakeGh(() => ({ status: 0, stdout: 'not-json', stderr: '' }));
  assert.throws(() => listReleaseTags(badJson), /不是合法 JSON/);
  const notArray = fakeGh(() => ({ status: 0, stdout: '{}', stderr: '' }));
  assert.throws(() => listReleaseTags(notArray), /结构异常/);
});

test('listRemoteTags：解析 ls-remote 输出；git 失败抛错', () => {
  const ok = fakeGh(() => ({
    status: 0,
    stdout: 'abc123\trefs/tags/v1.0.0\ndef456\trefs/tags/v1.1.0\n',
    stderr: ''
  }));
  assert.deepStrictEqual(listRemoteTags(ok), ['v1.0.0', 'v1.1.0']);
  const failed = fakeGh(() => ({ status: 1, stdout: '', stderr: 'no remote' }));
  assert.throws(() => listRemoteTags(failed), /git ls-remote 失败/);
});

test('pruneOlderReleases：先删 Release 后删 v* tag，keep 与非 v* 不动，失败 tag 不补删', () => {
  const runners = makeRunners({
    releases: ['v1.1.0', 'v1.0.1', 'v1.0.0'],
    remoteTags: ['v1.1.0', 'v1.0.1', 'v1.0.0', 'release-notes'],
    ghDelete: (args) => (args[2] === 'v1.0.0'
      ? { status: 1, stdout: '', stderr: 'permission denied' }
      : { status: 0, stdout: '', stderr: '' })
  });
  const result = pruneOlderReleases({ keep: 'v1.1.0' }, { ghRunner: runners.gh, gitRunner: runners.git });
  assert.deepStrictEqual(result.deleted, ['v1.0.1']);
  assert.deepStrictEqual(result.failed, [{ tag: 'v1.0.0', message: 'permission denied' }]);
  assert.deepStrictEqual(result.tagsDeleted, []);
  assert.deepStrictEqual(result.tagsFailed, []);

  const mutations = runners.sequence.filter((call) =>
    (call.cli === 'gh' && call.args[1] === 'delete') ||
    (call.cli === 'git' && call.args[0] === 'push')
  );
  const releaseDeletes = mutations.filter((call) => call.cli === 'gh');
  const tagPushes = mutations.filter((call) => call.cli === 'git');
  assert.strictEqual(releaseDeletes.length, 2);
  assert.strictEqual(tagPushes.length, 0, '失败 Release 的 tag 不得单独补删（留给下次重试）');
  const lastReleaseDelete = runners.sequence.lastIndexOf(releaseDeletes[releaseDeletes.length - 1]);
  assert.ok(runners.sequence.some((call) => call.cli === 'gh' && call.args[1] === 'delete'), '应先有 Release 删除');
  for (const push of tagPushes) {
    assert.ok(runners.sequence.indexOf(push) > lastReleaseDelete, 'tag 删除必须晚于全部 Release 删除');
  }
  for (const call of releaseDeletes) assert.ok(call.args.includes('--yes') && call.args.includes('--cleanup-tag'));
  assert.ok(!runners.sequence.some((call) => call.args.includes('v1.1.0')), '不得删除 keep 自身');
  assert.ok(!runners.sequence.some((call) => call.args.includes('release-notes')), '非 v* tag 不得触碰');
});

test('pruneOlderReleases：无 Release 的残留 v* tag 在 Release 清理后由 git 删除', () => {
  const runners = makeRunners({
    releases: ['v1.1.0', 'v1.0.0'],
    remoteTags: ['v1.1.0', 'v1.0.0', 'v0.9.0']
  });
  const result = pruneOlderReleases({ keep: 'v1.1.0' }, { ghRunner: runners.gh, gitRunner: runners.git });
  assert.deepStrictEqual(result.deleted, ['v1.0.0']);
  assert.deepStrictEqual(result.tagsDeleted, ['v0.9.0'], 'v1.0.0 已随 Release --cleanup-tag 删除，不重复');
  const pushes = runners.sequence.filter((call) => call.cli === 'git' && call.args[0] === 'push');
  assert.deepStrictEqual(pushes[0].args, ['push', 'origin', ':refs/tags/v0.9.0']);
  const ghDeleteIndex = runners.sequence.findIndex((call) => call.cli === 'gh' && call.args[1] === 'delete');
  const firstPushIndex = runners.sequence.findIndex((call) => call.cli === 'git' && call.args[0] === 'push');
  assert.ok(ghDeleteIndex < firstPushIndex, '顺序固定：先删 Release，再删 tag');
});

test('pruneOlderReleases：dry-run 同时给出 Release 与 tag 两阶段计划且零删除调用', () => {
  const runners = makeRunners({
    releases: ['v1.1.0', 'v1.0.0'],
    remoteTags: ['v1.1.0', 'v1.0.0', 'v0.9.0', 'release-notes']
  });
  const result = pruneOlderReleases(
    { keep: 'v1.1.0', dryRun: true },
    { ghRunner: runners.gh, gitRunner: runners.git }
  );
  assert.deepStrictEqual(result.deleted, ['v1.0.0']);
  assert.deepStrictEqual(result.tagsDeleted, ['v0.9.0'], '计划删除的 Release tag 不重复出现在 tag 清单');
  assert.strictEqual(result.failed.length, 0);
  assert.strictEqual(result.tagsFailed.length, 0);
  assert.ok(!runners.sequence.some((call) => call.cli === 'gh' && call.args[1] === 'delete'), 'dry-run 不得调用 gh 删除');
  assert.ok(!runners.sequence.some((call) => call.cli === 'git' && call.args[0] === 'push'), 'dry-run 不得调用 git 推送');
});

test('pruneOlderReleases：远端列表失败时在删除前中止（无半清理状态）', () => {
  const runners = makeRunners({
    releases: ['v1.1.0', 'v1.0.0'],
    gitListFailed: true
  });
  assert.throws(
    () => pruneOlderReleases({ keep: 'v1.1.0' }, { ghRunner: runners.gh, gitRunner: runners.git }),
    /git ls-remote 失败/
  );
  assert.ok(!runners.sequence.some((call) => call.cli === 'gh' && call.args[1] === 'delete'), '列表失败前不得删除 Release');
});

test('pruneOlderReleases：缺少 --keep 抛错', () => {
  const runners = makeRunners({});
  assert.throws(() => pruneOlderReleases({}, { ghRunner: runners.gh, gitRunner: runners.git }), /--keep/);
});

test('release-prune CLI：缺少 --keep 时打印用法并以退出码 1 结束（不触碰 gh/git）', () => {
  const result = spawnSync(process.execPath, ['scripts/release-prune.js'], { cwd: ROOT, encoding: 'utf-8' });
  assert.strictEqual(result.status, 1);
  assert.ok(result.stdout.includes('用法：'), '应打印用法');
});
