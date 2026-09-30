'use strict';
// 双语对照配对（构建期纯函数）：在同一发布集合中查找与当前文章同 slug 的另一语言文章。
// 调用方传 getPublished(articles) 的结果；predicate 仍保留 !draft，防御未过滤集合被直接传入。
function findAlternateArticle(publishedArticles, article) {
  if (!article || typeof article !== 'object') return null;
  const list = Array.isArray(publishedArticles) ? publishedArticles : [];
  return list.find((candidate) => candidate && candidate.lang !== article.lang
    && candidate.slug === article.slug && !candidate.draft) || null;
}

module.exports = { findAlternateArticle };
