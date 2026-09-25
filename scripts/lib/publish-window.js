'use strict';

/**
 * 定时发布窗口：date 晚于构建时间的文章视为“已排期”，在所有产出（页面/feed/
 * sitemap/搜索索引/归档）中统一排除，直到构建时刻越过其 date。
 */
function isScheduled(article, now) {
  const current = now instanceof Date ? now.getTime() : NaN;
  if (!article || !article.date || !Number.isFinite(current)) return false;
  const t = new Date(article.date).getTime();
  return Number.isFinite(t) && t > current;
}

/**
 * 按发布时间切分文章列表（保持输入顺序）。
 * @param {Array} articles
 * @param {Date} now
 * @returns {{published: Array, scheduled: Array}}
 */
function partitionByPublishTime(articles, now) {
  const published = [];
  const scheduled = [];
  for (const a of Array.isArray(articles) ? articles : []) {
    if (isScheduled(a, now)) scheduled.push(a);
    else published.push(a);
  }
  return { published, scheduled };
}

module.exports = { isScheduled, partitionByPublishTime };
