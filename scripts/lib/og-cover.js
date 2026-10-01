'use strict';
// OG 封面源选择：与构建期「损坏/被策略拦截头图回退」保持同语义。
// build.js 在生成 OG 前把本轮损坏媒体引用（sharp 处理失败 ∪ 内容策略拦截）落盘，
// generate-og 读取后跳过这些封面源、改用默认模板 OG，并让缓存键不再包含封面 stat，
// 使策略/文件状态翻转时不会复用旧封面合成图。
const fs = require('fs');
const path = require('path');
const { configFingerprint } = require('./asset-cache');

const BROKEN_MEDIA_FILENAME = 'broken-media.json';

/**
 * 损坏媒体清单文件的默认位置（站点根 + internals.paths.cacheDir）。
 * @param {string} root 站点根目录
 * @param {string} cacheDir 缓存目录（相对根或绝对路径）
 * @returns {string} 绝对路径
 */
function defaultBrokenMediaPath(root, cacheDir) {
  return path.join(path.resolve(root), String(cacheDir || '.cache'), BROKEN_MEDIA_FILENAME);
}

/**
 * 读取损坏媒体清单；缺失 / 解析失败 / 非数组一律视为空清单（OG 生成不因此中断）。
 * @param {string} filePath
 * @returns {string[]}
 */
function readBrokenMediaManifest(filePath) {
  if (!filePath) return [];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item) => typeof item === 'string' && item !== '');
}

/**
 * 选择 OG 封面源：frontmatter cover 优先于 featuredImage；命中损坏清单则跳过。
 * @param {Object|null} attrs frontmatter 属性
 * @param {(ref: string) => boolean} [isBroken] 损坏媒体匹配器
 * @returns {{cover: string, skipped: boolean}}
 */
function selectCoverSource(attrs, isBroken) {
  const a = attrs && typeof attrs === 'object' ? attrs : {};
  const cover = String(a.cover || a.featuredImage || '').trim();
  if (!cover) return { cover: '', skipped: false };
  if (typeof isBroken === 'function' && isBroken(cover)) return { cover: '', skipped: true };
  return { cover, skipped: false };
}

/**
 * 构造单篇文章的 OG 缓存指纹：封面文件 stat 参与哈希，封面不可用（无 stat）时
 * 退化为基准指纹，与「按封面合成」的缓存键互异。
 * @param {string} baseFingerprint 全局 OG 指纹
 * @param {{mtimeMs: number, size: number}|null} [coverStats]
 * @returns {string}
 */
function buildArticleOgKey(baseFingerprint, coverStats) {
  if (!coverStats) return baseFingerprint;
  return configFingerprint([baseFingerprint, coverStats.mtimeMs, coverStats.size]);
}

module.exports = { BROKEN_MEDIA_FILENAME, defaultBrokenMediaPath, readBrokenMediaManifest, selectCoverSource, buildArticleOgKey };
