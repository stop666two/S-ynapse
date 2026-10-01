'use strict';

const path = require('path');
const { safeSlug, validateSlug, isReservedOsName } = require('./utils');

const MEDIA_PREFIX = '/media/';
const VARIANT_RX = /(?:^|\/)variants\/(.+)-(\d+)\.(?:webp|avif|jpe?g|png)$/i;
// 媒体产物变体命名：<原名>-<宽度>.<格式>（与 scripts/build/media.js 的 variantName 同格式，可位于任意子目录）。
const OUTPUT_VARIANT_RX = /^(.+)-(\d+)\.(?:webp|avif|jpe?g|png)$/i;

/**
 * 规范化媒体引用：统一 POSIX 分隔符并剥离查询串/哈希（与 extractMediaRefs 同口径）。
 * @param {string} ref
 * @returns {string}
 */
function normalizeMediaRef(ref) {
  return String(ref == null ? '' : ref).replace(/\\/g, '/').replace(/[?#].*$/, '');
}

// 文章页固定落在 /{lang}/{slug}/，以下路径段已被构建器占用（聚合页/分页/资产目录），
// 同名 slug 会与生成目录互相覆盖：预校验直接阻断，而不是产出丢页面的站点。
const RESERVED_ROUTE_SEGMENTS = Object.freeze([
  'archive', 'tags', 'categories', 'gallery', 'search', 'series', 'page', 'assets'
]);

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
 * 创建「损坏媒体」匹配器：输入媒体处理失败清单（可含 `/media/` 前缀或相对路径，
 * Set 或数组皆可），返回判别函数。匹配规则：规范化后精确相等，或按产物变体名
 * （`<原名>-<宽度>.<格式>`）映射回失败的源文件。
 * @param {Iterable<string>} brokenRefs 媒体处理失败清单
 * @returns {(ref: string) => boolean} 传入 /media/ 引用返回是否损坏
 */
function createBrokenMediaMatcher(brokenRefs) {
  const refs = new Set();
  const stems = new Set();
  const list = brokenRefs instanceof Set ? brokenRefs : (Array.isArray(brokenRefs) ? brokenRefs : []);
  for (const raw of list) {
    let ref = normalizeMediaRef(raw);
    if (!ref) continue;
    if (!ref.startsWith(MEDIA_PREFIX)) {
      const stripped = ref.replace(/^\/+/, '');
      ref = MEDIA_PREFIX + (stripped.startsWith('media/') ? stripped.slice('media/'.length) : stripped);
    }
    refs.add(ref);
    stems.add(ref.slice(MEDIA_PREFIX.length).replace(/\.[^./]+$/, ''));
  }
  return function mediaBroken(ref) {
    const norm = normalizeMediaRef(ref);
    if (!norm || !norm.startsWith(MEDIA_PREFIX)) return false;
    if (refs.has(norm)) return true;
    const rel = norm.slice(MEDIA_PREFIX.length);
    const m = rel.match(OUTPUT_VARIANT_RX);
    return m ? stems.has(m[1]) : false;
  };
}

/**
 * 归并「损坏媒体」引用：sharp 处理失败清单（/media/ 引用）与内容策略拦截清单
 * （media/、assets/、videos/ 相对路径）。被策略拦截的 media/ 文件不会发布到 dist，
 * 与 sharp 失败同语义——上层据此让 featuredImage 回退自动封面/pattern，避免悬空引用。
 * @param {Iterable<string>} [sharpFailures]
 * @param {Iterable<{path?: string}|string|null>} [policyBlocked]
 * @returns {Set<string>} /media/ 引用集合
 */
function collectBrokenMediaRefs(sharpFailures, policyBlocked) {
  const refs = new Set();
  const add = (raw) => {
    let ref = normalizeMediaRef(raw);
    if (!ref) return;
    if (!ref.startsWith(MEDIA_PREFIX)) {
      const stripped = ref.replace(/^\/+/, '');
      ref = MEDIA_PREFIX + (stripped.startsWith('media/') ? stripped.slice('media/'.length) : stripped);
    }
    refs.add(ref);
  };
  const sharpList = sharpFailures instanceof Set || Array.isArray(sharpFailures) ? sharpFailures : [];
  for (const raw of sharpList) add(raw);
  const blockedList = Array.isArray(policyBlocked) ? policyBlocked : [];
  for (const entry of blockedList) {
    const rawPath = typeof entry === 'string' ? entry : (entry && entry.path);
    if (!rawPath) continue;
    const norm = String(rawPath).replace(/\\/g, '/').replace(/^\/+/, '');
    if (!norm.startsWith('media/')) continue;
    add(norm.slice('media/'.length));
  }
  return refs;
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

// 预校验问题记录：critical=true 的条目（slug 身份类）无论是否 --allow-degraded 都阻断构建；
// 其余（日期/分类/媒体引用）可在降级预览模式下放行。
function problem(stage, file, message, critical) {
  return { stage, file, message, critical: critical === true };
}

/**
 * 构建前只读预校验：重复 slug、非法日期、空标签/分类、缺失媒体引用。
 * 不做任何写入，供构建在清理 dist 之前调用。
 * @param {Array<{file: string, lang: string, attrs: Object, body: string}>} items
 * @param {{mediaExists: (ref: string) => boolean}} options
 * @returns {{errors: Object[], warnings: Object[]}}
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
      errors.push(problem('slug', file,
        file + ': frontmatter slug "' + String(attrs.slug).slice(0, 80) + '" is invalid (' + reason + ')', true));
      continue;
    }

    if (RESERVED_ROUTE_SEGMENTS.includes(identity.slug)) {
      errors.push(problem('slug', file,
        file + ': slug "' + identity.slug + '" collides with the generated /' + lang + '/' + identity.slug + '/ route; rename the article or choose another slug', true));
      continue;
    }

    if (isReservedOsName(identity.slug)) {
      errors.push(problem('slug', file,
        file + ': slug "' + identity.slug + '" is a reserved OS device name; rename the article or choose another slug', true));
      continue;
    }

    const key = String(lang) + '/' + identity.slug;
    const first = seen.get(key);
    if (first) {
      errors.push(problem('slug', file,
        file + ': duplicate slug "' + identity.slug + '" (already used by ' + first + ')', true));
      continue;
    }
    seen.set(key, file);

    if (attrs.date && isNaN(new Date(attrs.date).getTime())) {
      errors.push(problem('date', file,
        file + ': frontmatter "date: ' + attrs.date + '" is not a valid date. Expected YYYY-MM-DD or ISO 8601.', false));
    }

    if (hasEmptyEntry(attrs.tags) || hasEmptyEntry(attrs.categories)) {
      errors.push(problem('taxonomy', file,
        file + ': frontmatter "tags"/"categories" contains an empty entry; remove it to avoid broken tag pages', false));
    }

    const refs = new Set();
    if (attrs.featuredImage) refs.add(String(attrs.featuredImage));
    for (const ref of extractMediaRefs(item.body)) refs.add(ref);
    for (const ref of refs) {
      if (!mediaExists(ref)) {
        errors.push(problem('media', file, file + ': references missing media "' + ref + '"', false));
      }
    }
  }

  return { errors, warnings };
}

module.exports = { extractMediaRefs, createMediaResolver, createBrokenMediaMatcher, collectBrokenMediaRefs, normalizeMediaRef, resolveArticleIdentity, preflightArticles, RESERVED_ROUTE_SEGMENTS };
