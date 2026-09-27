#!/usr/bin/env node
'use strict';
// 本地/CI 归档脚本（npm run release:archive）：
//   1. 读取 ref（tag 或 HEAD）指向的 RELEASE.json 获取版本号，并校验版本三方一致
//      （RELEASE.json = package.json = tag 名），预发布版本（X.Y.Z-<预发布>）同样支持；
//   2. 用 `git archive` + 白名单 pathspec 生成 S-ynapse-<version>.zip（含统一前缀目录）；
//   3. 解析 zip 中央目录逐条复核白名单（assertArchiveContents）并断言必需文件/目录存在。
//
// 用法：node scripts/release-archive.js --ref <tag|HEAD> [--out <zip 路径|输出目录>]
// 默认输出：release-artifacts/S-ynapse-<version>.zip（目录已加入 .gitignore）；
// --out 指向目录（已存在目录 / 以分隔符结尾）时在该目录内使用默认文件名。

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const manifest = require('./lib/release-manifest');
const { isSemver } = require('./lib/release-version');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT, 'release-artifacts');

function git(args, options) {
  return spawnSync('git', args, Object.assign({ cwd: ROOT, encoding: 'utf-8' }, options || {}));
}

function parseArgs(argv) {
  const options = { ref: 'HEAD', out: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--ref') {
      options.ref = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--ref=')) {
      options.ref = arg.slice('--ref='.length);
    } else if (arg === '--out') {
      options.out = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else {
      throw new Error('未知参数：' + arg + '（用法：--ref <tag|HEAD> [--out <zip 路径>]）');
    }
  }
  if (!options.ref) throw new Error('--ref 不能为空');
  return options;
}

// 读取 ref 指向的 JSON 文件并解析；缺失或非法即抛错。
function readJsonAtRef(ref, file) {
  const result = git(['show', ref + ':' + file]);
  if (result.error || result.status !== 0) {
    throw new Error('无法读取 ' + ref + ':' + file + '：' + ((result.stderr || '').trim() || '文件不存在'));
  }
  try {
    return JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(ref + ':' + file + ' 不是合法 JSON：' + err.message, { cause: err });
  }
}

// 版本一致性断言（CI「版本校验」）：
//   - RELEASE.json.version 必须等于 package.json.version（release:mark 保证两者同步）；
//   - ref 为 tag（v 开头）时，tag 名必须是 'v' + version，防止旧 tag 打包出错误命名的归档。
function assertVersionConsistency(ref, releaseVersion, packageVersion) {
  if (packageVersion !== releaseVersion) {
    throw new Error('版本不一致：RELEASE.json=' + releaseVersion + '，package.json=' + packageVersion +
      '（请先用 release:mark 同步版本后再归档）');
  }
  if (/^v/.test(ref) && ref !== 'v' + releaseVersion) {
    throw new Error('tag 与版本不一致：ref=' + ref + '，RELEASE.json.version=' + releaseVersion);
  }
  return true;
}

// 读取 ref 的版本号并校验与 package.json / tag 一致；缺失或非法即抛错（发布包必须携带状态标记）。
function resolveVersion(ref) {
  const state = readJsonAtRef(ref, 'RELEASE.json');
  if (!isSemver(state.version)) {
    throw new Error(ref + ':RELEASE.json 的 version 不是合法 SemVer（X.Y.Z 或 X.Y.Z-预发布）：' + JSON.stringify(state.version));
  }
  const pkg = readJsonAtRef(ref, 'package.json');
  assertVersionConsistency(ref, state.version, pkg.version);
  return state.version;
}

// 解析 zip 中央目录，返回条目名列表（含目录条目与统一前缀）。
// 只依赖 Node 内置能力：定位 EOCD（含 zip 注释场景，校验注释长度与文件尾对齐）后逐条读取。
function readZipEntries(filePath) {
  const buf = fs.readFileSync(filePath);
  const eocdSignature = 0x06054b50;
  const minOffset = Math.max(0, buf.length - 22 - 65535);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) !== eocdSignature) continue;
    const commentLength = buf.readUInt16LE(i + 20);
    if (i + 22 + commentLength === buf.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('不是有效的 ZIP 文件（未找到 EOCD）');
  const count = buf.readUInt16LE(eocd + 10);
  const centralOffset = buf.readUInt32LE(eocd + 16);
  if (centralOffset === 0xffffffff || count === 0xffff) {
    throw new Error('不支持 ZIP64 归档（条目数或体积超出 32 位范围）');
  }
  const names = [];
  let offset = centralOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('ZIP 中央目录损坏（条目 ' + (i + 1) + ' 签名不匹配）');
    }
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    names.push(buf.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

// 解析输出路径：--out 缺省或指向目录（已存在目录 / 以分隔符结尾）时，
// 在目标目录内使用默认文件名 S-ynapse-<version>.zip；否则视为完整文件路径。
function resolveOutPath(out, version) {
  const defaultName = 'S-ynapse-' + version + '.zip';
  if (!out) return path.join(DEFAULT_OUT_DIR, defaultName);
  const hasTrailingSeparator = /[\\/]$/.test(out);
  if (hasTrailingSeparator) return path.join(out, defaultName);
  if (fs.existsSync(out) && fs.statSync(out).isDirectory()) return path.join(out, defaultName);
  return out;
}

// 执行归档并完成全部校验；返回 { file, version, files, bytes, skeleton, tests }。
function archiveRelease(options) {
  const opts = options || {};
  const ref = opts.ref || 'HEAD';
  const version = resolveVersion(ref);
  const prefix = 'S-ynapse-' + version + '/';
  const out = resolveOutPath(opts.out, version);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.rmSync(out, { force: true });

  const args = ['archive', '--format=zip', '--prefix=' + prefix, '-o', out, ref, '--'].concat(manifest.listReleaseIncludePaths());
  const result = git(args);
  if (result.error) throw new Error('无法执行 git archive：' + result.error.message);
  if (result.status !== 0) {
    throw new Error('git archive 失败：' + ((result.stderr || '').trim() || 'exit ' + result.status));
  }

  const entries = readZipEntries(out);
  manifest.assertArchiveContents(entries, { prefix });
  const files = entries
    .filter(function (entry) { return !entry.endsWith('/'); })
    .map(function (entry) { return entry.startsWith(prefix) ? entry.slice(prefix.length) : entry; });

  const present = new Set(files);
  const missingFiles = manifest.RELEASE_REQUIRED_FILES.filter(function (file) { return !present.has(file); });
  if (missingFiles.length > 0) {
    throw new Error('归档缺少必需文件：' + missingFiles.join(', '));
  }
  const missingDirs = manifest.RELEASE_REQUIRED_DIRS.filter(function (dir) {
    return !files.some(function (file) { return file.startsWith(dir + '/'); });
  });
  if (missingDirs.length > 0) {
    throw new Error('归档缺少必需目录内容：' + missingDirs.join(', '));
  }

  // 骨架统计：articles/media 只应出现 .gitkeep 标记（实体内容已被 pathspec 过滤，
  // assertArchiveContents 的白名单判定是兜底），tests 计数用于确认测试随包分发。
  const skeleton = {};
  for (const dir of manifest.RELEASE_SKELETON_DIRS) {
    skeleton[dir] = files.filter(function (file) {
      return file.startsWith(dir + '/') && file.endsWith('/' + manifest.RELEASE_SKELETON_MARKER);
    }).length;
  }
  const tests = files.filter(function (file) { return file.endsWith('.test.js'); }).length;

  return { file: out, version, files: files.length, bytes: fs.statSync(out).size, skeleton, tests };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = archiveRelease(options);
  const kb = (result.bytes / 1024).toFixed(1);
  console.log('[release:archive] ' + options.ref + ' → ' + result.file);
  console.log('[release:archive] 版本 ' + result.version + '，共 ' + result.files + ' 个文件，' + kb + ' KB');
  const skeletonParts = Object.keys(result.skeleton).map(function (dir) {
    return dir + '/ ' + result.skeleton[dir] + ' 个 .gitkeep';
  });
  console.log('[release:archive] 骨架目录：' + skeletonParts.join('、') + '（不含示例文章/媒体）');
  console.log('[release:archive] 测试随包：' + result.tests + ' 个 *.test.js 文件（解压后 npm test 可运行）');
  console.log('[release:archive] 白名单校验通过：0 个越界条目，必需文件齐全');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[release:archive] 失败：' + (err && err.message ? err.message : err));
    process.exitCode = 1;
  }
}

module.exports = { archiveRelease, readZipEntries, readJsonAtRef, assertVersionConsistency, resolveVersion, resolveOutPath, parseArgs };
