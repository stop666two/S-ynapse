'use strict';

// 源码清单（测试用）：有 git 时用 `git ls-files`（只含跟踪文件），
// 无 .git 时（发布归档解压后跑 npm test）回退为工作树遍历 + 固定跳过目录。
//
// 为什么需要它：多个「删除键/模块无残留引用」用例此前直接遍历工作树，
// 于是本地任何未跟踪但被 gitignore 的副本（如 backups/ 下的旧仓库快照）
// 都会被当成源文件命中，造成「CI 绿、本地恒红」的假失败。改用跟踪文件清单后
// 两端一致，且不会因为归档里存在解压残留而漂移。
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SKIP_DIRS = Object.freeze(['node_modules', '.git', 'dist', 'real-site', '.tmp-scripts', 'backups', '.cache', 'build-artifacts']);

function gitTrackedFiles(root) {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  const out = String(result.stdout || '').split('\0').filter(Boolean);
  if (out.length === 0) return null;
  return out.map(function (rel) { return path.join(root, rel.split('/').join(path.sep)); });
}

function walkFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return out;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      walkFiles(abs, out);
    } else {
      out.push(abs);
    }
  }
  return out;
}

// 返回绝对路径数组；pattern 用于过滤（如 /\.(js|ejs)$/）。
function listSourceFiles(root, pattern) {
  const tracked = gitTrackedFiles(root);
  const files = tracked || walkFiles(root, []);
  return pattern ? files.filter(function (file) { return pattern.test(file); }) : files;
}

module.exports = { listSourceFiles, SKIP_DIRS };
