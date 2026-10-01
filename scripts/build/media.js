'use strict';
// 媒体与静态资产（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createMediaModule(ctx) 注入路径、缓存加载器与构建错误收集器。
const fs = require('fs');
const path = require('path');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { classifyFile, sanitizeSvg } = require('../lib/content-policy');
const { buildCacheKey, configFingerprint, getFresh, pruneTo, ttlExpired } = require('../lib/asset-cache');
const { getAllFiles } = require('./fs-utils');
const { loadInternals } = require('../lib/internals');

function createMediaModule(ctx) {
  const MEDIA_TTL_DAYS = loadInternals().cache.mediaTtlDays;
  // 本轮媒体优化失败的 /media/ 引用（源文件存在但 sharp 无法处理）：供 build.js 把
  // 指向它们的 featuredImage 回退为自动封面/pattern；每次 optimizeMedia 开始时重置。
  let brokenMedia = new Set();
  // 最近一轮 optimizeMedia 的计数（优化/复用/失败/候选），供构建报告「缓存命中」区块读取。
  let lastOptimizeStats = null;
  // Create the output directory structure under dist/.
  // If cleanDist is enabled, removes the entire dist/ first.
  // Required subdirectories: articles/, tags/, categories/, page/
  function setupDist(config) {
    console.log('[2/14] Setting up dist directory...');
    if (config.site.build.cleanDist && fs.existsSync(ctx.distDir)) {
      fs.rmSync(ctx.distDir, { recursive: true, force: true });
      console.log('  Cleaned dist/');
    }
    if (!fs.existsSync(ctx.distDir)) fs.mkdirSync(ctx.distDir, { recursive: true });
  }

  // Copy everything from static/ into dist/ as-is.
  // This covers: icons, media assets, fonts, and any other unprocessed files.
  function copyStatic(config) {
    if (!config.site.build.copyStatic || !fs.existsSync(ctx.staticDir)) {
      console.log('  [SKIP] Static copy disabled or static/ not found');
      return;
    }
    console.log('[3/14] Copying static files...');
    copyDirSync(ctx.staticDir, ctx.distDir);
  }

  // Recursive directory copy — creates destination directories on the fly.
  function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Apply the content policy (content-policy.json5) to videos/, assets/, and the
  // non-sharp-optimized part of media/ (svg sanitized, gif/avif/bmp/ico raw copy).
  // Violations are NOT copied → the deployed URL naturally 404s.
  // Returns { copied, blocked: [{ path, reason }] } for the build report.
  function copyProtectedAssets(config) {
    const policy = config.contentPolicy || {};
    if (policy.enabled === false) {
      console.log('  [SKIP] Content policy disabled');
      return { copied: 0, blocked: [] };
    }
    console.log('  [POLICY] Applying content policy to videos/, assets/, media/...');
    const blocked = [];
    let copied = 0;

    const copyFiltered = (srcDir, destDir, srcCategory) => {
      if (!fs.existsSync(srcDir)) return;
      for (const srcPath of getAllFiles(srcDir)) {
        const rel = path.relative(srcDir, srcPath);
        const baseName = rel.replace(/\\/g, '/').split('/').pop().toLowerCase();
        if (baseName === '.gitkeep') continue; // directory placeholder, never published
        const verdict = classifyFile(rel, srcCategory, policy);
        if (!verdict.allowed) {
          blocked.push({ path: `${srcCategory}/${rel.replace(/\\/g, '/')}`, reason: verdict.reason });
          continue;
        }
        const destPath = path.join(destDir, rel);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        copied++;
      }
    };

    copyFiltered(ctx.assetsDir, path.join(ctx.distDir, 'assets'), 'assets');
    copyFiltered(ctx.videosDir, path.join(ctx.distDir, 'videos'), 'videos');

    // media/: files sharp does not handle are copied verbatim here (svg after
    // sanitization). Files classified 'media-optimized' are left to optimizeMedia().
    if (policy.svgSanitize !== false && fs.existsSync(ctx.mediaDir)) {
      const mediaDest = path.join(ctx.distDir, 'media');
      for (const srcPath of getAllFiles(ctx.mediaDir)) {
        const rel = path.relative(ctx.mediaDir, srcPath);
        const baseName = rel.replace(/\\/g, '/').split('/').pop().toLowerCase();
        if (baseName === '.gitkeep') continue;
        const verdict = classifyFile(rel, 'media', policy);
        if (!verdict.allowed) {
          blocked.push({ path: `media/${rel.replace(/\\/g, '/')}`, reason: verdict.reason });
          continue;
        }
        if (verdict.category === 'media-optimized') continue;
        const destPath = path.join(mediaDest, rel);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        if (/\.svg$/i.test(srcPath)) {
          const svg = sanitizeSvg(fs.readFileSync(srcPath, 'utf-8'));
          if (!svg.safe) {
            blocked.push({ path: `media/${rel.replace(/\\/g, '/')}`, reason: 'svg-unsafe' });
            continue;
          }
          writeFileAtomicSync(destPath, svg.content, 'utf-8');
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
        copied++;
      }
    }

    if (blocked.length) {
      console.warn(`  [POLICY] Blocked ${blocked.length} file(s) by content policy:`);
      for (const b of blocked) console.warn(`    - ${b.path} (${b.reason})`);
    } else {
      console.log(`  [POLICY] Copied ${copied} protected asset(s), no violations`);
    }
    return { copied, blocked };
  }

  // Optimize images from media/ using sharp.
  // Copy one processed media file from the persistent cache into dist/media.
  function copyMediaOutput(rel) {
    const src = path.join(ctx.mediaCacheDir, rel);
    const dest = path.join(ctx.distDir, 'media', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  // Generates responsive variants at configured sizes and formats (WebP + original).
  // Output: dist/media/ with a media-manifest.json mapping original paths to variants.
  // The manifest is consumed by setupMarkedRenderer for <picture>/<img> tag generation.
  // Returns the manifest object, or null if disabled/sharp unavailable.
  async function optimizeMedia(config) {
    brokenMedia = new Set();
    lastOptimizeStats = null;
    if (!config.site.build.optimizeMedia || !ctx.sharp) {
      console.log('  [SKIP] Media optimization disabled or sharp not available');
      return null;
    }
    console.log('[4/14] Optimizing media...');
    if (!fs.existsSync(ctx.mediaDir)) {
      console.log('  media/ directory not found, skipping');
      return null;
    }
    const manifest = {};
    const sizes = config.site.build.mediaResponsiveSizes;
    const quality = config.site.build.mediaQuality;
    const avifCfg = config.site.build.avif;
    const formats = config.site.build.mediaFormats;
    const destDir = path.join(ctx.distDir, 'media');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    if (!fs.existsSync(ctx.mediaCacheDir)) fs.mkdirSync(ctx.mediaCacheDir, { recursive: true });
    const images = getAllFiles(ctx.mediaDir).filter(f => /\.(jpg|jpeg|png|gif|tiff|webp)$/i.test(f));
    const cache = ctx.loadBuildCache();
    const mediaCache = cache.media;
    const mediaFingerprint = configFingerprint([sizes, quality, avifCfg, formats, (config.features && config.features.imageLazy) || {}]);
    const seenIds = [];
    let count = 0;
    let skipped = 0;
    const processImage = async (imgPath) => {
      const relPath = path.relative(ctx.mediaDir, imgPath);
      const parsed = path.parse(relPath);
      const ext = parsed.ext.toLowerCase();
      const supportedExts = ['.jpg', '.jpeg', '.png', '.tiff', '.webp'];
      if (!supportedExts.includes(ext)) return;
      const cacheId = 'media/' + relPath.replace(/\\/g, '/');
      seenIds.push(cacheId);
      let stats = null;
      try { stats = fs.statSync(imgPath); } catch (e) { /* 保留 null：文件不可读时走重新生成分支 */ }
      const cacheKey = buildCacheKey(stats, mediaFingerprint);
      const cached = getFresh(mediaCache, cacheId, cacheKey);
      if (cached && Array.isArray(cached.outputs) && cached.outputs.length > 0
        && cached.outputs.every((rel) => fs.existsSync(path.join(ctx.mediaCacheDir, rel)))
        && !ttlExpired(path.join(ctx.mediaCacheDir, cached.outputs[0]), MEDIA_TTL_DAYS)) {
        for (const rel of cached.outputs) copyMediaOutput(rel);
        manifest[cacheId] = cached.entry;
        skipped++;
        return;
      }
      try {
        const metadata = await ctx.sharp(imgPath).metadata();
        const originalWidth = metadata.width;
        const urlDir = parsed.dir ? parsed.dir + '/' : '';
        const entry = { original: `/media/${urlDir}${parsed.base}`, variants: {}, width: originalWidth, height: metadata.height };
        const imageLazyCfg = (config.features && config.features.imageLazy) || {};
        if (imageLazyCfg.lqip !== false) {
          try {
            const lw = Math.max(8, Math.min(64, parseInt(imageLazyCfg.lqipWidth) || 24));
            const buf = await ctx.sharp(imgPath).resize(lw, null, { withoutEnlargement: true }).blur(12).webp({ quality: 30 }).toBuffer();
            entry.lqip = 'data:image/webp;base64,' + buf.toString('base64');
          } catch (e) { /* LQIP 失败不影响主流程 */ }
        }
        const activeFormats = avifCfg.enabled ? ['avif', ...formats.filter(f => f !== 'avif')] : formats;
        const outputs = [];
        for (const size of sizes) {
          if (originalWidth <= size) continue;
          for (const fmt of activeFormats) {
            const suffix = fmt === 'original' ? ext : fmt === 'webp' ? '.webp' : '.avif';
            const variantName = `${parsed.name}-${size}${suffix}`;
            const outPath = path.join(ctx.mediaCacheDir, parsed.dir || '', variantName);
            const outDir = path.dirname(outPath);
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            let pipeline = ctx.sharp(imgPath).resize(size, null, { withoutEnlargement: true });
            if (fmt === 'webp') pipeline = pipeline.webp({ quality });
            else if (fmt === 'avif') pipeline = pipeline.avif({ quality: avifCfg.quality, effort: avifCfg.effort });
            else if (ext === '.png') pipeline = pipeline.png({ quality });
            else pipeline = pipeline.jpeg({ quality });
            await pipeline.toFile(outPath);
            outputs.push(path.relative(ctx.mediaCacheDir, outPath).split(path.sep).join('/'));
            entry.variants[`${size}-${fmt}`] = `/media/${urlDir}${variantName}`;
          }
        }
        const originalDest = path.join(ctx.mediaCacheDir, parsed.dir || '', parsed.base);
        const origDir = path.dirname(originalDest);
        if (!fs.existsSync(origDir)) fs.mkdirSync(origDir, { recursive: true });
        fs.copyFileSync(imgPath, originalDest);
        outputs.push(path.relative(ctx.mediaCacheDir, originalDest).split(path.sep).join('/'));
        for (const rel of outputs) copyMediaOutput(rel);
        manifest[cacheId] = entry;
        mediaCache[cacheId] = { key: cacheKey, entry: entry, outputs: outputs };
        count++;
      } catch (err) {
        // 损坏/零字节/非图片等无法优化的源文件：降级为告警并计入构建报告，
        // 不阻断整站构建（缺失引用已由内容预校验以 fatal 阻断）；同时登记为损坏引用，
        // 使 featuredImage 指向它的文章在页面生成前回退自动封面/pattern。
        brokenMedia.add('/media/' + relPath.replace(/\\/g, '/'));
        console.error(`  [ERROR] Failed to optimize ${relPath}: ${err.message}`);
        ctx.recordBuildFailure('media', `Failed to optimize ${relPath}: ${err.message}`, { fatal: false });
      }
    };
    await Promise.all(images.map(p => processImage(p)));
    pruneTo(mediaCache, seenIds);
    ctx.saveBuildCache(cache);
    const manifestPath = path.join(ctx.distDir, 'media-manifest.json');
    writeFileAtomicSync(manifestPath, JSON.stringify(manifest));
    console.log(`  Optimized ${count} images (reused ${skipped} unchanged)`);
    lastOptimizeStats = { optimized: count, reused: skipped, failed: brokenMedia.size, total: images.length };
    return manifest;
  }

  // 本轮媒体优化失败的 /media/ 引用集合（无失败时为空集合，可变闭包状态）。
  function getBrokenMedia() {
    return brokenMedia;
  }

  // 最近一轮媒体优化统计（未运行时为 null），供构建报告读取。
  function getMediaStats() {
    return lastOptimizeStats;
  }

  return { setupDist, copyStatic, copyProtectedAssets, copyMediaOutput, optimizeMedia, getBrokenMedia, getMediaStats };
}

module.exports = { createMediaModule };
