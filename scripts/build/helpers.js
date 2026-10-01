'use strict';
// 构建辅助函数（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createHelpersModule(ctx) 注入项目根、favicon 静态目录、草稿开关、监视模式、
// JSON5 实现与构建错误收集器读取器（活值 getter）；isScheduled、escapeAttr 直连 lib。
const fs = require('fs');
const path = require('path');
const { escapeAttr } = require('../lib/utils');
const { isScheduled } = require('../lib/publish-window');
const { normalizeQuoteList, applyCount } = require('../lib/daily-quotes');
const { loadInternals } = require('../lib/internals');

function createHelpersModule(ctx) {
  const { staticDir, watchMode, showDrafts } = ctx;
  const uiColors = loadInternals().ui;

  // 代码内置最小集（紧急回退）：data/quotes.json5 与自定义 source 均不可用时的最后兜底。
  // 仅保留逐条可核验的公版名句，避免任何来源不明的句子进入产物。
  const BUILTIN_QUOTES = normalizeQuoteList([
    {
      text: '学而不思则罔，思而不学则殆。',
      textEn: 'Learning without thought ends in bewilderment; thought without learning ends in peril.',
      author: '孔子', authorEn: 'Confucius',
      source: '《论语·为政》', sourceEn: 'The Analects · Wei Zheng · trans. S-ynapse',
      tags: ['读书', '哲思']
    },
    {
      text: '千里之行，始于足下。',
      textEn: "A journey of a thousand li begins under one's feet.",
      author: '老子', authorEn: 'Laozi',
      source: '《道德经·第六十四章》', sourceEn: 'Dao De Jing · Chapter 64 · trans. S-ynapse',
      tags: ['励志']
    },
    {
      text: '纸上得来终觉浅，绝知此事要躬行。',
      textEn: 'What is learned from paper is shallow in the end; to truly know a matter, one must practise it.',
      author: '陆游', authorEn: 'Lu You',
      source: '《冬夜读书示子聿》', sourceEn: 'Reading on a Winter Night, to My Son Ziyu · trans. S-ynapse',
      tags: ['读书']
    },
    {
      text: 'To be, or not to be, that is the question.',
      author: '莎士比亚', authorEn: 'William Shakespeare',
      source: '《哈姆雷特》', sourceEn: 'Hamlet',
      tags: ['哲思']
    },
    {
      text: 'The fool doth think he is wise, but the wise man knows himself to be a fool.',
      author: '莎士比亚', authorEn: 'William Shakespeare',
      source: '《皆大欢喜》', sourceEn: 'As You Like It',
      tags: ['智慧', '幽默']
    }
  ]);
  // Filter out draft articles unless SHOW_DRAFTS is active
  function getPublished(articles) {
    const now = new Date();
    return articles.filter(a => (!a.draft || showDrafts) && !isScheduled(a, now));
  }

  // 读取引语文件（.json/.json5，接受顶层数组或 { quotes: [...] } 包装），返回归一化条目。
  // 抛出的错误由调用方统一降级处理。
  function loadQuoteFile(file) {
    const raw = fs.readFileSync(file, 'utf-8');
    const json5 = ctx.getJson5();
    const parsed = /\.json5$/i.test(file) && json5 ? json5.parse(raw) : JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.quotes) ? parsed.quotes : []);
    const quotes = normalizeQuoteList(list);
    if (!quotes.length) throw new Error('文件中没有可用引语');
    return quotes;
  }

  // 每日一言解析优先级：
  //   1) source 为自定义 .json/.json5 路径 → 读取该文件（失败告警后继续回退）；
  //   2) source 为 'builtin'（默认）→ 优先读取 dataFile（默认 data/quotes.json5），缺失即告警；
  //   3) 最后回退代码内置最小集。
  // 所有路径统一应用 count 池大小语义（0/缺省 = 全部；>0 = 稳定顺序取前 N）。
  function resolveDailyQuotes(config) {
    const dq = (config.features && config.features.dailyQuote) || {};
    const src = typeof dq.source === 'string' ? dq.source.trim() : '';
    const count = dq.count;
    const dataFile = typeof dq.dataFile === 'string' && dq.dataFile.trim() ? dq.dataFile.trim() : 'data/quotes.json5';
    if (src && src !== 'builtin') {
      if (!/\.(json|json5)$/i.test(src)) {
        console.warn('  [WARN] dailyQuote.source "' + src + '" 不是 .json/.json5 路径,已回退内置引语');
      } else {
        const file = path.isAbsolute(src) ? src : path.join(ctx.rootDir, src);
        try {
          const quotes = loadQuoteFile(file);
          const pool = applyCount(quotes, count);
          console.log('  dailyQuote.source: ' + path.relative(ctx.rootDir, file) + ' (' + pool.length + '/' + quotes.length + ' 条)');
          return pool;
        } catch (err) {
          console.warn('  [WARN] dailyQuote.source "' + src + '" 加载失败 (' + err.message + '),已回退内置引语');
        }
      }
    }
    const builtinFile = path.isAbsolute(dataFile) ? dataFile : path.join(ctx.rootDir, dataFile);
    if (fs.existsSync(builtinFile)) {
      try {
        const quotes = loadQuoteFile(builtinFile);
        const pool = applyCount(quotes, count);
        console.log('  dailyQuote.dataFile: ' + path.relative(ctx.rootDir, builtinFile) + ' (' + pool.length + '/' + quotes.length + ' 条)');
        return pool;
      } catch (err) {
        console.warn('  [WARN] dailyQuote.dataFile "' + dataFile + '" 加载失败 (' + err.message + '),已回退代码内置最小集');
      }
    } else {
      console.warn('  [WARN] dailyQuote.dataFile "' + dataFile + '" 不存在,已回退代码内置最小集');
    }
    return applyCount(BUILTIN_QUOTES, count);
  }
  function faviconFallbackSvg(color) {
    const fill = color || uiColors.faviconFallbackColor;
    const fg = uiColors.faviconForegroundColor;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="' + fill + '"/><g stroke="' + fg + '" stroke-width="4" stroke-linecap="round"><line x1="20" y1="22" x2="44" y2="21"/><line x1="20" y1="22" x2="32" y2="44"/><line x1="44" y1="21" x2="32" y2="44"/></g><g fill="' + fg + '"><circle cx="20" cy="22" r="6.2"/><circle cx="44" cy="21" r="6.2"/><circle cx="32" cy="44" r="6.4"/></g></svg>';
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
  // options.fatal === false 时记录为非阻断告警（进入报告但退出码保持 0，如压缩验证失败已回退）。
  function recordBuildFailure(stage, message, options) {
    const buildErrors = ctx.getBuildErrors();
    if (buildErrors) buildErrors.add(stage, message, options);
  }

  return { getPublished, resolveDailyQuotes, faviconFallbackSvg, readPngSize, resolveFaviconHtml, recordBuildFailure };
}

module.exports = { createHelpersModule };
