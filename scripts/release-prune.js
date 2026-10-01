#!/usr/bin/env node
'use strict';
// Release 旧版清理（npm run release:prune；CI publish 与本地 release:publish 调用）：
// 发布策略「只保留最新 Release」的执行器——除 --keep 指定的 tag 外，删除其余 GitHub Release。
// tag 永不删除：不使用 --cleanup-tag（gh release delete 默认保留 tag），也不执行任何远端 tag
// 删除命令；tag 是版本历史资产，本工具只清理 Release 页面与附件。
//
// 用法：
//   node scripts/release-prune.js --keep v1.1.0 [--dry-run]
//   npm run release:prune -- --keep v1.1.0
//
// 退出码：0 = 全部清理成功（或 dry-run）；1 = 参数错误 / gh 调用失败 / 存在删除失败。
// 依赖：gh CLI 已认证（CI 注入 GH_TOKEN，本地 gh auth login）。

const { spawnSync } = require('node:child_process');
const { loadInternals } = require('./lib/internals');

const INTERNALS = loadInternals();

// gh release list 的返回上限取 internals.release.listLimit（默认 200；只保留 1 个的策略下足够）。

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
  console.log('  删除除 --keep 外的全部 GitHub Release；tag 永不删除（不做 --cleanup-tag，也不删除远端 tag）');
}

// 纯函数：从 Release tag 列表中选出待删除项（保留 keep 自身）。
function selectObsoleteTags(tags, keep) {
  if (!Array.isArray(tags)) throw new TypeError('tags 必须是字符串数组');
  return tags.filter(function (tag) { return tag !== keep; });
}

// 默认执行器：调用 gh CLI（stdout/stderr 捕获，供列表解析与失败信息透出）。
function defaultGhRunner(args) {
  return spawnSync('gh', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// 列出全部 Release 的 tag 名；gh 不可用、失败或返回非法结构时抛错。
function listReleaseTags(runner) {
  const result = runner(['release', 'list', '--limit', String(INTERNALS.release.listLimit), '--json', 'tagName']);
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

// 删除旧 Release：返回 { deleted, failed, skipped }；failed 为 { tag, message } 列表。
// 删除命令固定为 gh release delete <tag> --yes（不带 --cleanup-tag），tag 始终保留。
// dryRun 仅打印计划；deps 可注入 { ghRunner }（测试用假执行器避免触碰真实 gh 与远端）。
function pruneOlderReleases(options, deps) {
  const opts = options || {};
  const keep = opts.keep || '';
  const ghRunner = (deps && deps.ghRunner) || defaultGhRunner;
  if (!keep) throw new Error('缺少 --keep <tag>：必须指定要保留的 Release');

  // dry-run 逐条打印：超过 internals.release.previewLimit 后仅打印一次省略提示。
  const previewLimit = INTERNALS.release.previewLimit;
  let dryRunPrinted = 0;
  const printDryRun = (message) => {
    if (dryRunPrinted < previewLimit) console.log(message);
    else if (dryRunPrinted === previewLimit) console.log('[release:prune] dry-run：其余计划省略（previewLimit=' + previewLimit + '，完整结果见返回结构）');
    dryRunPrinted++;
  };

  const releaseTags = listReleaseTags(ghRunner);
  const obsoleteReleases = selectObsoleteTags(releaseTags, keep);
  const result = { deleted: [], failed: [], skipped: releaseTags.length === 0 };
  for (const tag of obsoleteReleases) {
    if (opts.dryRun) {
      printDryRun('[release:prune] dry-run：将删除 Release ' + tag + '（tag 保留）');
      result.deleted.push(tag);
      continue;
    }
    const deletion = ghRunner(['release', 'delete', tag, '--yes']);
    if (deletion.error) {
      result.failed.push({ tag: tag, message: deletion.error.message });
      continue;
    }
    if (deletion.status !== 0) {
      result.failed.push({ tag: tag, message: String(deletion.stderr || '').trim() || 'exit ' + deletion.status });
      continue;
    }
    result.deleted.push(tag);
    console.log('[release:prune] 已删除旧 Release ' + tag + '（tag 保留）');
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
  if (result.failed.length > 0) {
    console.error('[release:prune] ' + result.failed.length + ' 项旧版清理失败：');
    for (const failure of result.failed) console.error('  - ' + failure.tag + '：' + failure.message);
    process.exitCode = 1;
    return;
  }
  console.log('[release:prune] 完成：保留 Release ' + options.keep +
    '，删除旧 Release ' + result.deleted.length + ' 个；tag 永不删除');
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
  listReleaseTags,
  pruneOlderReleases
};
