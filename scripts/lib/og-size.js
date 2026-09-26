'use strict';

// og-size: OG 图片尺寸解析（纯函数，无副作用）
// 规则：
//   1. 显式 width+height（同时提供且为正数）始终优先，不做上限；
//   2. 否则自动检测：站点文章封面图中，仅 1 张 → 用该图尺寸；多张 → 取面积最大者
//      （面积相同时优先更宽，再优先更高）；0 张 → 默认 1200x630；
//   3. 自动检测结果长边超过 maxDimension（默认 2560）时等比缩小（保持宽高比，四舍五入且不小于 1）；
//   4. autoSize:false 时忽略封面统计，直接回退默认尺寸（显式配置仍优先）。

const DEFAULT_OG_SIZE = Object.freeze({ width: 1200, height: 630 });
const MAX_OG_DIMENSION = 2560;

function isPositiveNumber(value) {
  return Number.isFinite(+value) && +value > 0;
}

function pickLargest(covers) {
  let best = null;
  for (const cover of covers) {
    const width = Math.round(+cover.width);
    const height = Math.round(+cover.height);
    if (!best) {
      best = { width, height };
      continue;
    }
    const area = width * height;
    const bestArea = best.width * best.height;
    if (area > bestArea) {
      best = { width, height };
    } else if (area === bestArea && (width > best.width || (width === best.width && height > best.height))) {
      best = { width, height };
    }
  }
  return best;
}

// collectCoverSizesFromManifest：从已解析文章列表 + 媒体 manifest 提取显式封面尺寸，
// 供构建期 resolveOgSize 使用。口径与 generate-og.js 的 collectCoverSizes 一致：
// 跳过草稿与无封面项，同一路径只计一次，manifest 缺失尺寸的条目跳过。
function collectCoverSizesFromManifest(articles, manifest) {
  const sizes = [];
  const seen = new Set();
  for (const article of Array.isArray(articles) ? articles : []) {
    if (!article || article.draft) continue;
    const cover = String(article.featuredImage || '').trim();
    if (!cover) continue;
    const key = cover.replace(/^\//, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = manifest && manifest[key];
    const width = entry ? Math.round(+entry.width) : 0;
    const height = entry ? Math.round(+entry.height) : 0;
    if (width > 0 && height > 0) sizes.push({ width, height });
  }
  return sizes;
}

function resolveOgSize(options = {}) {
  const explicitWidth = options.explicitWidth;
  const explicitHeight = options.explicitHeight;
  if (isPositiveNumber(explicitWidth) && isPositiveNumber(explicitHeight)) {
    return { width: Math.round(+explicitWidth), height: Math.round(+explicitHeight), source: 'explicit', scaled: false };
  }
  if (options.autoSize === false) {
    return { ...DEFAULT_OG_SIZE, source: 'default', scaled: false };
  }
  const covers = Array.isArray(options.covers) ? options.covers : [];
  const valid = covers.filter((cover) => cover && isPositiveNumber(cover.width) && isPositiveNumber(cover.height));
  if (!valid.length) {
    return { ...DEFAULT_OG_SIZE, source: 'default', scaled: false };
  }
  const picked = pickLargest(valid);
  const source = valid.length === 1 ? 'single' : 'largest';
  const cap = isPositiveNumber(options.maxDimension) ? Math.round(+options.maxDimension) : MAX_OG_DIMENSION;
  const longEdge = Math.max(picked.width, picked.height);
  if (longEdge <= cap) {
    return { ...picked, source, scaled: false };
  }
  const ratio = cap / longEdge;
  return {
    width: Math.max(1, Math.round(picked.width * ratio)),
    height: Math.max(1, Math.round(picked.height * ratio)),
    source,
    scaled: true,
  };
}

module.exports = { resolveOgSize, collectCoverSizesFromManifest, DEFAULT_OG_SIZE, MAX_OG_DIMENSION };
