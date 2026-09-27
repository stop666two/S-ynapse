#!/usr/bin/env node
'use strict';
// Release 旧版清理（npm run release:prune；CI publish 与本地 release:publish 调用）：
// 发布策略「只保留最新版本」的执行器——除 --keep 指定的 tag 外：
//   ① 先删除其余 GitHub Release（gh release delete <tag> --yes --cleanup-tag，连带其 tag）；
//   ② 再删除远端其余 v* tag（git push origin :refs/tags/<tag>），覆盖没有 Release 的残留 tag。
// 固定「先 Release 后 tag」的顺序，避免删 tag 后 Release 悬空；非 v* tag 与 --keep 一律不动。
//
// 用法：
//   node scripts/release-prune.js --keep v1.1.0 [--dry-run]
//   npm run release:prune -- --keep v1.1.0
//
// 退出码：0 = 全部清理成功（或 dry-run）；1 = 参数错误 / gh 或 git 调用失败 / 存在删除失败。
// 依赖：gh CLI 已认证（CI 注入 GH_TOKEN，本地 gh auth login）且 origin 远端可访问。

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

// gh release list 的返回上限：当前策略只保留 1 个，200 足以覆盖可预见的历史版本数。
const RELEASE_LIST_LIMIT = 200;

// 远端 tag 清理范围前缀：只处理 v* tag，其余命名空间的 tag 视为用户资产不动。
const TAG_PREFIX = 'v';

function parseArgs(argv) {
  const options = { keep: '', dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--keep') {
      options.keep = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--keep=')) {
      options.keep = arg.slice('--keep='.length);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error('未知参数：' + arg + '（用法：--keep <tag> [--dry-run]）');
    }
  }
  return options;
}

function printUsage() {
  console.log('用法：node scripts/release-prune.js --keep <tag> [--dry-run]');
  console.log('  ① 删除除 --keep 外的全部 GitHub Release（--cleanup-tag 连带删除其 tag）');
  console.log('  ② 再删除远端除 --keep 外的全部 v* tag（git push origin :refs/tags/<tag>）');
}

// 纯函数：从 Release tag 列表中选出待删除项（保留 keep 自身）。
function selectObsoleteTags(tags, keep) {
  if (!Array.isArray(tags)) throw new TypeError('tags 必须是字符串数组');
  return tags.filter(function (tag) { return tag !== keep; });
}

// 纯函数：从远端 tag 列表中选出待删除项——只处理 v* tag，保留 keep，其余命名空间不动。
function selectObsoleteRemoteTags(tags, keep) {
  if (!Array.isArray(tags)) throw new TypeError('tags 必须是字符串数组');
  return tags.filter(function (tag) {
    return tag !== keep && tag.startsWith(TAG_PREFIX);
  });
}

// 纯函数：远端 tag 删除清单 = 待删 v* tag 扣除「随 Release 删除一并清理」的 tag。
// cleanedByRelease 为已（或计划）通过 --cleanup-tag 删除的 Release tag，避免重复删除。
function planRemoteTagDeletions(remoteTags, keep, cleanedByRelease) {
  const cleaned = Array.isArray(cleanedByRelease) ? cleanedByRelease : [];
  return selectObsoleteRemoteTags(remoteTags, keep).filter(function (tag) {
    return !cleaned.includes(tag);
  });
}

// 默认执行器：调用 gh CLI（stdout/stderr 捕获，供列表解析与失败信息透出）。
function defaultGhRunner(args) {
  return spawnSync('gh', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// 默认执行器：调用 git CLI（cwd 固定为仓库根，配合 origin 远端操作）。
function defaultGitRunner(args) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// 列出全部 Release 的 tag 名；gh 不可用、失败或返回非法结构时抛错。
function listReleaseTags(runner) {
  const result = runner(['release', 'list', '--limit', String(RELEASE_LIST_LIMIT), '--json', 'tagName']);
  if (result.error) throw new Error('无法执行 gh（请安装并 gh auth login）：' + result.error.message);
  if (result.status !== 0) {
    throw new Error('gh release list 失败（exit ' + result.status + '）：' + String(result.stderr || '').trim());
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (err) {
    throw new Error('gh release list 返回不是合法 JSON：' + err.message, { cause: err });
  }
  if (!Array.isArray(parsed)) throw new Error('gh release list 返回结构异常（期望数组）');
  return parsed
    .map(function (item) { return item && item.tagName; })
    .filter(function (tag) { return typeof tag === 'string' && tag !== ''; });
}

// 列出 origin 远端全部 tag 名（--refs 去掉 peeled 行）；git 缺失或失败时抛错。
function listRemoteTags(runner) {
  const result = runner(['ls-remote', '--tags', '--refs', 'origin']);
  if (result.error) throw new Error('无法执行 git（请确认 git 可用）：' + result.error.message);
  if (result.status !== 0) {
    throw new Error('git ls-remote 失败（exit ' + result.status + '）：' + String(result.stderr || '').trim());
  }
  const tags = [];
  for (const line of String(result.stdout || '').split('\n')) {
    const ref = line.split('\t')[1] || '';
    if (ref.startsWith('refs/tags/')) tags.push(ref.slice('refs/tags/'.length));
  }
  return tags;
}

// 删除旧 Release 与远端旧 tag：返回 { deleted, failed, tagsDeleted, tagsFailed, skipped }；
// failed / tagsFailed 为 { tag, message } 列表。dryRun 仅打印两阶段计划；
// deps 可注入 { ghRunner, gitRunner }（测试用假执行器避免触碰真实 gh/git 与远端）。
function pruneOlderReleases(options, deps) {
  const opts = options || {};
  const keep = opts.keep || '';
  const ghRunner = (deps && deps.ghRunner) || defaultGhRunner;
  const gitRunner = (deps && deps.gitRunner) || defaultGitRunner;
  if (!keep) throw new Error('缺少 --keep <tag>：必须指定要保留的 Release 与 tag');

  // 先完成两份只读列表，任一失败时在删除前中止，避免留下半清理状态。
  const releaseTags = listReleaseTags(ghRunner);
  const remoteTags = listRemoteTags(gitRunner);

  const obsoleteReleases = selectObsoleteTags(releaseTags, keep);
  const result = { deleted: [], failed: [], tagsDeleted: [], tagsFailed: [], skipped: releaseTags.length === 0 };
  for (const tag of obsoleteReleases) {
    if (opts.dryRun) {
      console.log('[release:prune] dry-run：将删除 Release ' + tag + '（含其 tag）');
      result.deleted.push(tag);
      continue;
    }
    const deletion = ghRunner(['release', 'delete', tag, '--yes', '--cleanup-tag']);
    if (deletion.error) {
      result.failed.push({ tag: tag, message: deletion.error.message });
      continue;
    }
    if (deletion.status !== 0) {
      result.failed.push({ tag: tag, message: String(deletion.stderr || '').trim() || 'exit ' + deletion.status });
      continue;
    }
    result.deleted.push(tag);
    console.log('[release:prune] 已删除旧 Release ' + tag + '（含其 tag）');
  }

  // 属于旧 Release 的 tag 一律交给 --cleanup-tag 处理（删除失败者保持原状、留待下次重试，
  // 避免产生悬空 Release）；第二阶段只删除没有 Release 的残留 v* tag。
  const obsoleteTags = planRemoteTagDeletions(remoteTags, keep, obsoleteReleases);
  for (const tag of obsoleteTags) {
    if (opts.dryRun) {
      console.log('[release:prune] dry-run：将删除远端 tag ' + tag);
      result.tagsDeleted.push(tag);
      continue;
    }
    const deletion = gitRunner(['push', 'origin', ':refs/tags/' + tag]);
    if (deletion.error) {
      result.tagsFailed.push({ tag: tag, message: deletion.error.message });
      continue;
    }
    if (deletion.status !== 0) {
      result.tagsFailed.push({ tag: tag, message: String(deletion.stderr || '').trim() || 'exit ' + deletion.status });
      continue;
    }
    result.tagsDeleted.push(tag);
    console.log('[release:prune] 已删除远端 tag ' + tag);
  }
  return result;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error('[release:prune] ' + err.message);
    process.exitCode = 1;
    return;
  }
  if (options.help || !options.keep) {
    printUsage();
    process.exitCode = options.help ? 0 : 1;
    return;
  }
  const result = pruneOlderReleases({ keep: options.keep, dryRun: options.dryRun });
  const failures = result.failed.concat(result.tagsFailed);
  if (failures.length > 0) {
    console.error('[release:prune] ' + failures.length + ' 项旧版清理失败：');
    for (const failure of failures) console.error('  - ' + failure.tag + '：' + failure.message);
    process.exitCode = 1;
    return;
  }
  console.log('[release:prune] 完成：保留 ' + options.keep +
    '，删除 Release ' + result.deleted.length + ' 个、远端 tag ' + result.tagsDeleted.length + ' 个');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[release:prune] 失败：' + (err && err.message ? err.message : err));
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  selectObsoleteTags,
  selectObsoleteRemoteTags,
  planRemoteTagDeletions,
  listReleaseTags,
  listRemoteTags,
  pruneOlderReleases
};
