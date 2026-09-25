'use strict';
// CJK 字体子集化管线（scripts/build/cjk-fonts.js）。
// 构建后期运行：扫描 dist 全部 HTML 收集实际用字 → 复用/下载 Noto Sans SC woff2 分片
// （缓存 .cache/fonts/<url 哈希>.woff2 + chunk-list.json；首次联网、之后离线可复用）→
// 写 dist/assets/fonts/<slug>/ 与 dist/assets/css/cjk-fonts.css，并把 HTML 内的固定引用
// 改带内容哈希查询串（该 CSS 位于 /assets/css/* immutable 目录，避免回访缓存陈旧）。
// 失败（断网/超时/解析失败/载荷异常）不抛出：告警、清理半套产物、剥离 HTML 引用，回退系统字体。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { getAllFiles } = require('./fs-utils');
const cjk = require('../lib/cjk-fonts');

const CHUNK_LIST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DOWNLOAD_CONCURRENCY = 6;
const FONT_DISPLAY_ALLOWED = ['auto', 'block', 'swap', 'fallback', 'optional'];

function readCjkConfig(config) {
  const raw = (config && config.site && config.site.build && config.site.build.cjkFonts) || {};
  const timeout = Number(raw.fetchTimeoutMs);
  const display = (config && config.site && config.site.performance && config.site.performance.fontDisplay) || 'swap';
  const weights = Array.isArray(raw.weights) && raw.weights.length ? raw.weights : cjk.DEFAULT_WEIGHTS;
  return {
    enabled: raw.enabled !== false,
    family: typeof raw.family === 'string' && raw.family.trim() ? raw.family.trim() : 'Noto Sans SC',
    weights: cjk.normalizeWeights(weights),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : cjk.DEFAULT_TIMEOUT_MS,
    fontDisplay: FONT_DISPLAY_ALLOWED.indexOf(display) >= 0 ? display : 'swap'
  };
}

// 并发受限的任务池（下载分片最多 6 路并行；失败即由 Promise.all 汇总抛出）。
async function mapPool(items, limit, worker) {
  const size = Math.max(1, Math.min(limit, items.length));
  let index = 0;
  const runners = [];
  for (let i = 0; i < size; i++) {
    runners.push((async () => {
      while (index < items.length) {
        const current = index++;
        await worker(items[current], current);
      }
    })());
  }
  await Promise.all(runners);
}

function createCjkFontsModule(ctx) {
  const distDir = ctx.distDir;
  const cacheDir = ctx.cacheDir;
  const logger = ctx.logger || console;
  const fetchImpl = ctx.fetchImpl || undefined;
  const chunkListCacheFile = path.join(cacheDir, 'chunk-list.json');
  const linkRx = new RegExp('<link\\b[^>]*href=["\']?' + cjk.CJK_CSS_HREF.replace(/\//g, '\\/') + '(?:\\?v=[^"\'\\s>]*)?["\']?[^>]*>', 'gi');

  function htmlFiles() {
    return getAllFiles(distDir).filter((file) => /\.html?$/i.test(file));
  }

  // 用字来源：全部 HTML（正文/属性/内联 JSON）+ 产出 JSON（外部化运行时配置等仅客户端渲染的文案；
  // 搜索索引/feed 在子集化之后才生成，其文案均已在页面 HTML 中出现）。
  function collectDistTexts() {
    const texts = [];
    for (const file of getAllFiles(distDir)) {
      if (/\.html?$/i.test(file)) texts.push(...cjk.extractHtmlTexts(fs.readFileSync(file, 'utf-8')));
      else if (/\.json$/i.test(file)) texts.push(fs.readFileSync(file, 'utf-8'));
    }
    return texts;
  }

  function readChunkListCache(cssUrl) {
    try {
      const data = JSON.parse(fs.readFileSync(chunkListCacheFile, 'utf-8'));
      if (data && data.url === cssUrl && Array.isArray(data.chunks) && data.chunks.length) {
        return { chunks: data.chunks, fetchedAt: Number(data.fetchedAt) || 0 };
      }
    } catch (e) { /* 缓存缺失/损坏一律按无缓存处理 */ }
    return null;
  }

  async function loadChunkList(cssUrl, timeoutMs) {
    const cached = readChunkListCache(cssUrl);
    if (cached && Date.now() - cached.fetchedAt < CHUNK_LIST_TTL_MS) return { chunks: cached.chunks, cached: true };
    try {
      const chunks = await cjk.fetchChunkList({ cssUrl, timeoutMs, fetchImpl });
      fs.mkdirSync(cacheDir, { recursive: true });
      writeFileAtomicSync(chunkListCacheFile, JSON.stringify({ url: cssUrl, fetchedAt: Date.now(), chunks }, null, 2), 'utf-8');
      return { chunks, cached: false };
    } catch (err) {
      if (cached) {
        logger.warn('[cjk-fonts] 字体清单拉取失败，复用过期缓存: ' + err.message);
        return { chunks: cached.chunks, cached: true };
      }
      throw err;
    }
  }

  async function materializePlan(plan, cfg) {
    const slug = cjk.fontFamilySlug(cfg.family);
    const outDir = path.join(distDir, 'assets', 'fonts', slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    const unique = [];
    const seen = new Set();
    for (const entry of plan) {
      if (seen.has(entry.file)) continue;
      seen.add(entry.file);
      unique.push(entry);
    }
    const stats = { bytes: 0, downloaded: 0, reused: 0, files: unique.length, outDir };
    await mapPool(unique, DOWNLOAD_CONCURRENCY, async (entry) => {
      const cacheFile = path.join(cacheDir, entry.file);
      let buf;
      if (fs.existsSync(cacheFile)) {
        buf = fs.readFileSync(cacheFile);
        stats.reused += 1;
      } else {
        buf = await cjk.downloadFontChunk(entry.url, { timeoutMs: cfg.timeoutMs, fetchImpl });
        writeFileAtomicSync(cacheFile, buf);
        stats.downloaded += 1;
      }
      writeFileAtomicSync(path.join(outDir, entry.file), buf);
      stats.bytes += buf.length;
    });
    return stats;
  }

  function writeFontCss(plan, cfg) {
    const slug = cjk.fontFamilySlug(cfg.family);
    const css = cjk.buildFontCss(plan, {
      fontFamily: cfg.family,
      urlPrefix: '/assets/fonts/' + slug + '/',
      fontDisplay: cfg.fontDisplay
    });
    const file = path.join(distDir, cjk.CJK_CSS_HREF.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeFileAtomicSync(file, css, 'utf-8');
    const hash = crypto.createHash('sha1').update(css).digest('hex').slice(0, 10);
    return { file, href: cjk.CJK_CSS_HREF + '?v=' + hash };
  }

  function updateHtmlRefs(transform) {
    for (const file of htmlFiles()) {
      try {
        const html = fs.readFileSync(file, 'utf-8');
        const next = transform(html);
        if (next !== html) writeFileAtomicSync(file, next, 'utf-8');
      } catch (err) {
        logger.warn('[cjk-fonts] HTML 引用更新失败 ' + path.basename(file) + ': ' + err.message);
      }
    }
  }

  function stripHtmlRefs() {
    updateHtmlRefs((html) => html.replace(linkRx, ''));
  }

  function cleanupDist(cfg) {
    const slugDir = path.join(distDir, 'assets', 'fonts', cjk.fontFamilySlug(cfg.family));
    fs.rmSync(slugDir, { recursive: true, force: true });
    const fontsParent = path.dirname(slugDir);
    try {
      if (fs.existsSync(fontsParent) && fs.readdirSync(fontsParent).length === 0) fs.rmdirSync(fontsParent);
    } catch (e) { /* 尽力清理，不影响降级 */ }
    fs.rmSync(path.join(distDir, cjk.CJK_CSS_HREF.replace(/^\//, '')), { force: true });
  }

  async function buildCjkFonts(config) {
    const cfg = readCjkConfig(config);
    if (!cfg.enabled) return { ok: false, skipped: true, reason: 'disabled by config' };
    const cssUrl = cjk.googleFontsCssUrl({ family: cfg.family, weights: cfg.weights });
    try {
      const chunkList = await loadChunkList(cssUrl, cfg.timeoutMs);
      const codepoints = cjk.collectUsedCodepoints(collectDistTexts());
      if (!codepoints.length) throw new Error('no CJK codepoints found in dist HTML');
      const plan = cjk.buildSubsetPlan(chunkList.chunks, codepoints);
      if (!plan.length) throw new Error('no font chunk intersects used codepoints');
      const fonts = await materializePlan(plan, cfg);
      const css = writeFontCss(plan, cfg);
      updateHtmlRefs((html) => html.split(cjk.CJK_CSS_HREF).join(css.href));
      logger.log('  CJK fonts: ' + plan.length + '/' + chunkList.chunks.length + ' chunks, '
        + fonts.files + ' files (' + Math.round(fonts.bytes / 1024) + 'KB), downloaded ' + fonts.downloaded
        + ', reused ' + fonts.reused + (chunkList.cached ? ', list-cache' : ''));
      return {
        ok: true, skipped: false, family: cfg.family, weights: cfg.weights,
        kept: plan.length, total: chunkList.chunks.length, codepoints: codepoints.length,
        bytes: fonts.bytes, files: fonts.files, downloaded: fonts.downloaded, reused: fonts.reused,
        cssHref: css.href, chunkListCached: chunkList.cached
      };
    } catch (err) {
      cleanupDist(cfg);
      stripHtmlRefs();
      logger.warn('[cjk-fonts] ' + err.message + '；跳过子集化，回退系统字体（构建继续）');
      return { ok: false, skipped: false, reason: err.message };
    }
  }

  return { buildCjkFonts };
}

module.exports = { createCjkFontsModule };
