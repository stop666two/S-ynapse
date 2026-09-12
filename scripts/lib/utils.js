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
// Last resort: random 4-char fallback (rare — only for non-alphanumeric non-CJK input).
function safeSlug(text) {
  if (!text) return '';
  let slug = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || /^[-\s]*$/.test(slug)) {
    slug = encodeURIComponent(text).toLowerCase().replace(/%[0-9a-f]{2}/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  if (!slug) slug = 'tag-' + Math.random().toString(36).slice(2, 6);
  return slug;
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
  'noscript','textarea','select','button','link','meta','base','canvas',
  'applet','frame','frameset'
]);

// Attributes allowed on tags. on* and style are always dropped separately.
const SAFE_ATTRS = new Set([
  'class','id','href','src','srcset','sizes','loading','decoding','data-lqip','data-w','data-h','alt','title','lang','type',
  'checked','disabled','colspan','rowspan','width','height',
  // media elements (video/audio/track)
  'controls','preload','loop','muted','autoplay','playsinline','poster','kind','srclang','default'
]);

// Remove executable/active HTML while keeping safe formatting tags.
// Handles: dangerous full-subtree removal, unknown-tag escaping,
// event-handler and style attribute stripping, javascript: URI filtering.
function sanitizeHtml(input) {
  if (typeof input !== 'string') return '';
  let output = input;
  const dangerPattern = [...DANGEROUS_TAGS].join('|');
  const dangerRemover = new RegExp(`<\\s*(${dangerPattern})(\\s[^>]*)?>[\\s\\S]*?<\\s*/\\s*\\1\\s*>`, 'gi');
  const dangerSelfCloser = new RegExp(`<\\s*(${dangerPattern})(\\s[^>]*)?/?>`, 'gi');
  output = output.replace(dangerRemover, ' ');
  output = output.replace(dangerSelfCloser, ' ');
  output = output.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\s*(\/?)\s*>/gi, function(match, closing, tag, attrs, selfClose) {
    const lower = tag.toLowerCase();
    if (closing) {
      return SAFE_TAGS.has(lower) ? match : '&lt;' + match.slice(1);
    }
    if (!SAFE_TAGS.has(lower)) return '&lt;' + match.slice(1);
    let safeAttrs = '';
    const attrRe = /([^\s=\/'"<>]+)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;
    let am;
    while ((am = attrRe.exec(attrs)) !== null) {
      const key = am[1];
      const val = am[2] ? am[2].trim().replace(/^\s*=\s*/, '') : null;
      const k = key.toLowerCase();
      if (k === 'on' || k.startsWith('on')) continue;
      if (k === 'style') continue;
      if (k.startsWith('data-') || k.startsWith('aria-')) { safeAttrs += ' ' + key + (val ? '=' + val : ''); continue; }
      if (!SAFE_ATTRS.has(k)) continue;
      if (val && (k === 'href' || k === 'src' || k === 'poster')) {
        const raw = val.replace(/^['"]|['"]$/g, '').trim();
        if (/^(javascript|vbscript|data):/i.test(raw)) continue;
        // Media elements may only load site-local sources: no absolute
        // http(s)// schema, no protocol-relative //host URLs.
        if ((lower === 'video' || lower === 'audio') && (k === 'src' || k === 'poster') && /^(?:[a-z][a-z0-9+.-]*:|\/\/|\\)/i.test(raw)) continue;
      }
      safeAttrs += ' ' + key + (val ? '=' + val : '');
    }
    return '<' + lower + safeAttrs + (selfClose ? ' />' : '>');
  });
  return output;
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

module.exports = { formatDate, safeSlug, escapeAttr, escapeHtml, stripHtml, insertCjkSpacing, applyCjkSpacingToHtml, extractToc, sanitizeHtml, escapeJsonForScript, countWords, resolveWikiLinks };
