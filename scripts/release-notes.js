#!/usr/bin/env node
'use strict';
// Release 描述生成器（npm run release:notes -- --tag vX.Y.Z [--archive <zip>] [--out <md>]）：
//   1. 校验本地存在目标 tag，读取 tag 内（或工作区）RELEASE.json；
//   2. 从 CHANGELOG.md 提取 [X.Y.Z] 版本段，从 git 收集远端 owner/repo、上一 tag、首个提交锚点；
//   3. --archive 给定时计算归档字节数与 SHA-256；
//   4. 渲染确定性 Markdown（不含生成时间，同输入同字节，LF 行尾）：
//      本版变更 / 质量与校验（门禁清单 + RELEASE.json + 归档 + Node + 构建可用性）/
//      安装与使用 / 完整变更（compare 链接）/ 附件。
//
// 用途：CI publish 作业生成 Release 正文；release-notes.yml 手动补更历史 Release；
// 本地 `npm run release:notes -- --tag vX.Y.Z --archive <zip> --out <md>` 预览。
// 输出缺省打印到 stdout；写入文件时经原子写入（同目录临时文件 + rename）。

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { writeFileAtomicSync } = require('./lib/atomic-write');
const { normalizeTagVersion } = require('./lib/release-version');
const {
  normalizeLineEndings,
  extractChangelogSection,
  pickPreviousTag,
  parseOwnerRepo,
  sha256Hex,
  renderReleaseNotes,
  buildArchiveName
} = require('./lib/release-notes');

const ROOT = path.resolve(__dirname, '..');

function git(args) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf-8' });
}

function parseArgs(argv) {
  const options = { tag: '', archive: '', out: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tag') {
      options.tag = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--tag=')) {
      options.tag = arg.slice('--tag='.length);
    } else if (arg === '--archive') {
      options.archive = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--archive=')) {
      options.archive = arg.slice('--archive='.length);
    } else if (arg === '--out') {
      options.out = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else {
      throw new Error('未知参数：' + arg + '（用法：--tag <vX.Y.Z> [--archive <zip>] [--out <md>]）');
    }
  }
  if (!options.tag) throw new Error('--tag 不能为空（用法：--tag <vX.Y.Z> [--archive <zip>] [--out <md>]）');
  return options;
}

// tag 必须存在于本地：描述中的 CHANGELOG 段与 RELEASE.json 都应与 tag 内容对应；
// 本地缺 tag 时提示先 git fetch --tags，避免生成与 tag 不一致的描述。
function assertTagExists(tag) {
  const result = git(['rev-parse', '--verify', tag + '^{commit}']);
  if (result.error || result.status !== 0) {
    throw new Error('本地不存在 tag ' + tag + '：请先执行 git fetch --tags（或确认 tag 名称）');
  }
}

// 读取上下文所需的文本文件；缺失返回空串（由调用方决定是否致命）。
function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return '';
    throw err;
  }
}

// RELEASE.json 优先取 tag 内版本（补更历史 Release 时工作区可能已是新版本）；
// tag 内缺失时回退工作区文件，均不可得返回 null（渲染层标注）。
function loadReleaseState(tag) {
  const fromTag = git(['show', tag + ':RELEASE.json']);
  if (!fromTag.error && fromTag.status === 0) {
    try {
      return JSON.parse(fromTag.stdout);
    } catch (err) {
      throw new Error(tag + ':RELEASE.json 不是合法 JSON：' + err.message, { cause: err });
    }
  }
  const local = readTextIfExists(path.join(ROOT, 'RELEASE.json'));
  if (local === '') return null;
  try {
    return JSON.parse(local);
  } catch (err) {
    throw new Error('工作区 RELEASE.json 不是合法 JSON：' + err.message, { cause: err });
  }
}

// 远端 owner/repo：从 origin 解析；缺失或无法解析时抛错（compare 链接是描述的必需段落）。
function loadOwnerRepo() {
  const remote = git(['remote', 'get-url', 'origin']);
  if (remote.error || remote.status !== 0) {
    throw new Error('无法读取 git remote origin（compare 链接需要 owner/repo）：' + ((remote.stderr || '').trim() || 'git get-url 失败'));
  }
  const parsed = parseOwnerRepo(remote.stdout.trim());
  if (!parsed) {
    throw new Error('无法从 origin 解析 owner/repo：' + remote.stdout.trim());
  }
  return parsed;
}

// 上一 tag：creatordate 降序列表中选择目标之后的第一个 v*；列表不可得时返回 null。
function loadPreviousTag(tag) {
  const result = git(['tag', '--sort=-creatordate']);
  if (result.error || result.status !== 0) return null;
  const tags = result.stdout.split('\n').map(function (line) { return line.trim(); }).filter(Boolean);
  return pickPreviousTag(tags, tag);
}

// 首个提交锚点：目标 tag 的根提交；解析失败回退 HEAD 的根提交，再失败返回空串。
function loadFirstCommit(tag) {
  for (const ref of [tag, 'HEAD']) {
    const result = git(['rev-list', '--max-parents=0', ref]);
    if (!result.error && result.status === 0 && result.stdout.trim() !== '') {
      const lines = result.stdout.trim().split('\n');
      return lines[lines.length - 1].trim();
    }
  }
  return '';
}

// 归档信息：读取归档文件计算字节数与 SHA-256；未给 --archive 返回 null。
function loadArchive(archivePath, version) {
  if (!archivePath) return null;
  const resolved = path.resolve(archivePath);
  const buffer = fs.readFileSync(resolved);
  return {
    name: path.basename(resolved) || buildArchiveName(version),
    bytes: buffer.length,
    sha256: sha256Hex(buffer)
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const version = normalizeTagVersion(options.tag);
  assertTagExists(options.tag);

  const changelogText = readTextIfExists(path.join(ROOT, 'CHANGELOG.md'));
  if (changelogText === '') {
    throw new Error('仓库根缺少 CHANGELOG.md：无法提取版本变更段');
  }
  const section = extractChangelogSection(changelogText, version);
  if (!section.found) {
    throw new Error(
      'CHANGELOG.md 中未找到 [' + version + '] 版本段：请先运行 npm run release:mark 生成版本段，或确认目标 tag 的版本号正确'
    );
  }

  const { owner, repo } = loadOwnerRepo();
  const text = renderReleaseNotes({
    tag: options.tag,
    version: version,
    changelogText: changelogText,
    releaseState: loadReleaseState(options.tag),
    archive: loadArchive(options.archive, version),
    nodeVersion: readTextIfExists(path.join(ROOT, '.nvmrc')),
    owner: owner,
    repo: repo,
    previousTag: loadPreviousTag(options.tag),
    firstCommit: loadFirstCommit(options.tag)
  });

  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileAtomicSync(outPath, normalizeLineEndings(text), 'utf-8');
    console.log('[release-notes] 已生成 ' + outPath + '（' + Buffer.byteLength(text, 'utf-8') + ' 字节）');
  } else {
    process.stdout.write(normalizeLineEndings(text));
  }
}

try {
  main();
} catch (err) {
  console.error('[release-notes] 失败：' + (err && err.message ? err.message : err));
  process.exitCode = 1;
}
