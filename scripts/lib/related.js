// Compute related articles using a tag/category scoring algorithm.
//
// Consumes the features.related config block:
//   - topN               maximum number of results per article (default 4)
//   - sameTagWeight      points per shared tag (default 3)
//   - sameCategoryWeight points per shared category (default 2)
//   - minScore           minimum score to appear in results (default 2,
//                        which keeps single-category matches eligible)
//   - excludeCurrent     true (default) = the article itself never appears;
//                        false = self-reference allowed (self scores highest).
//
// Only articles in the same language are considered. Results are written
// in-memory to article.relatedArticles as { slug, title, url, score, tags, excerpt }
// objects sorted by score desc.
function computeRelatedArticles(published, relatedConfig) {
  const cfg = relatedConfig || {};
  const topN = Number.isFinite(cfg.topN) && cfg.topN > 0 ? cfg.topN : 4;
  const tagWeight = Number.isFinite(cfg.sameTagWeight) ? cfg.sameTagWeight : 3;
  const categoryWeight = Number.isFinite(cfg.sameCategoryWeight) ? cfg.sameCategoryWeight : 2;
  const minScore = Number.isFinite(cfg.minScore) ? cfg.minScore : 2;
  const excludeCurrent = cfg.excludeCurrent !== false;
  for (const article of published) {
    const peers = published.filter(o => o.lang === article.lang);
    const scored = [];
    for (const other of peers) {
      if (excludeCurrent && other.slug === article.slug) continue;
      let score = 0;
      const sharedTags = article.tags.filter(t => other.tags.includes(t));
      score += sharedTags.length * tagWeight;
      const sharedCategories = article.categories.filter(c => other.categories.includes(c));
      score += sharedCategories.length * categoryWeight;
      if (score >= minScore) scored.push({ slug: other.slug, title: other.title, url: other.url, score, tags: sharedTags, excerpt: other.excerpt || '' });
    }
    scored.sort((a, b) => b.score - a.score);
    article.relatedArticles = scored.slice(0, topN);
  }
}

module.exports = { computeRelatedArticles };
