'use strict';
// 配置键 → 运行时/模板值的归一化函数集合（构建期纯函数，单测覆盖在 scripts/config-wiring.test.js）。
const { escapeJsonForScript } = require('./utils');

// 配置接线纯函数：
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
// 覆盖：围栏/行内代码、图片/链接、标题、引用、列表、强调、删除线、分隔线、内联 HTML、数学段；最后压缩空白。
function stripMarkdownText(text) {
  const stripped = String(text == null ? '' : text)
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
    .replace(/<[^>]+>/g, ' ');
  return stripMathText(stripped);
}

// 数学段的纯文本剥离（摘要 surfaces 统一策略）：块级/行内定界符连内容一并移除，
// 输出不含裸 $ / $$；货币口径与构建期 mathGuard 一致（闭合 $ 后随数字不成对）。
// 仅覆盖默认定界符（$$ / $ / \( \[）；自定义定界符的摘要请使用构建期占位（data-tex）链路。
function stripMathText(text) {
  return String(text == null ? '' : text)
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/\$(?!\$)(?:\\.|[^$\\\n])+\$(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// features.search 检索参数归一化。
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

// ---------------------------------------------------------------------------
// supSub / math / mermaid / series / related / wordCount /
// gallery / imageLazy 配置接线纯函数（构建期与模板共用；默认值 = 历史行为）。
// ---------------------------------------------------------------------------

// 正则元字符转义（定界符/标记可作为正则字面量安全使用）。
function escapeRegExp(str) {
  return String(str == null ? '' : str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 文案模板替换：{name} 等具名占位符，未提供的占位符保持原样（含大小写敏感匹配）。
function applyTemplate(tpl, vars) {
  return String(tpl == null ? '' : tpl).replace(/\{([A-Za-z0-9_]+)\}/g, function (m, key) {
    return Object.prototype.hasOwnProperty.call(vars || {}, key) ? String(vars[key]) : m;
  });
}

// supSub 配置归一化：
//   supMarker/subMarker 取非空字符串（缺省 ^ / ~，≥1 字符，正则元字符按字面量匹配）；
//   skipInsideMath 默认 true = 历史行为（数学段内不处理上下标；false 时数学段内也解析）；
//   preserveUnmatched 默认 true = 孤立标记保持原文（false = 剥离标记字符）。
function supSubConfig(features) {
  const s = (features && features.supSub) || {};
  const marker = function (raw, dflt) {
    const v = raw == null ? '' : String(raw);
    return v.length ? v : dflt;
  };
  return {
    enabled: s.enabled !== false,
    supMarker: marker(s.supMarker, '^'),
    subMarker: marker(s.subMarker, '~'),
    skipInsideMath: s.skipInsideMath !== false,
    preserveUnmatched: s.preserveUnmatched !== false
  };
}

// supSub 标记匹配表（顺序：上标优先；两标记相同时以上标记优先，避免同一字符双重语义）。
function supSubMatchers(cfg) {
  const list = [];
  if (cfg.supMarker) list.push({ marker: cfg.supMarker, up: true });
  if (cfg.subMarker && cfg.subMarker !== cfg.supMarker) list.push({ marker: cfg.subMarker, up: false });
  return list;
}

// 定位 src 起始处的 supSub 段：返回 { raw, text, up } 或 null。
// 规则与历史正则 `^([~^])([^~^\n]+?)\1` 等价：内容非空、不跨行、不含任一标记（含自身）。
function matchSupSub(src, matchers) {
  const input = String(src == null ? '' : src);
  for (const mk of matchers) {
    if (!input.startsWith(mk.marker)) continue;
    const bodyStart = mk.marker.length;
    let i = bodyStart;
    while (i <= input.length) {
      if (i >= input.length || input[i] === '\n') break;
      let isMarker = false;
      for (const other of matchers) {
        if (input.startsWith(other.marker, i)) { isMarker = true; break; }
      }
      if (isMarker) {
        if (i > bodyStart && input.startsWith(mk.marker, i)) {
          return { raw: input.slice(0, i + mk.marker.length), text: input.slice(bodyStart, i), up: mk.up };
        }
        break;
      }
      i++;
    }
  }
  return null;
}

// 数学段内 supSub 转换（仅在 supSub.skipInsideMath=false 且 math.autoDetect=true 时使用）：
// 对定界符（block 优先、其后 inline）内部应用上下标替换，外部保持原样；不成对标记按
// preserveUnmatched 处理（保持或剥离）。delimiters 形如 { block: ['$$'], inline: ['$'] }。
function transformSupSubInMathRaw(raw, matchers, preserveUnmatched, delimiters) {
  const input = String(raw == null ? '' : raw);
  const d = delimiters || {};
  const pairs = [];
  for (const open of (Array.isArray(d.block) ? d.block : ['$$'])) pairs.push([open, open]);
  for (const open of (Array.isArray(d.inline) ? d.inline : ['$'])) pairs.push([open, open]);
  for (const pair of pairs) {
    const [open, close] = pair;
    if (!input.startsWith(open) || !input.endsWith(close) || input.length <= open.length + close.length) continue;
    const inner = input.slice(open.length, input.length - close.length);
    return open + transformSupSubText(inner, matchers, preserveUnmatched) + close;
  }
  return input;
}

// 纯文本 supSub 转换（escapeHtml 由调用方保证：本函数输出 HTML，正文由 marked 转义后再调用时需注意）。
function transformSupSubText(text, matchers, preserveUnmatched) {
  const input = String(text == null ? '' : text);
  let out = '';
  let i = 0;
  while (i < input.length) {
    // 标记重复（如 `~~`）可能是删除线等其它语法：整体保留、不作上下标解析
    let doubled = false;
    for (const mk of matchers) {
      if (input.startsWith(mk.marker + mk.marker, i)) {
        out += mk.marker + mk.marker;
        i += mk.marker.length * 2;
        doubled = true;
        break;
      }
    }
    if (doubled) continue;
    const hit = matchSupSub(input.slice(i), matchers);
    if (hit) {
      const body = hit.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      out += hit.up ? '<sup>' + body + '</sup>' : '<sub>' + body + '</sub>';
      i += hit.raw.length;
      continue;
    }
    let stripped = false;
    if (!preserveUnmatched) {
      for (const mk of matchers) {
        if (!input.startsWith(mk.marker, i)) continue;
        i += mk.marker.length;
        stripped = true;
        break;
      }
    }
    if (stripped) continue;
    out += input[i];
    i++;
  }
  return out;
}

// math 配置归一化：
//   autoDetect 默认 true（自动解析定界符并保护数学段；false = 不自动解析，仅渲染 ```math 围栏块）；
//   inlineDelimiters/blockDelimiters 取非空字符串数组（去空去重；缺省 ['$'] / ['$$']）；
//   mathml 默认 true（KaTeX output='htmlAndMathml'；false = 'html'）。
function mathConfig(features) {
  const m = (features && features.math) || {};
  const arr = function (raw, dflt) {
    if (!Array.isArray(raw)) return dflt.slice();
    const out = [];
    for (const item of raw) {
      const v = item == null ? '' : String(item);
      if (v && !out.includes(v)) out.push(v);
    }
    return out.length ? out : dflt.slice();
  };
  const strict = m.strict === 'warn' || m.strict === 'error' || m.strict === true ? m.strict : false;
  return {
    enabled: m.enabled !== false,
    autoDetect: m.autoDetect !== false,
    inlineDelimiters: arr(m.inlineDelimiters, ['$']),
    blockDelimiters: arr(m.blockDelimiters, ['$$']),
    renderRoundParens: m.renderRoundParens !== false,
    renderSquareBrackets: m.renderSquareBrackets !== false,
    mathml: m.mathml !== false,
    throwOnError: m.throwOnError === true,
    strict: strict
  };
}

// 构建期 mathGuard 正则集（全部经正则转义，支持 ≥1 字符定界符）：
//   blockStart  行首块定界符探测（用于 marked start()）
//   blockToken  完整块（可跨行）
//   inlineToken 完整行内段（块定界符同行形态 + 单字符对称定界符 + \( 与 \[）
//   inlineStart 行内定界符首字符集合（不含反引号，反引号跳过逻辑在调用方）
function buildMathGuardPatterns(cfg) {
  const c = cfg || {};
  const inline = (Array.isArray(c.inlineDelimiters) && c.inlineDelimiters.length) ? c.inlineDelimiters : ['$'];
  const block = (Array.isArray(c.blockDelimiters) && c.blockDelimiters.length) ? c.blockDelimiters : ['$$'];
  const blockParts = [];
  const blockStartParts = [];
  for (const d of block) {
    const e = escapeRegExp(d);
    blockParts.push(e + '[\\s\\S]*?' + e);
    blockStartParts.push(e);
  }
  const inlineParts = [];
  const startChars = new Set();
  for (const d of block) {
    const e = escapeRegExp(d);
    inlineParts.push(e + '(?!\\s)[^\\n]*?' + e);
    startChars.add(d.charAt(0));
  }
  for (const d of inline) {
    const e = escapeRegExp(d);
    startChars.add(d.charAt(0));
    if (d.length > 1) {
      inlineParts.push(e + '[\\s\\S]*?' + e);
    } else {
      const notSame = '(?!' + e + ')';
      const notDigit = d === '$' ? '(?!\\d)' : '';
      inlineParts.push(e + notSame + '(?:\\\\.|[^' + e + '\\\\\\n])+' + e + notDigit);
    }
  }
  if (c.renderRoundParens !== false) {
    inlineParts.push('\\\\\\([\\s\\S]*?\\\\\\)');
    startChars.add('\\');
  }
  if (c.renderSquareBrackets !== false) {
    inlineParts.push('\\\\\\[[\\s\\S]*?\\\\\\]');
    startChars.add('\\');
  }
  return {
    blockStart: new RegExp('^(?:' + blockStartParts.join('|') + ')', 'm'),
    blockToken: new RegExp('^(?:' + blockParts.join('|') + ')'),
    inlineToken: new RegExp('^(?:' + inlineParts.join('|') + ')'),
    inlineStartChars: Array.from(startChars)
  };
}

// 从 mathGuard 捕获的原文中剥离定界符，返回 { tex, display }（无法识别返回 null）。
// 判定顺序：块级定界符（长优先）→ 行内定界符（长优先）→ \( \) 行内 → \[ \] 块级。
// delimiters 形如 { block: ['$$'], inline: ['$'] }；缺省与 mathConfig 一致。
function extractMathTex(raw, delimiters) {
  const text = String(raw == null ? '' : raw);
  const d = delimiters || {};
  const block = (Array.isArray(d.block) && d.block.length ? d.block : ['$$']).slice().sort(function (a, b) { return b.length - a.length; });
  const inline = (Array.isArray(d.inline) && d.inline.length ? d.inline : ['$']).slice().sort(function (a, b) { return b.length - a.length; });
  for (const open of block) {
    if (open && text.length > open.length * 2 && text.startsWith(open) && text.endsWith(open)) {
      return { tex: text.slice(open.length, text.length - open.length), display: true };
    }
  }
  for (const open of inline) {
    if (open && text.length > open.length * 2 && text.startsWith(open) && text.endsWith(open)) {
      return { tex: text.slice(open.length, text.length - open.length), display: false };
    }
  }
  if (text.length > 4 && text.startsWith('\\(') && text.endsWith('\\)')) {
    return { tex: text.slice(2, text.length - 2), display: false };
  }
  if (text.length > 4 && text.startsWith('\\[') && text.endsWith('\\]')) {
    return { tex: text.slice(2, text.length - 2), display: true };
  }
  return null;
}

// 配置定界符的自定义检测（非默认项 inline 非 '$' / block 非 '$$' 成对出现即视为存在数学；
// 默认 $ 与 $$ 的口径由 mathNeeded 的块级正则 + mathGuard 行内正则覆盖）。
function hasCustomMathDelimiters(content, cfg) {
  const text = String(content == null ? '' : content);
  const inline = (cfg && Array.isArray(cfg.inlineDelimiters)) ? cfg.inlineDelimiters : ['$'];
  const block = (cfg && Array.isArray(cfg.blockDelimiters)) ? cfg.blockDelimiters : ['$$'];
  for (const d of block) {
    if (d === '$$') continue;
    const e = escapeRegExp(d);
    if (new RegExp(e + '[\\s\\S]*?' + e).test(text)) return true;
  }
  for (const d of inline) {
    if (d === '$') continue;
    const e = escapeRegExp(d);
    if (new RegExp(e + '[^\\n]*?' + e).test(text)) return true;
  }
  return false;
}

// KaTeX 按需加载判定（canonical；articles.js 的 hasMath 与模板共用同一语义）：
//   math.enabled=false → 不加载；
//   autoDetect=true → 块级（$$ / \( / \[ / 自定义）+ 行内成对定界符（含默认 $，货币启发式不触发）；
//   autoDetect=false → 仅 ```math 围栏块触发（客户端渲染 .math-block[data-tex]）。
function mathNeeded(content, cfg) {
  const text = String(content == null ? '' : content);
  const c = cfg || {};
  if (c.enabled === false) return false;
  if (c.autoDetect !== false) {
    if (/(\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/.test(text)) return true;
    if (hasCustomMathDelimiters(text, c)) return true;
    // 默认行内 $ 成对出现（与构建期 mathGuard 同一正则，含货币/数字启发式）：门控必须覆盖，
    // 否则仅含行内公式的文章不会按需加载 KaTeX。
    const pat = buildMathGuardPatterns(c);
    return new RegExp(pat.inlineToken.source.replace(/^\^/, '')).test(text);
  }
  return /```[ \t]*math\b/i.test(text);
}

// mermaid 配置归一化：
//   autoDetect 默认 true（构建期 SSR；false = 构建期不渲染回退客户端，仍仅识别显式 ```mermaid 围栏）；
//   followTheme 默认 true（SSR 跟随站点主题生成明/暗双份；false = 仅明色，暗色沿用）；
//   copyAfterRender 默认 false（true = 每张已渲染图附复制原始代码按钮，源码经 data-mm-code 保留）；
//   errorText/errorTextEn：渲染失败占位（en 空回退中文）。
function mermaidConfig(features) {
  const m = (features && features.mermaid) || {};
  return {
    enabled: m.enabled !== false,
    autoDetect: m.autoDetect !== false,
    followTheme: m.followTheme !== false,
    copyAfterRender: m.copyAfterRender === true,
    errorText: m.errorText == null ? '' : String(m.errorText),
    errorTextEn: m.errorTextEn == null ? '' : String(m.errorTextEn)
  };
}

// mermaid 失败占位文案（按语言；en 空回退中文；均空回退内置英文兜底）。
function mermaidErrorText(cfg, lang) {
  const c = cfg || {};
  const zh = c.errorText || '';
  const en = c.errorTextEn || zh;
  const pick = String(lang || '') === 'en' ? (en || zh) : zh;
  return pick || '';
}

// series 配置归一化（文案键：未设置 = 默认模板；显式空串 = 交由模板回退词典）。
function seriesConfig(features) {
  const s = (features && features.series) || {};
  const str = function (v, dflt) { return v == null ? dflt : String(v); };
  return {
    enabled: s.enabled !== false,
    pageEnabled: s.pageEnabled !== false,
    showBadge: s.showBadge !== false,
    badgeFormat: str(s.badgeFormat, '系列 · {name}'),
    badgeFormatEn: str(s.badgeFormatEn, 'Series · {name}'),
    showNavPanel: s.showNavPanel !== false,
    sidebarWidget: s.sidebarWidget !== false,
    order: s.order === 'desc' ? 'desc' : 'asc',
    panelTitle: str(s.panelTitle, '本系列共 {total} 篇'),
    panelTitleEn: str(s.panelTitleEn, '{total} posts in this series'),
    showPosition: s.showPosition !== false,
    defaultWidgetCount: parseInt(s.defaultWidgetCount, 10) > 0 ? parseInt(s.defaultWidgetCount, 10) : 8,
    progressLabel: str(s.progressLabel, '{index} / {total}') || '{index} / {total}'
  };
}

// 语言模板解析（文案键统一链）：未设置 = 默认模板；显式空串 = 回退词典；
// en 站优先 *En（空串回退中文模板，中文模板缺省时用默认中文模板）。
function resolveTemplate(cfg, lang, zhKey, enKey, defZh) {
  const c = cfg || {};
  const zh = c[zhKey] == null ? (defZh == null ? '' : defZh) : String(c[zhKey]);
  const en = c[enKey] == null ? null : String(c[enKey]);
  if (String(lang || '') === 'en') return en || zh;
  return zh;
}

// 系列徽标文案：模板（en 空回退中文） → ui-strings 词典；{name} 替换系列名。
function seriesBadgeText(cfg, lang, name, dictZh, dictEn) {
  const tpl = resolveTemplate(cfg, lang, 'badgeFormat', 'badgeFormatEn', '系列 · {name}');
  if (tpl) return applyTemplate(tpl, { name: name == null ? '' : name });
  return String(lang || '') === 'en' ? (dictEn || dictZh || '') : (dictZh || '');
}

// 系列导航面板标题：模板（en 空回退中文） → ui-strings 词典；{total} 替换总篇数。
function seriesPanelTitle(cfg, lang, total, dictZh, dictEn) {
  const tpl = resolveTemplate(cfg, lang, 'panelTitle', 'panelTitleEn', '本系列共 {total} 篇');
  if (tpl) return applyTemplate(tpl, { total: total == null ? '' : total });
  return String(lang || '') === 'en' ? (dictEn || dictZh || '') : (dictZh || '');
}

// related 配置归一化：excludeCurrent 默认 true（相关推荐排除当前文章，历史行为）。
function relatedConfig(features) {
  const r = (features && features.related) || {};
  return { excludeCurrent: r.excludeCurrent !== false };
}

// wordCount 配置归一化：
//   onCards/inArticle 默认 true（卡片/正文尾部显示字数）；
//   textFormat/readTimeFormat 语言模板（en 空回退中文；空模板回退词典）；
//   countCjkChars 默认 true（CJK 逐字计数）；countDigits 默认 true（数字作为拉丁词参与计数，历史行为）。
function wordCountConfig(features) {
  const w = (features && features.wordCount) || {};
  const str = function (v, dflt) { return v == null ? dflt : String(v); };
  const wpm = isNaN(+w.wpm) || +w.wpm <= 0 ? 265 : +w.wpm;
  return {
    enabled: w.enabled !== false,
    onCards: w.onCards !== false,
    inArticle: w.inArticle !== false,
    textFormat: str(w.textFormat, '{count} 字'),
    textFormatEn: str(w.textFormatEn, '{count} words'),
    readTimeFormat: str(w.readTimeFormat, '{minutes} 分钟阅读'),
    readTimeFormatEn: str(w.readTimeFormatEn, '{minutes} min read'),
    wpm: wpm,
    countCjkChars: w.countCjkChars !== false,
    countDigits: w.countDigits !== false
  };
}

// 字数文案：模板（en 空回退中文） → ui-strings 词典；{count} 替换计数值。
function wordCountText(cfg, lang, count, dictZh, dictEn) {
  const tpl = resolveTemplate(cfg, lang, 'textFormat', 'textFormatEn', '{count} 字');
  if (tpl) return applyTemplate(tpl, { count: count == null ? '' : count });
  return String(lang || '') === 'en' ? (dictEn || dictZh || '') : (dictZh || '');
}

// 阅读时长文案：模板（en 空回退中文） → ui-strings 词典；{minutes} 替换分钟数。
function readTimeText(cfg, lang, minutes, dictZh, dictEn) {
  const tpl = resolveTemplate(cfg, lang, 'readTimeFormat', 'readTimeFormatEn', '{minutes} 分钟阅读');
  if (tpl) return applyTemplate(tpl, { minutes: minutes == null ? '' : minutes });
  return String(lang || '') === 'en' ? (dictEn || dictZh || '') : (dictZh || '');
}

// gallery 配置归一化：collectFeatured 默认 true（图库收集文章封面；false = 仅正文图片）。
function galleryCollectFeatured(features) {
  const g = (features && features.gallery) || {};
  return g.collectFeatured !== false;
}

// imageLazy.preserveAspectRatio 默认 true（构建期输出 width/height 防 CLS；false = 不输出，交由 CSS 自适应）。
function imagePreserveAspectRatio(features) {
  const il = (features && features.imageLazy) || {};
  return il.preserveAspectRatio !== false;
}

// ---------------------------------------------------------------------------
// lightbox / backToTop / tts / reward / heatmap / stats /
// mobile / contactPopup 接线。以下纯函数为构建期与测试的 canonical 语义。
// ---------------------------------------------------------------------------

// 非负数值解析：null/undefined/空串/非法/负数回退 fallback；0 合法（表示瞬时/不限制）。
function pickNonNegative(raw, fallback) {
  const n = parseFloat(raw);
  return isNaN(n) || n < 0 ? fallback : n;
}

// lightbox 时长与宽度归一化：
//   maxWidthVw：专键 features.lightbox.maxWidthVw > 兼容旧键 features.imageFit.lightbox.maxWidthPct > 92；
//   openDurationMs / switchDurationMs：专键 > 通用 transitionDurationMs > 220；0 = 瞬时（不做动画）。
function lightboxConfig(features) {
  const L = (features && features.lightbox) || {};
  const IF = (features && features.imageFit && features.imageFit.lightbox) || {};
  const trans = pickNonNegative(L.transitionDurationMs, 220);
  return {
    maxWidthVw: pickNonNegative(L.maxWidthVw, pickNonNegative(IF.maxWidthPct, 92)),
    openDurationMs: pickNonNegative(L.openDurationMs, trans),
    switchDurationMs: pickNonNegative(L.switchDurationMs, trans),
    transitionDurationMs: trans
  };
}

// backToTop 运行时归一化：
//   scrollDurationMs 默认 450（0 = 瞬时）；smoothScroll 默认 true（false = 瞬时，与 hotkey 现语义统一）；
//   htmlAnchorFallback 默认 false（true = 模板输出 <noscript> 锚点链接）。
function backToTopConfig(features) {
  const B = (features && features.backToTop) || {};
  return {
    scrollDurationMs: pickNonNegative(B.scrollDurationMs, 450),
    smoothScroll: B.smoothScroll !== false,
    htmlAnchorFallback: B.htmlAnchorFallback === true
  };
}

// tts 运行时候选语音选择（与 js/domains/features/tts.js 的运行时算法同源）：
//   voiceBy='lang'（默认）= voice.lang 精确/前缀匹配页面语言；voiceBy='name' = voice.name 含语言显示名
//   （Intl.DisplayNames 的英文名与页面语言名，兼容 lang 标签不可靠的平台），name 无命中回退 lang；
//   preferDefaultVoice 默认 true = 命中集合内按 localService(2 分)/default(1 分) 取最高分（稳定序）；
//   false = 取平台返回顺序首个；整体无命中返回 null（由调用方回退浏览器默认语音）。
function ttsLanguageNames(lang) {
  const base = String(lang == null ? '' : lang).toLowerCase().split(/[-_]/)[0];
  if (!base) return [];
  const out = [];
  ['en', base].forEach(function (loc) {
    try {
      const display = new Intl.DisplayNames([loc], { type: 'language' });
      const name = display.of(base);
      if (name) {
        const v = String(name).toLowerCase();
        if (out.indexOf(v) === -1) out.push(v);
      }
    } catch (e) { /* 忽略：环境无 Intl.DisplayNames 时该语言名不参与匹配 */ }
  });
  return out;
}

function pickTtsVoice(voices, lang, cfg) {
  const list = Array.isArray(voices) ? voices.filter(function (v) { return v && typeof v === 'object'; }) : [];
  if (!list.length) return null;
  const c = cfg || {};
  const exact = String(lang == null ? '' : lang).toLowerCase();
  const base = exact.split(/[-_]/)[0];
  let matched = [];
  if (c.voiceBy === 'name') {
    const names = ttsLanguageNames(lang);
    if (names.length) {
      matched = list.filter(function (v) {
        const n = String(v.name || '').toLowerCase();
        return names.some(function (x) { return n.indexOf(x) > -1; });
      });
    }
  }
  if (!matched.length) {
    matched = list.filter(function (v) { return String(v.lang || '').toLowerCase() === exact; });
    if (!matched.length && base) {
      matched = list.filter(function (v) {
        const vl = String(v.lang || '').toLowerCase();
        return vl === base || vl.indexOf(base + '-') === 0;
      });
    }
  }
  if (!matched.length) return null;
  if (c.preferDefaultVoice === false) return matched[0];
  let best = matched[0], bestScore = -1;
  matched.forEach(function (v) {
    const score = (v.localService === true ? 2 : 0) + (v.default === true ? 1 : 0);
    if (score > bestScore) { bestScore = score; best = v; }
  });
  return best;
}

// tts 配置归一化：preferDefaultVoice 默认 true；voiceBy 仅接受 lang|name（其余回退 lang）；highlightParagraph 默认 false。
function ttsConfig(features) {
  const T = (features && features.tts) || {};
  return {
    preferDefaultVoice: T.preferDefaultVoice !== false,
    voiceBy: T.voiceBy === 'name' ? 'name' : 'lang',
    highlightParagraph: T.highlightParagraph === true
  };
}

// reward 关闭路径门控：默认三者皆 true（现行为）；false = 对应关闭方式失效。
function rewardCloseConfig(features) {
  const R = (features && features.reward) || {};
  return {
    byBtn: R.closeByBtn !== false,
    byOverlay: R.closeByOverlay !== false,
    byEsc: R.closeByEsc !== false
  };
}

// heatmap 层数钳制（2~7；非法回退 5）。
const HEATMAP_LEVEL_MIN = 2;
const HEATMAP_LEVEL_MAX = 7;
function heatmapLevelCount(raw) {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return 5;
  return Math.min(HEATMAP_LEVEL_MAX, Math.max(HEATMAP_LEVEL_MIN, n));
}

// heatmap 配置归一化：levels 钳制 2~7；showLegend/showMonthNumbers 默认 true；文案键保留原值（空串交由回退链）；
// scaling='fixed' 时消费 palette（长度须 >= levels，见 resolveHeatmapPalette），'auto'（默认）忽略 palette。
function heatmapConfig(features) {
  const H = (features && features.heatmap) || {};
  const str = function (v) { return v == null ? '' : String(v); };
  return {
    enabled: H.enabled !== false,
    levels: heatmapLevelCount(H.levels),
    scaling: H.scaling === 'fixed' ? 'fixed' : 'auto',
    palette: Array.isArray(H.palette)
      ? H.palette.filter(function (x) { return typeof x === 'string' && x.trim() !== ''; }).map(function (x) { return x.trim(); })
      : [],
    showLegend: H.showLegend !== false,
    legendLow: str(H.legendLow),
    legendLowEn: str(H.legendLowEn),
    legendHigh: str(H.legendHigh),
    legendHighEn: str(H.legendHighEn),
    tooltipFormat: str(H.tooltipFormat),
    tooltipFormatEn: str(H.tooltipFormatEn),
    showMonthNumbers: H.showMonthNumbers !== false
  };
}

// 月度文章数 → 热力层级（0 = 空月；1..levels）。
// 历史口径保留：maxCount<=2 时用 count+1 阶梯（含 levels 上限）；否则 ceil(count/maxCount*levels) 线性分桶。
function heatmapBucketLevel(count, maxCount, levels) {
  const c = Math.max(0, Math.floor(+count) || 0);
  if (c <= 0) return 0;
  const n = heatmapLevelCount(levels);
  const m = Math.max(1, Math.floor(+maxCount) || 1);
  if (m <= 2) return Math.min(c + 1, n);
  return Math.max(1, Math.min(n, Math.ceil(c / m * n)));
}

// 热力色阶（l1..l(levels-1) 由浅到深，顶层为强调混色）：
//   levels=5 时逐字保持历史色阶（25/45/65% + 实色 + 强调）；其余层数按 25%→100% 线性等分。
function heatmapPalette(levels) {
  const n = heatmapLevelCount(levels);
  if (n === 5) {
    return [
      'color-mix(in srgb,var(--color-s) 25%,var(--color-surface))',
      'color-mix(in srgb,var(--color-s) 45%,var(--color-surface))',
      'color-mix(in srgb,var(--color-s) 65%,var(--color-surface))',
      'var(--color-s)',
      'color-mix(in srgb,var(--color-s) 40%,var(--color-a))'
    ];
  }
  const out = [];
  for (let i = 1; i < n; i++) {
    if (i === n - 1) out.push('var(--color-s)');
    else {
      const pct = Math.round(25 + (i - 1) * (100 - 25) / (n - 2));
      out.push('color-mix(in srgb,var(--color-s) ' + pct + '%,var(--color-surface))');
    }
  }
  out.push('color-mix(in srgb,var(--color-s) 40%,var(--color-a))');
  return out;
}

// 图例示色层级（不含 l0 空色）：[1, 中位, 顶层下一级] 去重。levels=5 → [1,2,4]（历史图例）。
function heatmapLegendLevels(levels) {
  const n = heatmapLevelCount(levels);
  const arr = [1, Math.ceil((n - 1) / 2), n - 1];
  return arr.filter(function (v, i) { return v >= 1 && arr.indexOf(v) === i; });
}

// 图例低/高文案链：*En（en 站）> 中文 > ui-strings 词典（dict 已按语言解析）。
function heatmapLegendText(cfg, lang, which, dict) {
  const c = cfg || {};
  const en = String(lang || '') === 'en';
  const zhKey = which === 'high' ? 'legendHigh' : 'legendLow';
  const enKey = zhKey + 'En';
  const v = en ? (c[enKey] || c[zhKey]) : c[zhKey];
  return v || (dict == null ? '' : String(dict));
}

// 热力 tooltip 模板链：*En（en 站）> 中文 > 内置 `{year}-{month}: {count} <单位>`；{year}/{month}/{count} 替换。
function heatmapTooltip(cfg, lang, year, month, count, unitZh, unitEn) {
  const c = cfg || {};
  const en = String(lang || '') === 'en';
  const tpl = en ? (c.tooltipFormatEn || c.tooltipFormat) : c.tooltipFormat;
  if (tpl) return applyTemplate(tpl, { year: year, month: month, count: count });
  const unit = en ? (unitEn || 'posts') : (unitZh || '篇');
  return String(year) + '-' + String(month) + ': ' + String(count) + ' ' + unit;
}

// stats 配置归一化：showArchiveCards 默认 true；linkArchive 默认 /archive/（空串 = 卡片不跳转）。
function statsConfig(features) {
  const s = (features && features.stats) || {};
  const link = s.linkArchive == null ? '/archive/' : String(s.linkArchive).trim();
  return {
    enabled: s.enabled !== false,
    showArchiveCards: s.showArchiveCards !== false,
    linkArchive: link
  };
}

// 统计标签文案链：*En（en 站）> 中文配置 > [fallbackKey 同链] > ui-strings 词典（dict 已按语言解析）。
function statsLabel(statsRaw, lang, key, dict, fallbackKey) {
  const cfg = statsRaw || {};
  const en = String(lang || '') === 'en';
  const chain = function (k) {
    const zh = cfg[k];
    const enVal = cfg[k + 'En'];
    const v = en ? (enVal || zh) : zh;
    return v == null ? '' : String(v);
  };
  let v = chain(key);
  if (!v && fallbackKey) v = chain(fallbackKey);
  return v || (dict == null ? '' : String(dict));
}

// mobile 配置归一化：searchFullscreen/touchFallback/codeScrollHint 默认 true；
// buttonStackGap 默认 3.4rem（与历史移动端按钮堆叠步进一致，视觉不变）。
function mobileConfig(features) {
  const m = (features && features.mobile) || {};
  const gap = m.buttonStackGap == null ? '' : String(m.buttonStackGap).trim();
  return {
    enabled: m.enabled !== false,
    searchFullscreen: m.searchFullscreen !== false,
    buttonStackGap: gap || '3.4rem',
    touchFallback: m.touchFallback !== false,
    codeScrollHint: m.codeScrollHint !== false
  };
}

// contactPopup 配置归一化：popupWidth 默认 400px（与模板历史 max-width 一致，修复 360/400 漂移）；
// showAllItems 默认 true（全量展示；false = 折叠到「更多」展开器）。
function contactPopupConfig(features) {
  const c = (features && features.contactPopup) || {};
  const width = c.popupWidth == null ? '' : String(c.popupWidth).trim();
  return {
    enabled: c.enabled !== false,
    popupWidth: width || '400px',
    showAllItems: c.showAllItems !== false
  };
}

// 联系弹窗复制按钮文案链：*En（en 站）> 中文 > ui-strings 词典。
function contactCopyText(features, lang, dict) {
  const c = (features && features.contactPopup) || {};
  const en = String(lang || '') === 'en';
  const v = en ? (c.copyTextEn || c.copyText) : c.copyText;
  return v || (dict == null ? '' : String(dict));
}

// ---------------------------------------------------------------------------
// 隐藏开关收敛：手势阈值 / 存储上限 / 反馈时长 / 空闲超时 / 缓存条数 /
// 阅读模式持久化 / 命令面板回退值 / 搜索索引加载参数。
// 默认值 = 历史行为（与 features-schema.js / tuning-defaults.js 同值）。
// ---------------------------------------------------------------------------

// 非负整数解析：非法/低于下限回退 fallback（下限默认 0）。
function pickCount(raw, fallback, min) {
  const n = parseInt(raw, 10);
  const floor = min == null ? 0 : min;
  return isNaN(n) || n < floor ? fallback : n;
}

// lightbox 手势阈值归一化（触屏横滑/下拉关闭/鼠标拖拽/双击倍数/遮罩容差）。
function lightboxGestureConfig(features) {
  const L = (features && features.lightbox) || {};
  const dbl = +L.dblClickZoomLevel;
  return {
    swipeThresholdPx: pickNonNegative(L.swipeThresholdPx, 50),
    swipeCloseThresholdPx: pickNonNegative(L.swipeCloseThresholdPx, 80),
    mouseSwipeThresholdPx: pickNonNegative(L.mouseSwipeThresholdPx, 80),
    dblClickZoomLevel: isNaN(dbl) || dbl < 1 ? 2 : dbl,
    clickTolerancePx: pickNonNegative(L.clickTolerancePx, 6)
  };
}

// readingProgress 阅读位置参数归一化（键盘步进 / 恢复下限 / 存储上限 / 保存节流）。
function readingRestoreConfig(features) {
  const R = (features && features.readingProgress) || {};
  const step = +R.keyboardStep;
  return {
    keyboardStep: isNaN(step) || step <= 0 ? 0.05 : Math.min(1, step),
    minRestorePx: pickNonNegative(R.minRestorePx, 160),
    maxStoredPositions: pickCount(R.maxStoredPositions, 80, 1),
    saveThrottleMs: pickNonNegative(R.saveThrottleMs, 400)
  };
}

// readDock 滚动显隐阈值归一化（近顶部恒显距离 / 方向判定增量）。
function readDockScrollConfig(features) {
  const D = (features && features.readDock) || {};
  return {
    hideBelowPx: pickNonNegative(D.hideBelowPx, 80),
    directionDeltaPx: pickNonNegative(D.directionDeltaPx, 12)
  };
}

// externalLink 复制反馈时长归一化（0 = 立即还原）。
function externalLinkCopyConfig(features) {
  const E = (features && features.externalLink) || {};
  return { copyFeedbackMs: pickNonNegative(E.copyFeedbackMs, 1500) };
}

// hotSearches 词频表上限归一化（≥1；非法回退 50）。
function hotSearchesConfig(features) {
  const H = (features && features.hotSearches) || {};
  return { maxWords: pickCount(H.maxWords, 50, 1) };
}

// morphIcons 空闲预加载超时归一化（非法回退 3000）。
function morphIconsConfig(features) {
  const M = (features && features.morphIcons) || {};
  return { idleTimeoutMs: pickNonNegative(M.idleTimeoutMs, 3000) };
}

// softNavigation 内存缓存条数归一化（≥1；非法回退 16）。
function softNavCacheConfig(features) {
  const S = (features && features.softNavigation) || {};
  return { cacheMaxEntries: pickCount(S.cacheMaxEntries, 16, 1) };
}

// readingHistory 本地存储上限归一化（≥1；非法回退 50）。
function readingHistoryConfig(features) {
  const R = (features && features.readingHistory) || {};
  return { maxStored: pickCount(R.maxStored, 50, 1) };
}

// continueReading 首页卡片归一化：displayCount≥1（非法回退 3）、showProgress 默认 true、
// storageKey 留空时复用 readingHistory.storageKey（再回退历史默认 's-history'）；
// maxStored 复用 readingHistory.maxStored（缺省/非法回退 50，供移除后上限重算）；
// 文案键 removeLabel/clearLabel：zh 键空回退内置中文，*En 键空串 = en 站回退 ui-strings。
function continueReadingConfig(features) {
  const F = (features && features.continueReading) || {};
  const RH = (features && features.readingHistory) || {};
  const key = F.storageKey == null ? '' : String(F.storageKey).trim();
  const rhKey = RH.storageKey == null ? '' : String(RH.storageKey).trim();
  const pickZh = function (v, dflt) { const s = v == null ? '' : String(v).trim(); return s || dflt; };
  const pickEn = function (v) { return v == null ? '' : String(v).trim(); };
  return {
    displayCount: pickCount(F.count, 3, 1),
    showProgress: F.showProgress !== false,
    storageKey: key || rhKey || 's-history',
    maxStored: pickCount(RH.maxStored, 50, 1),
    removeLabel: pickZh(F.removeLabel, '移除'),
    removeLabelEn: pickEn(F.removeLabelEn),
    clearLabel: pickZh(F.clearLabel, '清空'),
    clearLabelEn: pickEn(F.clearLabelEn)
  };
}

// exportArticle 归一化（构建期模板/运行时共用语义）：
//   enabled 总开关；print/markdown 子开关默认开（总开关关闭时两者恒 false）；
//   文案键：zh 键未设/空串回退内置中文，*En 键空串 = en 站回退中文（模板按语言取用）；
//   sourceFootnote 仅在 print 开启时生效。
function exportArticleConfig(features) {
  const E = (features && features.exportArticle) || {};
  const enabled = E.enabled !== false;
  const print = enabled && E.print !== false;
  const pickZh = function (v, dflt) { const s = v == null ? '' : String(v).trim(); return s || dflt; };
  const pickEn = function (v) { return v == null ? '' : String(v).trim(); };
  return {
    enabled: enabled,
    print: print,
    markdown: enabled && E.markdown !== false,
    printLabel: pickZh(E.printLabel, '打印 / 另存 PDF'),
    printLabelEn: pickEn(E.printLabelEn),
    markdownLabel: pickZh(E.markdownLabel, '复制 Markdown'),
    markdownLabelEn: pickEn(E.markdownLabelEn),
    sourceFootnote: print && E.sourceFootnote !== false
  };
}

// readMode 持久化归一化：persist 默认 true；storageKey 空回退历史键名 'readingMode'。
function readModeConfig(features) {
  const R = (features && features.readMode) || {};
  const key = R.storageKey == null ? '' : String(R.storageKey).trim();
  return { persist: R.persist !== false, storageKey: key || 'readingMode' };
}

// themeLab 主题调色板归一化（canonical；与 js/domains/features/theme-lab-core.js 同语义）：
//   enabled 默认 true；storageKey 空值回退 'ss-theme-lab'；
//   tokens 仅保留已定义变量名（THEME_LAB_TOKENS）、去重保序、封顶 12；过滤后不足 8 项回退默认 12 项；
//   exportName 剔除路径分隔符与文件系统保留字符，空结果回退 'theme-overrides.json5'。
const THEME_LAB_TOKENS = [
  '--color-p', '--color-s', '--color-a', '--color-bg', '--color-surface', '--color-t',
  '--color-ts', '--color-tl', '--color-border', '--color-hover', '--color-code-bg', '--color-code-t'
];
const THEME_LAB_MIN_TOKENS = 8;
const THEME_LAB_MAX_TOKENS = 12;
const THEME_LAB_DEFAULT_KEY = 'ss-theme-lab';
const THEME_LAB_DEFAULT_EXPORT = 'theme-overrides.json5';

function themeLabConfig(features) {
  const T = (features && features.themeLab) || {};
  const key = T.storageKey == null ? '' : String(T.storageKey).trim();
  const out = [];
  if (Array.isArray(T.tokens)) {
    for (const item of T.tokens) {
      const id = item == null ? '' : String(item).trim();
      if (THEME_LAB_TOKENS.includes(id) && !out.includes(id)) out.push(id);
    }
  }
  // eslint-disable-next-line no-control-regex -- 有意匹配控制字符：文件名不得携带 NUL–US 段
  const name = String(T.exportName == null ? '' : T.exportName).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim();
  return {
    enabled: T.enabled !== false,
    storageKey: key || THEME_LAB_DEFAULT_KEY,
    tokens: (out.length >= THEME_LAB_MIN_TOKENS ? out : THEME_LAB_TOKENS.slice()).slice(0, THEME_LAB_MAX_TOKENS),
    exportName: name || THEME_LAB_DEFAULT_EXPORT
  };
}

// bilingual 双语对照配置归一化（构建期模板/CSS 与运行时共用语义）：
//   enabled/switch/sideBySide 默认 true；
//   breakpointPx 夹取到 480–3840 的整数（非法/缺失回退 1280）。
function bilingualConfig(features) {
  const B = (features && features.bilingual) || {};
  const n = parseFloat(B.breakpointPx);
  const bp = isNaN(n) ? 1280 : Math.min(3840, Math.max(480, Math.round(n)));
  return {
    enabled: B.enabled !== false,
    switch: B.switch !== false,
    sideBySide: B.sideBySide !== false,
    breakpointPx: bp
  };
}

// saveDataMode 省流模式归一化（canonical；与 js/domains/core/save-data-core.js 的
// resolveSaveDataConfig 同语义，由 scripts/save-data.test.js 对拍）：
//   enabled/auto/manual 默认 true；storageKey 空值回退 'ss-save-data'；
//   degrade 五项默认 true——唯一关闭方式为显式 false（与 features.json5 逐项对应）。
const SAVE_DATA_DEFAULT_KEY = 'ss-save-data';
function saveDataModeConfig(features) {
  const S = (features && features.saveDataMode) || {};
  const D = S.degrade || {};
  const key = S.storageKey == null ? '' : String(S.storageKey).trim();
  return {
    enabled: S.enabled !== false,
    auto: S.auto !== false,
    manual: S.manual !== false,
    storageKey: key || SAVE_DATA_DEFAULT_KEY,
    degrade: {
      animations: D.animations !== false,
      particles: D.particles !== false,
      lowResImages: D.lowResImages !== false,
      lazyAggressive: D.lazyAggressive !== false,
      systemFontsOnly: D.systemFontsOnly !== false
    }
  };
}

// commandPalette 回退值归一化（缺配置/非法时与 JSON5/schema 默认一致：ctrl+shift+p / 10 / true）。
function commandPaletteConfig(features) {
  const C = (features && features.commandPalette) || {};
  const hotkey = C.hotkey === undefined || C.hotkey === null ? 'ctrl+shift+p' : String(C.hotkey);
  const n = Number(C.maxResults);
  return {
    hotkey: hotkey,
    maxResults: Number.isFinite(n) && n > 0 ? n : 10,
    autoFocus: C.autoFocus !== false
  };
}

// 搜索索引加载参数归一化：tuning.search.indexTimeoutMs（>0，非法回退 5000）、
// indexRetry（≥0 的额外重试次数，非法回退 1）。
function searchIndexConfig(tuning) {
  const T = (tuning && tuning.search) || {};
  const to = +T.indexTimeoutMs;
  const retry = parseInt(T.indexRetry, 10);
  return {
    timeoutMs: isNaN(to) || to <= 0 ? 5000 : to,
    retry: isNaN(retry) || retry < 0 ? 1 : retry
  };
}

// 索引加载失败文案链：tuning.search.errorText(En) 按语言取值，空串 = 不参与（调用方回退 i18n）。
function searchLoadErrorText(tuning, lang) {
  const T = (tuning && tuning.search) || {};
  const raw = String(lang || '') === 'en' ? T.errorTextEn : T.errorText;
  return raw == null ? '' : String(raw);
}

// mermaid 客户端 initialize 内建默认项（canonical；templates/layout.ejs 内联脚本镜像同一语义）：
//   runtime = { dark, fontFamily, scale } 为调用时环境：
//   dark 决定 theme（true='dark'、false='neutral'）；fontFamily 空回退 'sans-serif'；
//   scale（size.fit==='scale'）决定各图种 useMaxWidth。
//   字段与历史硬编码逐字一致：startOnLoad=false / securityLevel='strict' /
//   flowchart htmlLabels=false、curve='basis' / class、state htmlLabels=false /
//   themeVariables.edgeLabelBackground='transparent'。
function mermaidClientDefaults(runtime) {
  const r = runtime || {};
  const scale = r.scale === true;
  const ff = r.fontFamily == null ? '' : String(r.fontFamily);
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: r.dark === true ? 'dark' : 'neutral',
    fontFamily: ff || 'sans-serif',
    flowchart: { htmlLabels: false, useMaxWidth: scale, curve: 'basis' },
    sequence: { useMaxWidth: scale },
    gantt: { useMaxWidth: scale },
    er: { useMaxWidth: scale },
    class: { htmlLabels: false, useMaxWidth: scale },
    state: { htmlLabels: false, useMaxWidth: scale },
    themeVariables: { edgeLabelBackground: 'transparent' }
  };
}

// mermaid 客户端选项深合并（canonical）：
//   base = mermaidClientDefaults 计算结果；clientOptions = features.mermaid.clientOptions。
//   规则：纯对象递归合并（配置优先）；数组/标量整体覆盖；
//   未知键原样透传（由 mermaid 自行校验）；已声明键类型不一致（含 null、数组与非数组互斥、
//   对象与非对象互斥）→ 忽略该键并记入 warnings（键路径，顶层非法时记 'clientOptions'）。
//   返回 { options, warnings }；options 始终为合法对象（clientOptions 非法时 = base）。
function mergeMermaidClientOptions(base, clientOptions) {
  const warnings = [];
  const isPlain = function (v) { return v !== null && typeof v === 'object' && !Array.isArray(v); };
  const kindOf = function (v) {
    if (Array.isArray(v)) return 'array';
    if (isPlain(v)) return 'object';
    return v === null ? 'null' : typeof v;
  };
  function merge(target, source, path) {
    const out = {};
    for (const k of Object.keys(target)) out[k] = target[k];
    if (source == null) return out;
    if (!isPlain(source)) {
      warnings.push(path || 'clientOptions');
      return out;
    }
    for (const k of Object.keys(source)) {
      const keyPath = path ? path + '.' + k : k;
      const v = source[k];
      if (!Object.prototype.hasOwnProperty.call(out, k)) { out[k] = v; continue; }
      const cur = out[k];
      if (isPlain(cur) && isPlain(v)) { out[k] = merge(cur, v, keyPath); continue; }
      if (kindOf(cur) === kindOf(v)) out[k] = v;
      else warnings.push(keyPath);
    }
    return out;
  }
  return { options: merge(base, clientOptions, ''), warnings: warnings };
}

// guard 水印移动端断点（canonical）：单一来源 tuning.layout.mobileBreakpoint（可能带 px 单位）；
// 缺省/非法/非正数回退 768（历史硬编码值，降级模式下 tuning 缺失时保持原行为）。
function watermarkMobileBreakpointPx(tuning) {
  const raw = ((tuning || {}).layout || {}).mobileBreakpoint;
  const n = parseFloat(raw);
  return isNaN(n) || n <= 0 ? 768 : n;
}

// 触觉反馈时长归一化（guard.contextMenu.hapticMs / features.sidebarDrag.hapticMs）：
//   非负整数；0 = 禁用震动；非法/负数/空值回退 fallback（默认 10，历史硬编码值）。
function hapticDurationMs(raw, fallback) {
  const dflt = fallback == null ? 10 : fallback;
  const n = parseInt(raw, 10);
  return isNaN(n) || n < 0 ? dflt : n;
}

// 存储键归一化（lightbox.positionStorageKey / devtoolsDetect.reloadStorageKey）：
//   去首尾空白；空值/非法回退 fallback（历史键名）。
function storageKeyOr(raw, fallback) {
  const v = raw == null ? '' : String(raw).trim();
  return v || fallback;
}

// 解析热力色阶：scaling='fixed' 且 palette 长度 >= levels 时使用固定色表（取前 levels 项）；
// 长度不足/非法时回退 auto 色阶并返回构建期提示（warning 由调用方打印一次）。
function resolveHeatmapPalette(cfg) {
  const c = cfg || {};
  const levels = heatmapLevelCount(c.levels);
  const palette = Array.isArray(c.palette) ? c.palette : [];
  if (c.scaling === 'fixed') {
    if (palette.length >= levels) return { colors: palette.slice(0, levels), warning: '' };
    return {
      colors: heatmapPalette(levels),
      warning: 'features.heatmap.scaling=fixed 但 palette 仅 ' + palette.length + ' 色（需要 ' + levels + '），已回退 auto 色阶'
    };
  }
  return { colors: heatmapPalette(levels), warning: '' };
}

// analytics 配置归一化：injectAt 枚举（head|body，非法回退 body）；emitBeacon 默认 true；
// scriptSrc 仅透传（默认值由 features-schema.js 单源提供，wiring 不再内联兜底 URL）；
// siteTag 为站点级 token 覆盖来源（非空优先，优先级解析在 scripts/build/config.js，见 config-reference §3.30）。
function analyticsConfig(features) {
  const A = (features && features.analytics) || {};
  const src = A.scriptSrc == null ? '' : String(A.scriptSrc).trim();
  return {
    enabled: A.enabled !== false,
    scriptSrc: src,
    injectAt: A.injectAt === 'head' ? 'head' : 'body',
    emitBeacon: A.emitBeacon !== false,
    siteTag: A.siteTag == null ? '' : String(A.siteTag).trim()
  };
}

// 生成 Cloudflare Web Analytics 引导脚本（内联 <script> 标签串）：token 为空/未启用/无 scriptSrc 时
// 返回空串（scriptSrc 默认值由 features-schema.js 单源提供）；
// emitBeacon=false 时不输出 data-cf-beacon JSON（脚本仍加载，由 beacon 自行处理无 token 场景）。
// nonce 由 renderPage 的 injectScriptNonce 统一注入，本函数不写 nonce 属性。
function buildAnalyticsTag(cfg, token) {
  const a = cfg || {};
  const t = token == null ? '' : String(token).trim();
  if (a.enabled === false || !t || !a.scriptSrc) return '';
  const src = escapeJsonForScript(a.scriptSrc);
  const beaconInit = a.emitBeacon === false ? '' : 'var cfg=' + escapeJsonForScript({ token: t }) + ';';
  const beaconAttr = a.emitBeacon === false ? '' : 'e.setAttribute("data-cf-beacon",JSON.stringify(cfg));';
  return '<script>(function(){var src=' + src + ';' + beaconInit +
    'function go(){if(document.getElementById("cfBeacon"))return;var e=document.createElement("script");e.defer=true;e.id="cfBeacon";e.src=src;' +
    beaconAttr + 'document.head.appendChild(e)}if(document.prerendering){document.addEventListener("prerenderingchange",go,{once:true})}else{go()}})();</script>';
}

// 构建性能阈值告警（features.performance.warning*）：返回 [WARN] 文案数组，仅提示不阻断构建；
// 预算门禁由 features.perfBudget 负责（warnOnly=false 时阻断），两者职责与日志前缀均不同。
function performanceWarnings(perf, stats, elapsedMs) {
  const p = perf || {};
  const s = stats || {};
  const pos = function (v) { return Number.isFinite(+v) && +v > 0 ? +v : 0; };
  const out = [];
  const js = pos(p.warningJsKb);
  if (js && s.jsKb > js) out.push('JS 体积 ' + s.jsKb.toFixed(1) + 'KB 超过 performance.warningJsKb=' + js + 'KB');
  const html = pos(p.warningHtmlKb);
  if (html && s.htmlRawMaxKb > html) out.push('最大 HTML 原始体积 ' + s.htmlRawMaxKb.toFixed(1) + 'KB 超过 performance.warningHtmlKb=' + html + 'KB');
  const img = pos(p.warningImageKb);
  if (img && Array.isArray(s.largeImages) && s.largeImages.length) {
    const top = s.largeImages[0];
    out.push(s.largeImages.length + ' 张图片超过 performance.warningImageKb=' + img + 'KB（最大 ' + top.kb.toFixed(1) + 'KB：' + top.path + '）');
  }
  const ms = pos(p.warningBuildMs);
  if (ms && elapsedMs > ms) out.push('构建耗时 ' + Math.round(elapsedMs) + 'ms 超过 performance.warningBuildMs=' + ms + 'ms');
  return out;
}

// debug 开关归一化（features.debug）：默认全部关闭，构建日志行为不受影响。
function debugConfig(features) {
  const d = (features && features.debug) || {};
  return {
    verbose: d.verbose === true,
    listPages: d.listPages === true,
    dumpConfig: d.dumpConfig === true
  };
}

// 解析后配置摘要（features.debug.dumpConfig）：输出顶层模块与键数、关键开关状态；
// 敏感字段（token/secret/password）只输出是否已设置，绝不输出明文。
function configSummary(config) {
  const cfg = config && typeof config === 'object' ? config : {};
  const out = [];
  const sensitive = /(token|secret|password|credential|apikey|api_key)/i;
  for (const key of Object.keys(cfg).sort()) {
    const v = cfg[key];
    if (v === null || typeof v !== 'object') {
      out.push(key + ' = ' + (sensitive.test(key) ? (v ? '***' : '') : JSON.stringify(v)));
      continue;
    }
    if (Array.isArray(v)) { out.push(key + ' = [' + v.length + ' 项]'); continue; }
    if (key === 'features') { out.push('features = ' + Object.keys(v).length + ' 个模块'); continue; }
    const parts = [];
    for (const k of Object.keys(v).sort()) {
      const val = v[k];
      if (sensitive.test(k)) parts.push(k + '=' + (val ? '***' : ''));
      else if (val === null || typeof val !== 'object') parts.push(k + '=' + JSON.stringify(val));
      else if (Array.isArray(val)) parts.push(k + '=[' + val.length + ' 项]');
      else parts.push(k + '={' + Object.keys(val).length + '}');
    }
    out.push(key + ' = ' + (parts.length ? parts.join(', ') : '(空)'));
  }
  return out;
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
  stripMathText,
  normalizeSearchConfig,
  searchEmptyText,
  rankSearchEntries,
  wikiLinkConfig,
  heroSearchPlaceholder,
  escapeRegExp,
  applyTemplate,
  supSubConfig,
  supSubMatchers,
  matchSupSub,
  transformSupSubInMathRaw,
  transformSupSubText,
  mathConfig,
  buildMathGuardPatterns,
  hasCustomMathDelimiters,
  extractMathTex,
  mathNeeded,
  mermaidConfig,
  mermaidErrorText,
  seriesConfig,
  seriesBadgeText,
  seriesPanelTitle,
  relatedConfig,
  wordCountConfig,
  wordCountText,
  readTimeText,
  galleryCollectFeatured,
  imagePreserveAspectRatio,
  pickNonNegative,
  lightboxConfig,
  backToTopConfig,
  ttsLanguageNames,
  pickTtsVoice,
  ttsConfig,
  rewardCloseConfig,
  heatmapLevelCount,
  heatmapConfig,
  heatmapBucketLevel,
  heatmapPalette,
  heatmapLegendLevels,
  heatmapLegendText,
  heatmapTooltip,
  statsConfig,
  statsLabel,
  mobileConfig,
  contactPopupConfig,
  contactCopyText,
  resolveHeatmapPalette,
  analyticsConfig,
  buildAnalyticsTag,
  performanceWarnings,
  debugConfig,
  configSummary,
  pickCount,
  lightboxGestureConfig,
  readingRestoreConfig,
  readDockScrollConfig,
  externalLinkCopyConfig,
  hotSearchesConfig,
  morphIconsConfig,
  softNavCacheConfig,
  readingHistoryConfig,
  continueReadingConfig,
  exportArticleConfig,
  readModeConfig,
  themeLabConfig,
  bilingualConfig,
  saveDataModeConfig,
  commandPaletteConfig,
  searchIndexConfig,
  searchLoadErrorText,
  mermaidClientDefaults,
  mergeMermaidClientOptions,
  watermarkMobileBreakpointPx,
  hapticDurationMs,
  storageKeyOr
};
