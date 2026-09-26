#!/usr/bin/env node
'use strict';
// 压缩无头验证的静态服务子进程（由 scripts/lib/compression-verify.js 拉起，不供人工常驻运行）：
//   node scripts/compression-verify-server.js --root <dir> [--fallback <dir>] [--port <n>]
// 端口缺省 0：由系统分配空闲端口，监听后向 stdout 打印 SYNAPSE_SERVE_PORT=<port>，
// 父进程据此连接（无需预留固定端口，两个实例天然互异）。
// root 命中的文件优先；root 缺失（isNotFound）且提供 --fallback 时改用 fallback 解析：
// 基线快照只包含被增强触及的文本文件（HTML/CSS/JS/JSON），其余资产回退到压缩产物目录读取，
// 从而让「基线叠加层」精确还原增强前的整站字节，而无需整目录复制。
// 看门狗与 scripts/build/serve.js 同语义（环境变量、缺省全关）：
//   SYNAPSE_SERVE_PARENT_PID  父进程 PID，父进程消失后自退
//   SYNAPSE_SERVE_IDLE_MS     空闲上限（毫秒），超时自退
//   SYNAPSE_SERVE_MAX_MS      绝对寿命上限（毫秒），到时自退
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const { MIME_TYPES, acceptsGzip, isCompressibleType, resolveStaticFile } = require('./lib/static-server');

function parseArgs(argv) {
  const out = { root: '', fallback: '', port: 0 };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--root' && value) { out.root = value; i++; }
    else if (key === '--fallback' && value) { out.fallback = value; i++; }
    else if (key === '--port' && value) { out.port = Number(value) || 0; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
if (!args.root) {
  console.error('[compression-verify-server] 缺少 --root <dir>');
  process.exit(2);
}
const rootDir = path.resolve(args.root);
const fallbackDir = args.fallback ? path.resolve(args.fallback) : '';

let lastActivity = Date.now();
const server = http.createServer(function (req, res) {
  lastActivity = Date.now();
  const rawPath = String(req.url || '/').split('?')[0];
  let urlPath;
  try {
    urlPath = decodeURIComponent(rawPath);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  let resolved = resolveStaticFile(rootDir, urlPath);
  if (resolved.isNotFound && fallbackDir) resolved = resolveStaticFile(fallbackDir, urlPath);
  fs.readFile(resolved.filePath, function (err, data) {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Server Error');
      return;
    }
    const contentType = MIME_TYPES[path.extname(resolved.filePath).toLowerCase()] || 'application/octet-stream';
    const status = resolved.isNotFound ? 404 : 200;
    const headers = { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'Vary': 'Accept-Encoding' };
    if (isCompressibleType(contentType) && acceptsGzip(req.headers['accept-encoding'])) {
      zlib.gzip(data, function (zerr, zipped) {
        if (zerr) {
          headers['Content-Length'] = data.length;
          res.writeHead(status, headers);
          res.end(data);
          return;
        }
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = zipped.length;
        res.writeHead(status, headers);
        res.end(zipped);
      });
      return;
    }
    headers['Content-Length'] = data.length;
    res.writeHead(status, headers);
    res.end(data);
  });
});

server.listen(args.port, '127.0.0.1', function () {
  const address = server.address();
  console.log('SYNAPSE_SERVE_PORT=' + (address && address.port ? address.port : args.port));
});

const parentPid = parseInt(process.env.SYNAPSE_SERVE_PARENT_PID || '', 10);
const idleMs = parseInt(process.env.SYNAPSE_SERVE_IDLE_MS || '0', 10) || 0;
const maxMs = parseInt(process.env.SYNAPSE_SERVE_MAX_MS || '0', 10) || 0;
const lifespanStart = Date.now();
function tryClose(reason) {
  console.log('  Auto-exit: ' + reason);
  try { server.closeAllConnections(); } catch (err) { /* 旧版 Node 无此 API 时忽略 */ }
  server.close(function () { process.exit(0); });
  setTimeout(function () { process.exit(0); }, 1000).unref();
}
function parentAlive() {
  try { process.kill(parentPid, 0); return true; } catch (err) { return false; }
}
if (parentPid > 0 || idleMs > 0 || maxMs > 0) {
  setInterval(function () {
    if (parentPid > 0 && !parentAlive()) { tryClose('parent process exited'); return; }
    if (idleMs > 0 && Date.now() - lastActivity > idleMs) tryClose('idle ' + Math.round((Date.now() - lastActivity) / 1000) + 's');
    if (maxMs > 0 && Date.now() - lifespanStart > maxMs) tryClose('max lifetime ' + Math.round(maxMs / 1000) + 's');
  }, 5000);
}
['SIGINT', 'SIGTERM'].forEach(function (sig) {
  process.on(sig, function () { tryClose('signal ' + sig); });
});
