'use strict';

// dist 产物归一化哈希护栏（供 build.js 机械拆分前后的产物等价验证）：
//   - 构建期 CSP nonce 每次进程随机生成，直接哈希会让两次等价构建误报差异；
//     归一化把 HTML 的 nonce="..." 属性与 CSP 的 nonce-<base64> 令牌（_headers /
//     Worker / meta 三处同源）替换为固定占位，使哈希对 nonce 不敏感；
//   - 同时把 CRLF 归一化为 LF（跨平台检出/生成差异），并按 root 相对路径忽略
//     已知非确定性产物（build-report.html 含构建统计、og/ 为图像管线产物）；
//   - 二进制文件（无效 UTF-8）按原始字节哈希，避免 UTF-8 替换字符（U+FFFD）把不同
//     字节序列折叠成相同文本而产生「等价假象」。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isUtf8 } = require('node:buffer');

// 默认忽略项（root 相对 POSIX 路径；目录项以 / 结尾）
const DEFAULT_IGNORES = ['build-report.html', 'og/'];

// nonce 的两种形态：HTML 属性值（双引号）与 CSP 令牌（可带引号包裹，只替换令牌本身）
const NONCE_ATTR_RE = /nonce="[^"]*"/g;
const NONCE_TOKEN_RE = /nonce-[A-Za-z0-9+/=_-]+/g;

/**
 * 归一化单个产物内容：CRLF → LF，nonce 属性与令牌 → 固定占位。
 * 参数 relPath 暂未参与归一化（保留给未来按文件类型差异化处理），
 * 当前对全部文本文件统一应用两条规则，确保 HTML 与 _headers 都被覆盖。
 *
 * @param {string} relPath 相对 root 的 POSIX 路径
 * @param {string} content 文本内容
 * @returns {string} 归一化后的内容
 */
function normalizeContent(relPath, content) {
  return String(content)
    .replace(/\r\n/g, '\n')
    .replace(NONCE_ATTR_RE, 'nonce="NONCE"')
    .replace(NONCE_TOKEN_RE, 'nonce-NONCE');
}

// 忽略项归一化：反斜杠转 POSIX、去掉目录尾部的 /
function normalizeIgnore(ignore) {
  const posix = String(ignore).split(path.sep).join('/');
  return posix.endsWith('/') ? posix.slice(0, -1) : posix;
}

// 相对路径是否命中忽略项：精确匹配文件，或位于忽略目录子树内
function isIgnored(relPath, normalizedIgnores) {
  for (const entry of normalizedIgnores) {
    if (!entry) continue;
    if (relPath === entry || relPath.startsWith(entry + '/')) return true;
  }
  return false;
}

/**
 * 递归列出 rootDir 下全部文件，返回排序后的 POSIX 相对路径。
 * 跳过忽略项本身及其子树；返回结果使用字典序排序（不依赖 locale）。
 *
 * @param {string} rootDir 产物根目录
 * @param {string[]} [ignores] 忽略项（root 相对路径，目录以 / 结尾；默认 DEFAULT_IGNORES）
 * @returns {string[]} 排序后的 POSIX 相对路径数组
 */
function listDistFiles(rootDir, ignores = DEFAULT_IGNORES) {
  const normalizedIgnores = ignores.map(normalizeIgnore);
  const files = [];
  function walk(absDir, relDir) {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relDir ? relDir + '/' + entry.name : entry.name;
      if (isIgnored(rel, normalizedIgnores)) continue;
      if (entry.isDirectory()) {
        walk(path.join(absDir, entry.name), rel);
      } else if (entry.isFile()) {
        files.push(rel);
      }
    }
  }
  walk(rootDir, '');
  return files.sort();
}

// 单文件哈希：有效 UTF-8 走归一化文本，无效 UTF-8（二进制）走原始字节
function hashFile(relPath, buffer) {
  if (!isUtf8(buffer)) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
  const normalized = normalizeContent(relPath, buffer.toString('utf8'));
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * 对 rootDir 下（忽略项之外）全部文件计算归一化 SHA-256。
 *
 * @param {string} rootDir 产物根目录
 * @param {string[]} [ignores] 忽略项（默认 DEFAULT_IGNORES）
 * @returns {{ total: number, files: Record<string, string> }} 文件总数与 rel → 十六进制哈希
 */
function hashDist(rootDir, ignores = DEFAULT_IGNORES) {
  const relPaths = listDistFiles(rootDir, ignores);
  /** @type {Record<string, string>} */
  const files = {};
  for (const rel of relPaths) {
    files[rel] = hashFile(rel, fs.readFileSync(path.join(rootDir, rel)));
  }
  return { total: relPaths.length, files };
}

// 清单结构校验：必须带对象类型的 files 字段（hashDist 结果与 snapshot 清单均满足）
function assertManifest(name, manifest) {
  const files = manifest && manifest.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new TypeError('清单格式无效：' + name + ' 缺少对象类型的 files 字段');
  }
}

/**
 * 比较两份清单（基准 a → 现状 b）。
 * added = 仅存在于 b；removed = 仅存在于 a；changed = 两侧都有但哈希不同。
 *
 * @param {{ files: Record<string, string> }} a 基准清单
 * @param {{ files: Record<string, string> }} b 现状清单
 * @returns {{ added: string[], removed: string[], changed: string[] }} 排序后的三类差异
 */
function diffManifests(a, b) {
  assertManifest('a', a);
  assertManifest('b', b);
  const aKeys = new Set(Object.keys(a.files));
  const bKeys = new Set(Object.keys(b.files));
  const added = [];
  const removed = [];
  const changed = [];
  for (const rel of bKeys) {
    if (!aKeys.has(rel)) added.push(rel);
    else if (a.files[rel] !== b.files[rel]) changed.push(rel);
  }
  for (const rel of aKeys) {
    if (!bKeys.has(rel)) removed.push(rel);
  }
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

module.exports = { normalizeContent, listDistFiles, hashDist, diffManifests, DEFAULT_IGNORES };
