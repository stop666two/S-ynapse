'use strict';
// release:prune（「只保留最新 Release」清理器）的单元测试：
// 参数解析；纯函数选择（Release tag）；gh 假执行器的列表/删除/失败收集、双列表先于删除。
// 核心安全断言：tag 永不删除——执行器序列中不得出现任何 git 调用、--cleanup-tag 或 tag 删除命令。
// 测试全程使用注入的假执行器，不调用真实 gh/git、不触碰任何远端资源。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  parseArgs,
  selectObsoleteTags,
  listReleaseTags,
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

function makeGh(options) {
  const opts = options || {};
  const calls = [];
  const gh = function (args) {
    calls.push(args.slice());
    if (args[0] === 'release' && args[1] === 'list') {
      if (opts.listFailed) return { status: 1, stdout: '', stderr: 'auth required' };
      return {
        status: 0,
        stdout: JSON.stringify((opts.releases || []).map(function (tag) { return { tagName: tag }; })),
        stderr: ''
      };
    }
    return opts.ghDelete ? opts.ghDelete(args) : { status: 0, stdout: '', stderr: '' };
  };
  return { gh, calls };
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

test('pruneOlderReleases：只删除旧 Release（无 --cleanup-tag），失败项照实收集', () => {
  const runners = makeGh({
    releases: ['v1.1.0', 'v1.0.1', 'v1.0.0'],
    ghDelete: (args) => (args[2] === 'v1.0.0'
      ? { status: 1, stdout: '', stderr: 'permission denied' }
      : { status: 0, stdout: '', stderr: '' })
  });
  const result = pruneOlderReleases({ keep: 'v1.1.0' }, { ghRunner: runners.gh });
  assert.deepStrictEqual(result.deleted, ['v1.0.1']);
  assert.deepStrictEqual(result.failed, [{ tag: 'v1.0.0', message: 'permission denied' }]);

  const deletes = runners.calls.filter((args) => args[0] === 'release' && args[1] === 'delete');
  assert.strictEqual(deletes.length, 2);
  for (const args of deletes) {
    assert.deepStrictEqual(args, ['release', 'delete', args[2], '--yes'],
      '删除命令必须是 gh release delete <tag> --yes，不带 --cleanup-tag');
    assert.ok(!args.includes('--cleanup-tag'), '绝不允许 --cleanup-tag（会连带删除 tag）');
  }
  assert.ok(!runners.calls.some((args) => args.includes('v1.1.0')), '不得删除 keep 自身');
});

test('pruneOlderReleases：即使远端存在旧 v* tag 也绝不执行任何 tag 删除命令', () => {
  const runners = makeGh({ releases: ['v1.1.0', 'v1.0.0'] });
  const result = pruneOlderReleases({ keep: 'v1.1.0' }, { ghRunner: runners.gh });
  assert.deepStrictEqual(result.deleted, ['v1.0.0']);
  for (const args of runners.calls) {
    assert.notStrictEqual(args[0], 'git', '不得调用 git 删除远端 tag');
    assert.ok(!args.includes(':refs/tags/v1.0.0'), '不得出现 tag 删除引用');
    assert.ok(!args.includes('ls-remote'), '不需要枚举远端 tag');
    assert.ok(!args.includes('--cleanup-tag'), '不得连带删除 tag');
  }
  assert.ok(!('tagsDeleted' in result) && !('tagsFailed' in result), '返回结构不得包含 tag 删除字段');
});

test('pruneOlderReleases：dry-run 只打印 Release 计划且零删除调用', () => {
  const runners = makeGh({ releases: ['v1.1.0', 'v1.0.0'] });
  const result = pruneOlderReleases({ keep: 'v1.1.0', dryRun: true }, { ghRunner: runners.gh });
  assert.deepStrictEqual(result.deleted, ['v1.0.0']);
  assert.strictEqual(result.failed.length, 0);
  assert.ok(!runners.calls.some((args) => args[0] === 'release' && args[1] === 'delete'), 'dry-run 不得调用删除');
  assert.ok(!runners.calls.some((args) => args[0] === 'git'), 'dry-run 不得触碰 git');
});

test('pruneOlderReleases：列表失败时在删除前中止（无半清理状态）', () => {
  const runners = makeGh({ releases: ['v1.1.0', 'v1.0.0'], listFailed: true });
  assert.throws(
    () => pruneOlderReleases({ keep: 'v1.1.0' }, { ghRunner: runners.gh }),
    /gh release list 失败/
  );
  assert.ok(!runners.calls.some((args) => args[0] === 'release' && args[1] === 'delete'), '列表失败前不得删除');
});

test('pruneOlderReleases：缺少 --keep 抛错', () => {
  const runners = makeGh({});
  assert.throws(() => pruneOlderReleases({}, { ghRunner: runners.gh }), /--keep/);
});

test('release-prune CLI：缺少 --keep 时打印用法并以退出码 1 结束（不触碰 gh/git）', () => {
  const result = spawnSync(process.execPath, ['scripts/release-prune.js'], { cwd: ROOT, encoding: 'utf-8' });
  assert.strictEqual(result.status, 1);
  assert.ok(result.stdout.includes('用法：'), '应打印用法');
});
