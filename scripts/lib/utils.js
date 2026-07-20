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

module.exports = { formatDate, safeSlug, escapeAttr, escapeHtml, stripHtml, insertCjkSpacing, applyCjkSpacingToHtml, extractToc };
