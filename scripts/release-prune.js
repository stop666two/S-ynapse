#!/usr/bin/env node
'use strict';
// Release 旧版清理（npm run release:prune；CI publish 与本地 release:publish 调用）：
// 发布策略「只保留最新版本」的执行器——除 --keep 指定的 tag 外，删除其余 GitHub Release
// 及其远端 tag（gh release delete <tag> --yes --cleanup-tag）。
//
// 用法：
//   node scripts/release-prune.js --keep v1.1.0 [--dry-run]
//   npm run release:prune -- --keep v1.1.0
//
// 退出码：0 = 全部清理成功（或 dry-run）；1 = 参数错误 / gh 调用失败 / 存在删除失败。
// 依赖：gh CLI 已安装并完成认证（CI 注入 GH_TOKEN，本地用 gh auth login）。

const { spawnSync } = require('node:child_process');

// gh release list 的返回上限：当前策略只保留 1 个，200 足以覆盖可预见的历史版本数。
const RELEASE_LIST_LIMIT = 200;

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
  console.log('  删除除 --keep 外的全部 GitHub Release 及其远端 tag（--cleanup-tag 一并删除 tag）');
}

// 纯函数：从 Release tag 列表中选出待删除项（保留 keep 自身）。
function selectObsoleteTags(tags, keep) {
  if (!Array.isArray(tags)) throw new TypeError('tags 必须是字符串数组');
  return tags.filter(function (tag) { return tag !== keep; });
}

// 默认执行器：调用 gh CLI（stdout/stderr 捕获，供列表解析与失败信息透出）。
function defaultRunner(args) {
  return spawnSync('gh', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
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

// 删除旧 Release：返回 { deleted, failed, skipped }；failed 为 { tag, message } 列表。
// dryRun 仅打印计划；runner 可注入（测试用假执行器避免触碰真实 gh）。
function pruneOlderReleases(options, runner) {
  const opts = options || {};
  const keep = opts.keep || '';
  const execute = runner || defaultRunner;
  if (!keep) throw new Error('缺少 --keep <tag>：必须指定要保留的 Release');
  const tags = listReleaseTags(execute);
  const obsolete = selectObsoleteTags(tags, keep);
  const result = { deleted: [], failed: [], skipped: tags.length === 0 };
  for (const tag of obsolete) {
    if (opts.dryRun) {
      console.log('[release:prune] dry-run：将删除 ' + tag + '（含远端 tag）');
      result.deleted.push(tag);
      continue;
    }
    const deletion = execute(['release', 'delete', tag, '--yes', '--cleanup-tag']);
    if (deletion.error) {
      result.failed.push({ tag: tag, message: deletion.error.message });
      continue;
    }
    if (deletion.status !== 0) {
      result.failed.push({ tag: tag, message: String(deletion.stderr || '').trim() || 'exit ' + deletion.status });
      continue;
    }
    result.deleted.push(tag);
    console.log('[release:prune] 已删除旧 Release ' + tag + '（含远端 tag）');
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
    console.error('[release:prune] ' + result.failed.length + ' 个旧 Release 删除失败：');
    for (const failure of result.failed) console.error('  - ' + failure.tag + '：' + failure.message);
    process.exitCode = 1;
    return;
  }
  console.log('[release:prune] 完成：保留 ' + options.keep + '，删除 ' + result.deleted.length + ' 个旧 Release');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[release:prune] 失败：' + (err && err.message ? err.message : err));
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, selectObsoleteTags, listReleaseTags, pruneOlderReleases };
