const sanitizeHtmlLib = require('sanitize-html');
const { createHash } = require('node:crypto');

// Format a date string according to a template pattern (YYYY-MM-DD HH:mm).
// Automatically detects if the input includes time (non-midnight) and includes HH:mm in output.
// Falls back to returning the raw string if parsing fails.
function formatDate(dateStr, fmt) {
  if (!dateStr) return '';
  let d, hasTime;
  if (typeof dateStr === 'object' && dateStr instanceof Date && !isNaN(dateStr.getTime())) {
    d = dateStr;
    hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
  } else {
    const rawStr = String(dateStr);
    hasTime = /\d{1,2}:\d{2}/.test(rawStr) && !rawStr.endsWith('00:00:00') && !rawStr.endsWith('T00:00:00.000Z') && !/T00:00:00/.test(rawStr);
    d = new Date(rawStr);
    if (isNaN(d.getTime())) return rawStr;
  }
  const pad = n => String(n).padStart(2, '0');
  const map = {
    'YYYY': d.getFullYear(), 'MM': pad(d.getMonth() + 1), 'DD': pad(d.getDate()),
    'HH': hasTime ? pad(d.getHours()) : '', 'mm': hasTime ? pad(d.getMinutes()) : '', 'ss': hasTime ? pad(d.getSeconds()) : ''
  };
  let result = fmt || 'YYYY-MM-DD';
  for (const [k, v] of Object.entries(map)) result = result.replace(k, v);
  if (!hasTime) result = result.replace(/[:]\s*$|:\s*[^\d\s]|[\s]+:/g, '').replace(/\s+/g, ' ').trim();
  return result;
}

// Convert text to a URL-safe slug. Preserves Chinese characters.
// Two-pass fallback: first tries simple slugification, then URI-encoding for edge cases.
// Last resort: deterministic SHA-1 suffix (same input always yields the same slug,
// so repeated builds and same-build collisions resolve identically; only used for
// non-alphanumeric non-CJK input such as emoji-only titles).
// 长度上限与显式 slug 的 validateSlug 对齐（120）：超长标题截断后附加确定性哈希，
// 避免生成超出文件系统名称上限的目录/URL（长标题仍可区分且幂等）。
const SLUG_MAX_LENGTH = 120;
function safeSlug(text) {
  if (!text) return '';
  let slug = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || /^[-\s]*$/.test(slug)) {
    let encoded;
    // 孤立代理等无法百分号编码的输入：跳过本分支，直接走确定性哈希兜底（不抛 URIError）。
    try {
      encoded = encodeURIComponent(text);
    } catch (err) {
      encoded = '';
    }
    slug = encoded.toLowerCase().replace(/%[0-9a-f]{2}/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  if (!slug) slug = 'tag-' + createHash('sha1').update(String(text)).digest('hex').slice(0, 6);
  if (slug.length > SLUG_MAX_LENGTH) {
    slug = slug.slice(0, SLUG_MAX_LENGTH - 7) + '-' + createHash('sha1').update(String(text)).digest('hex').slice(0, 6);
  }
  return slug;
}

// Windows 保留设备名（CON/PRN/AUX/NUL/COM1-9/LPT1-9，可带扩展名，大小写不敏感）：
// 这些名字即使作为目录段也会被 Win32 解释为设备，必须拒绝；大小写均拒绝以保持跨平台一致。
const WINDOWS_RESERVED_NAME_RX = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

/**
 * 判断路径段是否为操作系统保留名（当前覆盖 Windows 设备名）。
 * @param {string} slug
 * @returns {boolean}
 */
function isReservedOsName(slug) {
  return WINDOWS_RESERVED_NAME_RX.test(String(slug == null ? '' : slug).trim());
}

// 可执行协议检测（链接 href/src 用）：去掉控制/格式字符与空白后按小写前缀判断，
// 覆盖 `java\nscript:`、`JaVaScRiPt:` 等混淆写法。data: 一律视为不安全链接协议。
function hasUnsafeLinkScheme(url) {
  if (typeof url !== 'string') return false;
  const normalized = url.replace(/[\p{Cc}\s]+/gu, '').toLowerCase();
  return /^(javascript|vbscript|data):/.test(normalized);
}

// Validate a hand-written front-matter slug before it is used as a URL path
// segment and an output filename. Rejects path traversal, HTML-breaking and
// OS-reserved characters. Returns { ok, slug } or { ok: false, reason }.
function validateSlug(rawSlug) {
  if (typeof rawSlug !== 'string' || !rawSlug.trim()) return { ok: false, reason: 'empty or not a string' };
  const slug = rawSlug.trim();
  if (slug.length > 120) return { ok: false, reason: 'longer than 120 characters' };
  if (slug.includes('/') || slug.includes('\\')) return { ok: false, reason: 'contains a path separator (/ or \\)' };
  if (slug.includes('..')) return { ok: false, reason: 'contains ".."' };
  if (isReservedOsName(slug)) return { ok: false, reason: 'is a reserved OS device name (CON/PRN/AUX/NUL/COM1-9/LPT1-9)' };
  if (!/^[A-Za-z0-9_\u4e00-\u9fa5-]+$/.test(slug)) {
    return { ok: false, reason: 'contains characters other than letters, digits, CJK, "_" and "-"' };
  }
  return { ok: true, slug };
}

// Escape a string for use in HTML attribute values. Handles &, ", ', <, >.
function escapeAttr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Escape a string for use in HTML text content. Handles &, <, > only (safe for non-attribute contexts).
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Remove characters that XML 1.0 forbids in text: C0 controls other than tab/newline/CR,
// U+FFFE/U+FFFF and lone surrogates. Feed/sitemap writers must apply this before emitting
// anything, because neither the `feed` package nor escapeHtml filters them and a raw
// control byte makes the whole document fail to parse (DOMParser parsererror).
// 按码点遍历（for...of）：成对代理被合并为一个码点得以保留，孤立代理落入代理区被剔除。
function stripInvalidXmlChars(value) {
  let out = '';
  for (const ch of String(value == null ? '' : value)) {
    const cp = ch.codePointAt(0);
    const forbidden = (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d)
      || cp === 0xfffe || cp === 0xffff
      || (cp >= 0xd800 && cp <= 0xdfff);
    if (!forbidden) out += ch;
  }
  return out;
}

// Strip all HTML tags and decode common entities (&amp;, &quot;, &#39;).
// Returns plain text with normalized whitespace. Used for excerpt generation and search indexing.
function stripHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

// 按 Unicode 码点截断文本：绝不会把代理对（emoji/CJK 扩展区/ZWJ 序列）切成孤立代理。
// 孤立代理写入 UTF-8 文件会变成 U+FFFD，摘要、卡片、feed 都必须用本函数而非 String.slice。
function truncateCodePoints(text, maxCodePoints) {
  const s = String(text == null ? '' : text);
  const limit = Math.floor(Number(maxCodePoints));
  if (!Number.isFinite(limit) || limit <= 0) return '';
  const chars = Array.from(s);
  if (chars.length <= limit) return s;
  return chars.slice(0, limit).join('');
}

const CJK_RX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
// Count words split by script: CJK chars count as one word each, Latin/CJK-mixed
// text splits on whitespace. Used for per-script reading-speed calculation
// (features.readingTime.wordsPerMinuteCJK / wordsPerMinuteLatin).
// options（features.wordCount 接线，缺省 = 历史口径）：
//   countCjkChars = true   CJK 字符逐字计数；false 时 CJK 不计入 total（latin 部分照计）
//   countDigits   = true   数字作为普通拉丁词计数（"123" 计 1，历史行为）；
//                          false 时纯数字 token 不计（"abc123" 等混合 token 仍计 1，不拆分单词）
function countWordsDetail(text, options) {
  if (typeof text !== 'string') return { cjk: 0, latin: 0, total: 0 };
  const opts = options || {};
  const countCjk = opts.countCjkChars !== false;
  const countDigits = opts.countDigits !== false;
  const cjk = (text.match(CJK_RX) || []).length;
  const latinTokens = text.replace(CJK_RX, ' ').split(/\s+/).filter(Boolean);
  const latin = latinTokens.filter(function (tok) {
    return countDigits || !/^[0-9]+$/.test(tok);
  }).length;
  const cjkPart = countCjk ? cjk : 0;
  return { cjk: cjkPart, latin, total: cjkPart + latin };
}

// Count words: total of CJK characters and whitespace-separated Latin tokens.
function countWords(text, options) {
  return countWordsDetail(text, options).total;
}

// Insert thin spaces (\u2009) at CJK/Latin boundaries for proper typographic spacing.
// Operates on plain text only. CJK range: U+4E00–U+9FFF, U+3400–U+4DBF, U+F900–U+FAFF.
function insertCjkSpacing(text) {
  return text
    .replace(/([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff])(?=[A-Za-z0-9@&$¥])/g, '$1\u2009')
    .replace(/([A-Za-z0-9@])(?=[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff])/g, '$1\u2009');
}

// Apply CJK spacing to HTML content without affecting tags.
// Regex walks the string alternating between tag segments and text segments,
// applying insertCjkSpacing to text segments only.
function applyCjkSpacingToHtml(html) {
  return html.replace(/(<[^>]+>)|(?:^|(?<=>))([^<]*?)(?=<|$)/gs, function(match, tag, text) {
    if (tag) return tag;
    return text ? insertCjkSpacing(text) : '';
  });
}

// Extract table of contents from rendered HTML by finding h2-h4 elements
// that have heading-anchor links. Returns array of {level, id, text} sorted by DOM order.
function extractToc(html, minLevel, maxLevel) {
  // TOC 层级来自 features.toc.minLevel/maxLevel；正文标题锚点由 markdown.js 仅对 h2–h4 生成，
  // 故本函数将层级收敛到受支持的 2–4（minLevel 默认 2，maxLevel 默认 4）。
  const lo = Math.min(4, Math.max(2, parseInt(minLevel, 10) || 2));
  const hi = Math.max(lo, Math.min(4, parseInt(maxLevel, 10) || 4));
  const toc = [];
  const regex = new RegExp('<h([' + lo + '-' + hi + '])\\s+id="([^"]+)"[^>]*>.*?<a[^>]*class="heading-anchor"[^>]*>#<\\/a>(.*?)<\\/h\\1>', 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    toc.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, '').trim()
    });
  }
  return toc;
}

// Tags allowed to pass through sanitizeHtml (subset of standard HTML plus
// the tags needed by GFM task lists, definition lists, and table blocks).
const SAFE_TAGS = new Set([
  'h1','h2','h3','h4','h5','h6','p','br','hr','blockquote','pre','code',
  'em','strong','del','ins','sup','sub','small','kbd','s','abbr','mark','b','i','u',
  'a','img','picture','source','ul','ol','li','dl','dt','dd','table','thead','tbody','tfoot','tr','th','td',
  'div','span','details','summary','input','figure','figcaption','caption','colgroup','col','time',
  'audio','video','track'
]);

// Tags whose entire subtree is removed: their content is executable code
// or active content and cannot be shown safely in an embedded context.
// audio/video are intentionally allowed (embedding is safe; their src is
// restricted to site-local media paths below).
const DANGEROUS_TAGS = new Set([
  'script','style','iframe','object','embed','svg','math','template','form',
  'noscript','textarea','option','select','button','link','meta','base','canvas',
  'applet','frame','frameset'
]);

// Attributes allowed on tags, mapped per tag. on* and style are excluded by
// construction (not listed). data-*/aria-* wildcards cover build-injected
// attributes (data-lqip/data-w/data-h/data-iw) and a11y annotations.
const ALLOWED_ATTRS = {
  '*': ['class','id','title','lang','type','data-*','aria-*'],
  a: ['href'],
  img: ['src','srcset','sizes','loading','decoding','alt','width','height'],
  source: ['src','srcset','sizes'],
  video: ['src','poster','controls','preload','loop','muted','autoplay','playsinline','width','height'],
  audio: ['src','controls','preload','loop','muted','autoplay','playsinline','width','height'],
  track: ['src','kind','srclang','default'],
  input: ['checked','disabled'],
  td: ['colspan','rowspan'],
  th: ['colspan','rowspan']
};

// Media elements may only load site-local sources: absolute/protocol-relative
// URLs and backslash-prefixed paths are stripped from src/poster.
function restrictMediaAttrs(tagName, attribs) {
  const out = copyOwnProperties({}, attribs);
  for (const key of ['src', 'poster']) {
    if (out[key] && /(?:^[a-z][a-z0-9+.-]*:|\/\/|\\)/i.test(out[key].trim())) delete out[key];
  }
  return { tagName, attribs: out };
}

const SANITIZE_OPTIONS = {
  allowedTags: [...SAFE_TAGS],
  nonTextTags: [...DANGEROUS_TAGS],
  allowedAttributes: ALLOWED_ATTRS,
  allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'],
  allowProtocolRelative: true,
  allowedSchemesAppliedToAttributes: ['href', 'src', 'poster', 'srcset'],
  transformTags: {
    video: restrictMediaAttrs,
    audio: restrictMediaAttrs
  }
};

// Escape tags that are neither explicitly allowed nor dangerous so they render
// as literal text (parity with the previous whitelist sanitizer). Dangerous
// tags stay raw for sanitize-html to drop together with their subtree.
function escapeUnknownTags(html) {
  return html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, function(match, slash, name, rest) {
    const lower = name.toLowerCase();
    if (SAFE_TAGS.has(lower) || DANGEROUS_TAGS.has(lower)) return match;
    return '&lt;' + slash + name + rest + '&gt;';
  });
}

// Remove executable/active HTML while keeping safe formatting tags.
// Backed by sanitize-html (WHATWG-style tokenization): entity-encoded schemes
// (jav&#x61;script:), quoted ">" inside attribute values, and unquoted
// attribute escapes are handled by the parser instead of regex heuristics.
function sanitizeHtml(input) {
  if (typeof input !== 'string') return '';
  return sanitizeHtmlLib(escapeUnknownTags(input), SANITIZE_OPTIONS);
}

// Serialize a value for embedding inside an inline <script> block.
// < is escaped so that "</script>" inside strings cannot terminate the
// surrounding script element (JSON.stringify does not escape it).
function escapeJsonForScript(value, space) {
  return JSON.stringify(value, null, space).replace(/</g, '\\u003c');
}

// Resolve [[wiki links]] into Markdown links before Markdown parsing.
// lookup: Map-like { titles: Map(lowerTitle → {title,url}), slugs: Map(slug → {title,url}),
//                    titlesExact: Map(exactTitle → {title,url})  // caseInsensitive=false 时使用 }
// options（features.wikiLinks，默认值 = 历史固定行为）:
//   unknownMode: 'text'（未知目标降级纯文本，默认）| 'link'（渲染为站内搜索链接 /{lang}/search/?q=…）| 'hide'（整体移除）
//   unknownSuffix: 未知目标显示文本附加后缀（默认 ''）
//   caseInsensitive: 标题匹配是否忽略大小写（默认 true）
//   allowCustomLabel: 是否允许 [[目标|自定义文本]] 覆盖显示文本（默认 true；false 时忽略 | 后文本）
//   lang: 'link' 模式的站内链接语言前缀（缺省时回退 'zh'）
// Percent-encode 搜索词：孤立代理无法编码（encodeURIComponent 抛 URIError），
// 先按 UTF-8 解码语义把孤立代理替换为 U+FFFD 再编码，保证任意字符串都能生成合法查询串。
function encodeSearchTarget(value) {
  const text = String(value);
  try {
    return encodeURIComponent(text);
  } catch (err) {
    return encodeURIComponent(
      text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '\uFFFD')
        .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
    );
  }
}

// Patterns: [[title]] [[title|显示文本]] [[slug]] [[slug|文本]] [[https://...]] [[url|文本]]
function resolveWikiLinks(content, lookup, options) {
  if (typeof content !== 'string' || !lookup) return content;
  const cfg = options || {};
  const mode = ['text', 'link', 'hide'].includes(cfg.unknownMode) ? cfg.unknownMode : 'text';
  const suffix = cfg.unknownSuffix == null ? '' : String(cfg.unknownSuffix);
  const caseInsensitive = cfg.caseInsensitive !== false;
  const allowLabel = cfg.allowCustomLabel !== false;
  const lang = /^[a-z]{2}(-[a-z0-9]+)?$/i.test(String(cfg.lang || '')) ? String(cfg.lang) : 'zh';
  const titles = lookup.titles || new Map();
  const slugs = lookup.slugs || new Map();
  const titlesExact = lookup.titlesExact || null;
  return content.replace(/\[\[([^\]]+)\]\]/g, function(m, inner) {
    const parts = inner.split('|');
    const target = parts[0].trim();
    const label = allowLabel ? (parts[1] || '').trim() : '';
    if (/^https?:\/\//i.test(target)) {
      return '[' + (label || target) + '](' + target + ')';
    }
    const byTitle = caseInsensitive ? titles.get(target.toLowerCase()) : (titlesExact ? titlesExact.get(target) : titles.get(target));
    const bySlug = slugs.get(target.replace(/^\/+|\/+$/g, ''));
    const hit = byTitle || bySlug;
    if (hit) return '[' + (label || hit.title) + '](' + hit.url + ')';
    if (mode === 'hide') return '';
    const text = (label || target) + suffix;
    if (mode === 'link') return '[' + text + '](/' + lang + '/search/?q=' + encodeSearchTarget(target) + ')';
    return text;
  });
}

// 检测渲染后的 HTML 是否包含需要 Prism 高亮的代码块；仅 mermaid 代码块不需要
// （由 mermaid vendor 接管），内联 <code> 也不算。用于按页决定是否引入 prism.js。
function hasHighlightableCode(html) {
  if (typeof html !== 'string' || !html) return false;
  const blockRe = /<pre\b[^>]*>\s*<code\b([^>]*)>/gi;
  let m;
  while ((m = blockRe.exec(html))) {
    const clsMatch = /class\s*=\s*"([^"]*)"/i.exec(m[1] || '');
    const langs = (clsMatch ? clsMatch[1] : '').split(/\s+/).filter(function (c) { return /^language-/.test(c); });
    if (langs.length && langs.every(function (c) { return c === 'language-mermaid'; })) continue;
    return true;
  }
  return false;
}

// 以「自有可枚举属性」语义写入键：普通赋值遇 key='__proto__' 会触发原型 setter
// （对象值改写原型、标量静默丢弃），而 JSON.parse/JSON5.parse 产物可携带该自有键。
// 序列化、映射与深合并等重建对象时必须经本函数，保证任意数据键不丢失。
function setOwnProperty(obj, key, value) {
  Object.defineProperty(obj, key, { value: value, enumerable: true, writable: true, configurable: true });
  return obj;
}

// 以「自有可枚举属性」语义拷贝源对象的字符串键：Object.assign 复制自有 '__proto__'
// 键时会触发目标原型 setter（对象值改写原型、标量静默丢键）。配置解析（JSON5）与
// 构建数据重建对象时必须经本函数，保证任意数据键不丢失、目标原型不被改写。
function copyOwnProperties(target, source) {
  for (const key of Object.keys(source || {})) setOwnProperty(target, key, source[key]);
  return target;
}

module.exports = { formatDate, safeSlug, validateSlug, isReservedOsName, hasUnsafeLinkScheme, SLUG_MAX_LENGTH, escapeAttr, escapeHtml, stripInvalidXmlChars, stripHtml, truncateCodePoints, insertCjkSpacing, applyCjkSpacingToHtml, extractToc, sanitizeHtml, escapeJsonForScript, countWords, countWordsDetail, resolveWikiLinks, hasHighlightableCode, setOwnProperty, copyOwnProperties, restrictMediaAttrs };
