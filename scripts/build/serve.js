'use strict';
require('../lib/process-guard.js');
// 开发预览服务器模块（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createServeModule(ctx) 注入产物目录；http 在函数体内按需 require，非 serve 模式零开销。
// MIME 表、gzip 协商与静态文件解析委托 scripts/lib/static-server.js（与压缩验证服务器共享语义）。
const fs = require('fs');
const path = require('path');
const { MIME_TYPES, acceptsGzip, isCompressibleType, resolveStaticFile } = require('../lib/static-server');
const { loadInternals } = require('../lib/internals');

// 维护页文案转义：与 Worker 的契约一致（文案「HTML 转义后输出」）。维护页是整页拼接的字符串，
// 文案里出现 < > & " ' 会破坏标记结构，因此统一转义后再写入 title/正文。
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

// 本地 serve 的缓存语义与生产对齐（2G/缓存复测）：
// 生产由 _headers 对 /assets/** 下发 immutable、Worker 对 HTML 下发 max-age=0 + SWR；
// 本地曾一律 no-cache，导致「缓存到底有没有命中」在本地无法复现，弱网复测也会失真。
// 注意：这里只按「内容寻址/可安全长期缓存」的路径给强缓存，其余仍保持 no-cache。
function cacheControlFor(urlPath, status) {
  var p = String(urlPath || '/');
  var st = status == null ? 200 : status;
  if (/^\/assets\/(?:js|css|fonts)\//.test(p) || /^\/assets\/(?:config|quotes)\.[0-9A-Za-z]+\.json$/.test(p)) {
    return 'public, max-age=31536000, immutable';
  }
  if (/^\/media\//.test(p) || /^\/og\//.test(p)) return 'public, max-age=604800, stale-while-revalidate=86400';
  if (/^\/assets\/vendor\//.test(p)) return 'public, max-age=3600, stale-while-revalidate=86400';
  // 与 Worker 一致：只给 200 的 HTML 贴 SWR，404 页同样匹配「/」结尾，不能连带缓存。
  if (st >= 200 && st < 300 && (/\.html?$/.test(p) || p.charAt(p.length - 1) === '/')) {
    return 'public, max-age=0, stale-while-revalidate=86400';
  }
  return 'no-cache';
}

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
    var PORT = Number.isInteger(opts.port) ? opts.port : (argvPort || loadInternals().ports.serve);
    // features.maintenance：setRetryAfter=false 时维护响应不输出 Retry-After；retryAfter 为秒数（非法回退 3600）。
    var maintCfg = (config.features && config.features.maintenance) || {};
    // 接线：features.maintenance.enabled 此前零消费。true 时与 --maintenance 参数 /
    // MAINTENANCE=1 环境变量等价（三者取或），本地预览能直接验证线上维护态；
    // 缺键/非 true 一律不进入维护态。
    var MAINTENANCE = process.argv.indexOf('--maintenance') !== -1 || process.env.MAINTENANCE === '1' || maintCfg.enabled === true;
    // 接线：message/messageEn 此前零消费（只认环境变量与硬编码中文）。优先级与 Worker
    // 一致：MAINTENANCE_MESSAGE > features.maintenance.message(En) > 内置语；serve 无请求级语言，
    // 按站点语言（en 开头 → messageEn，与 Worker 的 Accept-Language 选择对应）取一条，
    // 空则回退另一条 —— 本地预览看到的就是线上会看到的文案。
    var maintEn = String((config.site && config.site.language) || '').toLowerCase().indexOf('en') === 0;
    var maintCfgMsg = maintEn ? (maintCfg.messageEn || maintCfg.message) : (maintCfg.message || '');
    var MAINT_MSG = process.env.MAINTENANCE_MESSAGE || maintCfgMsg ||
      (maintEn ? 'The site is under maintenance. Please check back later.' : '本站正在维护中，请稍后再来。');
    var MAINT_MSG_HTML = escapeHtml(MAINT_MSG);
    // 接线：status 此前硬编码 503；只接受 400–599 整数（200/301 之类会让维护页
    // 看起来「正常」或跳走），其余回退 503，与 Worker 的归一化规则一致。
    var maintStatus = Number(maintCfg.status);
    if (!Number.isInteger(maintStatus) || maintStatus < 400 || maintStatus > 599) maintStatus = 503;
    var maintRetry = parseInt(maintCfg.retryAfter, 10);
    if (!Number.isFinite(maintRetry) || maintRetry <= 0) maintRetry = 3600;
    var maintHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
    if (maintCfg.setRetryAfter !== false) maintHeaders['Retry-After'] = String(maintRetry);
    var maintPage = '<!DOCTYPE html><html lang="' + config.site.language + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>维护中 - ' + MAINT_MSG_HTML + '</title><style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:' + config.theme.colors.background + ';color:' + config.theme.colors.text + '}p{color:' + config.theme.colors.textSecondary + '}</style></head><body><main><h1>维护中</h1><p>' + MAINT_MSG_HTML + '</p></main></body></html>';
    var applyRedirects = !(config.features && config.features.redirects && config.features.redirects.applyInServe === false);
    var REDIRECT_LIST = [];
    if (applyRedirects) {
      try {
        var rc = fs.readFileSync(path.join(distDir, '_redirects'), 'utf-8');
        rc.split('\n').forEach(function(line) {
          if (!line.trim()) return;
          var parts = line.trim().split(/\s+/);
          if (parts.length >= 3) REDIRECT_LIST.push({ from: parts[0], to: parts[1], status: parts[2] === '302' ? 302 : 301 });
        });
      } catch (e) { /* 忽略：serve 模式下 _redirects 不存在时按空规则处理 */ }
    }
    var mime = MIME_TYPES;
    var lastActivity = Date.now();
    var server = http.createServer(function(req, res) {
      lastActivity = Date.now();
      if (MAINTENANCE) {
        res.writeHead(maintStatus, maintHeaders);
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
      var resolved = resolveStaticFile(distDir, urlPath);
      var filePath = resolved.filePath;
      var isNotFound = resolved.isNotFound;
      fs.stat(filePath, function(serr, st) {
        if (serr || !st.isFile()) { res.writeHead(500); res.end('Server Error'); return; }
        var ext = path.extname(filePath).toLowerCase();
        var etag = '"' + st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16) + '"';
        var lastMod = st.mtime.toUTCString();
        if (req.headers['if-none-match'] === etag || req.headers['if-modified-since'] === lastMod) {
          res.writeHead(304, { 'ETag': etag, 'Last-Modified': lastMod, 'Cache-Control': cacheControlFor(urlPath, 200) });
          res.end();
          return;
        }
        fs.readFile(filePath, function(err, data) {
          if (err) { res.writeHead(500); res.end('Server Error'); return; }
          var contentType = mime[ext] || 'application/octet-stream';
          var compressible = isCompressibleType(contentType);
          var status = isNotFound ? 404 : 200;
          var headers = { 'Content-Type': contentType, 'ETag': etag, 'Last-Modified': lastMod, 'Cache-Control': cacheControlFor(urlPath, status), 'Vary': 'Accept-Encoding' };
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
    // SYNAPSE_SERVE_IDLE_MS 指定空闲毫秒数，超时自退；SYNAPSE_SERVE_MAX_MS 指定绝对寿命上限，
    // 到时无条件退出（兜底父进程 PID 被复用或监督脚本自身被杀的情况）。三者缺省均关闭，仅测试/工具脚本使用。
    var parentPid = parseInt(process.env.SYNAPSE_SERVE_PARENT_PID || '', 10);
    var maxMs = parseInt(process.env.SYNAPSE_SERVE_MAX_MS || '0', 10) || 0;
    var lifespanStart = Date.now();
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
    if (parentPid > 0 || idleMs > 0 || maxMs > 0) {
      setInterval(function() {
        if (parentPid > 0 && !parentAlive()) { tryClose('parent process exited'); return; }
        if (idleMs > 0 && Date.now() - lastActivity > idleMs) tryClose('idle ' + Math.round((Date.now() - lastActivity) / 1000) + 's');
        if (maxMs > 0 && Date.now() - lifespanStart > maxMs) tryClose('max lifetime ' + Math.round(maxMs / 1000) + 's');
      }, 5000);
    }
    // 信号处理器随 server 生命周期注册/注销：同进程多次 startServer（测试、工具脚本）时不会
    // 累积 listener（Node 默认 10 个即告警，且旧处理器会一直持有已关闭的 server）。
    var signalHandlers = {};
    ['SIGINT', 'SIGTERM'].forEach(function(sig) {
      signalHandlers[sig] = function() { tryClose('signal ' + sig); };
      process.on(sig, signalHandlers[sig]);
    });
    server.on('close', function() {
      ['SIGINT', 'SIGTERM'].forEach(function(sig) {
        if (signalHandlers[sig]) process.removeListener(sig, signalHandlers[sig]);
        signalHandlers[sig] = null;
      });
    });
    return server;
  }

  return { startServer };
}

module.exports = { createServeModule, cacheControlFor };
