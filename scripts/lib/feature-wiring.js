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

// ---------------------------------------------------------------------------
// 第五轮 W3（2026-09-27）：supSub / math / mermaid / series / related / wordCount /
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

// 配置定界符的自定义检测（单 $ 保持历史口径不单独触发 KaTeX 按需加载）：
// 非默认项（inline 非 '$' / block 非 '$$'）成对出现即视为存在数学。
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
//   autoDetect=true → 历史口径（$$ / \( / \[）+ 自定义定界符成对检测；
//   autoDetect=false → 仅 ```math 围栏块触发（客户端渲染 .math-block[data-tex]）。
function mathNeeded(content, cfg) {
  const text = String(content == null ? '' : content);
  const c = cfg || {};
  if (c.enabled === false) return false;
  if (c.autoDetect !== false) {
    return /(\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/.test(text) || hasCustomMathDelimiters(text, c);
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

// 语言模板解析（W3 文案键统一链）：未设置 = 默认模板；显式空串 = 回退词典；
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
  imagePreserveAspectRatio
};
