'use strict';

const path = require('path');
const { safeSlug, validateSlug } = require('./utils');

const MEDIA_PREFIX = '/media/';
const VARIANT_RX = /(?:^|\/)variants\/(.+)-(\d+)\.(?:webp|avif|jpe?g|png)$/i;

/**
 * 提取正文中的 /media/ 引用（先去围栏代码块与行内代码，避免示例误报）。
 * 仅匹配独立的 /media/ 路径，不匹配 https://host/media/... 这类外链子串。
 * @param {string} text Markdown/HTML 正文
 * @returns {string[]} 去重后的引用（保持首次出现顺序）
 */
function extractMediaRefs(text) {
  if (typeof text !== 'string' || !text) return [];
  const stripped = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
  const out = [];
  const seen = new Set();
  const rx = /(?:^|[\s("'=])(\/media\/[^\s"'()<>[\]{}]+)/g;
  let m;
  while ((m = rx.exec(stripped)) !== null) {
    const ref = m[1].replace(/[?#].*$/, '');
    if (ref === MEDIA_PREFIX) continue;
    if (!seen.has(ref)) {
      seen.add(ref);
      out.push(ref);
    }
  }
  return out;
}

/**
 * 创建媒体引用校验器：接受源文件列表（相对 media/ 的 POSIX 路径），
 * 精确匹配源文件，并放行构建生成的 variants/ 变体路径（按其基名映射回源文件）。
 * @param {string[]} sourceFiles 相对路径列表，如 ['test-photo-1.jpg','sub/nested.webp']
 * @returns {(ref: string) => boolean}
 */
function createMediaResolver(sourceFiles) {
  const files = (Array.isArray(sourceFiles) ? sourceFiles : [])
    .map((f) => String(f).replace(/\\/g, '/'))
    .filter(Boolean);
  const set = new Set(files);
  const stems = new Set(files.map((f) => f.replace(/\.[^./]+$/, '')));
  return function mediaExists(ref) {
    if (typeof ref !== 'string' || !ref.startsWith(MEDIA_PREFIX)) return false;
    const rel = ref.slice(MEDIA_PREFIX.length).replace(/[?#].*$/, '');
    if (!rel) return false;
    if (set.has(rel)) return true;
    const m = rel.match(VARIANT_RX);
    if (m) {
      const dir = rel.slice(0, rel.length - m[0].length);
      const prefix = dir === '' || dir.endsWith('/') ? dir : dir + '/';
      return stems.has(prefix + m[1]);
    }
    return false;
  };
}

function firstH1(body) {
  const m = String(body || '').match(/^#\s+(.+)/m);
  return m ? m[1].trim() : '';
}

/**
 * 解析文章身份（标题与 slug），与 build.js 主处理逻辑保持同一优先级：
 * title: frontmatter.title > 首个 H1 > 文件名；slug: frontmatter.slug（强校验）> safeSlug(title)。
 * @param {Object} attrs frontmatter 属性
 * @param {string} body Markdown 正文
 * @param {string} filename 文件名（如 a.md）
 * @returns {{title: string, slug: string, explicitSlugInvalid: boolean}}
 */
function resolveArticleIdentity(attrs, body, filename) {
  const a = attrs && typeof attrs === 'object' ? attrs : {};
  const title = a.title || firstH1(body) || path.basename(String(filename || ''), '.md');
  if (a.slug != null) {
    const check = validateSlug(a.slug);
    if (check.ok) return { title, slug: check.slug, explicitSlugInvalid: false };
    return { title, slug: safeSlug(title), explicitSlugInvalid: true };
  }
  return { title, slug: safeSlug(title), explicitSlugInvalid: false };
}

function hasEmptyEntry(list) {
  return Array.isArray(list) && list.some((v) => String(v == null ? '' : v).trim() === '');
}

/**
 * 构建前只读预校验：重复 slug、非法日期、空标签/分类、缺失媒体引用。
 * 不做任何写入，供构建在清理 dist 之前调用。
 * @param {Array<{file: string, lang: string, attrs: Object, body: string}>} items
 * @param {{mediaExists: (ref: string) => boolean}} options
 * @returns {{errors: Array<{stage: string, file: string, message: string}>, warnings: Array}>}
 */
function preflightArticles(items, options) {
  const list = Array.isArray(items) ? items : [];
  const mediaExists = (options && options.mediaExists) || (() => true);
  const errors = [];
  const warnings = [];
  const seen = new Map();

  for (const item of list) {
    const file = item.file;
    const lang = item.lang;
    const attrs = item.attrs && typeof item.attrs === 'object' ? item.attrs : {};
    const identity = resolveArticleIdentity(attrs, item.body, path.basename(String(file)));

    if (identity.explicitSlugInvalid) {
      const reason = validateSlug(attrs.slug).reason;
      errors.push({
        stage: 'slug',
        file,
        message: file + ': frontmatter slug "' + String(attrs.slug).slice(0, 80) + '" is invalid (' + reason + ')'
      });
      continue;
    }

    const key = String(lang) + '/' + identity.slug;
    const first = seen.get(key);
    if (first) {
      errors.push({
        stage: 'slug',
        file,
        message: file + ': duplicate slug "' + identity.slug + '" (already used by ' + first + ')'
      });
      continue;
    }
    seen.set(key, file);

    if (attrs.date && isNaN(new Date(attrs.date).getTime())) {
      errors.push({
        stage: 'date',
        file,
        message: file + ': frontmatter "date: ' + attrs.date + '" is not a valid date. Expected YYYY-MM-DD or ISO 8601.'
      });
    }

    if (hasEmptyEntry(attrs.tags) || hasEmptyEntry(attrs.categories)) {
      errors.push({
        stage: 'taxonomy',
        file,
        message: file + ': frontmatter "tags"/"categories" contains an empty entry; remove it to avoid broken tag pages'
      });
    }

    const refs = new Set();
    if (attrs.featuredImage) refs.add(String(attrs.featuredImage));
    for (const ref of extractMediaRefs(item.body)) refs.add(ref);
    for (const ref of refs) {
      if (!mediaExists(ref)) {
        errors.push({ stage: 'media', file, message: file + ': references missing media "' + ref + '"' });
      }
    }
  }

  return { errors, warnings };
}

module.exports = { extractMediaRefs, createMediaResolver, resolveArticleIdentity, preflightArticles };
