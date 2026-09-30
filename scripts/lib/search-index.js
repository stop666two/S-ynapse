'use strict';
// 搜索索引构建库（Node 专用封装）：
//   - 配置归一化（features.search.index）；
//   - 调用 js/domains/features/search-core.js 的纯函数生成倒排索引；
//   - gzip 体积测量与低频词裁剪（超出 features.search.index.maxGzipKb 时按文档频率升序裁剪）；
//   - 内容寻址哈希与 featuredImage 的最终路径预计算（与 cacheBust 同规则，避免索引指向未哈希路径）。
// 纯逻辑在 search-core（浏览器/Node 共用）；本模块只做 Node 文件系统与 zlib 相关封装。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const DEFAULT_MAX_GZIP_KB = 60;
const DEFAULT_BUST_PATTERN = /.*\.(css|js|png|jpg|svg)$/i;
const HASHED_NAME_RE = /\.[0-9a-f]{10}$/;

// 归一化 features.search.index：bigram 默认 true；maxGzipKb 非正数/非法值回退 60。
function searchIndexOptions(features) {
  const s = (features && features.search) || {};
  const idx = (s && s.index) || {};
  const raw = idx.maxGzipKb;
  const num = (raw === '' || raw == null || isNaN(+raw)) ? DEFAULT_MAX_GZIP_KB : +raw;
  return {
    bigram: idx.bigram !== false,
    maxGzipKb: num > 0 ? num : DEFAULT_MAX_GZIP_KB
  };
}

// 调用 search-core.buildIndex 生成单语言索引；lang 强制覆盖文档级 lang（按构建语言分文件）。
function buildLanguageIndex(core, docs, options) {
  const opts = options || {};
  const list = (Array.isArray(docs) ? docs : []).map(function (d) {
    const doc = d || {};
    return {
      title: doc.title,
      url: doc.url,
      excerpt: doc.excerpt,
      content: doc.content,
      featuredImage: doc.featuredImage,
      tags: doc.tags,
      categories: doc.categories,
      lang: opts.lang || doc.lang
    };
  });
  return core.buildIndex(list, { lang: opts.lang, fields: opts.fields, bigram: opts.bigram });
}

function measureGzip(text) {
  return zlib.gzipSync(Buffer.from(String(text), 'utf-8')).length;
}

// JSON 文本防注入：`<` 一律序列化为 JSON 等价的 \u003c 转义，产物中不存在可执行标签起始串；
// JSON.parse 后值完全一致（搜索匹配、展示不受影响）。
// JSON 的结构字符只有 {}[],:" 与空白，`<` 只可能出现在字符串字面量内，替换不会破坏语法。
function serializeIndexText(index) {
  return JSON.stringify(index).replace(/</g, '\\u003c');
}

// 内容寻址：语言参与哈希（同内容不同语言不得碰撞），返回 10 位十六进制短哈希。
function hashIndexText(lang, text) {
  return crypto.createHash('sha256')
    .update(String(lang) + '\u0000' + String(text), 'utf-8')
    .digest('hex')
    .slice(0, 10);
}

// 体积裁剪：按「文档频率升序 + 词项字典序」批量删除 (字段, 词项)，每批后重新称重；
// 返回 { index（原地裁剪）, text, gzipBytes, pruned, reached }。预算无法达标时 reached=false（调用方告警）。
function pruneIndexToBudget(index, maxBytes, options) {
  const opts = options || {};
  const budget = maxBytes > 0 ? Math.floor(maxBytes) : 0;
  let text = serializeIndexText(index);
  let gzipBytes = measureGzip(text);
  if (gzipBytes <= budget) return { index: index, text: text, gzipBytes: gzipBytes, pruned: 0, reached: true };
  const units = [];
  const fieldNames = Object.keys(index.fields || {});
  for (let f = 0; f < fieldNames.length; f++) {
    const table = index.fields[fieldNames[f]] || {};
    const terms = Object.keys(table);
    for (let t = 0; t < terms.length; t++) units.push({ f: fieldNames[f], term: terms[t], df: table[terms[t]].length });
  }
  units.sort(function (a, b) {
    if (a.df !== b.df) return a.df - b.df;
    if (a.term !== b.term) return a.term < b.term ? -1 : 1;
    return a.f < b.f ? -1 : a.f > b.f ? 1 : 0;
  });
  const ratio = opts.batchRatio > 0 ? opts.batchRatio : 0.05;
  const batchSize = Math.max(1, Math.ceil(units.length * ratio));
  let cursor = 0;
  let removed = 0;
  while (gzipBytes > budget && cursor < units.length) {
    const end = Math.min(units.length, cursor + batchSize);
    for (; cursor < end; cursor++) {
      delete index.fields[units[cursor].f][units[cursor].term];
      removed++;
    }
    text = serializeIndexText(index);
    gzipBytes = measureGzip(text);
  }
  return { index: index, text: text, gzipBytes: gzipBytes, pruned: removed, reached: gzipBytes <= budget };
}

// featuredImage 最终路径预计算：只处理站内绝对路径（非 assets/og/node_modules、无查询串、
// 扩展名参与 cacheBust 的媒体），规则与 scripts/build/minify.js → cacheBust 一致（含幂等跳过）。
function resolveFinalAssetUrl(distDir, url, options) {
  const opts = options || {};
  const raw = String(url == null ? '' : url);
  if (opts.cacheBusting === false) return raw;
  if (!raw || raw.charAt(0) !== '/' || raw.indexOf('?') !== -1 || raw.indexOf('#') !== -1) return raw;
  const pattern = opts.pattern instanceof RegExp ? opts.pattern : DEFAULT_BUST_PATTERN;
  if (!pattern.test(raw)) return raw;
  const rel = raw.replace(/^\/+/, '');
  if (rel.indexOf('assets/') === 0 || rel.indexOf('og/') === 0 || rel.indexOf('node_modules/') >= 0) return raw;
  let buf;
  try {
    buf = fs.readFileSync(path.join(distDir, rel.split('/').join(path.sep)));
  } catch (err) {
    return raw;
  }
  const hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 10);
  const dir = path.posix.dirname(raw);
  const base = path.posix.basename(raw);
  const dot = base.lastIndexOf('.');
  const name = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  if (HASHED_NAME_RE.test(name)) return raw;
  return (dir === '/' ? '/' : dir + '/') + name + '.' + hash + ext;
}

module.exports = {
  DEFAULT_MAX_GZIP_KB,
  searchIndexOptions,
  buildLanguageIndex,
  measureGzip,
  serializeIndexText,
  hashIndexText,
  pruneIndexToBudget,
  resolveFinalAssetUrl
};
