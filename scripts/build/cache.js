'use strict';
// 构建缓存读写模块（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createCacheModule(ctx) 注入缓存文件路径；writeFileAtomicSync 直连 ./lib/atomic-write。
const fs = require('fs');
const { writeFileAtomicSync } = require('../lib/atomic-write');

function createCacheModule(ctx) {
  const { buildCachePath } = ctx;

  // Build cache: source mtime+size+config fingerprint per media image / OG cover,
  // plus page fingerprints (incremental rendering) keyed by output relPath.
  // Best-effort only — a corrupt or missing cache never fails the build.
  function loadBuildCache() {
    try {
      const raw = JSON.parse(fs.readFileSync(buildCachePath, 'utf-8'));
      return {
        version: 1,
        media: raw && raw.media && typeof raw.media === 'object' ? raw.media : {},
        og: raw && raw.og && typeof raw.og === 'object' ? raw.og : {},
        pages: raw && raw.pages && typeof raw.pages === 'object' ? raw.pages : {}
      };
    } catch (e) {
      return { version: 1, media: {}, og: {}, pages: {} };
    }
  }

  function saveBuildCache(cache) {
    try {
      writeFileAtomicSync(buildCachePath, JSON.stringify(cache));
    } catch (e) {
      console.warn('  [WARN] Failed to write .build-cache.json: ' + e.message);
    }
  }

  return { loadBuildCache, saveBuildCache };
}

module.exports = { createCacheModule };
