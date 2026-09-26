'use strict';
// 静态文件服务共享能力：开发预览服务器（scripts/build/serve.js）与压缩无头验证服务器
// （scripts/compression-verify-server.js）共用，保证两处对同一产物给出相同的 URL→文件解析、
// MIME 判定与 gzip 协商语义。
//   - MIME_TYPES / COMPRESSIBLE_PREFIXES：扩展名与可压缩文本类型白名单；
//   - acceptsGzip：按 Accept-Encoding 判断（q=0 视为拒绝，与浏览器语义一致）；
//   - resolveStaticFile：clean URL（目录 → index.html、缺省路径补 .html、越界与缺失回退 404.html）。
// 行为与抽取前的 serve.js 逐字一致（scripts/serve-compression.test.js 监守）。

const fs = require('fs');
const path = require('path');

// 扩展名 → Content-Type（与抽取前 serve.js 的 mime 表逐项一致）
const MIME_TYPES = Object.freeze({
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.txt': 'text/plain',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.pdf': 'application/pdf', '.csv': 'text/csv',
  '.zip': 'application/zip', '.7z': 'application/x-7z-compressed', '.rar': 'application/x-rar-compressed',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject'
});

// 可压缩的文本类 MIME 前缀（忽略 charset 参数）；图片/字体/媒体等二进制不压缩。
const COMPRESSIBLE_PREFIXES = Object.freeze([
  'text/', 'application/javascript', 'application/json', 'application/manifest+json', 'image/svg+xml', 'application/xml'
]);

/**
 * 解析 Accept-Encoding 判断客户端是否接受 gzip。
 * 显式 q=0 表示拒绝（RFC 9110 §12.5.3），缺失 q 参数按接受处理。
 * @param {string} [header] 原始 Accept-Encoding 头
 * @returns {boolean}
 */
function acceptsGzip(header) {
  const raw = String(header || '').toLowerCase();
  if (raw.indexOf('gzip') === -1) return false;
  const parts = raw.split(',');
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i].trim();
    if (token.indexOf('gzip') === 0) {
      const q = token.match(/;\s*q=([0-9.]+)/);
      return !q || parseFloat(q[1]) > 0;
    }
  }
  return false;
}

/**
 * 判断 Content-Type 是否属于可 gzip 的文本类型（按前缀匹配，忽略 charset 参数）。
 * @param {string} contentType 完整 Content-Type（可含 ; charset=...）
 * @returns {boolean}
 */
function isCompressibleType(contentType) {
  const baseType = String(contentType || '').split(';')[0].trim().toLowerCase();
  return COMPRESSIBLE_PREFIXES.some((prefix) => baseType.indexOf(prefix) === 0);
}

/**
 * 把 URL 路径解析为 rootDir 内的静态文件路径（clean URL 语义）：
 *   ① 去掉末尾 / 后按相对路径解析；空路径 → rootDir/index.html；
 *   ② 解析结果越出 rootDir（路径穿越）→ rootDir/404.html；
 *   ③ 命中目录 → 该目录的 index.html；
 *   ④ 文件不存在 → 追加 .html 再试；仍不存在 → rootDir/404.html 且 isNotFound=true。
 * @param {string} rootDir 服务根目录（resolveStaticFile 内部按 resolve 后的绝对路径比较）
 * @param {string} urlPath 已 decodeURIComponent 的 URL 路径（可含查询串前的裸路径）
 * @returns {{ filePath: string, isNotFound: boolean }}
 */
function resolveStaticFile(rootDir, urlPath) {
  const rootResolved = path.resolve(rootDir);
  const urlNoSlash = String(urlPath || '').replace(/\/$/, '');
  let filePath = urlNoSlash ? path.resolve(rootDir, '.' + urlNoSlash) : path.join(rootDir, 'index.html');
  if (!filePath.startsWith(rootResolved + path.sep) && !filePath.startsWith(rootResolved + '/')) {
    filePath = path.join(rootDir, '404.html');
  }
  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch (err) { /* 忽略：路径不存在/非目录时按原路径处理 */ }
  let isNotFound = false;
  if (!fs.existsSync(filePath)) {
    const alt = filePath + '.html';
    if (fs.existsSync(alt)) {
      filePath = alt;
    } else {
      filePath = path.join(rootDir, '404.html');
      isNotFound = true;
    }
  }
  return { filePath, isNotFound };
}

module.exports = { MIME_TYPES, COMPRESSIBLE_PREFIXES, acceptsGzip, isCompressibleType, resolveStaticFile };
