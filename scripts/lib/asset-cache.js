'use strict';

const crypto = require('crypto');
const fs = require('fs');

/**
 * 缓存产物是否超过兜底重验证天数（TTL）。
 * ttlDays <= 0 时恒为 false（仅按内容键判定，保持历史行为）；
 * 文件缺失或不可 stat 时视为已过期（返回 true，调用方重新生成）。
 */
function ttlExpired(filePath, ttlDays, now) {
  const days = Number(ttlDays);
  if (!Number.isFinite(days) || days <= 0) return false;
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    return true;
  }
  const current = Number.isFinite(now) ? now : Date.now();
  return current - stats.mtimeMs > days * 24 * 60 * 60 * 1000;
}

/**
 * 构建缓存键：源文件 mtime + size + 配置指纹。mtime 取整秒级以下会被
 * 截断，避免浮点噪声导致无谓失效；缺失字段按 0 处理，保证确定性。
 */
function buildCacheKey(stats, configHash) {
  const mtime = stats && Number.isFinite(stats.mtimeMs) ? Math.floor(stats.mtimeMs) : 0;
  const size = stats && Number.isFinite(stats.size) ? stats.size : 0;
  return mtime + ':' + size + ':' + String(configHash || '');
}

/** 配置指纹：把影响产物的配置片段稳定散列为 10 位十六进制。 */
function configFingerprint(parts) {
  return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 10);
}

function isFresh(cache, id, key) {
  return !!cache && cache[id] === key;
}

/** 取缓存记录（{ key, ...payload }）：键匹配时返回记录，否则 null。 */
function getFresh(cache, id, key) {
  const record = cache && cache[id];
  return record && record.key === key ? record : null;
}

function updateEntry(cache, id, key) {
  cache[id] = key;
  return cache;
}

/** 清理缓存中已不存在的条目（源文件/文章已删除）。 */
function pruneTo(cache, validIds) {
  const keep = new Set(Array.isArray(validIds) ? validIds : []);
  for (const id of Object.keys(cache || {})) {
    if (!keep.has(id)) delete cache[id];
  }
  return cache;
}

module.exports = { buildCacheKey, configFingerprint, isFresh, getFresh, updateEntry, pruneTo, ttlExpired };
