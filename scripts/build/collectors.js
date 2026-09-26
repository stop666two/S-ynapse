'use strict';
// 站点数据收集器（自 scripts/build.js 机械拆分；仅移动函数与依赖接线，不含逻辑变更）。
// 编排器通过 createCollectorsModule(ctx) 注入发布过滤器（getPublished，含草稿与定时发布窗口语义）；
// safeSlug 直连 lib/utils。
const { safeSlug } = require('../lib/utils');

function createCollectorsModule(ctx) {
  // Aggregate tags across all articles with count and slugified URL.
  // Returns array sorted by count descending.
  function collectTopTags(articles, limit, lang) {
    const counts = {};
    const published = ctx.getPublished(articles).filter(a => !lang || a.lang === lang);
    published.forEach(function(a) {
      (a.tags || []).forEach(function(t) { counts[t] = (counts[t] || 0) + 1; });
    });
    const prefix = lang ? '/' + lang : '';
    const list = Object.keys(counts)
      .sort(function(a, b) { return counts[b] - counts[a] || a.localeCompare(b); })
      .map(function(t) { return { name: t, count: counts[t], url: prefix + '/tags/' + safeSlug(t) + '/' }; });
    return limit == null ? list : list.slice(0, limit);
  }

  function collectTags(articles) {
    const result = [];
    const pubs = ctx.getPublished(articles);
    const langSet = new Set(pubs.map(a => a.lang).filter(Boolean));
    for (const lang of langSet) {
      const map = new Map();
      for (const a of pubs) {
        if (a.lang !== lang) continue;
        for (const tag of a.tags) {
          const slug = safeSlug(tag);
          if (!map.has(slug)) map.set(slug, { name: tag, slug, count: 0, url: `/${lang}/tags/${slug}/`, lang });
          map.get(slug).count++;
        }
      }
      for (const v of Array.from(map.values()).sort((a, b) => b.count - a.count)) result.push(v);
    }
    return result;
  }

  // Group articles into series (front-matter `series`). Each series lists its
  // articles in chronological order (oldest first) and annotates each article
  // with prev/next navigation inside the series for the detail-page panel.
  function collectSeries(articles) {
    const map = new Map();
    for (const a of ctx.getPublished(articles)) {
      if (!a.series) continue;
      if (!map.has(a.series)) map.set(a.series, []);
      map.get(a.series).push(a);
    }
    const result = [];
    for (const [name, list] of map) {
      list.sort((x, y) => {
        if (!x.date && !y.date) return x.title.localeCompare(y.title);
        if (!x.date) return 1;
        if (!y.date) return -1;
        return new Date(x.date) - new Date(y.date);
      });
      list.forEach(function(a, i) {
        a.seriesIndex = i + 1;
        a.seriesTotal = list.length;
        a.seriesPrevUrl = i > 0 ? list[i - 1].url : null;
        a.seriesNextUrl = i < list.length - 1 ? list[i + 1].url : null;
      });
      result.push({ name, slug: safeSlug(name), count: list.length, firstUrl: list[0].url, articles: list });
    }
    return result.sort((a, b) => b.count - a.count);
  }

  function collectFriends(config) {
    const cfg = config.friends || {};
    if (!cfg.enabled || !Array.isArray(cfg.friends) || !cfg.friends.length) return null;
    return cfg;
  }

  // Extract all media images referenced by published articles (featured images
  // plus inline markdown images) for the /gallery/ page. Deduplicates by src.
  // Returns array of {src, title, url, alt} sorted by source-article date desc.
  // options.collectFeatured=false（features.gallery.collectFeatured）时仅收集正文图片。
  function collectGalleryImages(articles, options) {
    const opts = options || {};
    const collectFeatured = opts.collectFeatured !== false;
    const seen = new Set();
    const items = [];
    const published = ctx.getPublished(articles);
    // Newest first; markdown body images come before the featured image so the
    // cover is not presented first.
    const newOrder = published.slice().reverse();
    const IMG_RX = /<img[^>]+src="([^"]+)"/g;
    for (const a of newOrder) {
      for (let m = IMG_RX.exec(a.content); m !== null; m = IMG_RX.exec(a.content)) {
        const src = m[1].startsWith('/') ? m[1] : null;
        if (!src || seen.has(src)) continue;
        seen.add(src);
        items.push({ src, title: a.title, url: a.url, alt: a.title });
      }
      if (collectFeatured && a.featuredImage && !seen.has(a.featuredImage)) {
        seen.add(a.featuredImage);
        items.push({ src: a.featuredImage, title: a.title, url: a.url, alt: a.title });
      }
    }
    return items;
  }

  // Aggregate simple site statistics for the archive stats panel and sidebar
  // widget: published counts, total words, first/last publish date and daily avg.
  function collectSiteStats(articles, tags, categories) {
    const published = ctx.getPublished(articles);
    let words = 0;
    let early = null;
    let late = null;
    for (const a of published) {
      words += (a.wordCount || 0);
      if (a.date) {
        const t = new Date(a.date).getTime();
        if (!early || t < early) early = t;
        if (!late || t > late) late = t;
      }
    }
    const days = early && late ? Math.max(1, Math.floor((late - early) / 86400000) + 1) : 0;
    const count = published.length;
    return {
      posts: count,
      words,
      tags: (tags || []).length,
      categories: (categories || []).length,
      earliestDate: early ? new Date(early) : null,
      latestDate: late ? new Date(late) : null,
      days,
      avgPerDay: days && count ? (count / days).toFixed(2) : 0
    };
  }

  // Aggregate categories across all articles with count and slugified URL.
  // Returns array sorted by count descending.
  function collectCategories(articles) {
    const result = [];
    const pubs = ctx.getPublished(articles);
    const langSet = new Set(pubs.map(a => a.lang).filter(Boolean));
    for (const lang of langSet) {
      const map = new Map();
      for (const a of pubs) {
        if (a.lang !== lang) continue;
        for (const cat of a.categories) {
          const slug = safeSlug(cat);
          if (!map.has(slug)) map.set(slug, { name: cat, slug, count: 0, url: `/${lang}/categories/${slug}/`, lang });
          map.get(slug).count++;
        }
      }
      for (const v of Array.from(map.values()).sort((a, b) => b.count - a.count)) result.push(v);
    }
    return result;
  }

  // Group articles by year-month for the archive page.
  // Articles without dates are excluded. Groups sorted newest first.
  function groupByYearMonth(articles) {
    const groups = {};
    for (const a of articles) {
      if (!a.year) continue;
      const key = `${a.year}-${a.month || '00'}`;
      if (!groups[key]) groups[key] = { year: a.year, month: a.month, articles: [], label: `${a.year}-${a.month || '??'}` };
      groups[key].articles.push(a);
    }
    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return (b.month || '00').localeCompare(a.month || '00');
    });
  }

  return { collectTopTags, collectTags, collectSeries, collectFriends, collectGalleryImages, collectSiteStats, collectCategories, groupByYearMonth };
}

module.exports = { createCollectorsModule };
