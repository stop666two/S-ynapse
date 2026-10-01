'use strict';

// 构建输出目录共享解析：`--out <dir>` > SYNAPSE_OUT_DIR > internals.paths.outDir > 默认 dist。
// 相对值按 rootDir 解析；供构建上下文与审计/验证/OG 生成脚本复用同一语义。

const path = require('path');
const { loadInternals } = require('./internals');

/**
 * 解析输出目录。
 * @param {string[]} argv 命令行参数（查找 --out）
 * @param {string} rootDir 仓库（或隔离站点）根目录
 * @param {{outDir?: string|null, env?: NodeJS.ProcessEnv}} [options] 可注入 internals 值与环境（测试用）
 * @returns {{dir: string, custom: boolean}} dir 为绝对路径；custom=false 表示未显式指定（默认 dist）
 */
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
  return { dir: path.isAbsolute(value) ? path.resolve(value) : path.resolve(rootDir, value), custom: true };
}

module.exports = { resolveOutputDir };
