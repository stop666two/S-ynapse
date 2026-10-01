'use strict';
// 文章内容管线（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createArticlesModule(ctx) 注入文章/页面/媒体目录、标记渲染器、hooks
// 与构建失败记录器；front-matter/marked 与 lib/utils 纯函数直连 require。
const fs = require('fs');
const path = require('path');
const frontMatter = require('front-matter');
const { marked } = require('marked');
const { getAllFiles } = require('./fs-utils');
const { preflightArticles, createMediaResolver, createBrokenMediaMatcher } = require('../lib/content-validate');
const { formatDate, safeSlug, validateSlug, applyCjkSpacingToHtml, extractToc, sanitizeHtml, truncateCodePoints, countWords, countWordsDetail, resolveWikiLinks, hasHighlightableCode, setOwnProperty } = require('../lib/utils');
const { siteLanguages: resolveSiteLanguages } = require('../lib/site-lang');
const { makeArticleComparator, stripMarkdownText, mathConfig, mathNeeded, wordCountConfig } = require('../lib/feature-wiring');

// 损坏头图回退：媒体处理失败的头图（源文件存在但 sharp 无法处理）在页面/卡片生成前清空，
// 使其落入「无 featuredImage」路径（自动封面/pattern）；原引用保留在 featuredImageBroken，
// 供构建报告告警与排查。返回回退的文章数。
function markBrokenFeaturedImages(articles, brokenRefs) {
  const isBroken = createBrokenMediaMatcher(brokenRefs);
  const list = Array.isArray(articles) ? articles : [];
  let count = 0;
  for (const article of list) {
    if (!article || !article.featuredImage) continue;
    if (!isBroken(article.featuredImage)) continue;
    article.featuredImageBroken = article.featuredImage;
    article.featuredImage = '';
    count++;
  }
  return count;
}

function createArticlesModule(ctx) {
  // Load Markdown content from pages/ as key-value map (filename → {title, content, body}).
  // Used by templates (e.g. article footer) for content that needs to be embedded into pages
  // without being rendered as a standalone HTML page. Also consumed by processCustomPages
  // which renders the same files as full standalone pages.
  // Key = filename without .md extension.
  function processPagesContent() {
    const result = {};
    if (!fs.existsSync(ctx.pagesDir)) {
      console.warn('  [WARN] pages/ directory not found, pages content will not be available');
      return null;
    }
    const files = fs.readdirSync(ctx.pagesDir).filter(f => /\.md$/i.test(f));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(ctx.pagesDir, file), 'utf-8');
        const fm = frontMatter(raw);
        const body = fm.body || '';
        const name = path.basename(file, '.md');
        // 文件名可为 '__proto__'：必须写成自有属性，否则改写结果对象原型且键丢失。
        setOwnProperty(result, name, {
          title: (fm.attributes && fm.attributes.title) || name,
          content: applyCjkSpacingToHtml ? sanitizeHtml(applyCjkSpacingToHtml(marked.parse(body))) : sanitizeHtml(marked.parse(body)),
          body: body
        });
      } catch (err) {
        console.error(`  [ERROR] Failed to process page content ${file}: ${err.message}`);
        ctx.recordBuildFailure('page', `Failed to process page content ${file}: ${err.message}`);
      }
    }
    if (!Object.keys(result).length) {
      console.warn('  [WARN] pages/ directory is empty, pages content will not be available');
      return null;
    }
    return result;
  }

  // Read-only content preflight. Runs BEFORE dist/ is cleaned so content errors
  // never leave a half-written output directory. Checks duplicate slugs, invalid
  // dates, empty taxonomy entries and missing /media references.
  function preflightContent(config) {
    console.log('[preflight] Validating article content...');
    const errors = [];
    const items = [];
    // 语言目录以 site.languages 为准（纯语言站不再扫描未配置的语言目录）。
    const LANGS = resolveSiteLanguages(config && config.site);
    const rel = (p) => path.relative(ctx.rootDir, p).split(path.sep).join('/');
    for (const lang of LANGS) {
      const langDir = path.join(ctx.articlesDir, lang);
      if (!fs.existsSync(langDir)) continue;
      for (const name of fs.readdirSync(langDir).filter((f) => /\.md$/i.test(f))) {
        const full = path.join(langDir, name);
        try {
          const fm = frontMatter(fs.readFileSync(full, 'utf-8'));
          items.push({ file: rel(full), lang: lang, attrs: fm.attributes || {}, body: fm.body || '' });
        } catch (err) {
          errors.push({ stage: 'article', file: rel(full), message: rel(full) + ': unreadable (' + err.message + ')' });
        }
      }
    }
    const sources = getAllFiles(ctx.mediaDir).map((f) => path.relative(ctx.mediaDir, f).split(path.sep).join('/'));
    const result = preflightArticles(items, { mediaExists: createMediaResolver(sources) });
    return { errors: errors.concat(result.errors), warnings: result.warnings };
  }

  // Parse all Markdown articles from articles/ into structured article objects.
  // For each article:
  //   1. Extract frontmatter (title, slug, date, tags, categories, draft, excerpt)
  //   2. Validate: max 1 h1 per article, reject articles with >1 h1
  //   3. Render Markdown → HTML using marked with the custom renderer
  //   4. Auto-generate excerpt from content if not in frontmatter
  //   5. Calculate read time based on word count
  //   6. Extract table of contents from headings
  //   7. Auto-generate OG image if no featuredImage in frontmatter
  //   8. If hooks.transformMarkdown exists, run content through it first
  // Returns array sorted by date descending.
  // Articles with multiple h1 tags are skipped with error.
  async function processArticles(config, mediaManifest, buildErrors) {
    console.log('[5/14] Processing articles...');
    ctx.setupMarkedRenderer(config, mediaManifest);
    const articles = [];
    if (!fs.existsSync(ctx.articlesDir)) {
      console.log('  articles/ directory not found');
      return articles;
    }
    const LANGS = resolveSiteLanguages(config.site);
    const files = [];
    for (const lang of LANGS) {
      const langDir = path.join(ctx.articlesDir, lang);
      if (fs.existsSync(langDir)) {
        for (const f of fs.readdirSync(langDir).filter(ff => /\.md$/i.test(ff))) {
          files.push({ file: f, lang, dir: langDir });
        }
      }
    }
    // Pre-scan pass: build a title/slug lookup so [[wiki links]] resolve across articles.
    // titles 键为小写（caseInsensitive=true 用）；titlesExact 保留原始大小写（caseInsensitive=false 用）。
    const wikiLookup = { titles: new Map(), titlesExact: new Map(), slugs: new Map() };
    const tagAliasesCfg = config.tagAliases || {};
    const aliasEnabled = tagAliasesCfg.enabled !== false;
    const tagAliases = tagAliasesCfg.aliases && typeof tagAliasesCfg.aliases === 'object' ? tagAliasesCfg.aliases : {};
    for (const meta of files) {
      const { file, lang } = meta;
      try {
        const fm = frontMatter(fs.readFileSync(path.join(meta.dir, file), 'utf-8'));
        const attrs = fm.attributes || {};
        const t = attrs.title || '';
        let s = '';
        if (attrs.slug != null) {
          const slugCheck = validateSlug(attrs.slug);
          if (!slugCheck.ok) continue;
          s = slugCheck.slug;
        } else {
          s = t ? safeSlug(t) : path.basename(file, '.md').replace(/\.md$/i, '');
        }
        const entry = { title: t || s, url: '/' + lang + '/' + s + '/' };
        wikiLookup.titles.set((t || s).toLowerCase(), entry);
        if (!wikiLookup.titlesExact.has(t || s)) wikiLookup.titlesExact.set(t || s, entry);
        wikiLookup.slugs.set(s, entry);
      } catch (e) { /* skip unreadable files in lookup */ }
    }
    function applyTagAliases(tags) {
      if (!aliasEnabled || !Object.keys(tagAliases).length) return tags;
      return tags.map(function(tag) {
        const k = (tag || '').trim();
        const direct = tagAliases[k];
        if (direct) return String(direct);
        const lowHit = tagAliases[k.toLowerCase()];
        if (lowHit) return String(lowHit);
        return tag;
      });
    }
    const MERMAID_RX = /```[ \t]*mermaid\b/i;
    const mathCfg = mathConfig(config.features);
    const wcCfg = wordCountConfig(config.features);
    const seenSlugs = new Map();
    for (const meta of files) {
      const { file, lang } = meta;
      const filePath = path.join(meta.dir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const fm = frontMatter(raw);
        const attrs = fm.attributes || {};
        let content = fm.body || '';
        if (ctx.getHooks() && ctx.getHooks().transformMarkdown) {
          content = ctx.getHooks().transformMarkdown(content, attrs) || content;
        }
        const noCodeContent = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
        const h1Matches = noCodeContent.match(/^#\s+/gm);
        const h1Count = h1Matches ? h1Matches.length : 0;
        if (h1Count > 1) {
          console.error(`  [ERROR] ${file}: ${h1Count} h1 headings found (max 1). Skipping.`);
          if (buildErrors) buildErrors.add('article', `${file}: ${h1Count} h1 headings found (max 1). Skipping.`);
          continue;
        }
        // Title resolution priority: frontmatter.title > first markdown h1 > filename
        let title = attrs.title || '';
        if (!title) {
          const firstH1 = content.match(/^#\s+(.+)/m);
          title = firstH1 ? firstH1[1].trim() : path.basename(file, '.md');
        }
        // Slug priority: frontmatter.slug (validated) > safeSlug(title)
        let slug;
        if (attrs.slug != null) {
          const slugCheck = validateSlug(attrs.slug);
          if (!slugCheck.ok) {
            const abortErr = new Error(`${file}: frontmatter slug "${String(attrs.slug).slice(0, 80)}" is invalid (${slugCheck.reason}). Aborting build.`);
            abortErr.isBuildAbort = true;
            throw abortErr;
          }
          slug = slugCheck.slug;
        } else {
          slug = safeSlug(title);
        }
        if ((seenSlugs.get(lang) || new Set()).has(slug)) {
          console.error(`  [ERROR] ${file}: duplicate slug "${slug}" (already used by another article in ${lang}). Skipping.`);
          ctx.recordBuildFailure('slug', `${file}: duplicate slug "${slug}" (already used by another article in ${lang})`);
          continue;
        }
        if (!seenSlugs.has(lang)) seenSlugs.set(lang, new Set());
        seenSlugs.get(lang).add(slug);
        const url = `/${lang}/${slug}/`;
        let excerpt = attrs.excerpt || '';
        // features.autoSummary.stripMarkdown（默认 true）：frontmatter excerpt 先剥离 Markdown 标记；
        // false 时原样保留（旧行为）。
        const _asCfg = (config.features && config.features.autoSummary) || {};
        if (excerpt && _asCfg.stripMarkdown !== false) excerpt = stripMarkdownText(excerpt);
        const date = attrs.date || null;
        if (date && isNaN(new Date(date).getTime())) {
          console.error(`  [ERROR] ${file}: frontmatter "date: ${date}" is not a valid date. Expected YYYY-MM-DD or ISO 8601. Skipping.`);
          ctx.recordBuildFailure('date', `${file}: frontmatter "date: ${date}" is not a valid date`);
          continue;
        }
        // 更新时间（frontmatter modified/updated）：meta article:modified_time、JSON-LD dateModified
        // 与 sitemap lastmod 优先使用；非法值忽略并告警（不阻断构建）。
        const modifiedRaw = attrs.modified || attrs.updated || null;
        let modified = null;
        if (modifiedRaw) {
          if (isNaN(new Date(modifiedRaw).getTime())) {
            console.warn(`  [WARN] ${file}: frontmatter "modified: ${modifiedRaw}" is not a valid date; ignored.`);
          } else {
            modified = modifiedRaw;
          }
        }
        if (!date) {
          console.warn(`  [WARN] ${file}: no frontmatter date; article is sorted before dated posts (use "date: YYYY-MM-DD" to control order).`);
        }
        if (attrs.tags !== undefined && !Array.isArray(attrs.tags)) {
          console.warn(`  [WARN] ${file}: frontmatter "tags" must be an array like ["a","b"]; auto-splitting "${attrs.tags}" on commas.`);
          attrs.tags = String(attrs.tags).split(',').map(function(s2) { return s2.trim(); }).filter(Boolean);
        }
        if (attrs.categories !== undefined && !Array.isArray(attrs.categories)) {
          console.warn(`  [WARN] ${file}: frontmatter "categories" must be an array like ["a"]; auto-splitting "${attrs.categories}" on commas.`);
          attrs.categories = String(attrs.categories).split(',').map(function(s2) { return s2.trim(); }).filter(Boolean);
        }
        const tags = applyTagAliases(Array.isArray(attrs.tags) ? attrs.tags : []).filter(function(t2) { return String(t2).trim() !== ''; });
        const categories = (Array.isArray(attrs.categories) ? attrs.categories : []).filter(function(c2) { return String(c2).trim() !== ''; });
        const draft = attrs.draft === true || attrs.draft === 'true';
        const pinned = attrs.pinned === true || attrs.pinned === 'true';
        const series = attrs.series ? String(attrs.series).trim() : null;
        // features.wikiLinks：构建期双链解析参数（unknownMode/unknownSuffix/caseInsensitive/allowCustomLabel）。
        const _wlCfg = (config.features && config.features.wikiLinks) || {};
        if (_wlCfg.enabled !== false) {
          content = resolveWikiLinks(content, wikiLookup, {
            unknownMode: _wlCfg.unknownMode,
            unknownSuffix: _wlCfg.unknownSuffix,
            caseInsensitive: _wlCfg.caseInsensitive,
            allowCustomLabel: _wlCfg.allowCustomLabel,
            lang
          });
        }
    // hasMath（按需加载 KaTeX 的触发条件）语义见 feature-wiring.mathNeeded：
    // autoDetect=true 维持历史口径（$$ / \( / \[，单 $ 不单独触发）；false 仅 ```math 围栏块。
    const hasMath = mathNeeded(content, mathCfg);
    const hasMermaid = MERMAID_RX.test(content);
        let htmlContent = marked.parse(content);
        if (config.site.build.cjkSpacing !== false) htmlContent = applyCjkSpacingToHtml(htmlContent);
        htmlContent = sanitizeHtml(htmlContent);
        const hasCode = hasHighlightableCode(htmlContent);
        // Auto-generate excerpt from rendered HTML (strip tags, truncate).
        // Code blocks (incl. mermaid sources) and math placeholders are stripped first so
        // raw code / TeX never leaks into cards, meta, feeds or search index.
        let excerptText = excerpt;
        if (!excerptText) {
          const noBlocks = htmlContent
            .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
            .replace(/<(span|div)[^>]*\bdata-tex=("[^"]*"|'[^']*'|[^\s>]+)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<a[^>]*class="heading-anchor"[^>]*>[\s\S]*?<\/a>/gi, ' ');
          const textOnly = noBlocks
            .replace(/<[^>]+>/g, ' ')
            .replace(/\$\$[\s\S]*?\$\$/g, ' ')
            .replace(/\\\[[\s\S]*?\\\]/g, ' ')
            .replace(/\\\([\s\S]*?\\\)/g, ' ')
            .replace(/\$\S[^$\n]*?\S\$|\$\S\$/g, ' ')
            .replace(/&lt;\/?[a-zA-Z][^&]*?&gt;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const as = (config.features && config.features.autoSummary) || {};
          const excerptLen = as.maxLength || config.site.build.excerptLength || config.theme.card?.excerptLength || 150;
          // 按码点截断：字符串 slice 可能把 emoji/CJK 扩展区代理对切成孤立代理（写盘变 U+FFFD）。
          const truncated = truncateCodePoints(textOnly, excerptLen);
          excerptText = truncated.length < textOnly.length ? truncated + (as.ellipsis || '...') : textOnly;
        }
        // Read time: prefers the per-script speeds from features.readingTime
        // (wordsPerMinuteCJK / wordsPerMinuteLatin); falls back to the legacy
        // features.wordCount.wpm → theme.card.readTimeSpeed → 265 chain.
        // features.readingTime.enabled === false disables the value entirely,
        // which in turn hides every read-time badge in the templates.
        // 字数口径（features.wordCount.countCjkChars/countDigits）仅影响字数展示；
        // readTime 的 CJK/Latin 分解始终使用完整口径（与 readingTime 速度键语义一致）。
        const wordCount = countWords(content, { countCjkChars: wcCfg.countCjkChars, countDigits: wcCfg.countDigits });
        const readingTimeCfg = (config.features && config.features.readingTime) || {};
        let readTime = null;
        if (readingTimeCfg.enabled !== false) {
          const cjkSpeed = Number(readingTimeCfg.wordsPerMinuteCJK);
          const latinSpeed = Number(readingTimeCfg.wordsPerMinuteLatin);
          if (cjkSpeed > 0 && latinSpeed > 0) {
            const detail = countWordsDetail(content);
            readTime = Math.max(1, Math.ceil(detail.cjk / cjkSpeed + detail.latin / latinSpeed));
          } else {
            const readSpeed = wcCfg.wpm || config.theme.card?.readTimeSpeed || 265;
            readTime = Math.max(1, Math.ceil(wordCount / readSpeed));
          }
        }
        const tocCfg = (config.features && config.features.toc) || {};
        const toc = extractToc(htmlContent, tocCfg.minLevel, tocCfg.maxLevel);
        // Auto OG image handled by scripts/generate-og.js (per-language PNG pipeline).

        articles.push({
          slug, title, url, date, modified, tags, categories, draft, pinned, series,
          lang, langPrefix: '/' + lang + '/',
          content: htmlContent,
          excerpt: excerptText,
          wordCount, readTime, toc, hasMath, hasMermaid,
          hasCode,
          featuredImage: attrs.featuredImage || '',
          frontmatter: attrs,
          filename: file,
          year: date ? new Date(date).getFullYear() : null,
          month: date ? String(new Date(date).getMonth() + 1).padStart(2, '0') : null,
          formattedDate: date ? formatDate(date, config.site.dateFormat) : ''
        });
        console.log(`  Processed: ${file} -> ${url}`);
      } catch (err) {
        if (err.isBuildAbort) throw err;
        console.error(`  [ERROR] Failed to process ${file}: ${err.message}`);
        if (buildErrors) buildErrors.add('article', `${file}: ${err.message}`);
      }
    }
    // features.pinned.sortRule='normal' 时按日期自然排序（不重排置顶）；'pinned-first'（默认）保持现行为。
    articles.sort(makeArticleComparator(config.features));
    console.log(`  Total: ${articles.length} articles processed`);
    return articles;
  }

  return { processPagesContent, preflightContent, processArticles, markBrokenFeaturedImages };
}

module.exports = { createArticlesModule, markBrokenFeaturedImages };
