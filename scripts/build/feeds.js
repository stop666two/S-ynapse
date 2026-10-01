'use strict';
// 订阅源 / 站点地图 / 搜索索引（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createFeedsModule(ctx) 注入路径、正文过滤器与构建错误收集器。
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { escapeHtml, stripHtml, stripInvalidXmlChars, truncateCodePoints } = require('../lib/utils');
const { buildSitemapUrls, encodeLoc, toSitemapLastmod } = require('../lib/robots');
const { resolveJsonFeedOptions } = require('../lib/feed-options');
const { localSearchIndexNeeded } = require('../lib/feature-wiring');
const { siteLanguages: resolveSiteLanguages } = require('../lib/site-lang');
const {
  searchIndexOptions, buildLanguageIndex, measureGzip, serializeIndexText, hashIndexText, pruneIndexToBudget, resolveFinalAssetUrl
} = require('../lib/search-index');

const SEARCH_INDEX_CORE_PATH = path.join(__dirname, '..', '..', 'js', 'domains', 'features', 'search-core.js');
const SEARCH_INDEX_FILE_RE = /^search-index\.[0-9a-f]+\.json$/;
const DEFAULT_BUST_PATTERN = '.*\\.(css|js|png|jpg|svg)$';

// feed 包依赖的 xml-js 只对 CDATA 文本里的第一个 "]]>" 做分割（cdata.replace 非全局），
// 第二个及之后会留下裸 "]]>"，使整个 feed 无法被 XML 解析器读取。此处在交给 feed 之前，
// 把第二个起的 "]]>" 预分割为 xml-js 约定的 "]]]]><![CDATA[>" 形态；第一个仍由其处理。
function escapeCdataSplits(value) {
  const text = String(value == null ? '' : value);
  const marker = ']]>';
  const split = ']]]]><![CDATA[>';
  let at = text.indexOf(marker);
  if (at === -1) return text;
  let out = text.slice(0, at + marker.length);
  let cursor = at + marker.length;
  at = text.indexOf(marker, cursor);
  while (at !== -1) {
    out += text.slice(cursor, at) + split;
    cursor = at + marker.length;
    at = text.indexOf(marker, cursor);
  }
  return out + text.slice(cursor);
}

function createFeedsModule(ctx) {
  // Generate an RSS 2.0 feed (per-language).
  // Uses the `feed` package. Includes full content if site.rss.fullContent true.
  // Writes /{lang}/feed.xml for each configured site.language.
  async function generateRSS(config, articles) {
    const Feed = ctx.getFeed();
    if (!config.site.rss || !config.site.rss.enabled || !Feed) {
      console.log('  [SKIP] RSS generation disabled or feed package not available');
      return;
    }
    console.log('[7/14] Generating RSS feed...');
    const siteLangsRSS = resolveSiteLanguages(config.site);
    const baseUrl = (config.site.url || '').replace(/\/+$/, '');
    for (const rssLang of siteLangsRSS) {
      const rssArticles = articles.filter(a => a.lang === rssLang);
      const rssPublished = ctx.getPublished(rssArticles);
      try {
        const feed = new Feed({
          title: stripInvalidXmlChars((rssLang === 'en' && config.site.titleEn) ? config.site.titleEn : (config.site.title || 'Blog')),
          description: stripInvalidXmlChars((rssLang === 'en' && config.site.descriptionEn) ? config.site.descriptionEn : (config.site.description || '')),
          id: stripInvalidXmlChars(baseUrl + '/' + rssLang),
          link: stripInvalidXmlChars(baseUrl + '/' + rssLang + '/'),
          language: rssLang === 'en' ? 'en-US' : (config.site.language || 'zh-CN'),
          copyright: stripInvalidXmlChars(config.site.copyright || ''),
          updated: rssPublished.length > 0 && rssPublished[0].date ? new Date(rssPublished[0].date) : new Date(),
          generator: stripInvalidXmlChars((rssLang === 'en' && config.site.titleEn) ? config.site.titleEn : (config.site.title || 'Blog'))
        });
        if (config.site.author) feed.author = { name: stripInvalidXmlChars(config.site.author), email: stripInvalidXmlChars(config.site.email || '') };
        const maxItems = config.site.rss.maxItems || 50;
        const items = rssPublished.slice(0, maxItems);
        for (const article of items) {
          const link = stripInvalidXmlChars(baseUrl + article.url);
          feed.addItem({
            title: escapeCdataSplits(stripInvalidXmlChars(article.title)),
            id: link,
            link,
            description: escapeCdataSplits(stripInvalidXmlChars(article.excerpt || '')),
            content: escapeCdataSplits(stripInvalidXmlChars(config.site.rss.fullContent ? article.content : (article.excerpt || ''))),
            date: article.date ? new Date(article.date) : new Date(),
            category: article.tags.map(t => ({ name: stripInvalidXmlChars(t) })),
            author: config.site.author ? [{ name: stripInvalidXmlChars(config.site.author) }] : undefined
          });
        }
        const rssPath = config.site.rss.path.replace(/^\//, '');
        const outputPath = path.join(ctx.distDir, rssLang, rssPath);
        const outDir = path.dirname(outputPath);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        writeFileAtomicSync(outputPath, feed.rss2(), 'utf-8');
        console.log(`  Created: /${rssLang}/${rssPath}`);
      } catch (err) {
        console.error(`  [ERROR] RSS generation failed: ${err.message}`);
        ctx.recordBuildFailure('feed', `RSS generation failed: ${err.message}`);
      }
    }
  }

  // Generate JSON Feed (https://jsonfeed.org/version/1.1) alongside RSS.
  // Reuses the `feed` package output (feed.json1()). Same source data as RSS:
  // published articles limited to site.rss.maxItems, content per rss.fullContent.
  // Enabled via site.rss.jsonFeed.enabled (default: follow rss.enabled).
  async function generateJSONFeed(config, articles) {
    const Feed = ctx.getFeed();
    const rss = config.site.rss || {};
    const enabled = rss.jsonFeed ? rss.jsonFeed.enabled : rss.enabled;
    if (!enabled || !rss.enabled || !Feed) {
      console.log('  [SKIP] JSON Feed generation disabled or feed package not available');
      return;
    }
    console.log('[7b] Generating JSON Feed...');
    const siteLangsJF = resolveSiteLanguages(config.site);
    const baseUrl = (config.site.url || '').replace(/\/+$/, '');
    try {
      for (const lang of siteLangsJF) {
        const langArticles = articles.filter(a => a.lang === lang);
        // updated 必须与条目同源（getPublished）：草稿/定时发布的未来日期不得进入 feed 元数据。
        const langPublished = ctx.getPublished(langArticles);
        const feed = new Feed({
          title: (lang === 'en' && config.site.titleEn) ? config.site.titleEn : (config.site.title || 'Blog'),
          description: (lang === 'en' && config.site.descriptionEn) ? config.site.descriptionEn : (config.site.description || ''),
          id: baseUrl + '/' + lang,
          link: baseUrl + '/' + lang + '/',
          language: lang === 'en' ? 'en-US' : (config.site.language || 'zh-CN'),
          copyright: config.site.copyright || '',
          updated: langPublished.length > 0 && langPublished[0].date ? new Date(langPublished[0].date) : new Date(),
          generator: 'S-ynapse'
        });
        if (config.site.author) feed.author = { name: config.site.author, email: config.site.email || '' };
        const jfOptions = resolveJsonFeedOptions(rss);
        const items = langPublished.slice(0, jfOptions.maxItems);
        for (const article of items) {
          const link = baseUrl + article.url;
          feed.addItem({
            title: article.title,
            id: link,
            link,
            description: article.excerpt || '',
            content: jfOptions.fullContent ? article.content : (article.excerpt || ''),
            date: article.date ? new Date(article.date) : new Date(),
            category: article.tags.map(t => ({ name: t })),
            author: config.site.author ? [{ name: config.site.author }] : undefined
          });
        }
        const jfPath = rss.jsonFeed.path.replace(/^\//, '');
        const outputPath = path.join(ctx.distDir, lang, jfPath);
        const outDir = path.dirname(outputPath);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        // JSON Feed 同样做 `<` → \u003c 防注入（JSON 等价转义，解析后值不变），
        // 避免站点标题/正文中的 `<script>` 以可执行标签起始串形式出现在产物中。
        writeFileAtomicSync(outputPath, feed.json1().replace(/</g, '\\u003c'), 'utf-8');
        console.log(`  Created: /${lang}/${jfPath}`);
      }
    } catch (err) {
      console.error('  [ERROR] JSON Feed generation failed: ' + err.message);
      ctx.recordBuildFailure('feed', 'JSON Feed generation failed: ' + err.message);
    }
  }
  // Generate a standard XML sitemap (per-language).
  // Includes: index (1.0), articles (0.8), archive (0.5), tags/categories (0.4), custom pages (0.5), pagination (0.6).
  // Each configured language gets its own prefixed URLs under /{lang}/.
  async function generateSitemap(config, articles, tags, categories, customPages) {
    if (!config.site.sitemap || !config.site.sitemap.enabled) {
      console.log('  [SKIP] Sitemap generation disabled');
      return;
    }
    console.log('[8/14] Generating sitemap...');
    try {
      const url = config.site.url.replace(/\/+$/, '');
      const feats = (config.features && config.features.sitemap) || {};
      const split = feats.split !== false;
      const perFile = Math.max(10, feats.maxUrlsPerFile || 500);
      const postFreq = feats.postFrequency || 'weekly';
      const postPr = parseFloat(feats.postPriority != null ? feats.postPriority : 0.8);
      const pageFreq = feats.pageFrequency || 'monthly';
      const pagePr = parseFloat(feats.pagePriority != null ? feats.pagePriority : 0.6);
      const tagFreq = feats.tagFrequency || 'monthly';
      const tagPr = parseFloat(feats.tagPriority != null ? feats.tagPriority : 0.4);
      const siteLangsSM = resolveSiteLanguages(config.site);

      async function writeSitemapFor(lang) {
        const pf = '/' + lang + '/';
        const langArticles = articles.filter(a => a.lang === lang);
        const langPubs = ctx.getPublished(langArticles);
        const langTags = ctx.collectTags(langArticles);
        const langCats = ctx.collectCategories(langArticles);
        const urls = [];
        if (config.site.build.generateIndex !== false) {
          urls.push({ loc: pf, changefreq: pageFreq, priority: '1.0' });
          const postsPerPage = config.site.postsPerPage || 10;
          const totalPages = Math.max(1, Math.ceil(langPubs.length / postsPerPage));
          for (let p = 2; p <= totalPages; p++) {
            urls.push({ loc: pf + 'page/' + p + '/', changefreq: pageFreq, priority: String(pagePr) });
          }
        }
        for (const a of langPubs) {
          if (a.draft) continue;
          // lastmod 优先更新时间（frontmatter modified/updated），无则回退发布日期。
          urls.push({ loc: a.url, changefreq: postFreq, priority: String(postPr), lastmod: a.modified || a.date || undefined });
        }
        if (config.site.build.generateArchive !== false) urls.push({ loc: pf + 'archive/', changefreq: pageFreq, priority: String(pagePr) });
        if (config.site.build.generateGallery !== false) urls.push({ loc: pf + 'gallery/', changefreq: pageFreq, priority: String(pagePr) });
        if (config.site.build.generateTags !== false) {
          urls.push({ loc: pf + 'tags/', changefreq: tagFreq, priority: String(tagPr) });
          for (const tag of langTags) urls.push({ loc: pf + 'tags/' + tag.slug + '/', changefreq: tagFreq, priority: String(tagPr) });
        }
        if (config.site.build.generateCategories !== false) {
          urls.push({ loc: pf + 'categories/', changefreq: tagFreq, priority: String(tagPr) });
          for (const cat of langCats) urls.push({ loc: pf + 'categories/' + cat.slug + '/', changefreq: tagFreq, priority: String(tagPr) });
        }
        for (const p of (customPages || [])) {
          if (p.draft || !p.slug) continue;
          urls.push({ loc: pf + p.slug + '/', changefreq: pageFreq, priority: String(pagePr) });
        }
        // 系列聚合页（features.series.pageEnabled）：与页面生成同源（ctx.collectSeries 按
        // safeSlug 组 slug）；空系列不产出页面，故不纳入。
        const seriesPagesOn = (config.features && config.features.series && config.features.series.enabled !== false && config.features.series.pageEnabled !== false);
        if (seriesPagesOn && typeof ctx.collectSeries === 'function') {
          for (const s of ctx.collectSeries(langPubs)) {
            if (!s.articles.length || !s.slug) continue;
            urls.push({ loc: pf + 'series/' + s.slug + '/', changefreq: pageFreq, priority: String(pagePr) });
          }
        }
        const sitemapPath = config.site.sitemap.path.replace(/^\//, '');
        const entryPath = path.join(ctx.distDir, lang, sitemapPath);
        const outDir = path.dirname(entryPath);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const writeOne = (item) => {
          let x = '<loc>' + escapeHtml(stripInvalidXmlChars(encodeLoc(url + item.loc))) + '</loc>';
          const lastmod = toSitemapLastmod(item.lastmod);
          if (lastmod) x += '<lastmod>' + lastmod + '</lastmod>';
          x += '<changefreq>' + escapeHtml(stripInvalidXmlChars(item.changefreq)) + '</changefreq><priority>' + escapeHtml(stripInvalidXmlChars(item.priority)) + '</priority>';
          return x;
        };
        if (!split || urls.length <= perFile) {
          let xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
          for (const item of urls) xml += '<url>' + writeOne(item) + '</url>';
          xml += '</urlset>';
          writeFileAtomicSync(entryPath, xml, 'utf-8');
          console.log(`  Created: /${lang}/${sitemapPath} (${urls.length} urls)`);
          return;
        }
        const parts = [];
        for (let i = 0; i < urls.length; i += perFile) parts.push(urls.slice(i, i + perFile));
        const idxUrls = [];
        for (let i = 0; i < parts.length; i++) {
          const partName = 'sitemap-' + (i + 1) + '.xml';
          idxUrls.push({ loc: pf + partName, changefreq: pageFreq, priority: '0.6' });
          let part = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
          for (const item of parts[i]) part += '<url>' + writeOne(item) + '</url>';
          part += '</urlset>';
          writeFileAtomicSync(path.join(outDir, partName), part, 'utf-8');
        }
        let index = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        for (const item of idxUrls) index += '<sitemap>' + escapeHtml(stripInvalidXmlChars(encodeLoc(url + item.loc))) + '</sitemap>';
        index += '</sitemapindex>';
        writeFileAtomicSync(entryPath, index, 'utf-8');
        console.log(`  Created: /${lang}/${sitemapPath} (index ${parts.length} parts, ${urls.length} urls)`);
      }

      for (const lang of siteLangsSM) await writeSitemapFor(lang);
    } catch (err) {
      console.error('  [ERROR] Sitemap generation failed: ' + err.message);
      ctx.recordBuildFailure('sitemap', 'Sitemap generation failed: ' + err.message);
    }
  }

  // 构建后向搜索引擎提交 sitemap（可选功能，仅生产构建执行）。
  // 注意：Google 自 2023 年起停用 sitemap ping（该端点会返回 404），此功能保留给
  // 仍支持该协议且配置启用的引擎（如 Bing）；失败仅告警，不阻断构建。
  // 多语言站点逐语言逐条提交（URL 列表与 robots.txt 的 Sitemap 行同源）。
  async function pingSearchEngines(config) {
    const ping = (config.features && config.features.searchEnginePing) || {};
    if (!ping.enabled) return;
    if (ctx.serveMode || ctx.watchMode) return;
    if (ping.onlyProduction && process.env.NODE_ENV !== 'production' && !process.env.CI) return;
    const base = (config.site.url || '').replace(/\/+$/, '');
    if (!base) { console.log('  [SKIP] Sitemap ping: site.url not configured'); return; }
    const sitemapUrls = buildSitemapUrls({
      baseUrl: base,
      sitemapPath: config.security.robots.sitemap,
      languages: resolveSiteLanguages(config.site)
    });
    if (!sitemapUrls.length) { console.log('  [SKIP] Sitemap ping: no sitemap URL resolved'); return; }
    const engines = Array.isArray(ping.engines) ? ping.engines : ['google'];
    const endpoints = {
      google: 'https://www.google.com/ping?sitemap=',
      bing: 'https://www.bing.com/ping?sitemap='
    };
    for (const name of engines) {
      const ep = endpoints[name];
      if (!ep) { console.warn('  [WARN] Unknown ping engine: ' + name); continue; }
      for (const smUrl of sitemapUrls) {
        try {
          const res = await fetch(ep + encodeURIComponent(smUrl), { method: 'GET', signal: AbortSignal.timeout(ping.timeoutMs || 5000) });
          console.log(`  Pinged ${name}: HTTP ${res.status} (${smUrl})`);
          if (!res.ok) console.warn('  [WARN] ' + name + ' ping rejected (HTTP ' + res.status + '); usually fine locally');
        } catch (err) {
          console.warn(`  [WARN] ${name} ping failed: ${err.message}`);
        }
      }
    }
  }
  // 搜索索引（v2 倒排、外置内容寻址）：
  //   prepareSearchIndex 在页面渲染前计算每语言索引与 URL（/assets/search-index.<hash>.json），
  //   由 build.js 注入模板（window.__SEARCH_INDEX_URL__）；generateSearchIndex 负责写盘与旧产物清理。
  //   体积超出 features.search.index.maxGzipKb 时按词频裁剪低频词并记录非阻断告警（构建报告 + 构建日志）。
  let preparedSearchIndexes = null;
  let searchCorePromise = null;
  function loadSearchCore() {
    if (!searchCorePromise) searchCorePromise = import(pathToFileURL(SEARCH_INDEX_CORE_PATH).href);
    return searchCorePromise;
  }
  function searchWeightOf(raw, dflt) {
    return (raw === '' || raw == null || isNaN(+raw)) ? dflt : Math.max(0, +raw);
  }
  async function prepareSearchIndex(config, articles) {
    preparedSearchIndexes = null;
    if (!localSearchIndexNeeded(config.navigation, config.features)) return {};
    const opts = searchIndexOptions(config.features);
    const core = await loadSearchCore();
    const s = (config.features && config.features.search) || {};
    const fullContent = s.includeContent !== false;
    const indexFields = [];
    if (searchWeightOf(s.weightTitle, 5) > 0) indexFields.push('title');
    if (searchWeightOf(s.weightExcerpt, 2) > 0) indexFields.push('excerpt');
    if (fullContent && searchWeightOf(s.weightContent, 1) > 0) indexFields.push('content');
    const busting = config.site.build.enableCacheBusting === true;
    const bustOpts = {
      cacheBusting: busting,
      pattern: new RegExp(config.site.build.cacheBustingPattern || DEFAULT_BUST_PATTERN, 'i')
    };
    const maxBytes = opts.maxGzipKb * 1024;
    const siteLangsSI = resolveSiteLanguages(config.site);
      // 空原型：语言键来自站点配置，'__proto__' 在普通对象上会触发原型 setter。
      const prepared = { langs: Object.create(null) };
      const urls = Object.create(null);
    for (const lang of siteLangsSI) {
      try {
        const published = ctx.getPublished(articles.filter(a => a.lang === lang));
        const docs = published.map(a => ({
          title: a.title,
          url: a.url,
          excerpt: truncateCodePoints(stripHtml(a.excerpt || ''), 200),
          featuredImage: resolveFinalAssetUrl(ctx.distDir, a.featuredImage || '', bustOpts),
          content: fullContent ? truncateCodePoints(stripHtml(a.content), 5000) : '',
          tags: a.tags,
          categories: a.categories,
          lang
        }));
        const index = buildLanguageIndex(core, docs, { lang, fields: indexFields, bigram: opts.bigram });
        const fullBytes = measureGzip(serializeIndexText(index));
        const pruned = pruneIndexToBudget(index, maxBytes);
        if (pruned.pruned > 0) {
          const detail = `搜索索引（${lang}）gzip ${(fullBytes / 1024).toFixed(1)}KB 超出 features.search.index.maxGzipKb=${opts.maxGzipKb}：已裁剪 ${pruned.pruned} 个低频词 → ${(pruned.gzipBytes / 1024).toFixed(1)}KB`;
          console.warn('  [WARN] ' + detail);
          ctx.recordBuildFailure('search', detail, { fatal: false });
        }
        if (!pruned.reached) {
          const detail = `搜索索引（${lang}）裁剪后仍为 ${(pruned.gzipBytes / 1024).toFixed(1)}KB，超过 features.search.index.maxGzipKb=${opts.maxGzipKb}（不阻断构建，请调高上限或关闭 includeContent）`;
          console.warn('  [WARN] ' + detail);
          ctx.recordBuildFailure('search', detail, { fatal: false });
        }
        const hash = hashIndexText(lang, pruned.text);
        const fileName = 'search-index.' + hash + '.json';
        prepared.langs[lang] = {
          url: '/assets/' + fileName,
          fileName,
          text: pruned.text,
          gzipBytes: pruned.gzipBytes,
          prunedCount: pruned.pruned,
          docsCount: index.docs.length
        };
        urls[lang] = '/assets/' + fileName;
      } catch (err) {
        console.warn(`  [WARN] Search index preparation failed for ${lang}: ${err.message}`);
        ctx.recordBuildFailure('search', `Search index preparation failed for ${lang}: ${err.message}`, { fatal: false });
      }
    }
    preparedSearchIndexes = prepared;
    return urls;
  }
  async function generateSearchIndex(config, articles) {
    // provider=pagefind 时仅当 features.pagefind.integrate=false（回退内置搜索链路）才生成本地索引。
    if (!localSearchIndexNeeded(config.navigation, config.features)) {
      console.log('  [SKIP] Search index generation disabled or provider not local');
      return;
    }
    console.log('[9/14] Generating search index...');
    try {
      if (!preparedSearchIndexes) await prepareSearchIndex(config, articles);
      const prepared = preparedSearchIndexes || { langs: Object.create(null) };
      const assetsDir = path.join(ctx.distDir, 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });
      // 上一轮内容寻址索引清理（增量构建不清理 dist；文件名随内容变化，避免残留堆积）。
      for (const name of fs.readdirSync(assetsDir)) {
        if (SEARCH_INDEX_FILE_RE.test(name)) fs.rmSync(path.join(assetsDir, name), { force: true });
      }
      // 旧固定路径索引（v1 产物 /{lang}/search-index.json）迁移清理：不再产出，避免残留过期副本。
      const siteLangsSI = resolveSiteLanguages(config.site);
      for (const lang of siteLangsSI) {
        const legacy = path.join(ctx.distDir, lang, 'search-index.json');
        if (fs.existsSync(legacy)) fs.rmSync(legacy, { force: true });
      }
      for (const lang of Object.keys(prepared.langs)) {
        const entry = prepared.langs[lang];
        writeFileAtomicSync(path.join(assetsDir, entry.fileName), entry.text, 'utf-8');
        const pruneNote = entry.prunedCount ? `, pruned ${entry.prunedCount}` : '';
        console.log(`  Created: ${entry.url} (${entry.docsCount} entries, gzip ${(entry.gzipBytes / 1024).toFixed(1)}KB${pruneNote})`);
      }
    } catch (err) {
      console.error('  [ERROR] Search index generation failed: ' + err.message);
      ctx.recordBuildFailure('search', 'Search index generation failed: ' + err.message);
    }
  }

  async function generatePagefindIndex(config) {
    const pf = (config.features && config.features.pagefind) || {};
    const navSearch = (config.navigation && config.navigation.search) || {};
    if (pf.enabled === false) return null;
    if (navSearch.provider !== 'pagefind') return null;
    const indexPath = String(pf.indexPath).replace(/^\/+/, '') || 'pagefind';
    const outDir = path.join(ctx.distDir, indexPath);
    let mod;
    try {
      // 可选依赖：pagefind 未安装时动态导入失败并走降级告警。模块名经变量传入，
      // 避免类型检查在未安装依赖时报「找不到模块」（运行时语义不变）。
      const pagefindModule = 'pagefind';
      mod = await import(pagefindModule);
    } catch (err) {
      console.warn('  [WARN] navigation.search.provider=pagefind 但未安装 pagefind；跳过索引生成（npm install -D pagefind）');
      return null;
    }
    try {
      fs.rmSync(outDir, { recursive: true, force: true });
      const created = await mod.createIndex();
      if (!created || !created.index) {
        throw new Error((created && created.errors && created.errors.join('; ')) || 'createIndex 未返回索引');
      }
      const pfAdd = await created.index.addDirectory({ path: ctx.distDir });
      if (pfAdd && pfAdd.errors && pfAdd.errors.length) {
        console.warn('  [WARN] Pagefind addDirectory errors: ' + pfAdd.errors.join('; '));
      }
      await created.index.writeFiles({ outputPath: outDir });
      console.log(`  Created: ${indexPath}/ (Pagefind 全文索引)`);
      return outDir;
    } catch (err) {
      console.error(`  [ERROR] Pagefind 索引生成失败: ${err.message}`);
      ctx.recordBuildFailure('search', `Pagefind 索引生成失败: ${err.message}`);
      return null;
    } finally {
      try { await mod.close(); } catch (e) { /* 服务已退出 */ }
    }
  }

  return { generateRSS, generateJSONFeed, generateSitemap, pingSearchEngines, prepareSearchIndex, generateSearchIndex, generatePagefindIndex };
}

module.exports = { createFeedsModule };
