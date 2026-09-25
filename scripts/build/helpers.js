'use strict';
// 构建辅助函数（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createHelpersModule(ctx) 注入项目根、favicon 静态目录、草稿开关、监视模式、
// JSON5 实现与构建错误收集器读取器（活值 getter）；isScheduled、escapeAttr 直连 lib。
const fs = require('fs');
const path = require('path');
const { escapeAttr } = require('../lib/utils');
const { isScheduled } = require('../lib/publish-window');

function createHelpersModule(ctx) {
  const { staticDir, watchMode, showDrafts } = ctx;

  const BUILTIN_QUOTES = [
    { text: '认识你自己。', author: '苏格拉底' },
    { text: '我思故我在。', author: '笛卡尔' },
    { text: '知行合一。', author: '王阳明' },
    { text: '路漫漫其修远兮，吾将上下而求索。', author: '屈原' },
    { text: '学而不思则罔，思而不学则殆。', author: '孔子' },
    { text: '纸上得来终觉浅，绝知此事要躬行。', author: '陆游' },
    { text: 'Where there is a will, there is a way.', author: 'Thomas Edison' }
  ];
  // Filter out draft articles unless SHOW_DRAFTS is active
  function getPublished(articles) {
    const now = new Date();
    return articles.filter(a => (!a.draft || showDrafts) && !isScheduled(a, now));
  }

  function resolveDailyQuotes(config) {
    const dq = (config.features && config.features.dailyQuote) || {};
    const src = typeof dq.source === 'string' ? dq.source.trim() : '';
    if (!src || src === 'builtin') return BUILTIN_QUOTES;
    if (!/\.(json|json5)$/i.test(src)) {
      console.warn('  [WARN] dailyQuote.source "' + src + '" 不是 .json/.json5 路径,已回退内置引语');
      return BUILTIN_QUOTES;
    }
    const file = path.isAbsolute(src) ? src : path.join(ctx.rootDir, src);
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const json5 = ctx.getJson5();
      const parsed = /\.json5$/i.test(file) && json5 ? json5.parse(raw) : JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.quotes) ? parsed.quotes : []);
      const quotes = list.map(function (q) {
        if (typeof q === 'string') return { text: q, author: '' };
        if (q && typeof q.text === 'string') return { text: q.text, author: typeof q.author === 'string' ? q.author : '' };
        return null;
      }).filter(Boolean);
      if (!quotes.length) throw new Error('文件中没有可用引语');
      console.log('  dailyQuote.source: ' + path.relative(ctx.rootDir, file) + ' (' + quotes.length + ' 条)');
      return quotes;
    } catch (err) {
      console.warn('  [WARN] dailyQuote.source "' + src + '" 加载失败 (' + err.message + '),已回退内置引语');
      return BUILTIN_QUOTES;
    }
  }
  function faviconFallbackSvg(color) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="' + color + '"/><g stroke="#fff" stroke-width="4" stroke-linecap="round"><line x1="20" y1="22" x2="44" y2="21"/><line x1="20" y1="22" x2="32" y2="44"/><line x1="44" y1="21" x2="32" y2="44"/></g><g fill="#fff"><circle cx="20" cy="22" r="6.2"/><circle cx="44" cy="21" r="6.2"/><circle cx="32" cy="44" r="6.4"/></g></svg>';
  }
  function readPngSize(absPath) {
    try {
      const fd = fs.openSync(absPath, 'r');
      const buf = Buffer.alloc(24);
      fs.readSync(fd, buf, 0, 24, 0);
      fs.closeSync(fd);
      if (buf.readUInt32BE(12) === 0x49484452) return buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20);
    } catch (e) { /* 尺寸不可读时省略 sizes 属性 */ }
    return '';
  }
  let _faviconHtmlCache = null;
  function resolveFaviconHtml(site, themeColor) {
    // --watch 模式下 favicon 文件可能被增删，缓存必须失效重查（普通构建复用缓存）
    if (_faviconHtmlCache !== null && !watchMode) return _faviconHtmlCache;
    const f = (site && site.favicon) || {};
    if (f.enabled === false) { _faviconHtmlCache = ''; return _faviconHtmlCache; }
    const isExternal = function (u) { return /^https?:\/\//i.test(u); };
    const localAbs = function (u) {
      if (typeof u !== 'string' || u.charAt(0) !== '/') return '';
      const rel = u.replace(/^\/+/, '').split('?')[0].split('#')[0];
      return path.join(staticDir, rel);
    };
    const pick = function (u, build) {
      if (!u || typeof u !== 'string') return null;
      if (isExternal(u)) return build(u, '');
      const abs = localAbs(u);
      if (abs && fs.existsSync(abs)) return build(u, abs);
      console.warn('  [WARN] favicon 文件不存在: ' + u + '（已跳过）');
      return null;
    };
    const link = function (rel, type, sizes, href) {
      return '<link rel="' + rel + '" type="' + type + '"' + (sizes ? ' sizes="' + sizes + '"' : '') + ' href="' + escapeAttr(href) + '">';
    };
    const parts = [
      pick(f.svg, function (u) { return link('icon', 'image/svg+xml', '', u); }),
      pick(f.png32, function (u, abs) { return link('icon', 'image/png', abs ? readPngSize(abs) : '', u); }),
      pick(f.appleTouch, function (u, abs) { return link('apple-touch-icon', 'image/png', abs ? readPngSize(abs) : '', u); })
    ].filter(Boolean);
    if (!parts.length) {
      parts.push('<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,' + encodeURIComponent(faviconFallbackSvg(themeColor)) + '">');
    }
    _faviconHtmlCache = parts.join('');
    return _faviconHtmlCache;
  }
  // Collects runtime failures so the build can exit non-zero instead of silently ignoring them.
  function recordBuildFailure(stage, message) {
    const buildErrors = ctx.getBuildErrors();
    if (buildErrors) buildErrors.add(stage, message);
  }

  return { getPublished, resolveDailyQuotes, faviconFallbackSvg, readPngSize, resolveFaviconHtml, recordBuildFailure };
}

module.exports = { createHelpersModule };
