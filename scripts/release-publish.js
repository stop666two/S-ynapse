#!/usr/bin/env node
'use strict';
// 本地发布通道（npm run release:publish -- vX.Y.Z）：在 Actions 不可用时的等效替代。
//
// 流程：
//   1. 确认远端已存在该 tag（gh release create --verify-tag 同样要求）；
//   2. 读取 tag 指向的 RELEASE.json 并执行与 CI 相同的双重校验（status/version/commit/checks）；
//   3. 生成或复用 release-artifacts/S-ynapse-<version>.zip（白名单 + 版本一致性校验通过）；
//   4. 调用 gh release create --latest 附加 zip 创建 GitHub Release（预发布版本号同样置为 Latest）；
//   5. 按「只保留最新版本」策略清理其余 Release 与远端 v* tag（release-prune）。
//
// 注意：Actions 通道在 tag 推送时已自动创建 Release；两条通道二选一，避免重复创建。
// 用法：npm run release:publish -- vX.Y.Z

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateReleaseState } = require('./lib/release-validate');
const { normalizeTagVersion, RELEASE_GATES } = require('./lib/release-version');
const { archiveRelease } = require('./release-archive');
const { pruneOlderReleases } = require('./release-prune');

const ROOT = path.resolve(__dirname, '..');

function git(args) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf-8' });
}

function loadStateAtTag(tag) {
  // RELEASE.json.commit 记录被核验提交 = tag 指向提交的父提交（git 提交无法包含自身 SHA）。
  const commitResult = git(['rev-parse', tag + '^{commit}^']);
  if (commitResult.error || commitResult.status !== 0) {
    throw new Error('无法解析 tag ' + tag + ' 的父提交（本地是否存在该 tag？）：' + ((commitResult.stderr || '').trim() || 'git rev-parse 失败'));
  }
  const stateResult = git(['show', tag + ':RELEASE.json']);
  if (stateResult.error || stateResult.status !== 0) {
    throw new Error('无法读取 ' + tag + ':RELEASE.json：' + ((stateResult.stderr || '').trim() || '文件不存在'));
  }
  let state;
  try {
    state = JSON.parse(stateResult.stdout);
  } catch (err) {
    throw new Error(tag + ':RELEASE.json 不是合法 JSON：' + err.message, { cause: err });
  }
  return { state, commit: commitResult.stdout.trim() };
}

function main() {
  const tag = process.argv[2] || '';
  if (!tag) {
    console.error('用法：npm run release:publish -- vX.Y.Z');
    process.exitCode = 1;
    return;
  }
  const version = normalizeTagVersion(tag);

  const remote = git(['ls-remote', '--tags', 'origin', 'refs/tags/' + tag]);
  if (remote.error || remote.status !== 0) {
    throw new Error('无法查询远端 tag（检查 origin 与网络）：' + ((remote.stderr || '').trim() || 'git ls-remote 失败'));
  }
  if (remote.stdout.trim() === '') {
    throw new Error('远端不存在 tag ' + tag + '：请先执行 git push origin ' + tag + '（Actions 通道会自动建 Release；本命令用于 Actions 不可用时）');
  }

  const { state, commit } = loadStateAtTag(tag);
  const result = validateReleaseState(state, {
    tag: tag,
    commit: commit,
    requiredChecks: RELEASE_GATES.map(function (gate) { return gate.key; })
  });
  if (!result.ok) {
    console.error('[release:publish] RELEASE.json 校验失败，拒绝创建 Release：');
    for (const error of result.errors) console.error('  - ' + error);
    process.exitCode = 1;
    return;
  }

  let zip = path.join(ROOT, 'release-artifacts', 'S-ynapse-' + version + '.zip');
  if (!fs.existsSync(zip)) {
    zip = archiveRelease({ ref: tag }).file;
  }

  const notes = [
    '经人工核验与全套质量门禁验证的版本。',
    '人工核验：' + state.humanVerifiedBy,
    '核验时间：' + state.verifiedAt,
    '被核验提交：' + state.commit
  ].join('\n');
  const ghArgs = [
    'release', 'create', tag, zip,
    '--verify-tag',
    '--latest',
    '--title', 'S-ynapse ' + tag,
    '--notes', notes
  ];
  const gh = spawnSync('gh', ghArgs, { cwd: ROOT, stdio: 'inherit' });
  if (gh.error) {
    throw new Error('无法执行 gh（请安装并 gh auth login）：' + gh.error.message);
  }
  if (gh.status !== 0) {
    throw new Error('gh release create 失败（exit ' + gh.status + '）：请确认 gh 已登录、tag 已推送、同名 Release 尚未存在');
  }
  console.log('[release:publish] 已创建 Release ' + tag + '，附件 ' + zip);

  // 发布策略：只保留最新版本——先清理其余 Release，再清理远端其余 v* tag。
  const pruned = pruneOlderReleases({ keep: tag });
  const pruneFailures = pruned.failed.concat(pruned.tagsFailed);
  if (pruneFailures.length > 0) {
    console.error('[release:publish] Release 已创建，但 ' + pruneFailures.length + ' 项旧版清理失败（单版本策略未完全生效）：');
    for (const failure of pruneFailures) console.error('  - ' + failure.tag + '：' + failure.message);
    throw new Error('旧版清理失败，请手动执行 npm run release:prune -- --keep ' + tag);
  }
  console.log('[release:publish] 旧版清理完成：仅保留 ' + tag +
    '（删除 Release ' + pruned.deleted.length + ' 个、远端 tag ' + pruned.tagsDeleted.length + ' 个）');
}

try {
  main();
} catch (err) {
  console.error('[release:publish] 失败：' + (err && err.message ? err.message : err));
  process.exitCode = 1;
}
