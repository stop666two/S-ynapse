'use strict';
// 订阅源 / 站点地图 / 搜索索引（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createFeedsModule(ctx) 注入路径、正文过滤器与构建错误收集器。
const fs = require('fs');
const path = require('path');
const { writeFileAtomicSync } = require('../lib/atomic-write');
const { escapeHtml, stripHtml } = require('../lib/utils');
const { buildSitemapUrls, encodeLoc, toSitemapLastmod } = require('../lib/robots');
const { resolveJsonFeedOptions } = require('../lib/feed-options');

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
    const siteLangsRSS = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);
    const baseUrl = (config.site.url || '').replace(/\/+$/, '');
    for (const rssLang of siteLangsRSS) {
      const rssArticles = articles.filter(a => a.lang === rssLang);
      const rssPublished = ctx.getPublished(rssArticles);
      try {
        const feed = new Feed({
          title: (rssLang === 'en' && config.site.titleEn) ? config.site.titleEn : (config.site.title || 'Blog'),
          description: (rssLang === 'en' && config.site.descriptionEn) ? config.site.descriptionEn : (config.site.description || ''),
          id: baseUrl + '/' + rssLang,
          link: baseUrl + '/' + rssLang + '/',
          language: rssLang === 'en' ? 'en-US' : (config.site.language || 'zh-CN'),
          copyright: config.site.copyright || '',
          updated: rssPublished.length > 0 && rssPublished[0].date ? new Date(rssPublished[0].date) : new Date(),
          generator: (rssLang === 'en' && config.site.titleEn) ? config.site.titleEn : (config.site.title || 'Blog')
        });
        if (config.site.author) feed.author = { name: config.site.author, email: config.site.email || '' };
        const maxItems = config.site.rss.maxItems || 50;
        const items = rssPublished.slice(0, maxItems);
        for (const article of items) {
          const link = baseUrl + article.url;
          feed.addItem({
            title: article.title,
            id: link,
            link,
            description: article.excerpt || '',
            content: config.site.rss.fullContent ? article.content : (article.excerpt || ''),
            date: article.date ? new Date(article.date) : new Date(),
            category: article.tags.map(t => ({ name: t })),
            author: config.site.author ? [{ name: config.site.author }] : undefined
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
    const siteLangsJF = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);
    const baseUrl = (config.site.url || '').replace(/\/+$/, '');
    try {
      for (const lang of siteLangsJF) {
        const langArticles = articles.filter(a => a.lang === lang);
        const feed = new Feed({
          title: (lang === 'en' && config.site.titleEn) ? config.site.titleEn : (config.site.title || 'Blog'),
          description: (lang === 'en' && config.site.descriptionEn) ? config.site.descriptionEn : (config.site.description || ''),
          id: baseUrl + '/' + lang,
          link: baseUrl + '/' + lang + '/',
          language: lang === 'en' ? 'en-US' : (config.site.language || 'zh-CN'),
          copyright: config.site.copyright || '',
          updated: langArticles.length > 0 && langArticles[0].date ? new Date(langArticles[0].date) : new Date(),
          generator: 'S-ynapse'
        });
        if (config.site.author) feed.author = { name: config.site.author, email: config.site.email || '' };
        const jfOptions = resolveJsonFeedOptions(rss);
        const items = ctx.getPublished(langArticles).slice(0, jfOptions.maxItems);
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
        writeFileAtomicSync(outputPath, feed.json1(), 'utf-8');
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
      const siteLangsSM = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);

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
          urls.push({ loc: a.url, changefreq: postFreq, priority: String(postPr), lastmod: a.date || undefined });
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
        const sitemapPath = config.site.sitemap.path.replace(/^\//, '');
        const entryPath = path.join(ctx.distDir, lang, sitemapPath);
        const outDir = path.dirname(entryPath);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const writeOne = (item) => {
          let x = '<loc>' + escapeHtml(encodeLoc(url + item.loc)) + '</loc>';
          const lastmod = toSitemapLastmod(item.lastmod);
          if (lastmod) x += '<lastmod>' + lastmod + '</lastmod>';
          x += '<changefreq>' + item.changefreq + '</changefreq><priority>' + item.priority + '</priority>';
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
        for (const item of idxUrls) index += '<sitemap>' + url + item.loc + '</sitemap>';
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
      languages: (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en'])
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
  function generateSearchIndex(config, articles) {
    if (!config.navigation.search || !config.navigation.search.enabled || config.navigation.search.provider !== 'local') {
      console.log('  [SKIP] Search index generation disabled or provider not local');
      return;
    }
    console.log('[9/14] Generating search index...');
    const fullContent = !!(config.features && config.features.search && config.features.search.includeContent !== false);
    const siteLangsSI = (config.site.languages && config.site.languages.length ? config.site.languages : ['zh', 'en']);
    for (const lang of siteLangsSI) {
      const langArticles = articles.filter(a => a.lang === lang);
      const published = ctx.getPublished(langArticles);
      const index = published.map(a => ({
        title: a.title,
        url: a.url,
        excerpt: stripHtml(a.excerpt || '').substring(0, 200),
        featuredImage: a.featuredImage || '',
        content: fullContent ? stripHtml(a.content).substring(0, 5000) : '',
        tags: a.tags,
        categories: a.categories,
        lang
      }));
      const outputPath = path.join(ctx.distDir, lang, 'search-index.json');
      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      writeFileAtomicSync(outputPath, JSON.stringify(index), 'utf-8');
      console.log(`  Created: /${lang}/search-index.json (${index.length} entries)`);
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
      mod = await import('pagefind');
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

  return { generateRSS, generateJSONFeed, generateSitemap, pingSearchEngines, generateSearchIndex, generatePagefindIndex };
}

module.exports = { createFeedsModule };
