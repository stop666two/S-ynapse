// 检索核心（构建期与浏览器共用，纯函数、无 DOM/Node 依赖）：
//   - 分词：CJK 码点段 → bigram（段长 1 时保留单字）；ASCII 字母数字段 → 小写整词；
//     其余字符（标点/空白/emoji）作分隔符。bigram=false 时 CJK 段整段成词（排障/兜底）。
//   - 索引：docs 保存展示元数据（title/url/excerpt/featuredImage/tags/categories/lang），
//     fields.title/excerpt/content 保存「词项 → 文档 id 升序数组」倒排表；正文全文不落盘。
//   - 查询：全部查询词项 AND 命中（任一被索引字段，或标签/分类子串包含该词项）；
//     得分 = Σ(字段权重 × 该字段命中词项数)；同分保持索引原序（构建期按日期倒序）。
//   - 单字 CJK 查询：对 bigram 键做首尾字扫描并集（任意含该字的二元组命中）。
//   - 加载：loadIndex 带超时/有限重试/结构校验；ensureIndex 缓存最近一次索引，force 强制刷新。

export const INDEX_VERSION = 2;

const CJK_RANGES = [
  [0x3040, 0x30ff],   // 平假名 / 片假名
  [0x3400, 0x4dbf],   // CJK 扩展 A
  [0x4e00, 0x9fff],   // CJK 基本区
  [0xac00, 0xd7af],   // 韩文音节
  [0xf900, 0xfaff],   // CJK 兼容表意文字
  [0x20000, 0x2a6df], // CJK 扩展 B
  [0x2a700, 0x2ebef], // CJK 扩展 C-F
  [0x2f800, 0x2fa1f]  // CJK 兼容表意补充
];

function isCjkCp(cp) {
  for (let i = 0; i < CJK_RANGES.length; i++) {
    if (cp >= CJK_RANGES[i][0] && cp <= CJK_RANGES[i][1]) return true;
  }
  return false;
}

function isAsciiWordCp(cp) {
  return (cp >= 0x30 && cp <= 0x39) || (cp >= 0x61 && cp <= 0x7a);
}

export function isSingleCjkTerm(term) {
  const s = String(term == null ? '' : term);
  const cps = Array.from(s);
  return cps.length === 1 && isCjkCp(cps[0].codePointAt(0));
}

// 分词（构建与查询共用）。返回词项数组：保留重复（构建端按文档去重），不排序。
export function tokenizeText(text, options) {
  const bigram = !(options && options.bigram === false);
  const out = [];
  const src = String(text == null ? '' : text).toLowerCase();
  const n = src.length;
  let i = 0;
  while (i < n) {
    const cp = src.codePointAt(i);
    if (isCjkCp(cp)) {
      const seg = [];
      let j = i;
      while (j < n) {
        const inner = src.codePointAt(j);
        if (!isCjkCp(inner)) break;
        const size = inner > 0xffff ? 2 : 1;
        seg.push(src.slice(j, j + size));
        j += size;
      }
      if (!bigram) {
        out.push(seg.join(''));
      } else if (seg.length === 1) {
        out.push(seg[0]);
      } else {
        for (let k = 0; k + 1 < seg.length; k++) out.push(seg[k] + seg[k + 1]);
      }
      i = j;
      continue;
    }
    if (isAsciiWordCp(cp)) {
      let j = i;
      while (j < n && isAsciiWordCp(src.codePointAt(j))) j++;
      out.push(src.slice(i, j));
      i = j;
      continue;
    }
    i += cp > 0xffff ? 2 : 1;
  }
  return out;
}

// 查询分词：去重并保持首次出现顺序（重复 bigram 不重复计入命中数）。
export function tokenizeQuery(text, options) {
  const terms = tokenizeText(text, options);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < terms.length; i++) {
    if (seen.has(terms[i])) continue;
    seen.add(terms[i]);
    out.push(terms[i]);
  }
  return out;
}

function str(value) {
  return value == null ? '' : String(value);
}

function strList(value) {
  return Array.isArray(value) ? value.map(str) : [];
}

// 倒排表查询：精确命中优先；单字 CJK 回退为 bigram 首尾字扫描（组合并去重升序）。
function collectPostings(table, term) {
  const exact = table[term];
  if (exact) return exact;
  if (!isSingleCjkTerm(term)) return null;
  let out = null;
  for (const key in table) {
    let hit = false;
    if (key === term) {
      hit = true;
    } else {
      const cps = Array.from(key);
      if (cps.length === 2) hit = cps[0] === term || cps[1] === term;
    }
    if (!hit) continue;
    const list = table[key];
    if (!out) out = list.slice();
    else for (let i = 0; i < list.length; i++) out.push(list[i]);
  }
  if (!out) return null;
  out.sort(function (a, b) { return a - b; });
  let w = 0;
  for (let i = 0; i < out.length; i++) {
    if (i === 0 || out[i] !== out[i - 1]) out[w++] = out[i];
  }
  out.length = w;
  return out;
}

// 构建倒排索引：docs 输入含 title/excerpt/content 等文本字段；
// options.fields 决定索引哪些字段（与构建期权重配置同源），options.bigram 决定 CJK 分词模式。
export function buildIndex(docs, options) {
  const opts = options || {};
  const bigram = opts.bigram !== false;
  const fieldNames = Array.isArray(opts.fields) && opts.fields.length ? opts.fields.slice() : ['title', 'excerpt', 'content'];
  const fields = {};
  for (let i = 0; i < fieldNames.length; i++) fields[fieldNames[i]] = Object.create(null);
  const outDocs = [];
  const list = Array.isArray(docs) ? docs : [];
  for (let id = 0; id < list.length; id++) {
    const d = list[id] || {};
    outDocs.push({
      title: str(d.title),
      url: str(d.url),
      excerpt: str(d.excerpt),
      featuredImage: str(d.featuredImage),
      tags: strList(d.tags),
      categories: strList(d.categories),
      lang: str(d.lang)
    });
    for (let f = 0; f < fieldNames.length; f++) {
      const name = fieldNames[f];
      const text = str(d[name]);
      if (!text) continue;
      const terms = tokenizeText(text, { bigram: bigram });
      const table = fields[name];
      const seen = new Set();
      for (let t = 0; t < terms.length; t++) {
        if (seen.has(terms[t])) continue;
        seen.add(terms[t]);
        const arr = table[terms[t]] || (table[terms[t]] = []);
        if (arr[arr.length - 1] !== id) arr.push(id);
      }
    }
  }
  return { version: INDEX_VERSION, lang: str(opts.lang), bigram: bigram, docs: outDocs, fields: fields };
}

export function isValidIndex(index) {
  return !!index && typeof index === 'object' && !Array.isArray(index)
    && Array.isArray(index.docs)
    && !!index.fields && typeof index.fields === 'object' && !Array.isArray(index.fields);
}

// 标签/分类元数据小写缓存（每次查询构建一次；子串命中语义与原实现一致）。
function buildLowerMeta(docs) {
  const out = [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i] || {};
    out.push({
      tags: strList(d.tags).map(function (v) { return v.toLowerCase(); }),
      cats: strList(d.categories).map(function (v) { return v.toLowerCase(); })
    });
  }
  return out;
}

// 倒排查询：返回排序后的 docs 摘要数组（已按 limit 截断）。
// options = { weights:{title,excerpt,content}, matchTags, matchCategories, limit }
export function searchIndex(index, query, options) {
  if (!isValidIndex(index)) return [];
  const opts = options || {};
  const defaults = { title: 5, excerpt: 2, content: 1 };
  const rawWeights = opts.weights || {};
  const weights = {
    title: rawWeights.title === undefined ? defaults.title : rawWeights.title,
    excerpt: rawWeights.excerpt === undefined ? defaults.excerpt : rawWeights.excerpt,
    content: rawWeights.content === undefined ? defaults.content : rawWeights.content
  };
  const matchTags = opts.matchTags !== false;
  const matchCategories = opts.matchCategories !== false;
  const limit = opts.limit > 0 ? Math.floor(opts.limit) : Infinity;
  const bigram = index.bigram !== false;
  const terms = tokenizeQuery(query, { bigram: bigram });
  if (!terms.length) return [];
  const docs = index.docs;
  const fields = index.fields || {};
  const fieldNames = ['title', 'excerpt', 'content'];
  const termData = terms.map(function (term) {
    const hitSet = new Set();
    const postings = {};
    for (let f = 0; f < fieldNames.length; f++) {
      const name = fieldNames[f];
      if (!(weights[name] > 0)) continue;
      const table = fields[name];
      if (!table) continue;
      const list = collectPostings(table, term);
      if (list && list.length) {
        postings[name] = list;
        for (let i = 0; i < list.length; i++) hitSet.add(list[i]);
      }
    }
    return { term: term, hitSet: hitSet, postings: postings };
  });
  const needMeta = matchTags || matchCategories;
  const lowerMeta = needMeta ? buildLowerMeta(docs) : null;
  let candidates = null;
  for (let t = 0; t < termData.length; t++) {
    const td = termData[t];
    const set = new Set(td.hitSet);
    if (needMeta) {
      for (let id = 0; id < docs.length; id++) {
        if (set.has(id)) continue;
        const meta = lowerMeta[id];
        let hit = false;
        if (matchTags) {
          for (let i = 0; i < meta.tags.length; i++) if (meta.tags[i].indexOf(td.term) !== -1) { hit = true; break; }
        }
        if (!hit && matchCategories) {
          for (let i = 0; i < meta.cats.length; i++) if (meta.cats[i].indexOf(td.term) !== -1) { hit = true; break; }
        }
        if (hit) set.add(id);
      }
    }
    if (candidates === null) {
      candidates = set;
    } else {
      for (const id of candidates) if (!set.has(id)) candidates.delete(id);
    }
    if (!candidates.size) return [];
  }
  const scored = [];
  candidates.forEach(function (id) {
    let score = 0;
    for (let t = 0; t < termData.length; t++) {
      const postings = termData[t].postings;
      for (let f = 0; f < fieldNames.length; f++) {
        const name = fieldNames[f];
        if (!(weights[name] > 0)) continue;
        const list = postings[name];
        if (list && list.indexOf(id) !== -1) score += weights[name];
      }
    }
    scored.push({ id: id, score: score });
  });
  scored.sort(function (a, b) { return (b.score - a.score) || (a.id - b.id); });
  return scored.slice(0, limit).map(function (x) { return docs[x.id]; });
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 高亮：对查询词项在文本中的全部出现做区间合并（重叠 bigram 合并为单段），
// 上限 maxMatches 个区间；输出已转义 HTML，<mark> 可附加 markClass。
export function highlightHtml(text, query, options) {
  const src = String(text == null ? '' : text);
  const opts = options || {};
  if (!src) return '';
  if (opts.enabled === false) return escapeHtml(src);
  const bigram = !(opts.bigram === false);
  const terms = tokenizeQuery(query, { bigram: bigram });
  if (!terms.length) return escapeHtml(src);
  terms.sort(function (a, b) { return b.length - a.length; });
  const lower = src.toLowerCase();
  const hay = lower.length === src.length ? lower : src;
  const max = opts.maxMatches > 0 ? Math.floor(opts.maxMatches) : 20;
  const ranges = [];
  for (let t = 0; t < terms.length; t++) {
    const term = terms[t];
    let from = 0;
    while (ranges.length < max * 4) {
      const at = hay.indexOf(term, from);
      if (at === -1) break;
      ranges.push([at, at + term.length]);
      from = at + term.length;
    }
  }
  ranges.sort(function (a, b) { return (a[0] - b[0]) || (b[1] - a[1]); });
  const merged = [];
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) {
      if (r[1] > last[1]) last[1] = r[1];
    } else {
      merged.push([r[0], r[1]]);
    }
  }
  const limited = merged.slice(0, max);
  const cls = String(opts.markClass == null ? '' : opts.markClass).replace(/[^\w-]/g, '');
  const open = cls ? '<mark class="' + cls + '">' : '<mark>';
  let html = '';
  let cursor = 0;
  for (let i = 0; i < limited.length; i++) {
    const r = limited[i];
    html += escapeHtml(src.slice(cursor, r[0])) + open + escapeHtml(src.slice(r[0], r[1])) + '</mark>';
    cursor = r[1];
  }
  html += escapeHtml(src.slice(cursor));
  return html;
}

// 摘要窗口：取首个命中词项位置并向两侧截取（无命中则首段截断 + 省略号）。
export function extractSnippet(text, query, maxLength) {
  const src = String(text == null ? '' : text);
  const max = maxLength > 0 ? Math.floor(maxLength) : 120;
  if (src.length <= max) return src;
  const terms = tokenizeQuery(query);
  const lower = src.toLowerCase();
  const hay = lower.length === src.length ? lower : src;
  let bestAt = -1;
  let bestLen = 0;
  for (let i = 0; i < terms.length; i++) {
    const at = hay.indexOf(terms[i]);
    if (at !== -1 && (bestAt === -1 || at < bestAt)) {
      bestAt = at;
      bestLen = terms[i].length;
    }
  }
  if (bestAt === -1) return src.slice(0, max) + '…';
  const start = Math.max(0, bestAt - 45);
  const end = Math.min(src.length, bestAt + bestLen + 55);
  return (start > 0 ? '…' : '') + src.slice(start, end) + (end < src.length ? '…' : '');
}

// 加载索引：HTTP 错误/结构非法均视为失败；超时与重试次数由调用方配置（保留历史语义）。
export function loadIndex(url, options) {
  const opts = options || {};
  const timeoutMs = opts.timeoutMs > 0 ? Math.floor(opts.timeoutMs) : 5000;
  const retries = opts.retries >= 0 ? Math.floor(opts.retries) : 1;
  function once(attempt) {
    const req = { credentials: 'same-origin' };
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) req.signal = AbortSignal.timeout(timeoutMs);
    return fetch(url, req).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      if (!isValidIndex(data)) throw new Error('invalid search index');
      return data;
    }).catch(function (err) {
      if (attempt < retries) return once(attempt + 1);
      throw err;
    });
  }
  return once(0);
}

let cacheUrl = '';
let cacheIndex = null;
let cachePromise = null;
let cacheFailed = false;

// 索引缓存：同一 URL 复用；force=true 时丢弃缓存重新加载。失败 resolve(null) 并标记 failed。
export function ensureIndex(url, options) {
  const opts = options || {};
  const force = opts.force === true;
  if (!force && cacheIndex && cacheUrl === url) return Promise.resolve(cacheIndex);
  if (!force && cachePromise && cacheUrl === url) return cachePromise;
  cacheUrl = url;
  cacheFailed = false;
  cacheIndex = null;
  const promise = loadIndex(url, opts).then(function (data) {
    cacheIndex = data;
    cachePromise = null;
    return data;
  }).catch(function () {
    cacheFailed = true;
    cachePromise = null;
    return null;
  });
  cachePromise = promise;
  return promise;
}

export function searchIndexState() {
  return { index: cacheIndex, failed: cacheFailed };
}
