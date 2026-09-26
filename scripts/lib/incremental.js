'use strict';
// 增量构建核心（纯函数）：指纹算法归一化、稳定序列化、页面缓存键与增量上下文决策。
// 页面级增量复用只依赖本模块的纯函数；编排器（scripts/build.js）只负责把决策结果注入构建上下文。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 允许的指纹算法（features.incrementalBuild.fingerprintHash）；非法/缺省回退 sha1。
const HASH_ALGOS = { sha1: 'sha1', sha256: 'sha256', md5: 'md5' };

function normalizeHashAlgo(raw) {
  const v = String(raw == null ? '' : raw).toLowerCase();
  return HASH_ALGOS[v] ? v : 'sha1';
}

function hashContent(content, algo) {
  return crypto.createHash(normalizeHashAlgo(algo)).update(String(content)).digest('hex');
}

// 稳定序列化：对象键排序、跳过函数/undefined/symbol、循环引用降级为占位符，
// 并把构建期 CSP nonce 归一化为占位符（CSP 指令 'nonce-…' 与 HTML 属性 nonce="…" 两种
// 形态；每次构建进程 nonce 不同，不应导致页面指纹失效）。相同输入必然得到相同字符串。
function stableSerialize(value) {
  const seen = new Set();
  function normString(s) {
    return String(s)
      .replace(/'nonce-[^']*'/g, "'nonce-*'")
      .replace(/nonce="[^"]*"/g, 'nonce="*"')
      .replace(/nonce='[^']*'/g, "nonce='*'");
  }
  function norm(v) {
    if (v === null || typeof v === 'undefined') return v === undefined ? undefined : null;
    if (typeof v === 'function' || typeof v === 'symbol') return undefined;
    if (typeof v === 'string') return normString(v);
    if (typeof v !== 'object') return v;
    if (Buffer.isBuffer(v)) return v.toString('base64');
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) {
      return v.map(function (item) {
        const r = norm(item);
        return r === undefined ? null : r;
      });
    }
    if (seen.has(v)) return '[circular]';
    seen.add(v);
    const out = {};
    for (const key of Object.keys(v).sort()) {
      const r = norm(v[key]);
      if (r !== undefined) out[key] = r;
    }
    seen.delete(v);
    return out;
  }
  return JSON.stringify(norm(value));
}

// 页面缓存键：relPath + 输入指纹（模板摘要 + 稳定序列化后的页面数据）经所选算法散列。
function pageCacheKey(relPath, inputFingerprint, algo) {
  return hashContent(String(relPath) + '\u0000' + String(inputFingerprint), algo);
}

// 模板目录摘要：所有 .ejs 文件按名排序后内容拼接散列（任一模板变化 → 全部页面指纹变化）。
function hashTemplateDir(dir, algo) {
  let files;
  try { files = fs.readdirSync(dir).filter(function (f) { return /\.ejs$/i.test(f); }).sort(); } catch (e) { return ''; }
  const parts = [];
  for (const f of files) {
    try { parts.push(f + '\u0000' + fs.readFileSync(path.join(dir, f), 'utf-8')); } catch (e) { /* 单文件不可读时忽略 */ }
  }
  return hashContent(parts.join('\u0000'), algo);
}

// 增量上下文决策：
//   active      = enabled !== false && skipUnchanged !== false && 非强制全量 && 请求增量
//   请求增量     = watch 模式下 incrementalBuild.watch !== false；非 watch 需显式 --incremental
//   forceFull   = argv 含 incrementalBuild.fullFlag（默认 '--full'）或 '--full'
function computeIncrementalContext(features, options) {
  const inc = features && features.incrementalBuild;
  const opts = options || {};
  const argv = Array.isArray(opts.argv) ? opts.argv : [];
  const argvIncludes = function (flag) { return argv.indexOf(flag) !== -1; };
  if (!inc) {
    return { active: false, forceFull: argvIncludes('--full'), requested: false, fullFlag: '--full', fingerprintHash: 'sha1' };
  }
  const fullFlagRaw = inc.fullFlag == null ? '' : String(inc.fullFlag).trim();
  const fullFlag = fullFlagRaw || '--full';
  const forceFull = argvIncludes(fullFlag) || argvIncludes('--full');
  const requested = opts.watchMode ? inc.watch !== false : argvIncludes('--incremental');
  const active = inc.enabled !== false && inc.skipUnchanged !== false && !forceFull && requested;
  return {
    active: active,
    forceFull: forceFull,
    requested: requested,
    fullFlag: fullFlag,
    fingerprintHash: normalizeHashAlgo(inc.fingerprintHash)
  };
}

module.exports = { normalizeHashAlgo, hashContent, stableSerialize, pageCacheKey, hashTemplateDir, computeIncrementalContext };
