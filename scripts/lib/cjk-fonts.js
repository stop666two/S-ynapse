'use strict';
// CJK 字体子集化共享库（Noto Sans SC，构建期按实际用字裁剪）：
//   1) 纯逻辑（可单测、不联网）：unicode-range 解析/交集、CJK 用字收集、HTML 文本抽取、
//      @font-face 解析与生成；
//   2) 网络路径：Google Fonts CSS 清单与 woff2 分片下载（Node 内置 fetch；UA 伪装以取 woff2
//      变体；超时经 AbortController 中止；fetchImpl 可注入以便离线测试与降级验证）。
// 数据约定：
//   chunk = { family, style, weight, url, unicodeRangeText, unicodeRange:[[start,end],...] }
//   plan  = { weight, style, url, file, unicodeRangeText, family }（file 为 URL 哈希命名的本地文件名）
const crypto = require('crypto');

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_WEIGHTS = [400, 700];
const CJK_CSS_HREF = '/assets/css/cjk-fonts.css';

// CJK 区段：CJK 部首/标点/假名/扩展 A/统一表意/兼容表意/全角形式 + 扩展 B-F（补充平面）。
const CJK_RANGES = [
  [0x2e80, 0x2eff], [0x3000, 0x303f], [0x3040, 0x30ff], [0x3400, 0x4dbf],
  [0x4e00, 0x9fff], [0xf900, 0xfaff], [0xff00, 0xffef],
  [0x20000, 0x2a6df], [0x2a700, 0x2ebef], [0x2f800, 0x2fa1f]
];

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

// 解析 CSS unicode-range 文本 → [[start,end], ...]（支持 U+XXXX、U+XXXX-YYYY 与 U+4?? 通配）。
function parseUnicodeRange(text) {
  const out = [];
  for (const raw of String(text == null ? '' : text).split(',')) {
    const token = raw.trim();
    const match = /^u\+([0-9a-f?]{1,6})(?:-([0-9a-f?]{1,6}))?$/i.exec(token);
    if (!match) continue;
    const start = parseInt(match[1].replace(/\?/g, '0'), 16);
    const end = match[2]
      ? parseInt(match[2].replace(/\?/g, 'F'), 16)
      : parseInt(match[1].replace(/\?/g, 'F'), 16);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) continue;
    out.push([start, end]);
  }
  return out;
}

// 归一化码点集合：接受数组/Set/任意可迭代，去重升序（用于二分交集判定）。
function normalizeCodepoints(codepoints) {
  const out = [];
  if (codepoints == null || typeof codepoints[Symbol.iterator] !== 'function') return out;
  for (const value of codepoints) {
    const n = Number(value);
    if (Number.isFinite(n)) out.push(n);
  }
  out.sort((a, b) => a - b);
  return out;
}

// 区间数组与码点集合是否有交集（码点升序 + 逐区间二分；空区间视为无交集）。
function intersects(range, codepoints) {
  const intervals = Array.isArray(range) ? range : [];
  const cps = normalizeCodepoints(codepoints);
  if (!intervals.length || !cps.length) return false;
  for (const interval of intervals) {
    const start = interval[0];
    const end = interval[1];
    let lo = 0;
    let hi = cps.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const cp = cps[mid];
      if (cp < start) { lo = mid + 1; continue; }
      if (cp <= end) return true;
      hi = mid - 1;
    }
  }
  return false;
}

function inCjkRange(cp) {
  for (const range of CJK_RANGES) {
    if (cp >= range[0] && cp <= range[1]) return true;
  }
  return false;
}

// 收集文本数组中的 CJK 实际用字，返回去重升序码点数组。
function collectUsedCodepoints(texts) {
  const set = new Set();
  for (const text of Array.isArray(texts) ? texts : []) {
    for (const ch of String(text == null ? '' : text)) {
      const cp = ch.codePointAt(0);
      if (inCjkRange(cp)) set.add(cp);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

// 解码 HTML 实体（数字实体 + 常用命名实体）；产物中文为字面量，实体解码仅作兜底。
function decodeHtmlEntities(text) {
  return String(text == null ? '' : text)
    .replace(/&#x([0-9a-f]{1,6});/gi, (match, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(Math.min(code, 0x10ffff)) : match;
    })
    .replace(/&#(\d{1,7});/g, (match, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(Math.min(code, 0x10ffff)) : match;
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (match, name) => NAMED_ENTITIES[name]);
}

const ATTR_VALUE_RX = /[A-Za-z_:][-\w:.]*\s*=\s*"([^"]*)"|'([^']*)'/g;

// 抽取 HTML 中的可读文本：去注释/标签后的正文 + 全部属性值（title/meta/placeholder/aria-label/
// data-* 与内联 script JSON 中的中文都覆盖），实体先行解码。
function extractHtmlTexts(html) {
  const src = String(html == null ? '' : html);
  const out = [decodeHtmlEntities(src.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' '))];
  ATTR_VALUE_RX.lastIndex = 0;
  let match;
  while ((match = ATTR_VALUE_RX.exec(src)) !== null) {
    const value = match[1] !== undefined ? match[1] : match[2];
    if (value) out.push(decodeHtmlEntities(value));
  }
  return out;
}

const FONT_FACE_RX = /@font-face\s*\{([^}]*)\}/gi;
const FONT_URL_RX = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)"']+))\s*\)/i;

function cssProp(body, name) {
  const match = new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;}]+)', 'i').exec(body);
  return match ? match[1].trim() : '';
}

// 解析 Google Fonts CSS 的 @font-face 列表。
function parseFontFaceCss(css) {
  const chunks = [];
  const src = String(css == null ? '' : css);
  FONT_FACE_RX.lastIndex = 0;
  let match;
  while ((match = FONT_FACE_RX.exec(src)) !== null) {
    const body = match[1].trim();
    const family = cssProp(body, 'font-family').replace(/^['"]|['"]$/g, '').trim();
    const urlMatch = FONT_URL_RX.exec(body);
    const url = urlMatch ? String(urlMatch[1] || urlMatch[2] || urlMatch[3] || '').trim() : '';
    if (!family || !url) continue;
    const weightText = cssProp(body, 'font-weight');
    const rangeText = cssProp(body, 'unicode-range');
    chunks.push({
      family,
      style: cssProp(body, 'font-style') || 'normal',
      weight: /^\d+$/.test(weightText) ? Number(weightText) : (weightText || 400),
      url,
      unicodeRangeText: rangeText,
      unicodeRange: parseUnicodeRange(rangeText)
    });
  }
  return chunks;
}

function isOkResponse(res) {
  if (!res) return false;
  if (typeof res.ok === 'boolean') return res.ok;
  const status = Number(res.status);
  return Number.isFinite(status) ? status >= 200 && status < 300 : true;
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryCount(options) {
  const retries = Number(options && options.retries);
  return Number.isFinite(retries) && retries >= 0 ? Math.floor(retries) + 1 : 2;
}

function retryDelay(options) {
  const delay = Number(options && options.retryDelayMs);
  return Number.isFinite(delay) && delay >= 0 ? delay : 300;
}

// 有限重试（默认 2 次尝试、300ms 间隔）：仅用于出网请求，满足超时 + 重试 + 退避底线。
async function withRetry(attempts, delayMs, task) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await sleepMs(delayMs);
    }
  }
  throw lastError;
}

// 带超时的 fetch：AbortController 中止；超时统一抛出含 "timeout" 的错误（便于降级日志归因）。
async function fetchWithTimeout(url, options) {
  const opts = options || {};
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  if (controller) timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: Object.assign({ 'User-Agent': opts.userAgent || DEFAULT_USER_AGENT }, opts.accept ? { Accept: opts.accept } : {}),
      redirect: 'follow',
      ...(controller ? { signal: controller.signal } : {})
    });
    if (!isOkResponse(res)) throw new Error('http ' + (res && res.status));
    return res;
  } catch (err) {
    if (controller && controller.signal.aborted) throw new Error('timeout after ' + timeoutMs + 'ms: ' + url, { cause: err });
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// 拉取 Google Fonts CSS 并解析为 chunk 列表（UA 伪装现代 Chrome 以获取 woff2 + unicode-range；
// 网络失败默认重试 1 次）。
async function fetchChunkList(options) {
  const opts = options || {};
  return withRetry(retryCount(opts), retryDelay(opts), async () => {
    const res = await fetchWithTimeout(opts.cssUrl, {
      timeoutMs: opts.timeoutMs,
      fetchImpl: opts.fetchImpl,
      userAgent: opts.userAgent,
      accept: 'text/css,*/*;q=0.1'
    });
    const chunks = parseFontFaceCss(await res.text());
    if (!chunks.length) throw new Error('no @font-face found in ' + opts.cssUrl);
    return chunks;
  });
}

// 缓存/产物文件名：URL 的 sha1 前 16 位十六进制（内容寻址，URL 变即换名）。
function chunkFileName(url) {
  return crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 16) + '.woff2';
}

function normalizeWeights(weights) {
  const out = [];
  for (const value of Array.isArray(weights) ? weights : []) {
    const text = String(value).trim();
    if (!/^\d{2,4}$/.test(text) || out.indexOf(text) !== -1) continue;
    out.push(text);
  }
  return out.sort((a, b) => Number(a) - Number(b));
}

function googleFontsCssUrl(options) {
  const opts = options || {};
  const family = String(opts.family || '').trim();
  const weights = normalizeWeights(opts.weights);
  const weightPart = weights.length ? ':wght@' + weights.join(';') : '';
  return 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') + weightPart + '&display=swap';
}

function fontFamilySlug(family) {
  return String(family == null ? '' : family).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// 子集计划：仅保留与用字有交集的 chunk（无 unicode-range 的 chunk 视为全量保留），按权重+URL 去重。
function buildSubsetPlan(chunks, codepoints) {
  const cps = normalizeCodepoints(codepoints);
  const seen = new Set();
  const plan = [];
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    if (!chunk || !chunk.url) continue;
    const keep = chunk.unicodeRange.length === 0 || intersects(chunk.unicodeRange, cps);
    if (!keep) continue;
    const key = chunk.weight + '|' + chunk.url;
    if (seen.has(key)) continue;
    seen.add(key);
    plan.push({
      weight: chunk.weight,
      style: chunk.style || 'normal',
      url: chunk.url,
      file: chunkFileName(chunk.url),
      unicodeRangeText: chunk.unicodeRangeText || '',
      family: chunk.family || ''
    });
  }
  return plan;
}

// 生成本地 @font-face：保留原 unicode-range；opts.weight 指定时仅输出该字重（否则按 chunk 自身字重）。
function buildFontCss(plan, options) {
  const opts = options || {};
  const family = opts.fontFamily || 'Noto Sans SC';
  const prefix = String(opts.urlPrefix || '').replace(/\/?$/, '/');
  const display = opts.fontDisplay || 'swap';
  const weightFilter = opts.weight == null ? null : Number(opts.weight);
  const rules = [];
  for (const entry of Array.isArray(plan) ? plan : []) {
    if (weightFilter != null && Number(entry.weight) !== weightFilter) continue;
    const weight = weightFilter != null ? weightFilter : entry.weight;
    const range = entry.unicodeRangeText ? 'unicode-range:' + entry.unicodeRangeText + ';' : '';
    rules.push('@font-face{font-family:\'' + family + '\';font-style:' + (entry.style || 'normal')
      + ';font-weight:' + weight + ';font-display:' + display
      + ';src:url(\'' + prefix + entry.file + '\') format(\'woff2\');' + range + '}');
  }
  return rules.length ? rules.join('\n') + '\n' : '';
}

// 下载单个 woff2 分片；非 woff2 载荷（错误页/拦截页）直接拒绝，避免把垃圾写入缓存。
// 网络失败默认重试 1 次。
async function downloadFontChunk(url, options) {
  const opts = options || {};
  return withRetry(retryCount(opts), retryDelay(opts), async () => {
    const res = await fetchWithTimeout(url, {
      timeoutMs: opts.timeoutMs,
      fetchImpl: opts.fetchImpl,
      userAgent: opts.userAgent,
      accept: 'font/woff2,*/*;q=0.1'
    });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 4 || buf.toString('ascii', 0, 4) !== 'wOF2') throw new Error('not a woff2 payload: ' + url);
    return buf;
  });
}

module.exports = {
  DEFAULT_USER_AGENT,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_WEIGHTS,
  CJK_CSS_HREF,
  CJK_RANGES,
  parseUnicodeRange,
  normalizeCodepoints,
  intersects,
  collectUsedCodepoints,
  decodeHtmlEntities,
  extractHtmlTexts,
  parseFontFaceCss,
  fetchWithTimeout,
  fetchChunkList,
  chunkFileName,
  normalizeWeights,
  googleFontsCssUrl,
  fontFamilySlug,
  buildSubsetPlan,
  buildFontCss,
  downloadFontChunk
};
