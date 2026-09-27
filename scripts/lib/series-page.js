'use strict';
// 系列聚合页纯函数（canonical 语义）：页面开关判定 / 列表排序 / URL 组装 /
// 自动元数据 / 跨语言对应匹配 / 可生成页面收集。
// 消费方：scripts/build/pages.js（页面生成）；scripts/build/feeds.js（sitemap 纳入）。
// 数据来源：scripts/build/collectors.js → collectSeries（slug = safeSlug(系列名)；
// 每篇文章携带 seriesIndex/seriesTotal/seriesPrevUrl/seriesNextUrl，按时间序）。

const { safeSlug } = require('./utils');

// 系列聚合页总开关：features.series.enabled 与 features.series.pageEnabled 同时为真
// 才生成页面（缺省均视为 true，与 features-schema 默认值一致）。
function seriesPagesEnabled(features) {
  const s = (features && features.series) || {};
  return s.enabled !== false && s.pageEnabled !== false;
}

// 列表显示顺序：asc = 时间旧→新（默认，与系列内序位一致）；desc = 新→旧。
// 返回新数组，不原地修改；序位（seriesIndex/seriesTotal）始终按时间序，与显示顺序无关。
function orderSeriesArticles(series, order) {
  const list = ((series && series.articles) || []).slice();
  return order === 'desc' ? list.reverse() : list;
}

// 系列页 URL：/{lang}/series/{slug}/（slug 由 collectSeries 经 safeSlug 生成，同源复用）。
function seriesPageUrl(lang, slug) {
  return '/' + String(lang || 'zh') + '/series/' + slug + '/';
}

// 系列页自动元数据：系列名为空或文章数为 0（空系列）时返回 null（不生成页面）；
// description 按语言生成，供 <meta name="description"> 与 og:description 使用。
function seriesPageMeta(series, lang) {
  const name = series && series.name != null ? String(series.name).trim() : '';
  const total = series && Array.isArray(series.articles) ? series.articles.length : 0;
  if (!name || total < 1) return null;
  const en = String(lang || '') === 'en';
  return {
    title: name,
    description: en
      ? '"' + name + '" series — ' + total + ' post' + (total === 1 ? '' : 's') + ' in reading order.'
      : '「' + name + '」系列共 ' + total + ' 篇，按顺序阅读。'
  };
}

// 跨语言对应系列匹配：两语言的文章 slug 集合完全一致视为同一系列的另一语言版本
// （翻译版通常保持相同 slug；不满足则视为无对应，返回 null，不猜测映射）。
function findAlternateSeries(series, candidates) {
  const srcSlugs = new Set(((series && series.articles) || []).map(function (a) { return a.slug; }));
  if (!srcSlugs.size) return null;
  for (const cand of (candidates || [])) {
    const list = (cand && cand.articles) || [];
    if (list.length !== srcSlugs.size) continue;
    let same = true;
    for (const a of list) { if (!srcSlugs.has(a.slug)) { same = false; break; } }
    if (same) return cand;
  }
  return null;
}

// 收集可生成的系列页（空系列 / 无名系列跳过）：
// 返回 [{ slug, url, name, description, altUrl, articles }]；articles 已按 order 排序。
// altList/altLang 提供另一语言的系列列表时进行 slug 集合匹配并生成 altUrl（无匹配则空串）。
function collectSeriesPages(seriesList, lang, order, altList, altLang) {
  const out = [];
  for (const s of (seriesList || [])) {
    const meta = seriesPageMeta(s, lang);
    if (!meta) continue;
    const slug = (s && s.slug) ? s.slug : safeSlug((s && s.name) || '');
    if (!slug) continue;
    const alt = altList ? findAlternateSeries(s, altList) : null;
    out.push({
      slug: slug,
      url: seriesPageUrl(lang, slug),
      name: meta.title,
      description: meta.description,
      altUrl: alt ? seriesPageUrl(altLang || (String(lang) === 'zh' ? 'en' : 'zh'), alt.slug) : '',
      articles: orderSeriesArticles(s, order)
    });
  }
  return out;
}

module.exports = { seriesPagesEnabled, orderSeriesArticles, seriesPageUrl, seriesPageMeta, findAlternateSeries, collectSeriesPages };
