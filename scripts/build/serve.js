'use strict';
// 开发预览服务器模块（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createServeModule(ctx) 注入产物目录；http 在函数体内按需 require，非 serve 模式零开销。
const fs = require('fs');
const path = require('path');

function createServeModule(ctx) {
  const { distDir } = ctx;

  // Simple development HTTP server for previewing the built site.
  // Serves files from dist/ with basic MIME type detection.
  // Supports clean URLs (auto-appends index.html for directories, .html for missing files).
  // Falls back to 404.html when no match is found.
  // 本地保真（T5）：按 Accept-Encoding 对文本类 MIME 做 gzip（node:zlib），使本地采样接近
  // 生产边缘压缩；请求未声明 gzip 时原样返回。可用 options.port 覆盖端口（0 = 随机端口，测试用）。
  function startServer(config, options) {
    var http = require('http');
    var zlib = require('zlib');
    var opts = options || {};
    var argvPort = parseInt(process.argv[process.argv.indexOf('--port') + 1]);
    var PORT = Number.isInteger(opts.port) ? opts.port : (argvPort || 3000);
    // 可压缩的文本类 MIME（前缀匹配，忽略 charset 参数）；图片/字体/媒体等二进制不压缩。
    var COMPRESSIBLE_PREFIXES = ['text/', 'application/javascript', 'application/json', 'application/manifest+json', 'image/svg+xml', 'application/xml'];
    function acceptsGzip(header) {
      var raw = String(header || '').toLowerCase();
      if (raw.indexOf('gzip') === -1) return false;
      var parts = raw.split(',');
      for (var i = 0; i < parts.length; i++) {
        var token = parts[i].trim();
        if (token.indexOf('gzip') === 0) {
          var q = token.match(/;\s*q=([0-9.]+)/);
          return !q || parseFloat(q[1]) > 0;
        }
      }
      return false;
    }
    var MAINTENANCE = process.argv.indexOf('--maintenance') !== -1 || process.env.MAINTENANCE === '1';
    var MAINT_MSG = process.env.MAINTENANCE_MESSAGE || '本站正在维护中，请稍后再来。';
    var maintPage = '<!DOCTYPE html><html lang="' + config.site.language + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>维护中 - ' + MAINT_MSG + '</title><style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:' + config.theme.colors.background + ';color:' + config.theme.colors.text + '}p{color:' + config.theme.colors.textSecondary + '}</style></head><body><main><h1>维护中</h1><p>' + MAINT_MSG + '</p></main></body></html>';
    var REDIRECT_LIST = [];
    try {
      var rc = fs.readFileSync(path.join(distDir, '_redirects'), 'utf-8');
      rc.split('\n').forEach(function(line) {
        if (!line.trim()) return;
        var parts = line.trim().split(/\s+/);
        if (parts.length >= 3) REDIRECT_LIST.push({ from: parts[0], to: parts[1], status: parts[2] === '302' ? 302 : 301 });
      });
    } catch (e) { /* 忽略：serve 模式下 _redirects 不存在时按空规则处理 */ }
    var mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.txt':'text/plain','.mp4':'video/mp4','.webm':'video/webm','.avi':'video/x-msvideo','.mov':'video/quicktime','.mkv':'video/x-matroska','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.flac':'audio/flac','.pdf':'application/pdf','.csv':'text/csv','.zip':'application/zip','.7z':'application/x-7z-compressed','.rar':'application/x-rar-compressed','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.eot':'application/vnd.ms-fontobject' };
    var lastActivity = Date.now();
    var server = http.createServer(function(req, res) {
      lastActivity = Date.now();
      if (MAINTENANCE) {
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' });
        res.end(maintPage);
        return;
      }
      var rawPath = req.url.split('?')[0];
      var urlPath;
      try {
        urlPath = decodeURIComponent(rawPath);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad Request');
        return;
      }
      var redirects = REDIRECT_LIST;
      if (redirects.length) {
        for (var i = 0; i < redirects.length; i++) {
          var rd = redirects[i];
          var wildcardTail = rd.from.charAt(rd.from.length - 1) === '*';
          if (rd.from === urlPath || (wildcardTail && urlPath.startsWith(rd.from.slice(0, -1)))) {
            var to = rd.to;
            if (wildcardTail && to.indexOf('*') !== -1) {
              to = to.split('*').join(urlPath.slice(rd.from.length - 1));
            }
            res.writeHead(rd.status, { Location: to, 'Cache-Control': 'no-store' });
            res.end();
            return;
          }
        }
      }
      var urlNoSlash = urlPath.replace(/\/$/, '');
      var filePath = urlNoSlash ? path.resolve(distDir, '.' + urlNoSlash) : path.join(distDir, 'index.html');
      if (!filePath.startsWith(path.resolve(distDir) + path.sep) && !filePath.startsWith(path.resolve(distDir) + '/')) {
        filePath = path.join(distDir, '404.html');
      }
      try { if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html'); } catch(e) { /* 忽略：路径不存在/非目录时按原路径处理 */ }
      var isNotFound = false;
      if (!fs.existsSync(filePath)) {
        var alt = filePath + '.html';
        if (fs.existsSync(alt)) filePath = alt;
        else { filePath = path.join(distDir, '404.html'); isNotFound = true; }
      }
      fs.stat(filePath, function(serr, st) {
        if (serr || !st.isFile()) { res.writeHead(500); res.end('Server Error'); return; }
        var ext = path.extname(filePath).toLowerCase();
        var etag = '"' + st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16) + '"';
        var lastMod = st.mtime.toUTCString();
        if (req.headers['if-none-match'] === etag || req.headers['if-modified-since'] === lastMod) {
          res.writeHead(304, { 'ETag': etag, 'Last-Modified': lastMod, 'Cache-Control': 'no-cache' });
          res.end();
          return;
        }
        fs.readFile(filePath, function(err, data) {
          if (err) { res.writeHead(500); res.end('Server Error'); return; }
          var contentType = mime[ext] || 'application/octet-stream';
          var baseType = contentType.split(';')[0].trim().toLowerCase();
          var compressible = COMPRESSIBLE_PREFIXES.some(function(p) { return baseType.indexOf(p) === 0; });
          var headers = { 'Content-Type': contentType, 'ETag': etag, 'Last-Modified': lastMod, 'Cache-Control': 'no-cache', 'Vary': 'Accept-Encoding' };
          var status = isNotFound ? 404 : 200;
          if (compressible && acceptsGzip(req.headers['accept-encoding'])) {
            zlib.gzip(data, function(zerr, zipped) {
              if (zerr) { headers['Content-Length'] = data.length; res.writeHead(status, headers); res.end(data); return; }
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
    });
    server.listen(PORT, function() {
      var actualPort = server.address() && server.address().port;
      console.log('  Server: http://localhost:' + (actualPort || PORT) + '/');
      console.log('  (Press Ctrl+C to stop)');
    });
    // 自动退出看门狗（防孤儿进程）：环境变量 SYNAPSE_SERVE_PARENT_PID 指定父进程，父进程消失后 5 秒内自退；
    // SYNAPSE_SERVE_IDLE_MS 指定空闲毫秒数，超时自退（两者缺省均关闭，仅测试/工具脚本使用）。
    var parentPid = parseInt(process.env.SYNAPSE_SERVE_PARENT_PID || '', 10);
    function tryClose(reason) {
      console.log('  Auto-exit: ' + reason);
      try { server.closeAllConnections(); } catch (e) { /* 旧版 Node 无此 API 时忽略 */ }
      server.close(function() { process.exit(0); });
      setTimeout(function() { process.exit(0); }, 1000).unref();
    }
    function parentAlive() {
      try { process.kill(parentPid, 0); return true; } catch (e) { return false; }
    }
    var idleMs = parseInt(process.env.SYNAPSE_SERVE_IDLE_MS || '0', 10) || 0;
    if (parentPid > 0 || idleMs > 0) {
      setInterval(function() {
        if (parentPid > 0 && !parentAlive()) { tryClose('parent process exited'); return; }
        if (idleMs > 0 && Date.now() - lastActivity > idleMs) tryClose('idle ' + Math.round((Date.now() - lastActivity) / 1000) + 's');
      }, 5000);
    }
    ['SIGINT', 'SIGTERM'].forEach(function(sig) {
      process.on(sig, function() { tryClose('signal ' + sig); });
    });
    return server;
  }

  return { startServer };
}

module.exports = { createServeModule };
