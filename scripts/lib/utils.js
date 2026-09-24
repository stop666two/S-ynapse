const sanitizeHtmlLib = require('sanitize-html');
const { createHash } = require('node:crypto');

// Format a date string according to a template pattern (YYYY-MM-DD HH:mm).
// Automatically detects if the input includes time (non-midnight) and includes HH:mm in output.
// Falls back to returning the raw string if parsing fails.
function formatDate(dateStr, fmt) {
  if (!dateStr) return '';
  let d, hasTime = false;
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
function safeSlug(text) {
  if (!text) return '';
  let slug = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || /^[-\s]*$/.test(slug)) {
    slug = encodeURIComponent(text).toLowerCase().replace(/%[0-9a-f]{2}/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  if (!slug) slug = 'tag-' + createHash('sha1').update(String(text)).digest('hex').slice(0, 6);
  return slug;
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

// Strip all HTML tags and decode common entities (&amp;, &quot;, &#39;).
// Returns plain text with normalized whitespace. Used for excerpt generation and search indexing.
function stripHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

const CJK_RX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
// Count words: CJK chars count as one word each, Latin/CJK-mixed text splits on whitespace.
function countWords(text) {
  if (typeof text !== 'string') return 0;
  const cjk = (text.match(CJK_RX) || []).length;
  const latin = text.replace(CJK_RX, ' ').split(/\s+/).filter(Boolean).length;
  return cjk + latin;
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
function extractToc(html) {
  const toc = [];
  const regex = /<h([2-4])\s+id="([^"]+)"[^>]*>.*?<a[^>]*class="heading-anchor"[^>]*>#<\/a>(.*?)<\/h\1>/gi;
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
  const out = Object.assign({}, attribs);
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
// lookup: Map-like { titles: Map(lowerTitle → {title,url}), slugs: Map(slug → {title,url}) }
// Patterns: [[title]] [[title|显示文本]] [[slug]] [[slug|文本]] [[https://...]] [[url|文本]]
// Unknown targets are unwrapped to plain text (no link, no error).
function resolveWikiLinks(content, lookup) {
  if (typeof content !== 'string' || !lookup) return content;
  const titles = lookup.titles || new Map();
  const slugs = lookup.slugs || new Map();
  return content.replace(/\[\[([^\]]+)\]\]/g, function(m, inner) {
    const parts = inner.split('|');
    const target = parts[0].trim();
    const label = (parts[1] || '').trim();
    if (/^https?:\/\//i.test(target)) {
      const outer = label || target;
      return '[' + outer + '](' + target + ')';
    }
    const byTitle = titles.get(target.toLowerCase());
    const bySlug = slugs.get(target.replace(/^\/+|\/+$/g, ''));
    const hit = byTitle || bySlug;
    if (hit) return '[' + (label || hit.title) + '](' + hit.url + ')';
    return label || target;
  });
}

module.exports = { formatDate, safeSlug, validateSlug, escapeAttr, escapeHtml, stripHtml, insertCjkSpacing, applyCjkSpacingToHtml, extractToc, sanitizeHtml, escapeJsonForScript, countWords, resolveWikiLinks };
