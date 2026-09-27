#!/usr/bin/env node
'use strict';
// 发布标记脚本（npm run release:mark）：
//   1. 校验工作区干净；
//   2. 顺序执行全套质量门禁（任一失败即停止，不修改任何文件）；
//   3. 校验人工核验参数（--human-verified / --confirm）；
//   4. 同步版本：递增路径用 npm version；显式版本 === 当前版本（同版本标记）时跳过 npm version，
//      仅当 package-lock 根版本漂移时同步；
//   5. 改写 CHANGELOG（[Unreleased] 重命名/合并进 [X.Y.Z] 段，或仅确保版本段与链接）；
//   6. 生成 RELEASE.json（status=verified + 门禁全 true + 记录被核验提交 = tag 父提交）；
//   7. 提交 chore(release): vX.Y.Z 并创建附注 tag vX.Y.Z；
//   8. 默认只留在本地并打印后续命令，--push（需 --confirm-push 二次确认）才推送。
//
// 同版本标记用于「当前 package.json 版本尚未发布过、为它建立首个 Release」的场景；
// 已发布版本不可重复使用（tag 已存在时脚本在门禁前拒绝）。
//
// --dry-run：跳过重型门禁，仅演练版本/文件/CHANGELOG 变换并输出计划，不写入任何文件。
//
// 用法：
//   npm run release:mark -- <major|minor|patch|X.Y.Z> --human-verified "<姓名>" --confirm <版本号>
//   npm run release:mark -- patch --human-verified "张三" --confirm 1.1.1 --dry-run
//   npm run release:mark -- 1.1.0 --human-verified "张三" --confirm 1.1.0   # 同版本标记

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { writeFileAtomicSync } = require('./lib/atomic-write');
const {
  RELEASE_GATES,
  CHANGELOG_LINK_BASE,
  resolveReleaseTarget,
  planChangelogRewrite,
  rewriteChangelog,
  buildReleaseState,
  buildPassedChecks,
  formatUtcDate
} = require('./lib/release-version');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const PACKAGE_LOCK = path.join(ROOT, 'package-lock.json');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');
const RELEASE_JSON = path.join(ROOT, 'RELEASE.json');

function git(args, options) {
  return spawnSync('git', args, Object.assign({ cwd: ROOT, encoding: 'utf-8' }, options || {}));
}

function gitOrThrow(args) {
  const result = git(args);
  if (result.error) throw new Error('无法执行 git：' + result.error.message);
  if (result.status !== 0) {
    throw new Error('git ' + args.join(' ') + ' 失败：' + ((result.stderr || '').trim() || 'exit ' + result.status));
  }
  return result.stdout.trim();
}

// 用 shell 执行 npm 命令：Windows 下 npm 是 .cmd，shell 模式跨平台一致。
// 命令字符串中的版本号在调用前已通过 semver 正则校验，避免命令注入。
function runShell(command) {
  return spawnSync(command, { cwd: ROOT, stdio: 'inherit', shell: true });
}

function parseArgs(argv) {
  const options = {
    bump: '',
    humanVerifiedBy: '',
    confirm: '',
    dryRun: false,
    push: false,
    confirmPush: false,
    help: false
  };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--human-verified' || arg === '--confirm') {
      const value = argv[i + 1] || '';
      i += 1;
      if (arg === '--human-verified') options.humanVerifiedBy = value;
      else options.confirm = value;
    } else if (arg.startsWith('--human-verified=')) {
      options.humanVerifiedBy = arg.slice('--human-verified='.length);
    } else if (arg.startsWith('--confirm=')) {
      options.confirm = arg.slice('--confirm='.length);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--push') {
      options.push = true;
    } else if (arg === '--confirm-push') {
      options.confirmPush = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('-')) {
      throw new Error('未知参数：' + arg);
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length > 0) options.bump = positionals[0];
  return options;
}

function printUsage() {
  console.log('用法：npm run release:mark -- <major|minor|patch|X.Y.Z> --human-verified "<姓名>" --confirm <版本号> [--dry-run] [--push --confirm-push]');
  console.log('');
  console.log('说明：');
  console.log('  --human-verified  人工核验人姓名（必填，记录进 RELEASE.json）');
  console.log('  --confirm         目标版本号（必填，与计算出的目标版本一致才继续）');
  console.log('  --dry-run         只演练并打印计划，不执行门禁、不写文件');
  console.log('  --push            推送分支与 tag（必须同时给 --confirm-push 二次确认）');
  console.log('  同版本标记        显式 X.Y.Z 且等于当前 package.json 版本时，跳过 npm version，');
  console.log('                    为当前版本建首个 Release（CHANGELOG [Unreleased] 合并进已有 [X.Y.Z] 段）');
}

// 人工核验与确认参数的共享校验：提前执行一次避免跑完门禁才因命令行缺失失败。
function collectArgErrors(options, targetVersion) {
  const errors = [];
  if (!options.humanVerifiedBy.trim()) {
    errors.push('缺少 --human-verified "<姓名>"：发布必须由人工完成最终核验并署名');
  }
  if (options.confirm !== targetVersion) {
    errors.push('--confirm 与目标版本不一致：需要 --confirm ' + targetVersion + '（当前：' + (options.confirm || '未提供') + '）');
  }
  if (options.push && !options.confirmPush) {
    errors.push('--push 需要追加 --confirm-push 再次确认（推送分支与 tag 是外发操作）');
  }
  return errors;
}

function printArgErrors(errors) {
  console.error('[release:mark] 参数校验失败：');
  for (const error of errors) console.error('  - ' + error);
}

function assertCleanWorktree() {
  const status = gitOrThrow(['status', '--porcelain']);
  if (status !== '') {
    console.error('[release:mark] 工作区不干净，拒绝发布。未提交的变更：');
    for (const line of status.split('\n')) console.error('  ' + line);
    throw new Error('请先提交或清理工作区后重试');
  }
}

function assertTagFree(tag) {
  const existing = git(['rev-parse', '-q', '--verify', 'refs/tags/' + tag]);
  if (existing.status === 0) {
    throw new Error('tag ' + tag + ' 已存在，拒绝重复发布');
  }
}

// 同版本标记路径的版本同步：package.json 已等于目标版本（调用前由 resolveReleaseTarget 保证），
// 仅当 package-lock 根版本（顶层 version 与 packages[""].version）漂移时写回目标版本。
function syncLockRootVersion(targetVersion) {
  const lock = JSON.parse(fs.readFileSync(PACKAGE_LOCK, 'utf-8'));
  let changed = false;
  if (lock.version !== targetVersion) {
    lock.version = targetVersion;
    changed = true;
  }
  if (lock.packages && lock.packages[''] && lock.packages[''].version !== targetVersion) {
    lock.packages[''].version = targetVersion;
    changed = true;
  }
  if (changed) writeFileAtomicSync(PACKAGE_LOCK, JSON.stringify(lock, null, 2) + '\n');
  return changed;
}

function runGates() {
  const checks = buildPassedChecks();
  for (let i = 0; i < RELEASE_GATES.length; i++) {
    const gate = RELEASE_GATES[i];
    console.log('\n[release:mark] [' + (i + 1) + '/' + RELEASE_GATES.length + '] ' + gate.command + ' — ' + gate.label);
    const result = runShell(gate.command);
    if (result.error) {
      throw new Error('无法启动门禁命令 ' + gate.command + '：' + result.error.message);
    }
    if (result.status !== 0) {
      throw new Error('门禁失败（exit ' + result.status + '）：' + gate.command + '；已停止，未修改任何文件');
    }
  }
  return checks;
}

const CHANGELOG_MODE_LABELS = {
  merge: '合并 [Unreleased] 进已有版本段',
  rename: '重命名 [Unreleased] 为目标版本段',
  create: '新建目标版本段',
  ensure: '仅确保目标版本段与链接'
};

function printDryRun(options, currentVersion, targetVersion, sameVersion, changelogText) {
  const today = formatUtcDate(new Date());
  const plan = planChangelogRewrite(changelogText, targetVersion, today);
  console.log('[release:mark] dry-run：仅演练，不执行门禁、不写入任何文件');
  console.log('  当前版本：' + currentVersion);
  if (sameVersion) {
    console.log('  目标版本：' + targetVersion + '（同版本标记：显式版本 === 当前版本，--confirm 一致）');
    console.log('  版本同步：跳过 npm version（package.json 已是 ' + targetVersion + '；package-lock 根版本不一致时同步）');
  } else {
    console.log('  目标版本：' + targetVersion + '（bump=' + options.bump + '，--confirm 一致）');
    console.log('  package.json / package-lock.json → ' + targetVersion + '（npm version --no-git-tag-version）');
  }
  console.log('  人工核验：' + options.humanVerifiedBy.trim());
  console.log('  门禁（dry-run 跳过，正式执行 ' + RELEASE_GATES.length + ' 项）：');
  for (const gate of RELEASE_GATES) console.log('    - ' + gate.command);
  console.log('  CHANGELOG 变换计划：' + CHANGELOG_MODE_LABELS[plan.mode] + ' → [' + targetVersion + '] - ' + today);
  if (plan.mode === 'merge') {
    for (const group of plan.mergedSubsections) {
      console.log('    合并小节：### ' + group.title + '（+ ' + group.entries + ' 条，保持既有条目）');
    }
    console.log('    删除 [Unreleased] 段；[' + targetVersion + '] 日期更新为 ' + today);
  } else if (plan.mode === 'rename') {
    console.log('    [Unreleased] → [' + targetVersion + '] - ' + today);
  } else if (plan.mode === 'create') {
    console.log('    未找到 [' + targetVersion + '] 段：在最新版本段前新建空段');
  }
  console.log('    版本链接：' + (plan.linkAdded
    ? '补 [' + targetVersion + ']: ' + CHANGELOG_LINK_BASE + 'v' + targetVersion
    : '[' + targetVersion + '] 链接已存在'));
  console.log('  RELEASE.json：status=verified、checks 全 true、commit=被核验提交（tag 的父提交）');
  console.log('  提交：chore(release): v' + targetVersion + '；附注 tag v' + targetVersion + '（默认不 push）');
  console.log('  后续（人工执行）：git push origin <branch> 且 git push origin v' + targetVersion);
  console.log('[release:mark] dry-run 完成：未写入任何文件');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.bump) {
    printUsage();
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const currentVersion = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8')).version;
  const resolved = resolveReleaseTarget(currentVersion, options.bump);
  const targetVersion = resolved.version;
  const sameVersion = resolved.sameVersion;
  const tag = 'v' + targetVersion;

  const argErrors = collectArgErrors(options, targetVersion);
  if (argErrors.length > 0) {
    printArgErrors(argErrors);
    process.exitCode = 1;
    return;
  }

  if (options.dryRun) {
    const changelogText = fs.readFileSync(CHANGELOG, 'utf-8');
    printDryRun(options, currentVersion, targetVersion, sameVersion, changelogText);
    return;
  }

  // ① 工作区干净 + tag 未被占用（在任何写入之前完成阻断式检查）。
  assertCleanWorktree();
  assertTagFree(tag);

  // ② 顺序执行全部前置门禁。
  const checks = runGates();

  // ③ 门禁通过后再次校验人工核验参数（与门禁前检查同源，双保险）。
  const finalErrors = collectArgErrors(options, targetVersion);
  if (finalErrors.length > 0) {
    printArgErrors(finalErrors);
    process.exitCode = 1;
    return;
  }

  // ④ 同步版本号（不产生 commit/tag）：递增路径走 npm version；
  //    同版本标记时 package.json 已一致、跳过 npm version，仅同步 package-lock 根版本漂移。
  if (sameVersion) {
    const synced = syncLockRootVersion(targetVersion);
    console.log('\n[release:mark] 同版本标记：跳过 npm version（package.json 已是 ' + targetVersion + '）' +
      (synced ? '；package-lock 根版本已同步' : '；package-lock 根版本一致'));
  } else {
    console.log('\n[release:mark] npm version --no-git-tag-version ' + targetVersion);
    const versionResult = runShell('npm version --no-git-tag-version ' + targetVersion);
    if (versionResult.error || versionResult.status !== 0) {
      throw new Error('npm version 失败：' + (versionResult.error ? versionResult.error.message : 'exit ' + versionResult.status));
    }
  }

  // ⑤ CHANGELOG：按现状重命名/合并 [Unreleased] 或确保 [X.Y.Z] 段与链接。
  const changelogText = fs.readFileSync(CHANGELOG, 'utf-8');
  const updatedChangelog = rewriteChangelog(changelogText, targetVersion, formatUtcDate(new Date()));
  fs.writeFileSync(CHANGELOG, updatedChangelog, 'utf-8');

  // ⑥ RELEASE.json：记录被核验提交（写入时 HEAD 即通过门禁的提交，也是 release 提交的父提交）。
  // git 提交内容无法包含自身 SHA（数学上不可自引用），因此 commit 字段记录 tag^ 而非 tag 目标，
  // CI 以 `git rev-parse vX.Y.Z^{commit}^` 与之比对，同样能防止标记与 tag 张冠李戴。
  const verifiedCommit = gitOrThrow(['rev-parse', 'HEAD']);
  const state = buildReleaseState({
    version: targetVersion,
    status: 'verified',
    humanVerifiedBy: options.humanVerifiedBy.trim(),
    verifiedAt: new Date().toISOString(),
    commit: verifiedCommit,
    checks
  });
  writeFileAtomicSync(RELEASE_JSON, JSON.stringify(state, null, 2) + '\n');

  // ⑦ 提交发布变更（单提交，不做 amend：amend 会改变提交 SHA，使标记与 tag 目标失配）。
  gitOrThrow(['add', 'package.json', 'package-lock.json', 'CHANGELOG.md', 'RELEASE.json']);
  gitOrThrow(['commit', '-m', 'chore(release): ' + tag]);

  // ⑧ 创建附注 tag（指向发布提交，其父提交即 RELEASE.json.commit 记录的核验提交）。
  gitOrThrow(['tag', '-a', tag, '-m', 'Release ' + tag]);
  const branch = gitOrThrow(['rev-parse', '--abbrev-ref', 'HEAD']);
  console.log('[release:mark] 已创建提交与附注 tag ' + tag + '（核验提交 ' + verifiedCommit.slice(0, 12) + '，分支 ' + branch + '）');

  // ⑨ 默认不 push，打印后续命令；--push + --confirm-push 才推送。
  if (options.push) {
    console.log('[release:mark] --push 已确认，推送分支与 tag …');
    const pushBranch = git(['push', 'origin', branch], { stdio: 'inherit' });
    if (pushBranch.error || pushBranch.status !== 0) {
      throw new Error('git push origin ' + branch + ' 失败');
    }
    const pushTag = git(['push', 'origin', tag], { stdio: 'inherit' });
    if (pushTag.error || pushTag.status !== 0) {
      throw new Error('git push origin ' + tag + ' 失败');
    }
    console.log('[release:mark] 推送完成：tag 触发 .github/workflows/release.yml 自动创建 GitHub Release');
  } else {
    console.log('[release:mark] 未推送（默认人工确认后再执行）：');
    console.log('  git push origin ' + branch);
    console.log('  git push origin ' + tag);
    console.log('[release:mark] 推送 tag 后由 Actions 自动建 Release；若 Actions 不可用，可先推送 tag 再执行 npm run release:publish -- ' + tag);
  }
}

try {
  main();
} catch (err) {
  console.error('[release:mark] 失败：' + (err && err.message ? err.message : err));
  process.exitCode = 1;
}
