'use strict';
// 页面生成族（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createPagesModule(ctx) 注入产物/页面/模板目录、CSP nonce、模板渲染器、
// 发布过滤器、收集器、页面状态读取器（媒体 manifest getter、内联配置体积 setter）与共享依赖。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ejs = require('ejs');
const frontMatter = require('front-matter');
const { marked } = require('marked');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { CJK_CSS_HREF } = require('../lib/cjk-fonts');
const { PRESETS: THEME_PRESETS } = require('../lib/theme-presets');
const { buildRuntimeConfig, configUrlName } = require('../lib/config-split');
const { formatDate, safeSlug, validateSlug, escapeAttr, applyCjkSpacingToHtml, sanitizeHtml, escapeJsonForScript, hasHighlightableCode } = require('../lib/utils');

function createPagesModule(ctx) {
  const { getTemplate, renderPage, getPublished, recordBuildFailure, collectFriends, collectSeries, collectGalleryImages, collectSiteStats, collectTags, collectCategories, collectTopTags, groupByYearMonth, categoryHue, resolveDailyQuotes, resolveFaviconHtml, CleanCSS } = ctx;
  let SITE_CSS_HREF = '';

  // 卡片（首页/标签列表）图片属性构造：从媒体 manifest 读取原格式多尺寸变体生成 srcset，
  // 使首屏卡片不再下载 1600px 原图（LCP 优化）。仅用 original 格式变体（不引入 <picture>，不改现有 CSS 选择器结构）。
  // manifest 不可用时回退为纯 src 属性；URL 会在 cache-bust 阶段被重写为带哈希路径。
  function buildCardImgAttrs(src) {
    const raw = String(src || '');
    const fallback = `src="${escapeAttr(raw)}"`;
    const MEDIA_MANIFEST = ctx.getMediaManifest();
    if (!raw || !MEDIA_MANIFEST) return fallback;
    const entry = MEDIA_MANIFEST[raw.replace(/^\//, '')];
    if (!entry || !entry.variants) return fallback;
    const items = [];
    for (const [key, val] of Object.entries(entry.variants)) {
      if (key.split('-').pop() !== 'original') continue;
      const w = parseInt(key.split('-')[0], 10);
      if (w) items.push([w, val]);
    }
    if (!items.length) return fallback;
    items.sort((a, b) => a[0] - b[0]);
    const srcFinal = entry.original || raw;
    const naturalW = parseInt(entry.width, 10);
    if (naturalW && !items.some((it) => it[0] === naturalW)) items.push([naturalW, srcFinal]);
    const srcset = items.map((it) => `${escapeAttr(it[1])} ${it[0]}w`).join(', ');
    return `src="${escapeAttr(srcFinal)}" srcset="${srcset}" sizes="(max-width: 768px) 100vw, 640px"`;
  }

  function buildSiteCss(config, baseData) {
    const b = config.site.build;
    SITE_CSS_HREF = '/' + b.cssOutDir + '/' + b.cssFileBase + '.css';
    const templateStr = getTemplate('site-css.ejs');
    if (!templateStr) {
      console.error('  [WARN] templates/site-css.ejs not found; layout will reference ' + SITE_CSS_HREF);
      return SITE_CSS_HREF;
    }
    let css = ejs.render(templateStr, baseData, { filename: path.join(ctx.templatesDir, 'site-css.ejs') });
    if (CleanCSS && config.site.build.minifyCSS !== false) {
      try {
        const min = new CleanCSS({ level: 1 }).minify(css);
        if (!min.errors || !min.errors.length) css = min.styles;
      } catch (e) {
        console.warn('  [WARN] site CSS minify failed: ' + e.message);
      }
    }
    const hash = crypto.createHash(b.hashAlgorithm).update(css).digest('hex').slice(0, b.hashLength);
    const rel = b.cssOutDir + '/' + b.cssFileBase + '.' + hash + '.css';
    const file = path.join(ctx.distDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeFileAtomicSync(file, css, 'utf-8');
    SITE_CSS_HREF = '/' + rel;
    console.log('  Created: ' + rel + ' (' + Math.round(Buffer.byteLength(css) / 1024) + 'KB)');
    return SITE_CSS_HREF;
  }
  // Theme presets for runtime picker + externalized runtime config (global, identical on every page).
  function buildRuntimePresets() {
    const out = [];
    for (const id of Object.keys(THEME_PRESETS)) {
      const p = THEME_PRESETS[id];
      out.push({ id: id, label: p.label, labelEn: p.labelEn || p.label, light: p.light, dark: p.dark,
        sample: { light: [p.light.background, p.light.primary, p.light.secondary, p.light.accent],
                  dark: [p.dark.background, p.dark.primary, p.dark.secondary, p.dark.accent] } });
    }
    return out;
  }

  // 运行时配置分层外部化（优化 Task 1.1）：写 /assets/config.<hash>.json（内容寻址、可 immutable 缓存），
  // 返回内联降级子集 critical（guard 开关 + PWA 注册信息，≤2048 字节，超限由 config-split 抛错阻断构建）。
  // 逐页/逐语言小项（__SITE_TITLE__/__ART_TITLE__/__SEARCH_PROVIDER__）不在此处，继续内联。
  function writeRuntimeConfig(config, presets, dailyQuotes) {
    const { critical, external } = buildRuntimeConfig({
      features: config.features,
      tuning: config.tuning,
      guard: config.guard,
      morphIcons: (config.features && config.features.morphIcons) || {},
      presets: presets,
      quotes: dailyQuotes,
      uiStrings: config.uiStrings,
      linkWarning: config.site && config.site.externalLinkWarning,
      pwa: config.site && config.site.pwa
    });
    const jsonText = JSON.stringify(external);
    ctx.setInlineConfigKb(Buffer.byteLength(JSON.stringify(critical), 'utf-8') / 1024);
    const url = configUrlName(jsonText);
    const file = path.join(ctx.distDir, url.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeFileAtomicSync(file, jsonText, 'utf-8');
    console.log('  Created: ' + url + ' (' + Math.round(Buffer.byteLength(jsonText) / 1024) + 'KB)');
    return { url, critical };
  }

  // Build the unified data object passed to every EJS template.
  // Contains: site config, theme, nav, sidebar, footer, security settings,
  // all articles, tags, categories, archives, and helper functions.
  // This is the base context — individual page generators add page-specific keys on top.
  function buildPageData(config, articles, tags, categories, resolvedDailyQuotes) {
    const published = getPublished(articles);
    const friendsCfg = collectFriends(config);
    let nav = config.navigation;
// Auto-inject a 友链 menu entry when friends are configured but no menu item points to /links/.
  // Inserted right after the "关于" menu item (falling back to append at end).
    if (friendsCfg && nav && Array.isArray(nav.menu)) {
      const hasLinks = nav.menu.some(function(m) { return m && (m.url === '/links/' || m.url === '/links'); });
      if (!hasLinks) {
        const menu = nav.menu.slice();
        const aboutIdx = menu.findIndex(function(m) { return m && /\/about\/?$/.test(m.url) && /关于/.test(m.label || ''); });
        const linkItem = { label: '友链', labelEn: 'Links', url: '/links/', type: 'page' };
        if (aboutIdx > -1) { menu.splice(aboutIdx + 1, 0, linkItem); }
        else { menu.push(linkItem); }
        nav = { ...nav, menu };
      }
    }
    let imageFitCss = '';
    const _ifCfg = (config.features && config.features.imageFit) || {};
    if (_ifCfg.enabled !== false && _ifCfg.content && _ifCfg.content.upscale === 'cap') {
      try {
        const mf = JSON.parse(fs.readFileSync(path.join(ctx.distDir, 'media-manifest.json'), 'utf8'));
        const widths = new Set();
        Object.keys(mf).forEach(function (k) { const e = mf[k]; if (e && e.width) widths.add(e.width); });
        imageFitCss = Array.from(widths).map(function (w) { return '[data-iw="' + w + '"]{--iw:' + w + 'px}'; }).join('');
      } catch (e) { imageFitCss = ''; }
    }
    return {
      site: config.site,
      theme: config.theme,
      features: config.features,
      uiStrings: config.uiStrings || {},
      tuning: config.tuning || {},
      guard: config.guard || {},
      imageFitCss,
      nav,
      sidebar: config.sidebar,
      footer: config.footer,
      security: config.security,
      allArticles: published,
      page: {},
      recentPosts: published.slice(0, 10),
      allTags: tags,
      allCategories: categories,
      archives: groupByYearMonth(published),
      seriesList: collectSeries(published),
      friends: friendsCfg,
      galleryItems: collectGalleryImages(articles),
      siteStats: collectSiteStats(articles, tags, categories),
      listCoverEnabled: !!(config.features && config.features.listCover && config.features.listCover.enabled !== false),
      searchProvider: (config.navigation && config.navigation.search && config.navigation.search.provider) || 'local',
      currentUrl: '/',
      currentPage: 'index',
      presets: buildRuntimePresets(),
      formatDate: (d) => formatDate(d, config.site.dateFormat),
      generateSlug: safeSlug,
      categoryHue: categoryHue,
      escapeAttr: escapeAttr,
      ui: function(path, fallback, lang) {
        let o = config.uiStrings || {};
        if (lang === 'en' && o.en) o = o.en;
        for (const k of String(path).split('.')) {
          if (o == null) return fallback;
          o = o[k];
        }
        return (o === undefined || o === null) ? fallback : o;
      },
      escapeJsonForScript: escapeJsonForScript,
      JSON: JSON,
      Array: Array,
      Math: Math,
      Date: Date,
      cardImgAttrs: buildCardImgAttrs,
      config,
      dailyQuotes: resolvedDailyQuotes || resolveDailyQuotes(config),
      faviconHtml: resolveFaviconHtml(config.site || {}, config.theme && config.theme.colors && config.theme.colors.secondary),
      siteCssHref: SITE_CSS_HREF,
      // CJK 子集样式引用（构建后期由 scripts/build/cjk-fonts.js 产出并改写为内容哈希查询串；
      // 失败/未启用时管线会剥离该引用，页面自动回退系统字体链）。
      cjkFontsHref: (config.site.build && config.site.build.cjkFonts && config.site.build.cjkFonts.enabled !== false) ? CJK_CSS_HREF : ''
    };
  }

  // Parse standalone pages from Markdown files in pages/ directory (parsing only, no rendering).
  // Each .md file is rendered per language by generatePages() to /{lang}/{slug}/index.html.
  // Language override: pages/{lang}/{file} wins over pages/{file} when present (fallback = default file).
  // Title priority: frontmatter.title > filename. Slug priority: slugOverride > attrs.slug > safeSlug(title).
  // The same files are also loaded by processPagesContent() for template embedding (e.g. article footer).
  // Duplicate slugs are silently skipped (first writer wins).
  function processCustomPages(config) {
    console.log('Processing custom pages...');
    const createdSlugs = new Set();
    const customPages = [];
    const langs = (config.site.languages && config.site.languages.length) ? config.site.languages : ['zh', 'en'];
    function parseOne(sourcePath, file, slugOverride) {
      const raw = fs.readFileSync(sourcePath, 'utf-8');
      const fm = frontMatter(raw);
      const attrs = fm.attributes || {};
      const content = fm.body || '';
      const title = attrs.title || path.basename(file, '.md');
      const description = attrs.description || config.site.description || '';
      const slugCheck = validateSlug(slugOverride || attrs.slug || safeSlug(title));
      if (!slugCheck.ok) {
        throw new Error(`invalid page slug "${String(slugOverride || attrs.slug || '').slice(0, 80)}" in ${file}: ${slugCheck.reason}`);
      }
      const slug = slugCheck.slug;
      let htmlContent = marked.parse(content);
      if (config.site.build.cjkSpacing !== false) htmlContent = applyCjkSpacingToHtml(htmlContent);
      htmlContent = sanitizeHtml(htmlContent);
      return { slug, title, description, content: htmlContent, hasCode: hasHighlightableCode(htmlContent), date: attrs.date || null };
    }
    if (fs.existsSync(ctx.pagesDir)) {
      const files = fs.readdirSync(ctx.pagesDir).filter(f => /\.md$/i.test(f));
      for (const file of files) {
        try {
          const def = parseOne(path.join(ctx.pagesDir, file), file);
          if (createdSlugs.has(def.slug)) continue;
          createdSlugs.add(def.slug);
          const page = {
            slug: def.slug,
            date: def.date,
            default: { title: def.title, description: def.description, content: def.content },
            langs: {}
          };
          for (const lang of langs) {
            const langFile = path.join(ctx.pagesDir, lang, file);
            if (fs.existsSync(langFile)) {
              const ov = parseOne(langFile, file, def.slug);
              page.langs[lang] = { title: ov.title, description: ov.description, content: ov.content };
            }
          }
          customPages.push(page);
        } catch (err) {
          console.error('  [ERROR] Failed to process custom page ' + file + ': ' + err.message);
          recordBuildFailure('page', 'Failed to process custom page ' + file + ': ' + err.message);
        }
      }
    }
    console.log('  Total: ' + customPages.length + ' custom pages processed');
    return customPages;
  }

  function localizeSidebar(sidebar, lang) {
    if (!sidebar || !sidebar.widgets) return sidebar;
    const copy = JSON.parse(JSON.stringify(sidebar));
    copy.widgets = copy.widgets.map(w => {
      if (lang === 'en' && w.titleEn) return { ...w, title: w.titleEn };
      return w;
    });
    return copy;
  }

  function localizeNav(nav, pf, lang) {
    if (!nav || !nav.menu) return nav;
    const copy = JSON.parse(JSON.stringify(nav));
    copy.menu = copy.menu.map(m => {
      const u = m.url || '';
      return { ...m, url: (u.startsWith('/') && !u.startsWith('//')) ? pf + u.replace(/^\//, '') : u, label: (lang === 'en' && m.labelEn) ? m.labelEn : m.label };
    });
    return copy;
  }

  function localizeFooter(footer, pf, lang) {
    if (!footer) return footer;
    const copy = JSON.parse(JSON.stringify(footer));
    const fix = (l) => {
      const u = l.url || '';
      return { ...l, url: (u.startsWith('/') && !u.startsWith('//')) ? pf + u.replace(/^\//, '') : u, label: (lang === 'en' && l.labelEn) ? l.labelEn : l.label };
    };
    if (copy.columnItems && copy.columnItems.items) {
      copy.columnItems.items = copy.columnItems.items.map(c => {
        const fixed = { ...c };
        if (c.titleEn) fixed.title = (lang === 'en') ? c.titleEn : c.title;
        if (!c.links) return fixed;
        return { ...fixed, links: c.links.map(l => l.enabled === false ? l : fix(l)) };
      });
    }
    if (copy.bottomLinks && copy.bottomLinks.items) {
      copy.bottomLinks.items = copy.bottomLinks.items.map(l => l.enabled === false ? l : fix(l));
    }
    return copy;
  }

  // 分页窗口化:total<=maxVisible 时全显示;超出时保留首尾与当前窗口,间隔用省略号。
  // maxVisibleRaw 可来自 tuning(字符串)或 undefined(默认 5);下限 3。
  function buildPaginationItems(totalPages, current, maxVisibleRaw, urlFor) {
    const mv = Math.max(3, parseInt(maxVisibleRaw, 10) || 5);
    const items = [];
    if (totalPages <= mv) {
      for (let p = 1; p <= totalPages; p++) items.push({ num: p, url: urlFor(p), current: p === current });
      return items;
    }
    const half = Math.max(1, Math.floor((mv - 2) / 2));
    const nums = new Set([1, totalPages]);
    for (let p = current - half; p <= current + half; p++) { if (p >= 1 && p <= totalPages) nums.add(p); }
    let prev = 0;
    for (let p = 1; p <= totalPages; p++) {
      if (nums.has(p)) { items.push({ num: p, url: urlFor(p), current: p === current }); prev = p; }
      else if (prev !== -1) { items.push({ ellipsis: true }); prev = -1; }
    }
    return items;
  }

  // Generate all HTML pages for the site (per-language):
  // For each language (config.site.languages or ['zh','en']), renders:
  // - Index pages with pagination (/{lang}/, /{lang}/page/N/)
  // - Article detail pages (/{lang}/{slug}/)
  // - Archive (/{lang}/archive/)
  // - Tags overview + individual tag pages (/{lang}/tags/)
  // - Categories overview + individual category pages (/{lang}/categories/)
  // - 404 (/{lang}/404.html), search (/{lang}/search/), favorites (/{lang}/favorites/)
  // - gallery (/{lang}/gallery/), links (/{lang}/links/)
  // - Env: baseData.articles/friends/pagesContent are language-agnostic; each lang
  //   filters its own published articles and tags/categories below.
  async function generatePages(config, articles, preBuiltBaseData, customPages) {
    console.log('[6/14] Generating pages...');
    const layoutTemplate = getTemplate('layout.ejs');
    if (!layoutTemplate) { console.error('  [FATAL] layout.ejs not found in templates/'); recordBuildFailure('render', 'layout.ejs not found in templates/'); return; }
    const baseData = preBuiltBaseData || buildPageData(config, articles, collectTags(articles), collectCategories(articles));
    if (customPages && customPages.length) baseData.customPages = customPages;

    const siteLangs = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);

    async function writeFile(relPath, content) {
      if (!content) return;
      const fullPath = path.join(ctx.distDir, relPath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      writeFileAtomicSync(fullPath, content, 'utf-8');
      console.log(`  Created: ${relPath}`);
    }

    for (const lang of siteLangs) {
      const pf = '/' + lang + '/';
      const langArticles = articles.filter(a => a.lang === lang);
      const langPublished = getPublished(langArticles);
      const langTags = collectTags(langArticles);
      const langCategories = collectCategories(langArticles);
      const langTopTags = collectTopTags(langArticles, null, lang);
      const langData = {
        ...baseData,
        lang,
        langPrefix: pf,
        title: lang === 'en' ? (config.site.titleEn || config.site.title) : config.site.title,
        articleTitle: null,
        ui: (path, fallback) => {
          let o = config.uiStrings || {};
          if (lang === 'en' && o.en) o = o.en;
          for (const k of String(path).split('.')) {
            if (o == null) return fallback;
            o = o[k];
          }
          return (o === undefined || o === null) ? fallback : o;
        },
        articles: langPublished,
        allArticles: langPublished,
        tags: langTags,
        allTags: langTags,
        categories: langCategories,
        allCategories: langCategories,
        recentPosts: langPublished.slice(0, 10),
        archives: groupByYearMonth(langPublished),
        seriesList: collectSeries(langPublished),
        galleryItems: collectGalleryImages(langArticles),
        siteStats: collectSiteStats(langArticles, langTags, langCategories),
        nav: localizeNav(baseData.nav, pf, lang),
        footer: localizeFooter(baseData.footer, pf, lang),
        sidebar: localizeSidebar(baseData.sidebar, lang)
      };

      if (config.site.build.generateIndex !== false) {
        const postsPerPage = config.site.postsPerPage || 10;
        const totalPages = Math.max(1, Math.ceil(langPublished.length / postsPerPage));
        for (let page = 1; page <= totalPages; page++) {
          const start = (page - 1) * postsPerPage;
          const end = start + postsPerPage;
          const pageArticles = langPublished.slice(start, end);
          const f = config.features;
          const heroEnabled = page === 1 && config.site.hero && config.site.hero.enabled !== false && f.hero.enabled !== false;
          const data = {
            ...langData,
            articles: pageArticles,
            heroData: heroEnabled ? {
              title: (lang === 'en' && config.site.hero.titleEn) ? config.site.hero.titleEn : (config.site.hero.title || config.site.title),
              subtitle: (lang === 'en' && config.site.hero.subtitleEn) ? config.site.hero.subtitleEn : (config.site.hero.subtitle || config.site.subtitle || config.site.description),
              showSearch: config.site.hero.showSearch !== false && f.hero.showSearch !== false,
              showTags: config.site.hero.showTags !== false && f.hero.showTags !== false,
              showCta: config.site.hero.showCta !== false && f.hero.showCta !== false,
              ctaLabel: lang === 'en' ? (config.site.hero.ctaLabelEn || f.hero.ctaLabelEn) : (config.site.hero.ctaLabel || f.hero.ctaLabel),
              ctaUrl: config.site.hero.ctaUrl || f.hero.ctaUrl,
              showDate: f.hero.showDate === true,
              date: (langPublished[0] && langPublished[0].formattedDate) || '',
              tagCount: config.site.hero.tagCount || f.hero.tagCount,
              tags: langTopTags.slice(0, config.site.hero.tagCount || f.hero.tagCount)
            } : null,
            pagination: {
              current: page,
              total: totalPages,
              prev: page > 1 ? (page === 2 ? pf : pf + 'page/' + (page - 1) + '/') : null,
              next: page < totalPages ? pf + 'page/' + (page + 1) + '/' : null,
              prevLabel: lang === 'en' ? 'Previous' : (config.site.paginationPrev || '上一页'),
              nextLabel: lang === 'en' ? 'Next' : (config.site.paginationNext || '下一页'),
              items: buildPaginationItems(totalPages, page, config.tuning && config.tuning.pagination && config.tuning.pagination.maxVisible, function (p) { return p === 1 ? pf : pf + 'page/' + p + '/'; })
            },
            currentUrl: page === 1 ? pf : pf + 'page/' + page + '/',
            currentPage: 'index'
          };
          const html = renderPage('index.ejs', data, layoutTemplate, config);
          if (html) {
            if (page === 1) await writeFile(lang + '/index.html', html);
            else await writeFile(lang + '/page/' + page + '/index.html', html);
          }
        }
      }

      // Article detail pages (per language)
      for (const article of langPublished) {
        if (article.draft) continue;
        const idx = langPublished.indexOf(article);
        const prev = idx > 0 ? langPublished[idx - 1] : null;
        const next = idx < langPublished.length - 1 ? langPublished[idx + 1] : null;
        const data = {
          ...langData,
          article,
          title: article.title,
          prevArticle: prev && !prev.draft ? { title: prev.title, url: prev.url, featuredImage: prev.featuredImage || '' } : null,
          nextArticle: next && !next.draft ? { title: next.title, url: next.url, featuredImage: next.featuredImage || '' } : null,
          altArticle: (() => {
            const alt = getPublished(articles).find(a => a.lang !== article.lang && a.slug === article.slug && !a.draft);
            return alt ? { url: alt.url, lang: alt.lang, title: alt.title } : null;
          })(),
          currentUrl: article.url,
          currentPage: 'post'
        };
        const html = renderPage('post.ejs', data, layoutTemplate, config);
        if (html) await writeFile(lang + '/' + article.slug + '/index.html', html);
      }

      if (config.site.build.generateArchive !== false) {
        const data = { ...langData, title: lang === 'en' ? 'Archive' : '归档', currentUrl: pf + 'archive', currentPage: 'archive' };
        const html = renderPage('archive.ejs', data, layoutTemplate, config);
        if (html) await writeFile(lang + '/archive/index.html', html);
      }

      if (config.site.build.generateTags !== false) {
        const data = { ...langData, title: lang === 'en' ? 'Tags' : '标签', currentUrl: pf + 'tags', currentPage: 'tags' };
        const html = renderPage('tags.ejs', data, layoutTemplate, config);
        if (html) await writeFile(lang + '/tags/index.html', html);
        for (const tag of langTags) {
          const tagArticles = langPublished.filter(a => !a.draft && a.tags.includes(tag.name));
          const tagData = { ...langData, title: tag.name, tag, tagName: tag.name, articles: tagArticles, currentUrl: tag.url, currentPage: 'tag' };
          const tagHtml = renderPage('tag.ejs', tagData, layoutTemplate, config);
          if (tagHtml) await writeFile(lang + '/tags/' + tag.slug + '/index.html', tagHtml);
        }
      }

      if (config.site.build.generateCategories !== false) {
        const data = { ...langData, title: lang === 'en' ? 'Categories' : '分类', currentUrl: pf + 'categories', currentPage: 'categories' };
        const html = renderPage('categories.ejs', data, layoutTemplate, config);
        if (html) await writeFile(lang + '/categories/index.html', html);
        for (const cat of langCategories) {
          const catArticles = langPublished.filter(a => !a.draft && a.categories.includes(cat.name));
          const catData = { ...langData, title: cat.name, category: cat, categoryName: cat.name, articles: catArticles, currentUrl: cat.url, currentPage: 'category' };
          const catHtml = renderPage('category.ejs', catData, layoutTemplate, config);
          if (catHtml) await writeFile(lang + '/categories/' + cat.slug + '/index.html', catHtml);
        }
      }

      const data404 = { ...langData, title: '404', currentUrl: pf + '404', currentPage: '404' };
      const html404 = renderPage('404.ejs', data404, layoutTemplate, config);
      if (html404) await writeFile(lang + '/404.html', html404);

      if (config.features && config.features.favorites && config.features.favorites.enabled !== false) {
        const favData = { ...langData, title: lang === 'en' ? 'Favorites' : '收藏', currentUrl: pf + 'favorites', currentPage: 'favorites' };
        const favHtml = renderPage('favorites.ejs', favData, layoutTemplate, config);
        if (favHtml) await writeFile(lang + '/favorites/index.html', favHtml);
      }

      if (config.site.build.generateGallery !== false) {
        const galleryData = { ...langData, title: lang === 'en' ? 'Gallery' : '图库', currentUrl: pf + 'gallery', currentPage: 'gallery' };
        const galleryHtml = renderPage('gallery.ejs', galleryData, layoutTemplate, config);
        if (galleryHtml) await writeFile(lang + '/gallery/index.html', galleryHtml);
      }

      if (baseData.friends) {
        const fdTitle = (baseData.friends.labels && (lang === 'en' ? baseData.friends.labels.en : baseData.friends.labels.zh)) || (lang === 'en' ? 'Friends' : '友情链接');
        const linksData = { ...langData, title: fdTitle, currentUrl: pf + 'links/', currentPage: 'links', pageTitle: fdTitle };
        const linksHtml = renderPage('links.ejs', linksData, layoutTemplate, config);
        if (linksHtml) await writeFile(lang + '/links/index.html', linksHtml);
      }

      if (config.navigation.search && config.navigation.search.enabled) {
        const searchData = { ...langData, title: lang === 'en' ? 'Search' : '搜索', currentUrl: pf + 'search', currentPage: 'search' };
        const searchHtml = renderPage('search.ejs', searchData, layoutTemplate, config);
        if (searchHtml) await writeFile(lang + '/search/index.html', searchHtml);
      }

      if (customPages && customPages.length) {
        for (const cp of customPages) {
          const ov = (cp.langs && cp.langs[lang]) || cp.default;
          const pageData = {
            ...langData,
            title: ov.title,
            description: ov.description,
            pageTitle: ov.title,
            pageContent: ov.content,
            hasCode: typeof ov.hasCode === 'boolean' ? ov.hasCode : hasHighlightableCode(ov.content),
            pageSlug: cp.slug,
            currentUrl: pf + cp.slug + '/',
            currentPage: 'page'
          };
          const pageHtml = renderPage('page.ejs', pageData, layoutTemplate, config);
          if (pageHtml) await writeFile(lang + '/' + cp.slug + '/index.html', pageHtml);
        }
      }
    }
    // Root / landing = zh index + auto language redirect script.
    {
      const rootLang = 'zh';
      const pf = '/' + rootLang + '/';
      const rp = getPublished(articles.filter(a => a.lang === rootLang));
      const postsPerPage = config.site.postsPerPage || 10;
      const totalPages = Math.max(1, Math.ceil(rp.length / postsPerPage));
      const start = 0;
      const end = start + postsPerPage;
      const rootArticles = rp.slice(start, end);
      const f = config.features;
      const rt = collectTopTags(articles.filter(a => a.lang === rootLang), null, rootLang);
      const heroEnabled = config.site.hero && config.site.hero.enabled !== false && f.hero.enabled !== false;
      const rootData = {
        ...baseData,
        lang: rootLang,
        langPrefix: pf,
        articles: rootArticles,
        allArticles: rp,
        heroData: heroEnabled ? {
          title: config.site.hero.title || config.site.title,
          subtitle: config.site.hero.subtitle || config.site.subtitle || config.site.description,
          showSearch: config.site.hero.showSearch !== false && f.hero.showSearch !== false,
          showTags: config.site.hero.showTags !== false && f.hero.showTags !== false,
          showCta: config.site.hero.showCta !== false && f.hero.showCta !== false,
          ctaLabel: config.site.hero.ctaLabel || f.hero.ctaLabel,
          ctaUrl: config.site.hero.ctaUrl || f.hero.ctaUrl,
          showDate: f.hero.showDate === true,
          date: (rp[0] && rp[0].formattedDate) || '',
          tagCount: config.site.hero.tagCount || f.hero.tagCount,
          tags: rt.slice(0, config.site.hero.tagCount || f.hero.tagCount)
        } : null,
        pagination: {
          current: 1, total: totalPages,
          prev: null,
          next: totalPages > 1 ? pf + 'page/2/' : null,
          prevLabel: '上一页', nextLabel: '下一页',
          items: buildPaginationItems(totalPages, 1, config.tuning && config.tuning.pagination && config.tuning.pagination.maxVisible, function (p) { return p === 1 ? pf : pf + 'page/' + p + '/'; })
        },
        currentUrl: pf,
        currentPage: 'index'
      };
      const html = renderPage('index.ejs', rootData, layoutTemplate, config);
      if (html) {
        // 该片段在 renderPage 之后插入，必须自行带上构建期 nonce（否则严格 CSP 下不执行）
        const redirectSnippet = '<script nonce="' + ctx.cspNonce + '">/*S-LANG-REDIRECT*/if(navigator.language&&/(en|en-US|en-GB|en-CA)/i.test(navigator.language)&&!localStorage.getItem("s-ss-lang")){location.replace("/en/");}</script>';
        const finalHtml = html.replace('</head>', redirectSnippet + '</head>');
        await writeFile('index.html', finalHtml);
      }
    }
  }

  return { buildCardImgAttrs, buildSiteCss, buildRuntimePresets, writeRuntimeConfig, buildPageData, processCustomPages, localizeSidebar, localizeNav, localizeFooter, buildPaginationItems, generatePages };
}

module.exports = { createPagesModule };
