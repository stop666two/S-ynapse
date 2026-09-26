'use strict';
// 无封面文章封面自动生成（scripts/build/auto-cover.js，构建接线）。
// 职责：为「已发布且 frontmatter 无 featuredImage」的文章生成列表卡片与文章页封面。
//   - 产物：<dist>/og/cover-<slug>.<hash8>.<ext>（内容寻址命名；/og/* 已有 _headers 缓存规则，
//     并被 sitemap 与 cache-bust 忽略——URL 自带哈希，无需再改写）；
//   - 缓存：.cache/covers/<文件名>（文件名即缓存键，命中直接拷入 dist，不重复渲染）；
//   - 主题：取 config.theme.colors.primary/secondary 与 darkMode.colors.text；缺失/非法时跳过
//     （返回空映射，页面回退 pattern/无图），不内置兜底配色；
//   - 失败降级：单篇失败仅 console.warn 并跳过（不调用 recordBuildFailure，避免阻断构建），
//     失败时保留旧缓存与旧产物供后续参考；
//   - 与 generate-og.js 的边界：自动封面位于 dist/og/ 根层，generate-og 只清理 og/<lang>/ 子目录，
//     两者互不误删；本模块也只清理 .cache/covers/ 内符合 cover-<slug>.<hash8>.<ext> 模式的旧条目。
const fs = require('fs');
const path = require('path');
const {
  resolveAutoCoverConfig,
  resolveAutoCoverColors,
  autoCoverHash,
  autoCoverFileName,
  isAutoCoverFileName,
  buildAutoCoverSvg
} = require('../lib/auto-cover');
const { atomicTempPath, commitAtomicTemp, discardAtomicTemp } = require('../lib/atomic-write');

function createAutoCoverModule(ctx) {
  const logger = ctx.logger || console;

  function coversDistDir() {
    return path.join(ctx.distDir, 'og');
  }

  function coversCacheDir() {
    return ctx.cacheDir || path.join(ctx.rootDir, '.cache', 'covers');
  }

  // 单篇文章 → 生成参数（配置、颜色、hash、文件名、URL）。任一前置条件不满足返回 null。
  function buildArticleInput(config, article, cfg) {
    const colors = resolveAutoCoverColors(config.theme);
    if (!colors) return null;
    const site = config.site || {};
    const lang = article.lang || 'zh';
    const siteName = (lang === 'en' && site.titleEn) ? site.titleEn : (site.title || '');
    const category = (Array.isArray(article.categories) && article.categories[0]) || article.series || '';
    const hash = autoCoverHash({
      title: article.title,
      siteName,
      category,
      primary: colors.primary,
      secondary: colors.secondary,
      titleColor: colors.titleColor,
      backgroundStyle: cfg.backgroundStyle,
      showSiteName: cfg.showSiteName,
      showCategory: cfg.showCategory,
      width: cfg.width,
      height: cfg.height,
      format: cfg.format
    });
    const fileName = autoCoverFileName(article.slug, hash, cfg.ext);
    return {
      fileName,
      url: '/og/' + fileName,
      svgInput: {
        title: article.title,
        siteName,
        category,
        width: cfg.width,
        height: cfg.height,
        primary: colors.primary,
        secondary: colors.secondary,
        titleColor: colors.titleColor,
        siteNameColor: colors.siteName,
        backgroundStyle: cfg.backgroundStyle,
        showSiteName: cfg.showSiteName,
        showCategory: cfg.showCategory
      }
    };
  }

  // SVG → sharp 栅格化 → 原子写入目标路径（临时文件 + rename，抗中断/抗占用）。
  async function renderCover(filePath, svgInput, format) {
    const svg = Buffer.from(buildAutoCoverSvg(svgInput), 'utf8');
    const tmp = atomicTempPath(filePath);
    try {
      const pipeline = ctx.sharp(svg);
      await (format === 'jpeg'
        ? pipeline.jpeg({ quality: 82, mozjpeg: true })
        : pipeline.webp({ quality: 82 })).toFile(tmp);
      commitAtomicTemp(tmp, filePath);
    } catch (err) {
      discardAtomicTemp(tmp);
      throw err;
    }
  }

  // 缓存目录清理：只删「本模块命名模式且本次不再需要」的条目；失败轮次不清理（保守保留）。
  function pruneCoversCache(needed) {
    const dir = coversCacheDir();
    if (!fs.existsSync(dir)) return 0;
    let removed = 0;
    for (const name of fs.readdirSync(dir)) {
      if (!isAutoCoverFileName(name) || needed.has(name)) continue;
      try {
        fs.rmSync(path.join(dir, name), { force: true });
        removed++;
      } catch (err) {
        logger.warn('  [WARN] auto cover: 清理旧缓存失败 ' + name + ': ' + err.message);
      }
    }
    return removed;
  }

  // 入口：生成/复用全部自动封面，返回 { '<lang>/<slug>': { url, width, height } }。
  // build.js 将其存入活值并经 pages 模块注入模板（无 featuredImage 的卡片/文章页头图使用）。
  async function generateAutoCovers(config, articles) {
    const features = (config && config.features) || {};
    const cfg = resolveAutoCoverConfig((features.listCover || {}).autoGenerate);
    const covers = {};
    if (!cfg.enabled) {
      logger.log('  [SKIP] Auto covers disabled (features.listCover.autoGenerate.enabled=false)');
      return covers;
    }
    if (!ctx.sharp) {
      logger.warn('  [WARN] auto cover: sharp 不可用，跳过生成（回退 pattern/无图）');
      return covers;
    }
    const published = ctx.getPublished ? ctx.getPublished(articles) : (articles || []);
    const targets = (published || []).filter((a) => a && !a.draft && !a.featuredImage);
    if (!targets.length) {
      logger.log('  Auto covers: no cover-less published article, nothing to generate');
      return covers;
    }
    logger.log('  Generating auto covers...');
    // 目录创建属于系统性前置条件（权限/磁盘），失败时整体跳过而非阻断构建。
    try {
      fs.mkdirSync(coversCacheDir(), { recursive: true });
      fs.mkdirSync(coversDistDir(), { recursive: true });
    } catch (err) {
      logger.warn('  [WARN] auto cover: 输出/缓存目录创建失败，跳过生成（回退 pattern/无图）: ' + err.message);
      return covers;
    }

    const needed = new Set();
    let made = 0;
    let reused = 0;
    let failed = 0;
    for (const article of targets) {
      const lang = article.lang || 'zh';
      let input;
      try {
        input = buildArticleInput(config, article, cfg);
      } catch (err) {
        failed++;
        logger.warn('  [WARN] auto cover: ' + lang + '/' + article.slug + ' 参数构建失败: ' + err.message);
        continue;
      }
      if (!input) {
        failed++;
        logger.warn('  [WARN] auto cover: theme 缺少 primary/secondary，跳过 ' + lang + '/' + article.slug);
        continue;
      }
      needed.add(input.fileName);
      const cachePath = path.join(coversCacheDir(), input.fileName);
      const outPath = path.join(coversDistDir(), input.fileName);
      try {
        const cached = fs.existsSync(cachePath);
        if (!cached) await renderCover(cachePath, input.svgInput, cfg.format);
        const tmp = atomicTempPath(outPath);
        try {
          fs.copyFileSync(cachePath, tmp);
          commitAtomicTemp(tmp, outPath);
        } catch (copyErr) {
          discardAtomicTemp(tmp);
          throw copyErr;
        }
        covers[lang + '/' + article.slug] = { url: input.url, width: cfg.width, height: cfg.height };
        if (cached) reused++;
        else made++;
      } catch (err) {
        failed++;
        logger.warn('  [WARN] auto cover: ' + lang + '/' + article.slug + ' 生成失败: ' + err.message);
      }
    }
    if (failed === 0) {
      const pruned = pruneCoversCache(needed);
      if (pruned) logger.log('  Auto covers cache: ' + pruned + ' stale file(s) removed');
    } else {
      logger.warn('  [WARN] auto cover: ' + failed + ' 篇生成失败，跳过缓存清理');
    }
    logger.log('  Auto covers: made ' + made + ', reused ' + reused + ', failed ' + failed);
    return covers;
  }

  return { generateAutoCovers };
}

module.exports = { createAutoCoverModule };
