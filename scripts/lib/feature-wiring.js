'use strict';

// 配置接线纯函数（第三轮配置闭环 W1）：
// 供构建期（scripts/build/**.js、templates/*.ejs 经 baseData 注入）与单测复用；
// 浏览器运行时（js/domains/**）因模块格式限制按同一语义就地实现，由 config-wiring.test.js
// 与本 runner 双重覆盖。所有函数均以「配置缺省 = 该键默认值 = 历史行为」为原则。

// theme.darkMode 取值归一化（canonical 来源；features.themeToggle 同义键已删除）。
function normalizeThemeDarkMode(darkMode) {
  const d = darkMode || {};
  return {
    default: ['light', 'dark', 'system'].includes(d.default) ? d.default : 'system',
    rememberChoice: d.rememberChoice !== false,
    iconStyle: ['sun-moon', 'single', 'switch'].includes(d.iconStyle) ? d.iconStyle : 'sun-moon',
    transitionAll: d.transitionAll !== false
  };
}

// searchHighlight.markClass：只保留安全类名字符，空串 = 不附加 class（默认）。
function normalizeMarkClass(raw) {
  return String(raw == null ? '' : raw).replace(/[^\w-]/g, '');
}

// pinned 模块归一化：enabled/badgeStyle/sortRule 的默认与历史行为一致（启用、pill、置顶优先）。
function pinnedConfig(features) {
  const p = (features && features.pinned) || {};
  const enabled = p.enabled !== false;
  const style = ['pill', 'corner', 'none'].includes(p.badgeStyle) ? p.badgeStyle : 'pill';
  const sortRule = p.sortRule === 'normal' ? 'normal' : 'pinned-first';
  return {
    enabled,
    badgeStyle: style,
    showBadge: enabled && style !== 'none',
    sortRule,
    badgeText: p.badgeText,
    badgeTextEn: p.badgeTextEn
  };
}

// 置顶徽标文案：配置文案优先于 ui-strings 词典；en 站优先 badgeTextEn（空回退中文）。
function pinnedText(pcfg, lang, fallbackZh, fallbackEn) {
  if (lang === 'en') return pcfg.badgeTextEn || pcfg.badgeText || fallbackEn || fallbackZh || '';
  return pcfg.badgeText || fallbackZh || '';
}

// 文章排序比较器（与 scripts/build/articles.js 原实现逐字等价，仅置顶优先段受 sortRule 控制）：
// pinned-first：置顶在前，其余按日期倒序（无日期排最后）；normal：完全按日期自然排序（不重排置顶）。
function makeArticleComparator(features) {
  const cfg = pinnedConfig(features);
  const pinnedFirst = cfg.enabled && cfg.sortRule === 'pinned-first';
  return function compareArticles(a, b) {
    if (pinnedFirst) {
      const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
    }
    if (!a.date && !b.date) return String(a.title).localeCompare(String(b.title));
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  };
}

// toc.defaultOpenLevel 解析：
//   0 → 全折叠（whole-list collapsed）；N≥1 → 可见最大标题级 = minLevel + N - 1
//   （默认 2 且 minLevel=2 → 展开到 h3；N≥3 时覆盖 maxLevel=4 即全展开）。
function defaultOpenLevelInfo(raw, minLevel) {
  const n = (raw === '' || raw == null || isNaN(+raw)) ? 2 : Math.max(0, Math.floor(+raw));
  const base = (minLevel === '' || minLevel == null || isNaN(+minLevel)) ? 2 : Math.max(1, Math.floor(+minLevel));
  if (n === 0) return { collapseAll: true, visibleMaxLevel: 0 };
  return { collapseAll: false, visibleMaxLevel: base + n - 1 };
}

// motion 错峰预算：总附加延迟 ≤ max，单项 delay = min(stagger, 剩余预算)。
function staggerDelays(stagger, max, count) {
  const s = isNaN(+stagger) ? 0 : Math.max(0, +stagger);
  const cap = isNaN(+max) ? 500 : Math.max(0, +max);
  const n = Math.max(0, Math.floor(+count) || 0);
  let budget = cap;
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = Math.min(s, budget);
    out.push(d);
    budget = Math.max(0, budget - d);
  }
  return out;
}

// dailyQuote.widgetStyle：'plain' → 无卡片外框；'card'（默认）/'sidebar'（旧值兼容）→ 卡片外观。
function quoteWidgetClass(raw) {
  return raw === 'plain' ? 'quote-widget-plain' : 'quote-widget-card';
}

// listCover.showOnArchive：标签归档列表页封面显隐（false = 不渲染封面，默认 true = 现行为）。
function archiveCoverEnabled(features) {
  const lc = (features && features.listCover) || {};
  return lc.enabled !== false && lc.showOnArchive !== false;
}

// cover 运行时归一化：defaultPattern 不在 patterns 内时回退 patterns[0]。
function coverRuntimeConfig(features) {
  const c = (features && features.cover) || {};
  const patterns = Array.isArray(c.patterns) && c.patterns.length ? c.patterns.slice() : ['gradient', 'stripes', 'dots', 'blob', 'mesh'];
  const def = patterns.includes(c.defaultPattern) ? c.defaultPattern : patterns[0];
  return { enabled: c.enabled !== false, patterns, defaultPattern: def, preferImage: c.preferImage !== false };
}

// pagefind.integrate：false 时即使 provider=pagefind 也回退内置搜索链路。
function pagefindIntegrated(features, provider) {
  if (String(provider || '') !== 'pagefind') return false;
  const pf = (features && features.pagefind) || {};
  return pf.enabled !== false && pf.integrate !== false;
}

// 搜索索引生成条件：provider=local，或 provider=pagefind 且 integrate=false（回退链路需本地索引）。
function localSearchIndexNeeded(navigation, features) {
  const navSearch = (navigation && navigation.search) || {};
  if (!navSearch.enabled || !navSearch.provider) return false;
  if (navSearch.provider === 'local') return true;
  if (navSearch.provider === 'pagefind') return !pagefindIntegrated(features, 'pagefind');
  return false;
}

// shortcuts.showHelpHint：页脚提示按钮渲染门控（default true = 现行为新增入口）。
function showHelpHint(features) {
  const s = (features && features.shortcuts) || {};
  return s.enabled !== false && s.showHelpHint !== false;
}

// frontmatter excerpt 的 Markdown 纯文本化（features.autoSummary.stripMarkdown=true 时启用）。
// 覆盖：围栏/行内代码、图片/链接、标题、引用、列表、强调、删除线、分隔线、内联 HTML；最后压缩空白。
function stripMarkdownText(text) {
  return String(text == null ? '' : text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`([^`\n]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)([^*_\n]+)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s*([-*_]){3,}\s*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// features.search 检索参数归一化（第四轮 W2 接线）。
//   showCount/matchTags/matchCategories 默认 true（= 历史行为）；
//   weightTitle/weightExcerpt/weightContent 默认 5/2/1（与 features-schema.js → DEFAULT_FEATURES.search 同值）；
//   权重为 0 = 该字段不参与匹配与计分；负数/空值回退默认。
function normalizeSearchConfig(features) {
  const s = (features && features.search) || {};
  const weight = function (raw, dflt) {
    return (raw === '' || raw == null || isNaN(+raw)) ? dflt : Math.max(0, +raw);
  };
  return {
    showCount: s.showCount !== false,
    matchTags: s.matchTags !== false,
    matchCategories: s.matchCategories !== false,
    weightTitle: weight(s.weightTitle, 5),
    weightExcerpt: weight(s.weightExcerpt, 2),
    weightContent: weight(s.weightContent, 1)
  };
}

// 无结果文案优先级链（浮层搜索）：
//   zh: features.search.emptyHint > noResultText > tuning.search.emptyText > 调用方内置兜底
//   en: features.search.emptyHintEn > noResultTextEn > tuning.search.emptyTextEn > 调用方内置兜底
// 空串/未设置视为「未提供」，逐级回退；全空返回 ''（由消费方决定最终内置文案）。
function searchEmptyText(features, tuning, lang) {
  const s = (features && features.search) || {};
  const t = (tuning && tuning.search) || {};
  const chain = String(lang || '') === 'en'
    ? [s.emptyHintEn, s.noResultTextEn, t.emptyTextEn]
    : [s.emptyHint, s.noResultText, t.emptyText];
  for (let i = 0; i < chain.length; i++) {
    if (chain[i]) return String(chain[i]);
  }
  return '';
}

// 加权检索（canonical 语义，前端 js/domains/features/search.js 与 /search 页镜像实现）。
//   - 命中字段得分 = 字段权重 × 命中出现次数（线性计数）；
//   - 权重为 0 的字段既不参与匹配也不参与计分；
//   - tags/categories 仅参与「是否命中」（无独立权重键，计 0 分），受 matchTags/matchCategories 门控；
//   - 按总分降序；同分保持输入顺序（索引/列表本身按日期倒序生成）→ 等价「同分按日期」。
function rankSearchEntries(entries, query, features) {
  const c = normalizeSearchConfig(features);
  const q = String(query == null ? '' : query).toLowerCase();
  const list = Array.isArray(entries) ? entries : [];
  if (!q) return [];
  function count(text) {
    if (!text) return 0;
    const hay = String(text).toLowerCase();
    let n = 0, i = 0;
    while ((i = hay.indexOf(q, i)) !== -1) { n++; i += q.length; }
    return n;
  }
  function hasAny(values) {
    return Array.isArray(values) && values.some(function (v) { return String(v).toLowerCase().indexOf(q) !== -1; });
  }
  const scored = [];
  for (let idx = 0; idx < list.length; idx++) {
    const e = list[idx] || {};
    let score = 0, hit = false;
    if (c.weightTitle > 0) { const n = count(e.title); if (n) { score += n * c.weightTitle; hit = true; } }
    if (c.weightExcerpt > 0) { const n = count(e.excerpt); if (n) { score += n * c.weightExcerpt; hit = true; } }
    if (c.weightContent > 0) { const n = count(e.content); if (n) { score += n * c.weightContent; hit = true; } }
    if (c.matchTags && hasAny(e.tags)) hit = true;
    if (c.matchCategories && hasAny(e.categories)) hit = true;
    if (hit) scored.push({ entry: e, score: score, index: idx });
  }
  scored.sort(function (a, b) { return (b.score - a.score) || (a.index - b.index); });
  return scored.map(function (x) { return x.entry; });
}

// wikiLinks 构建期解析参数归一化（默认值与历史固定行为一致：text / 区分大小写关闭时保持原行为 / 支持自定义标签）。
function wikiLinkConfig(features) {
  const wl = (features && features.wikiLinks) || {};
  return {
    enabled: wl.enabled !== false,
    unknownMode: ['text', 'link', 'hide'].includes(wl.unknownMode) ? wl.unknownMode : 'text',
    unknownSuffix: wl.unknownSuffix == null ? '' : String(wl.unknownSuffix),
    caseInsensitive: wl.caseInsensitive !== false,
    allowCustomLabel: wl.allowCustomLabel !== false
  };
}

// Hero 搜索占位（构建期 SSR）：hero 键按语言取值；空串 = 交由模板回退 ui-strings.toolbar.searchPlaceholder(En)。
function heroSearchPlaceholder(features, lang) {
  const h = (features && features.hero) || {};
  const raw = String(lang || '') === 'en' ? h.searchPlaceholderEn : h.searchPlaceholder;
  return raw == null ? '' : String(raw);
}

module.exports = {
  normalizeThemeDarkMode,
  normalizeMarkClass,
  pinnedConfig,
  pinnedText,
  makeArticleComparator,
  defaultOpenLevelInfo,
  staggerDelays,
  quoteWidgetClass,
  archiveCoverEnabled,
  coverRuntimeConfig,
  pagefindIntegrated,
  localSearchIndexNeeded,
  showHelpHint,
  stripMarkdownText,
  normalizeSearchConfig,
  searchEmptyText,
  rankSearchEntries,
  wikiLinkConfig,
  heroSearchPlaceholder
};
