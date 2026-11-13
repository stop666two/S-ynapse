'use strict';

// 构建输出目录共享解析：`--out <dir>` > SYNAPSE_OUT_DIR > internals.paths.outDir > 默认 dist。
// 相对值按 rootDir 解析；供构建上下文与审计/验证/OG 生成脚本复用同一语义。
//
// 两条不变量（审查 R-01 / R-14）：
//   1. `custom` 表示「输出目录不是默认 dist」，而不是「是否显式指定过」。
//      构建只对默认 dist 写 workers/security-config.js（其 assets 目录固定为 ../dist），
//      因此 CI 导出的 SYNAPSE_OUT_DIR=<root>/dist 必须仍算非自定义。
//   2. 输出目录不得等于站点根、不得是站点根的祖先、不得与任何构建输入目录重叠——
//      setupDist 在 cleanDist 为真时会对该目录执行 rmSync(recursive)，重叠即删除源目录。

const path = require('path');
const { loadInternals } = require('./internals');

// 路径比较用的归一化：Windows 文件系统大小写不敏感，比较前统一小写，避免
// `--out .\ARTICLES` 与 `articles/` 被当成两个不相干路径。
function normalizeForCompare(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

// child 是否落在 parent 内（含相等）。
function isInside(parent, child) {
  const rel = path.relative(normalizeForCompare(parent), normalizeForCompare(child));
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}

function isSamePath(a, b) {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

// 解析输出目录。
// @param {string[]} argv 命令行参数（查找 --out）
// @param {string} rootDir 仓库（或隔离站点）根目录
// @param {{outDir?: string|null, env?: NodeJS.ProcessEnv}} [options] 可注入 internals 值与环境（测试用）
// @returns {{dir: string, custom: boolean}} dir 为绝对路径；custom=false 表示输出目录就是默认 dist
function resolveOutputDir(argv, rootDir, options) {
  const args = Array.isArray(argv) ? argv : [];
  const opts = options || {};
  const env = opts.env || process.env;
  const idx = args.indexOf('--out');
  let value = (idx !== -1 && args[idx + 1] && args[idx + 1].charAt(0) !== '-') ? args[idx + 1] : '';
  if (!value && env.SYNAPSE_OUT_DIR) value = env.SYNAPSE_OUT_DIR;
  if (!value) {
    const outDir = opts.outDir !== undefined ? opts.outDir : loadInternals().paths.outDir;
    if (outDir) value = outDir;
  }
  if (!value) return { dir: path.join(rootDir, 'dist'), custom: false };
  const dir = path.isAbsolute(value) ? path.resolve(value) : path.resolve(rootDir, value);
  return { dir, custom: !isSamePath(dir, path.join(rootDir, 'dist')) };
}

// 纯函数：检测输出目录是否与站点根/构建输入目录冲突。
// 返回 null 表示安全；否则返回 { kind, path }，kind 为 'root'（等于根或根的祖先）或 'reserved'（与输入目录重叠）。
// reservedPaths 由调用方按自身目录布局传入（构建上下文传入它实际读取的源目录），避免这里的清单与实现漂移。
function findOutputDirConflict(dir, rootDir, reservedPaths) {
  const target = path.resolve(dir);
  const root = path.resolve(rootDir);
  if (isInside(target, root)) return { kind: 'root', path: root };
  const reserved = Array.isArray(reservedPaths) ? reservedPaths : [];
  for (const entry of reserved) {
    if (!entry) continue;
    const candidate = path.resolve(entry);
    if (isInside(candidate, target) || isInside(target, candidate)) {
      return { kind: 'reserved', path: candidate };
    }
  }
  return null;
}

module.exports = { resolveOutputDir, findOutputDirConflict };
