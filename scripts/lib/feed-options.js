// Resolve JSON Feed item options from the site.rss config block.
//
// Precedence for both values:
//   1. rss.jsonFeed.fullContent / rss.jsonFeed.maxItems (site-defaults.js
//      supplies fullContent: false, maxItems: 20 after config merge)
//   2. rss.fullContent / rss.maxItems (shared RSS-level settings)
//   3. built-in defaults: fullContent false, maxItems 50
//
// Invalid types are ignored: fullContent must be a boolean and maxItems a
// positive finite number, so a mis-typed key cannot silently truncate the feed.
function resolveJsonFeedOptions(rss) {
  const jf = (rss && rss.jsonFeed) || {};
  const fullContent = typeof jf.fullContent === 'boolean' ? jf.fullContent : rss && rss.fullContent === true;
  const jfMax = jf.maxItems;
  const rssMax = rss && rss.maxItems;
  const maxItems = (Number.isFinite(jfMax) && jfMax > 0) ? jfMax : ((Number.isFinite(rssMax) && rssMax > 0) ? rssMax : 50);
  return { fullContent, maxItems };
}

module.exports = { resolveJsonFeedOptions };
