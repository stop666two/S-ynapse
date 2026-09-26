'use strict';
// 配置接线单测：键注册表 / 删除项 / 纯函数语义 / 往返边界。
// 运行：node --test scripts/config-wiring.test.js（由 npm test 统一收集）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const features = json5.parse(fs.readFileSync(path.join(ROOT, 'features.json5'), 'utf-8'));
const theme = json5.parse(fs.readFileSync(path.join(ROOT, 'theme.json5'), 'utf-8'));
const uiStrings = json5.parse(fs.readFileSync(path.join(ROOT, 'ui-strings.json5'), 'utf-8'));
const { DEFAULT_FEATURES } = require('./lib/features-schema.js');
const w = require('./lib/feature-wiring.js');

test('features.json5：重复键已删除且 schema 同步（themeToggle/codeCopy/listCover/mobileBottomNav）', () => {
  for (const key of ['defaultTheme', 'rememberChoice', 'iconStyle', 'transitionAll']) {
    assert.ok(!(key in features.themeToggle), 'features.themeToggle.' + key + ' 应已删除');
    assert.ok(!(key in DEFAULT_FEATURES.themeToggle), 'schema themeToggle.' + key + ' 应已删除');
  }
  assert.ok(!('includeWindowBar' in features.codeCopy), 'codeCopy.includeWindowBar 应已删除');
  assert.ok(!('includeWindowBar' in DEFAULT_FEATURES.codeCopy), 'schema includeWindowBar 应已删除');
  assert.ok(!('aspectRatio' in features.listCover), 'listCover.aspectRatio 应已删除');
  assert.ok(!('aspectRatio' in DEFAULT_FEATURES.listCover), 'schema aspectRatio 应已删除');
  assert.ok(!('useSafeArea' in features.mobileBottomNav), 'mobileBottomNav.useSafeArea 应已删除');
  assert.ok(!('useSafeArea' in DEFAULT_FEATURES.mobileBottomNav), 'schema useSafeArea 应已删除');
});

test('theme.json5：darkMode 新增 canonical 键（rememberChoice/iconStyle/transitionAll）', () => {
  assert.strictEqual(theme.darkMode.rememberChoice, true);
  assert.strictEqual(theme.darkMode.iconStyle, 'sun-moon');
  assert.strictEqual(theme.darkMode.transitionAll, true);
  assert.strictEqual(theme.darkMode.default, 'system');
});

test('features.json5：本轮接线键默认值（markClass/revealStaggerMax/widgetStyle/showOnArchive）', () => {
  assert.strictEqual(features.searchHighlight.markClass, '');
  assert.strictEqual(features.motion.revealStaggerMax, 500);
  assert.strictEqual(features.dailyQuote.widgetStyle, 'card');
  assert.strictEqual(features.listCover.showOnArchive, true);
  assert.strictEqual(features.toc.defaultOpenLevel, 2);
  assert.strictEqual(features.readMode.focusOnlyContent, true);
  assert.strictEqual(features.mobileBottomNav.onlyMobile, true);
  assert.strictEqual(features.pinned.badgeStyle, 'pill');
  assert.strictEqual(features.pinned.sortRule, 'pinned-first');
  assert.strictEqual(features.cover.preferImage, true);
  assert.strictEqual(features.pagefind.integrate, true);
  assert.strictEqual(features.autoSummary.stripMarkdown, true);
  assert.strictEqual(features.shortcuts.showHelpHint, true);
  assert.strictEqual(features.favorites.listIcon, true);
});

test('ui-strings.json5：shortcutHint 双语齐全（zh + en）', () => {
  assert.ok(uiStrings.toolbar.shortcutHint, 'zh toolbar.shortcutHint 缺失');
  assert.ok(uiStrings.en.toolbar.shortcutHint, 'en toolbar.shortcutHint 缺失');
});

test('normalizeThemeDarkMode：缺省/非法值回退历史行为', () => {
  assert.deepStrictEqual(w.normalizeThemeDarkMode(undefined), { default: 'system', rememberChoice: true, iconStyle: 'sun-moon', transitionAll: true });
  assert.strictEqual(w.normalizeThemeDarkMode({ rememberChoice: false }).rememberChoice, false);
  assert.strictEqual(w.normalizeThemeDarkMode({ iconStyle: 'switch' }).iconStyle, 'switch');
  assert.strictEqual(w.normalizeThemeDarkMode({ iconStyle: 'bogus' }).iconStyle, 'sun-moon');
  assert.strictEqual(w.normalizeThemeDarkMode({ transitionAll: false }).transitionAll, false);
});

test('normalizeMarkClass：空值/非法字符过滤', () => {
  assert.strictEqual(w.normalizeMarkClass(undefined), '');
  assert.strictEqual(w.normalizeMarkClass(null), '');
  assert.strictEqual(w.normalizeMarkClass('search-hit'), 'search-hit');
  assert.strictEqual(w.normalizeMarkClass('a b"<c>'), 'abc');
});

test('pinnedConfig / pinnedText：样式与文案优先级', () => {
  const def = w.pinnedConfig({});
  assert.deepStrictEqual([def.enabled, def.badgeStyle, def.showBadge, def.sortRule], [true, 'pill', true, 'pinned-first']);
  assert.strictEqual(w.pinnedConfig({ pinned: { badgeStyle: 'none' } }).showBadge, false);
  assert.strictEqual(w.pinnedConfig({ pinned: { badgeStyle: 'bogus' } }).badgeStyle, 'pill');
  assert.strictEqual(w.pinnedConfig({ pinned: { sortRule: 'normal' } }).sortRule, 'normal');
  assert.strictEqual(w.pinnedConfig({ pinned: { enabled: false } }).showBadge, false);
  const cfg = { badgeText: '置顶!', badgeTextEn: 'Top!' };
  assert.strictEqual(w.pinnedText(cfg, 'zh', '词典', 'Dict'), '置顶!');
  assert.strictEqual(w.pinnedText(cfg, 'en', '词典', 'Dict'), 'Top!');
  assert.strictEqual(w.pinnedText({ badgeTextEn: '' }, 'en', '词典', 'Dict'), 'Dict');
  assert.strictEqual(w.pinnedText({}, 'zh', '词典', 'Dict'), '词典');
});

test('makeArticleComparator：pinned-first / normal / enabled=false', () => {
  const pinned = { title: 'p', date: '2024-01-01', pinned: true };
  const fresh = { title: 'f', date: '2024-06-01', pinned: false };
  const old = { title: 'o', date: '2023-01-01', pinned: false };
  const pf = w.makeArticleComparator({ pinned: { sortRule: 'pinned-first' } });
  assert.deepStrictEqual([old, fresh, pinned].sort(pf).map(a => a.title), ['p', 'f', 'o']);
  const normal = w.makeArticleComparator({ pinned: { sortRule: 'normal' } });
  assert.deepStrictEqual([old, fresh, pinned].sort(normal).map(a => a.title), ['f', 'p', 'o']);
  const disabled = w.makeArticleComparator({ pinned: { enabled: false } });
  assert.deepStrictEqual([old, fresh, pinned].sort(disabled).map(a => a.title), ['f', 'p', 'o']);
});

test('defaultOpenLevelInfo：0=全折叠；N≥1 按 minLevel 递推', () => {
  assert.deepStrictEqual(w.defaultOpenLevelInfo(0, 2), { collapseAll: true, visibleMaxLevel: 0 });
  assert.deepStrictEqual(w.defaultOpenLevelInfo(2, 2), { collapseAll: false, visibleMaxLevel: 3 });
  assert.deepStrictEqual(w.defaultOpenLevelInfo(3, 2), { collapseAll: false, visibleMaxLevel: 4 });
  assert.deepStrictEqual(w.defaultOpenLevelInfo(1, 3), { collapseAll: false, visibleMaxLevel: 3 });
  assert.deepStrictEqual(w.defaultOpenLevelInfo(undefined, undefined), { collapseAll: false, visibleMaxLevel: 3 });
});

test('staggerDelays：总附加延迟 ≤ revealStaggerMax，预算耗尽后为 0', () => {
  assert.deepStrictEqual(w.staggerDelays(80, 500, 3), [80, 80, 80]);
  assert.deepStrictEqual(w.staggerDelays(80, 100, 3), [80, 20, 0]);
  assert.deepStrictEqual(w.staggerDelays(0, 500, 3), [0, 0, 0]);
  assert.deepStrictEqual(w.staggerDelays(80, 0, 2), [0, 0]);
  const total = w.staggerDelays(60, 200, 10).reduce((a, b) => a + b, 0);
  assert.ok(total <= 200, '总延迟不得超过预算：' + total);
});

test('quoteWidgetClass：plain / card / 旧值 sidebar 兼容', () => {
  assert.strictEqual(w.quoteWidgetClass('plain'), 'quote-widget-plain');
  assert.strictEqual(w.quoteWidgetClass('card'), 'quote-widget-card');
  assert.strictEqual(w.quoteWidgetClass('sidebar'), 'quote-widget-card');
  assert.strictEqual(w.quoteWidgetClass(undefined), 'quote-widget-card');
});

test('archiveCoverEnabled：默认 true，enabled=false / showOnArchive=false 关闭', () => {
  assert.strictEqual(w.archiveCoverEnabled({}), true);
  assert.strictEqual(w.archiveCoverEnabled({ listCover: { showOnArchive: false } }), false);
  assert.strictEqual(w.archiveCoverEnabled({ listCover: { enabled: false } }), false);
});

test('coverRuntimeConfig：defaultPattern 回退 patterns[0]、preferImage 默认 true', () => {
  const def = w.coverRuntimeConfig({});
  assert.strictEqual(def.defaultPattern, 'gradient');
  assert.strictEqual(def.preferImage, true);
  const custom = w.coverRuntimeConfig({ cover: { patterns: ['dots'], defaultPattern: 'mesh' } });
  assert.strictEqual(custom.defaultPattern, 'dots');
  assert.strictEqual(w.coverRuntimeConfig({ cover: { preferImage: false } }).preferImage, false);
});

test('pagefindIntegrated / localSearchIndexNeeded：integrate=false 回退本地链路并产出索引', () => {
  assert.strictEqual(w.pagefindIntegrated({}, 'local'), false);
  assert.strictEqual(w.pagefindIntegrated({}, 'pagefind'), true);
  assert.strictEqual(w.pagefindIntegrated({ pagefind: { integrate: false } }, 'pagefind'), false);
  assert.strictEqual(w.pagefindIntegrated({ pagefind: { enabled: false } }, 'pagefind'), false);
  assert.strictEqual(w.localSearchIndexNeeded({ search: { enabled: true, provider: 'local' } }, {}), true);
  assert.strictEqual(w.localSearchIndexNeeded({ search: { enabled: true, provider: 'pagefind' } }, {}), false);
  assert.strictEqual(w.localSearchIndexNeeded({ search: { enabled: true, provider: 'pagefind' } }, { pagefind: { integrate: false } }), true);
  assert.strictEqual(w.localSearchIndexNeeded({ search: { enabled: false, provider: 'local' } }, {}), false);
});

test('showHelpHint：默认 true，shortcuts 关闭或显式 false 时不渲染', () => {
  assert.strictEqual(w.showHelpHint({}), true);
  assert.strictEqual(w.showHelpHint({ shortcuts: { showHelpHint: false } }), false);
  assert.strictEqual(w.showHelpHint({ shortcuts: { enabled: false } }), false);
});

test('stripMarkdownText：链接/强调/标题/列表/代码剥离，纯文本保持', () => {
  assert.strictEqual(w.stripMarkdownText('**加粗** 与 *斜体*'), '加粗 与 斜体');
  assert.strictEqual(w.stripMarkdownText('[标题](/a/b) ![图](/i.png)'), '标题 图');
  assert.strictEqual(w.stripMarkdownText('# H1\n> 引用\n- 项'), 'H1 引用 项');
  assert.strictEqual(w.stripMarkdownText('`code` 与 ```\nblock\n```'), 'code 与');
  assert.strictEqual(w.stripMarkdownText('普通 摘要，无标记。'), '普通 摘要，无标记。');
  assert.strictEqual(w.stripMarkdownText(undefined), '');
});

test('schema 枚举：dailyQuote.widgetStyle 受控；themeToggle 枚举残留已移除', () => {
  assert.deepStrictEqual(DEFAULT_FEATURES.dailyQuote.widgetStyle, 'card');
  const { validateFeatures } = require('./lib/features-schema.js');
  const bad = validateFeatures({ dailyQuote: { enabled: true, widgetStyle: 'bogus' } }, 'features');
  assert.ok(bad.errors.some(e => /dailyQuote\.widgetStyle/.test(e)), '非法 widgetStyle 应报错');
  const good = validateFeatures({ dailyQuote: { enabled: true, widgetStyle: 'plain' } }, 'features');
  assert.deepStrictEqual(good.errors, []);
});

// ---------------------------------------------------------------------------
// 搜索加权/标签分类/计数/空结果、外链新标签与复制、双链参数化、删除重复键。
// ---------------------------------------------------------------------------
test('features.json5：删除项与 schema 同步（pinyinFuzzy/placeholder/linkBehavior）', () => {
  assert.ok(!('pinyinFuzzy' in features.search), 'features.search.pinyinFuzzy 应已删除');
  assert.ok(!('pinyinFuzzy' in DEFAULT_FEATURES.search), 'schema search.pinyinFuzzy 应已删除');
  assert.ok(!('placeholder' in features.search), 'features.search.placeholder 应已删除（canonical: navigation.search.placeholder）');
  assert.ok(!('placeholder' in DEFAULT_FEATURES.search), 'schema search.placeholder 应已删除');
  assert.ok(!('placeholderEn' in features.search), 'features.search.placeholderEn 应已删除');
  assert.ok(!('placeholderEn' in DEFAULT_FEATURES.search), 'schema search.placeholderEn 应已删除');
  assert.ok(!('linkBehavior' in features), 'features.linkBehavior 模块应已删除（外链行为唯一来源 features.externalLink）');
  assert.ok(!('linkBehavior' in DEFAULT_FEATURES), 'schema linkBehavior 模块应已删除');
  // 已接线的搜索键默认值保持历史输出：emptyHint 空串（沿用 noResultText），权重 5/2/1。
  assert.strictEqual(features.search.emptyHint, '');
  assert.strictEqual(features.search.emptyHintEn, '');
  assert.strictEqual(features.search.noResultText, '未找到匹配内容');
  assert.strictEqual(features.search.weightTitle, 5);
  assert.strictEqual(features.search.weightExcerpt, 2);
  assert.strictEqual(features.search.weightContent, 1);
  assert.strictEqual(features.search.showCount, true);
  assert.strictEqual(features.search.matchTags, true);
  assert.strictEqual(features.search.matchCategories, true);
});

test('hero/wikiLinks/externalLink 接线键默认值', () => {
  assert.strictEqual(features.hero.searchPlaceholder, '搜索文章…');
  assert.strictEqual(features.hero.searchPlaceholderEn, 'Search posts…');
  assert.strictEqual(features.wikiLinks.unknownMode, 'text');
  assert.strictEqual(features.wikiLinks.unknownSuffix, '');
  assert.strictEqual(features.wikiLinks.caseInsensitive, true);
  assert.strictEqual(features.wikiLinks.allowCustomLabel, true);
  assert.ok(uiStrings.toolbar.copyLink && uiStrings.en.toolbar.copyLink, 'ui-strings toolbar.copyLink 双语缺失');
  assert.strictEqual(features.externalLink.whitelistNewTab, false);
  assert.strictEqual(features.externalLink.copyButtonText, '复制');
  assert.strictEqual(features.externalLink.copyButtonTextEn, 'Copy');
});

test('normalizeSearchConfig：默认值与权重 0/非法值边界', () => {
  assert.deepStrictEqual(w.normalizeSearchConfig({}), { showCount: true, matchTags: true, matchCategories: true, weightTitle: 5, weightExcerpt: 2, weightContent: 1 });
  const off = w.normalizeSearchConfig({ search: { showCount: false, matchTags: false, matchCategories: false, weightTitle: 0, weightExcerpt: '', weightContent: -3 } });
  assert.deepStrictEqual(off, { showCount: false, matchTags: false, matchCategories: false, weightTitle: 0, weightExcerpt: 2, weightContent: 0 });
  assert.strictEqual(w.normalizeSearchConfig({ search: { weightTitle: '7' } }).weightTitle, 7);
});

test('searchEmptyText：emptyHint > noResultText > tuning.emptyText(En) 优先级链', () => {
  const t = { search: { emptyText: 'T', emptyTextEn: 'TE' } };
  assert.strictEqual(w.searchEmptyText({ search: { emptyHint: 'H', noResultText: 'N' } }, t, 'zh'), 'H');
  assert.strictEqual(w.searchEmptyText({ search: { emptyHint: '', noResultText: 'N' } }, t, 'zh'), 'N');
  assert.strictEqual(w.searchEmptyText({ search: { emptyHintEn: 'HE', noResultTextEn: 'NE' } }, t, 'en'), 'HE');
  assert.strictEqual(w.searchEmptyText({ search: { emptyHintEn: '', noResultTextEn: 'NE' } }, t, 'en'), 'NE');
  assert.strictEqual(w.searchEmptyText({ search: {} }, t, 'zh'), 'T');
  assert.strictEqual(w.searchEmptyText({ search: { noResultTextEn: '' } }, t, 'en'), 'TE');
  assert.strictEqual(w.searchEmptyText({}, {}, 'zh'), '');
});

test('rankSearchEntries：加权排序/同分稳定/权重 0 不参与/标签分类计 0 分', () => {
  const idx = [
    { title: 'alpha', excerpt: '', content: '', tags: [], categories: [] },
    { title: 'other', excerpt: 'alpha', content: '', tags: [], categories: [] },
    { title: 'other2', excerpt: '', content: 'alpha alpha alpha', tags: [], categories: [] },
    { title: 'tagged', excerpt: '', content: '', tags: ['Alpha'], categories: [] },
    { title: 'catted', excerpt: '', content: '', tags: [], categories: ['alpha'] }
  ];
  const def = w.rankSearchEntries(idx, 'alpha', {});
  assert.deepStrictEqual(def.map(e => e.title), ['alpha', 'other2', 'other', 'tagged', 'catted']);
  const noTitle = w.rankSearchEntries(idx, 'alpha', { search: { weightTitle: 0 } }).map(e => e.title);
  assert.ok(!noTitle.includes('alpha'), '权重 0 的标题字段不得参与匹配');
  assert.ok(!w.rankSearchEntries(idx, 'alpha', { search: { weightContent: 0 } }).map(e => e.title).includes('other2'));
  assert.ok(!w.rankSearchEntries(idx, 'alpha', { search: { matchTags: false } }).map(e => e.title).includes('tagged'));
  assert.ok(!w.rankSearchEntries(idx, 'alpha', { search: { matchCategories: false } }).map(e => e.title).includes('catted'));
  assert.deepStrictEqual(w.rankSearchEntries(idx, '', {}), []);
  const tie = w.rankSearchEntries([{ title: 'q' }, { title: 'q' }], 'q', {}).map(e => e.title);
  assert.deepStrictEqual(tie, ['q', 'q'], '同分保持原索引顺序');
});

test('wikiLinkConfig：默认值/枚举与布尔回退', () => {
  assert.deepStrictEqual(w.wikiLinkConfig({}), { enabled: true, unknownMode: 'text', unknownSuffix: '', caseInsensitive: true, allowCustomLabel: true });
  const c = w.wikiLinkConfig({ wikiLinks: { enabled: false, unknownMode: 'bogus', unknownSuffix: 7, caseInsensitive: false, allowCustomLabel: false } });
  assert.deepStrictEqual(c, { enabled: false, unknownMode: 'text', unknownSuffix: '7', caseInsensitive: false, allowCustomLabel: false });
  assert.strictEqual(w.wikiLinkConfig({ wikiLinks: { unknownMode: 'link' } }).unknownMode, 'link');
});

test('heroSearchPlaceholder：按语言取 hero 键；空串交由模板回退 ui-strings', () => {
  assert.strictEqual(w.heroSearchPlaceholder({ hero: { searchPlaceholder: '搜', searchPlaceholderEn: 'Go' } }, 'zh'), '搜');
  assert.strictEqual(w.heroSearchPlaceholder({ hero: { searchPlaceholder: '搜', searchPlaceholderEn: 'Go' } }, 'en'), 'Go');
  assert.strictEqual(w.heroSearchPlaceholder({}, 'en'), '');
});

test('resolveWikiLinks：unknownMode text/link/hide + suffix + 大小写 + 自定义标签', () => {
  const { resolveWikiLinks } = require('./lib/utils.js');
  const entry = { title: '图表与数学公式', url: '/zh/charts/' };
  const entryEn = { title: 'Math Guide', url: '/en/math-guide/' };
  const lookup = {
    titles: new Map([['图表与数学公式', entry], ['math guide', entryEn]]),
    titlesExact: new Map([['图表与数学公式', entry], ['Math Guide', entryEn]]),
    slugs: new Map([['math-guide', entryEn]])
  };
  assert.strictEqual(resolveWikiLinks('[[图表与数学公式]]', lookup), '[图表与数学公式](/zh/charts/)');
  assert.strictEqual(resolveWikiLinks('[[math-guide]]', lookup), '[Math Guide](/en/math-guide/)');
  assert.strictEqual(resolveWikiLinks('[[不存在]]', lookup), '不存在');
  assert.strictEqual(resolveWikiLinks('[[不存在|别名]]', lookup), '别名');
  assert.strictEqual(resolveWikiLinks('[[不存在]]', lookup, { unknownSuffix: '⚠' }), '不存在⚠');
  assert.strictEqual(resolveWikiLinks('[[图表与数学公式]]', lookup, { unknownSuffix: '⚠' }), '[图表与数学公式](/zh/charts/)');
  assert.strictEqual(resolveWikiLinks('[[不存在]]', lookup, { unknownMode: 'link', lang: 'zh' }), '[不存在](/zh/search/?q=%E4%B8%8D%E5%AD%98%E5%9C%A8)');
  assert.strictEqual(resolveWikiLinks('[[不存在|别名]]', lookup, { unknownMode: 'link', lang: 'en' }), '[别名](/en/search/?q=%E4%B8%8D%E5%AD%98%E5%9C%A8)');
  assert.strictEqual(resolveWikiLinks('前[[不存在]]后', lookup, { unknownMode: 'hide' }), '前后');
  assert.strictEqual(resolveWikiLinks('[[Math Guide]]', lookup, { caseInsensitive: false }), '[Math Guide](/en/math-guide/)');
  assert.strictEqual(resolveWikiLinks('[[MATH GUIDE]]', lookup, { caseInsensitive: false }), 'MATH GUIDE');
  assert.strictEqual(resolveWikiLinks('[[MATH GUIDE]]', lookup, { caseInsensitive: true }), '[Math Guide](/en/math-guide/)');
  assert.strictEqual(resolveWikiLinks('[[图表与数学公式|查看图表]]', lookup, { allowCustomLabel: false }), '[图表与数学公式](/zh/charts/)');
  assert.strictEqual(resolveWikiLinks('[[不存在|别名]]', lookup, { allowCustomLabel: false }), '不存在');
  assert.strictEqual(resolveWikiLinks('[[https://example.com|外站]]', lookup, { allowCustomLabel: false }), '[https://example.com](https://example.com)');
  assert.strictEqual(resolveWikiLinks('[[https://example.com|外站]]', lookup), '[外站](https://example.com)');
  assert.strictEqual(resolveWikiLinks(undefined, lookup), undefined);
});

test('删除键无残留引用（js/templates/scripts 源码扫描）', () => {
  function walk(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'real-site', '.tmp-scripts'].includes(e.name)) continue;
        walk(p, out);
      } else out.push(p);
    }
    return out;
  }
  const pats = [
    /themeToggle\.(defaultTheme|rememberChoice|iconStyle|transitionAll)/,
    /listCover\.aspectRatio/,
    /mobileBottomNav\.useSafeArea/,
    /codeCopy\.includeWindowBar/,
    /\bpinyinFuzzy\b/,
    /\blinkBehavior\b/,
    /\bincrementalByDefault\b/
  ];
  const offenders = [];
  for (const f of walk(ROOT, [])) {
    if (!/\.(js|ejs)$/.test(f) || f.endsWith('.test.js')) continue;
    const src = fs.readFileSync(f, 'utf-8');
    for (const p of pats) if (p.test(src)) offenders.push(path.relative(ROOT, f) + ' :: ' + p);
  }
  assert.deepStrictEqual(offenders, []);
});

// ---------------------------------------------------------------------------
// math/supSub/mermaid/series/related/wordCount/gallery/imageLazy 接线。
// ---------------------------------------------------------------------------
test('features.json5：删除项与默认值口径修正（incrementalByDefault / skipInsideMath / countDigits）', () => {
  assert.ok(!('incrementalByDefault' in features.gallery), 'features.gallery.incrementalByDefault 应已删除（无增量清单缓存实现）');
  assert.ok(!('incrementalByDefault' in DEFAULT_FEATURES.gallery), 'schema gallery.incrementalByDefault 应已删除');
  assert.strictEqual(features.supSub.skipInsideMath, true, 'skipInsideMath 默认 true = 历史行为（数学段内不处理）');
  assert.strictEqual(DEFAULT_FEATURES.supSub.skipInsideMath, true);
  assert.strictEqual(features.wordCount.countDigits, true, 'countDigits 默认 true = 历史行为（数字计入）');
  assert.strictEqual(DEFAULT_FEATURES.wordCount.countDigits, true);
  assert.strictEqual(features.math.autoDetect, true);
  assert.deepStrictEqual(features.math.inlineDelimiters, ['$']);
  assert.deepStrictEqual(features.math.blockDelimiters, ['$$']);
  assert.strictEqual(features.math.mathml, true);
  assert.strictEqual(features.mermaid.copyAfterRender, false);
  assert.strictEqual(features.mermaid.errorTextEn, '[Diagram failed to render]');
  assert.strictEqual(features.series.showBadge, true);
  assert.strictEqual(features.series.badgeFormat, '系列 · {name}');
  assert.strictEqual(features.series.sidebarWidget, true);
  assert.strictEqual(features.series.panelTitle, '本系列共 {total} 篇');
  assert.strictEqual(features.series.showPosition, true);
  assert.strictEqual(features.related.excludeCurrent, true);
  assert.strictEqual(features.wordCount.onCards, true);
  assert.strictEqual(features.gallery.collectFeatured, true);
  assert.strictEqual(features.imageLazy.preserveAspectRatio, true);
});

test('supSubConfig：标记归一化 / 空值回退 / 布尔缺省', () => {
  assert.deepStrictEqual(w.supSubConfig({}), { enabled: true, supMarker: '^', subMarker: '~', skipInsideMath: true, preserveUnmatched: true });
  const c = w.supSubConfig({ supSub: { supMarker: '^^', subMarker: '', skipInsideMath: false, preserveUnmatched: false, enabled: false } });
  assert.deepStrictEqual(c, { enabled: false, supMarker: '^^', subMarker: '~', skipInsideMath: false, preserveUnmatched: false });
  assert.strictEqual(w.supSubConfig({ supSub: { supMarker: 7 } }).supMarker, '7');
});

test('matchSupSub / transformSupSubText：成对、多字符、跨行禁止、preserveUnmatched 两态', () => {
  const def = w.supSubConfig({});
  const m = w.supSubMatchers(def);
  assert.deepStrictEqual(w.matchSupSub('^x^ 后文', m), { raw: '^x^', text: 'x', up: true });
  assert.deepStrictEqual(w.matchSupSub('~y~', m), { raw: '~y~', text: 'y', up: false });
  assert.strictEqual(w.matchSupSub('^x\ny^', m), null, '不得跨行');
  assert.strictEqual(w.matchSupSub('^a~b^', m), null, '内容含其它标记时不解析');
  assert.strictEqual(w.matchSupSub('^', m), null);
  const multi = w.supSubMatchers(w.supSubConfig({ supSub: { supMarker: '^^', subMarker: '%%' } }));
  assert.deepStrictEqual(w.matchSupSub('^^x^^', multi), { raw: '^^x^^', text: 'x', up: true });
  assert.deepStrictEqual(w.matchSupSub('%%x%%', multi), { raw: '%%x%%', text: 'x', up: false });
  assert.strictEqual(w.transformSupSubText('a^b^c', m, true), 'a<sup>b</sup>c');
  assert.strictEqual(w.transformSupSubText('a^bc', m, true), 'a^bc');
  assert.strictEqual(w.transformSupSubText('a^bc', m, false), 'abc');
  assert.strictEqual(w.transformSupSubText('~~x~~', m, false), '~~x~~', '标记重复不剥离（保留删除线语法）');
  assert.strictEqual(w.transformSupSubText('^<b>^', m, true), '<sup>&lt;b&gt;</sup>');
});

test('mathConfig / buildMathGuardPatterns：默认等价历史、自定义定界符、正则转义、开关', () => {
  const def = w.mathConfig({});
  assert.deepStrictEqual([def.enabled, def.autoDetect, def.mathml], [true, true, true]);
  assert.deepStrictEqual(def.inlineDelimiters, ['$']);
  assert.deepStrictEqual(def.blockDelimiters, ['$$']);
  assert.strictEqual(def.renderRoundParens, true);
  assert.strictEqual(def.renderSquareBrackets, true);
  const custom = w.mathConfig({ math: { inlineDelimiters: ['%', '%'], blockDelimiters: ['%%'], mathml: false, autoDetect: false } });
  assert.deepStrictEqual(custom.inlineDelimiters, ['%'], '去重');
  assert.strictEqual(custom.mathml, false);
  assert.strictEqual(custom.autoDetect, false);
  assert.deepStrictEqual(w.mathConfig({ math: { inlineDelimiters: [] } }).inlineDelimiters, ['$'], '空数组回退默认');

  const pat = w.buildMathGuardPatterns(w.mathConfig({}));
  assert.strictEqual(pat.blockToken.exec('$$\nx\n$$')[0], '$$\nx\n$$');
  assert.strictEqual(pat.blockStart.exec('段落\n$$\nx\n$$').index, 3);
  assert.strictEqual(pat.inlineToken.exec('$x$')[0], '$x$');
  assert.strictEqual(pat.inlineToken.exec('$5 元 $6 元'), null, '$ 结尾数字不匹配（金额防误报）');
  assert.strictEqual(pat.inlineToken.exec('$a\nb$'), null, '行内不跨行');
  assert.strictEqual(pat.inlineToken.exec('$$a$$')[0], '$$a$$', '行内位置允许块定界符');
  assert.strictEqual(pat.inlineToken.exec('\\(x\\)')[0], '\\(x\\)');
  assert.strictEqual(pat.inlineToken.exec('\\[x\\]')[0], '\\[x\\]');
  const patNoParen = w.buildMathGuardPatterns(w.mathConfig({ math: { renderRoundParens: false, renderSquareBrackets: false } }));
  assert.strictEqual(patNoParen.inlineToken.exec('\\(x\\)'), null);
  const patEsc = w.buildMathGuardPatterns(w.mathConfig({ math: { inlineDelimiters: ['.*'], blockDelimiters: ['**'] } }));
  assert.strictEqual(patEsc.inlineToken.exec('.*x.*')[0], '.*x.*', '正则元字符定界符按字面量');
  assert.strictEqual(patEsc.blockToken.exec('**x**')[0], '**x**');
  const patPct = w.buildMathGuardPatterns(custom);
  assert.strictEqual(patPct.inlineToken.exec('%x%')[0], '%x%');
  assert.strictEqual(patPct.blockToken.exec('%%\nx\n%%')[0], '%%\nx\n%%');
});

test('hasCustomMathDelimiters：单 $ 不触发、自定义成对触发', () => {
  const def = w.mathConfig({});
  assert.strictEqual(w.hasCustomMathDelimiters('公式 $x$ 与 $y$', def), false, '默认 $ 不改变历史按需加载口径');
  const pct = w.mathConfig({ math: { inlineDelimiters: ['%'] } });
  assert.strictEqual(w.hasCustomMathDelimiters('公式 %x%', pct), true);
  assert.strictEqual(w.hasCustomMathDelimiters('公式 %x', pct), false);
  const block = w.mathConfig({ math: { blockDelimiters: ['%%'] } });
  assert.strictEqual(w.hasCustomMathDelimiters('%%\nx\n%%', block), true);
});

test('mermaidConfig / mermaidErrorText：默认与两态', () => {
  const def = w.mermaidConfig({});
  assert.deepStrictEqual([def.enabled, def.autoDetect, def.followTheme, def.copyAfterRender], [true, true, true, false]);
  const c = w.mermaidConfig({ mermaid: { autoDetect: false, followTheme: false, copyAfterRender: true, errorText: '失败', errorTextEn: 'Failed' } });
  assert.deepStrictEqual([c.autoDetect, c.followTheme, c.copyAfterRender], [false, false, true]);
  assert.strictEqual(w.mermaidErrorText(c, 'zh'), '失败');
  assert.strictEqual(w.mermaidErrorText(c, 'en'), 'Failed');
  assert.strictEqual(w.mermaidErrorText({ errorText: '失败' }, 'en'), '失败', 'en 空回退中文');
  assert.strictEqual(w.mermaidErrorText({}, 'en'), '');
});

test('seriesConfig / seriesBadgeText / seriesPanelTitle：模板替换与 en 回退链', () => {
  const def = w.seriesConfig({});
  assert.strictEqual(def.showBadge, true);
  assert.strictEqual(def.sidebarWidget, true);
  assert.strictEqual(def.showPosition, true);
  assert.strictEqual(def.defaultWidgetCount, 8);
  const c = w.seriesConfig({ series: { showBadge: false, sidebarWidget: false, showPosition: false, defaultWidgetCount: 3 } });
  assert.deepStrictEqual([c.showBadge, c.sidebarWidget, c.showPosition, c.defaultWidgetCount], [false, false, false, 3]);
  assert.strictEqual(w.seriesBadgeText(def, 'zh', '前端', '系列', 'Series'), '系列 · 前端');
  assert.strictEqual(w.seriesBadgeText(def, 'en', 'Frontend', '系列', 'Series'), 'Series · Frontend');
  assert.strictEqual(w.seriesBadgeText({ badgeFormat: '系列 · {name}', badgeFormatEn: '' }, 'en', 'X', '系列', 'Series'), '系列 · X', 'en 空回退中文');
  assert.strictEqual(w.seriesBadgeText({ badgeFormat: '' }, 'zh', 'X', '词典', 'Dict'), '词典', '空模板回退词典');
  assert.strictEqual(w.seriesPanelTitle(def, 'zh', 3, '系列', 'Series'), '本系列共 3 篇');
  assert.strictEqual(w.seriesPanelTitle(def, 'en', 3, '系列', 'Series'), '3 posts in this series');
  assert.strictEqual(w.seriesPanelTitle({ panelTitle: '', panelTitleEn: '' }, 'en', 3, '系列', 'Series'), 'Series', '空模板回退词典');
});

test('relatedConfig / galleryCollectFeatured / imagePreserveAspectRatio：默认与关闭态', () => {
  assert.strictEqual(w.relatedConfig({}).excludeCurrent, true);
  assert.strictEqual(w.relatedConfig({ related: { excludeCurrent: false } }).excludeCurrent, false);
  assert.strictEqual(w.galleryCollectFeatured({}), true);
  assert.strictEqual(w.galleryCollectFeatured({ gallery: { collectFeatured: false } }), false);
  assert.strictEqual(w.imagePreserveAspectRatio({}), true);
  assert.strictEqual(w.imagePreserveAspectRatio({ imageLazy: { preserveAspectRatio: false } }), false);
});

test('wordCountConfig / wordCountText / readTimeText：模板链与 en 回退', () => {
  const def = w.wordCountConfig({});
  assert.deepStrictEqual([def.onCards, def.inArticle, def.countCjkChars, def.countDigits], [true, true, true, true]);
  assert.strictEqual(def.wpm, 265);
  assert.strictEqual(w.wordCountText(def, 'zh', 1234, '词典', 'Dict'), '1234 字');
  assert.strictEqual(w.wordCountText(def, 'en', 1234, '词典', 'Dict'), '1234 words');
  assert.strictEqual(w.wordCountText({ textFormat: '', textFormatEn: '' }, 'en', 5, '词典', 'Dict'), 'Dict', '空模板回退词典');
  assert.strictEqual(w.wordCountText({ textFormat: '{count} 个字符' }, 'zh', 5, '词典', 'Dict'), '5 个字符');
  assert.strictEqual(w.readTimeText(def, 'zh', 3, '词典', 'Dict'), '3 分钟阅读');
  assert.strictEqual(w.readTimeText(def, 'en', 3, '词典', 'Dict'), '3 min read');
  assert.strictEqual(w.readTimeText({ readTimeFormatEn: '' }, 'en', 3, '词典', 'Dict'), '3 分钟阅读', 'en 空回退中文');
  assert.strictEqual(w.wordCountConfig({ wordCount: { wpm: 0 } }).wpm, 265);
});

test('countWordsDetail 参数化：中英混排 / 纯数字 / CJK 开关矩阵', () => {
  const { countWordsDetail, countWords } = require('./lib/utils');
  assert.deepStrictEqual(countWordsDetail('你好 world 123'), { cjk: 2, latin: 2, total: 4 });
  assert.deepStrictEqual(countWordsDetail('a b c', { countDigits: false }), { cjk: 0, latin: 3, total: 3 });
  assert.deepStrictEqual(countWordsDetail('123 456', { countDigits: false }), { cjk: 0, latin: 0, total: 0 });
  assert.deepStrictEqual(countWordsDetail('abc123', { countDigits: false }), { cjk: 0, latin: 1, total: 1 }, '混合 token 仍计 1');
  assert.deepStrictEqual(countWordsDetail('中文123', { countDigits: false }), { cjk: 2, latin: 0, total: 2 });
  assert.deepStrictEqual(countWordsDetail('中文 english', { countCjkChars: false }), { cjk: 0, latin: 1, total: 1 });
  assert.deepStrictEqual(countWordsDetail('中文 english', { countCjkChars: false, countDigits: false }), { cjk: 0, latin: 1, total: 1 });
  assert.strictEqual(countWords('你好 world', { countCjkChars: false }), 1);
  assert.strictEqual(countWords(undefined), 0);
});

test('computeRelatedArticles：excludeCurrent 两态（相关推荐自引用）', () => {
  const { computeRelatedArticles } = require('./lib/related');
  function make() {
    return [
      { slug: 'a', lang: 'zh', title: 'A', url: '/zh/a/', tags: ['x'], categories: ['c'], excerpt: '' },
      { slug: 'b', lang: 'zh', title: 'B', url: '/zh/b/', tags: ['x'], categories: ['c'], excerpt: '' }
    ];
  }
  const on = make();
  computeRelatedArticles(on, { excludeCurrent: true });
  assert.deepStrictEqual(on[0].relatedArticles.map(r => r.slug), ['b']);
  const off = make();
  computeRelatedArticles(off, { excludeCurrent: false });
  assert.deepStrictEqual(off[0].relatedArticles.map(r => r.slug), ['a', 'b'], '关闭排除后自身排第一');
});

test('markdown 渲染集成：mathGuard 保护 / supSub / 删除线 / math 围栏 / 图片尺寸两态', () => {  const { createMarkdownModule } = require('./build/markdown');
  const { marked } = require('marked');
  const mod = createMarkdownModule();
  const baseSite = { build: { usePictureTag: false }, url: '' };

  // 1) 默认配置：数学保护 + 默认标记
  mod.setupMarkedRenderer({ features: {}, site: baseSite }, null);
  const h1 = marked.parse('公式 $x^2$ 与 $y$');
  assert.ok(h1.includes('$x^2$'), '数学段受保护：' + h1);
  const h2 = marked.parse('a^上^ 与 b~下~');
  assert.ok(h2.includes('<sup>上</sup>') && h2.includes('<sub>下</sub>'), h2);
  const h3 = marked.parse('~~删除~~');
  assert.ok(h3.includes('<del>'), '删除线未被 supSub 破坏：' + h3);
  const h4 = marked.parse('孤立 ^ 标记');
  assert.ok(h4.includes('孤立 ^ 标记'), 'preserveUnmatched 默认保持：' + h4);
  const h5 = marked.parse('$x^2^$');
  assert.ok(!h5.includes('<sup>'), 'skipInsideMath 默认 true：数学段内不转换：' + h5);

  // 2) 自定义配置：标记自定义 + 孤立剥离 + math.autoDetect=false（```math 围栏块）
  mod.setupMarkedRenderer({
    features: { supSub: { supMarker: '^^', subMarker: '%%', preserveUnmatched: false }, math: { autoDetect: false } },
    site: baseSite
  }, null);
  const c1 = marked.parse('^^up^^ 与 %%down%%');
  assert.ok(c1.includes('<sup>up</sup>') && c1.includes('<sub>down</sub>'), c1);
  const c2 = marked.parse('a^^b');
  assert.ok(c2.includes('ab') && !c2.includes('^^'), '孤立标记剥离：' + c2);
  const c3 = marked.parse('```math\nE = mc^2\n```');
  assert.ok(c3.includes('class="math-block"') && c3.includes('data-tex="E = mc^2"'), '```math 围栏块输出：' + c3);
  const c4 = marked.parse('$x$');
  assert.ok(c4.includes('$x$'), 'autoDetect=false 不解析行内定界符（原样保留）');

  // 3) imageLazy.preserveAspectRatio=false：不输出 width/height；恢复 true 后输出（renderer 后注册覆盖）
  const manifest = { 'a.png': { width: 800, height: 600, original: '/a.png' } };
  mod.setupMarkedRenderer({ features: { imageLazy: { preserveAspectRatio: false } }, site: baseSite }, manifest);
  const i1 = marked.parse('![alt](/a.png)');
  assert.ok(!/\bwidth="/.test(i1) && !/\bheight="/.test(i1), '关闭防抖：不输出尺寸：' + i1);
  mod.setupMarkedRenderer({ features: {}, site: baseSite }, manifest);
  const i2 = marked.parse('![alt](/a.png)');
  assert.ok(/\bwidth="800"/.test(i2) && /\bheight="600"/.test(i2), '默认输出尺寸：' + i2);
});

test('mathNeeded：autoDetect 两态（自定义定界符 / ```math 围栏）', () => {
  const def = w.mathConfig({});
  assert.strictEqual(w.mathNeeded('公式 $$x$$', def), true);
  assert.strictEqual(w.mathNeeded('公式 \\(x\\)', def), true);
  assert.strictEqual(w.mathNeeded('公式 $x$', def), false, '单 $ 不单独触发（历史口径）');
  assert.strictEqual(w.mathNeeded('普通文本', def), false);
  const pct = w.mathConfig({ math: { inlineDelimiters: ['%'] } });
  assert.strictEqual(w.mathNeeded('公式 %x%', pct), true);
  assert.strictEqual(w.mathNeeded('公式 %x', pct), false);
  const fence = w.mathConfig({ math: { autoDetect: false } });
  assert.strictEqual(w.mathNeeded('正文 $$x$$', fence), false, 'autoDetect=false 时 $$ 不触发');
  assert.strictEqual(w.mathNeeded('```math\nE=mc^2\n```', fence), true);
  assert.strictEqual(w.mathNeeded('```mermaid\ngraph TD\n```', fence), false);
  assert.strictEqual(w.mathNeeded('$$x$$', w.mathConfig({ math: { enabled: false } })), false);
});

test('collectGalleryImages：collectFeatured 两态（含封面 / 仅正文图片）', () => {
  const { createCollectorsModule } = require('./build/collectors');
  const mod = createCollectorsModule({ getPublished: (list) => list });
  const articles = [
    { slug: 'a', title: 'A', url: '/zh/a/', lang: 'zh', featuredImage: '/media/f.jpg', content: '<img src="/media/inline.jpg"> <img src="https://x/y.jpg">' },
    { slug: 'b', title: 'B', url: '/zh/b/', lang: 'zh', featuredImage: '/media/f.jpg', content: '' }
  ];
  const on = mod.collectGalleryImages(articles, { collectFeatured: true }).map(i => i.src);
  assert.deepStrictEqual(on, ['/media/f.jpg', '/media/inline.jpg'], '封面收集 + 去重 + 外链剔除');
  const off = mod.collectGalleryImages(articles, { collectFeatured: false }).map(i => i.src);
  assert.deepStrictEqual(off, ['/media/inline.jpg'], '关闭封面收集');
});

// ---------------------------------------------------------------------------
// lightbox / backToTop / tts / reward / heatmap / stats /
// mobile / contactPopup 接线（含 backToTop 重复键删除与默认值口径修正）。
// ---------------------------------------------------------------------------
test('features.json5：删除项与默认值口径（backToTop 重复键 / buttonStackGap / popupWidth）', () => {
  assert.ok(!('rightOffset' in features.backToTop), 'features.backToTop.rightOffset 应已删除（canonical: tuning.backToTop.offsetSide）');
  assert.ok(!('bottomOffset' in features.backToTop), 'features.backToTop.bottomOffset 应已删除（canonical: tuning.backToTop.offsetBottom）');
  assert.ok(!('rightOffset' in DEFAULT_FEATURES.backToTop), 'schema backToTop.rightOffset 应已删除');
  assert.ok(!('bottomOffset' in DEFAULT_FEATURES.backToTop), 'schema backToTop.bottomOffset 应已删除');
  assert.strictEqual(features.mobile.buttonStackGap, '3.4rem', 'buttonStackGap 默认对齐历史堆叠步进（视觉不变）');
  assert.strictEqual(DEFAULT_FEATURES.mobile.buttonStackGap, '3.4rem');
  assert.strictEqual(features.contactPopup.popupWidth, '400px', 'popupWidth 默认对齐模板历史 400px（修复 360/400 漂移）');
  assert.strictEqual(DEFAULT_FEATURES.contactPopup.popupWidth, '400px');
  assert.strictEqual(features.lightbox.maxWidthVw, '92');
  assert.strictEqual(features.lightbox.openDurationMs, 180);
  assert.strictEqual(features.lightbox.switchDurationMs, 120);
  assert.strictEqual(features.backToTop.scrollDurationMs, 450);
  assert.strictEqual(features.backToTop.htmlAnchorFallback, false);
  assert.strictEqual(features.tts.preferDefaultVoice, true);
  assert.strictEqual(features.tts.voiceBy, 'lang');
  assert.strictEqual(features.tts.highlightParagraph, false);
  assert.strictEqual(features.reward.closeByBtn, true);
  assert.strictEqual(features.reward.closeByOverlay, true);
  assert.strictEqual(features.reward.closeByEsc, true);
  assert.strictEqual(features.heatmap.levels, 5);
  assert.strictEqual(features.heatmap.showLegend, true);
  assert.strictEqual(features.heatmap.showMonthNumbers, true);
  assert.strictEqual(features.stats.showArchiveCards, true);
  assert.strictEqual(features.stats.linkArchive, '/archive/');
});

test('lightboxConfig：专键 > 兼容旧键/通用键 > 默认；0 = 瞬时保留', () => {
  const def = w.lightboxConfig({});
  assert.deepStrictEqual([def.maxWidthVw, def.openDurationMs, def.switchDurationMs, def.transitionDurationMs], [92, 220, 220, 220], '缺省时分别回退 92 与通用 220');
  const full = w.lightboxConfig(features);
  assert.deepStrictEqual([full.maxWidthVw, full.openDurationMs, full.switchDurationMs], [92, 180, 120], '完整配置使用专键默认 180/120');
  const custom = w.lightboxConfig({ lightbox: { maxWidthVw: '70', openDurationMs: 0, switchDurationMs: 40, transitionDurationMs: 300 } });
  assert.deepStrictEqual([custom.maxWidthVw, custom.openDurationMs, custom.switchDurationMs], [70, 0, 40]);
  const fbWidth = w.lightboxConfig({ imageFit: { lightbox: { maxWidthPct: 80 } } });
  assert.strictEqual(fbWidth.maxWidthVw, 80, '未设 maxWidthVw 回退 imageFit.lightbox.maxWidthPct');
  const fbBoth = w.lightboxConfig({ lightbox: { maxWidthVw: '', transitionDurationMs: 300 } });
  assert.strictEqual(fbBoth.maxWidthVw, 92, '空串回退默认');
  assert.deepStrictEqual([fbBoth.openDurationMs, fbBoth.switchDurationMs], [300, 300], '未设时长回退通用 transitionDurationMs');
  assert.strictEqual(w.lightboxConfig({ lightbox: { openDurationMs: -5 } }).openDurationMs, 220, '负数回退');
});

test('backToTopConfig：scrollDurationMs 0=瞬时 / htmlAnchorFallback 门控 / 非负回退', () => {
  assert.deepStrictEqual(w.backToTopConfig({}), { scrollDurationMs: 450, smoothScroll: true, htmlAnchorFallback: false });
  const c = w.backToTopConfig({ backToTop: { scrollDurationMs: 0, smoothScroll: false, htmlAnchorFallback: true } });
  assert.deepStrictEqual(c, { scrollDurationMs: 0, smoothScroll: false, htmlAnchorFallback: true });
  assert.strictEqual(w.backToTopConfig({ backToTop: { scrollDurationMs: 'abc' } }).scrollDurationMs, 450);
  assert.strictEqual(w.backToTopConfig({ backToTop: { htmlAnchorFallback: 'yes' } }).htmlAnchorFallback, false);
});

test('ttsConfig / pickTtsVoice：voiceBy 策略、preferDefaultVoice 评分、无命中回退 null', () => {
  const def = w.ttsConfig({});
  assert.deepStrictEqual(def, { preferDefaultVoice: true, voiceBy: 'lang', highlightParagraph: false });
  assert.strictEqual(w.ttsConfig({ tts: { voiceBy: 'bogus' } }).voiceBy, 'lang');
  assert.strictEqual(w.ttsConfig({ tts: { voiceBy: 'name', highlightParagraph: true, preferDefaultVoice: false } }).highlightParagraph, true);

  const voices = [
    { name: 'Wrong Tag Voice', lang: 'zh-CN', default: false, localService: false },
    { name: 'Local Default Voice', lang: 'zh-CN', default: true, localService: true },
    { name: 'Chinese Voice', lang: 'en-US', default: false, localService: true },
    { name: 'Unrelated', lang: 'fr-FR', default: true, localService: true }
  ];
  const byLang = w.pickTtsVoice(voices, 'zh-CN', { preferDefaultVoice: true, voiceBy: 'lang' });
  assert.strictEqual(byLang.name, 'Local Default Voice', 'lang 策略命中 zh-CN 且 localService/default 评分最高');
  const byLangFirst = w.pickTtsVoice(voices, 'zh-CN', { preferDefaultVoice: false, voiceBy: 'lang' });
  assert.strictEqual(byLangFirst.name, 'Wrong Tag Voice', 'preferDefaultVoice=false 取平台顺序首个');
  const byName = w.pickTtsVoice(voices, 'zh-CN', { preferDefaultVoice: true, voiceBy: 'name' });
  assert.strictEqual(byName.name, 'Chinese Voice', 'name 策略命中语言显示名（lang 标签不可靠时）');
  assert.strictEqual(w.pickTtsVoice(voices, 'de-DE', { preferDefaultVoice: true, voiceBy: 'lang' }), null, '无命中回退 null');
  assert.strictEqual(w.pickTtsVoice([], 'zh-CN', { voiceBy: 'lang' }), null);
  assert.strictEqual(w.pickTtsVoice(undefined, 'zh-CN', {}), null);
  assert.strictEqual(w.pickTtsVoice(voices, 'zh', { preferDefaultVoice: true, voiceBy: 'lang' }).name, 'Local Default Voice', '前缀匹配 zh');
});

test('rewardCloseConfig：默认三者 true；显式 false 各自门控', () => {
  assert.deepStrictEqual(w.rewardCloseConfig({}), { byBtn: true, byOverlay: true, byEsc: true });
  assert.deepStrictEqual(
    w.rewardCloseConfig({ reward: { closeByBtn: false, closeByOverlay: false, closeByEsc: false } }),
    { byBtn: false, byOverlay: false, byEsc: false }
  );
  assert.strictEqual(w.rewardCloseConfig({ reward: { closeByBtn: 0 } }).byBtn, true, '仅显式 false 才关闭');
});

test('heatmapLevelCount / heatmapBucketLevel：2~7 钳制与历史分桶口径', () => {
  assert.strictEqual(w.heatmapLevelCount(5), 5);
  assert.strictEqual(w.heatmapLevelCount(1), 2, '下界钳制 2');
  assert.strictEqual(w.heatmapLevelCount(9), 7, '上界钳制 7');
  assert.strictEqual(w.heatmapLevelCount('abc'), 5, '非法回退 5');
  assert.strictEqual(w.heatmapLevelCount(3.9), 3, '取整');

  assert.strictEqual(w.heatmapBucketLevel(0, 10, 5), 0);
  assert.strictEqual(w.heatmapBucketLevel(10, 10, 5), 5);
  assert.strictEqual(w.heatmapBucketLevel(1, 10, 5), 1);
  assert.strictEqual(w.heatmapBucketLevel(6, 10, 5), 3);
  assert.strictEqual(w.heatmapBucketLevel(1, 1, 5), 2, 'maxCount<=2 历史阶梯 count+1');
  assert.strictEqual(w.heatmapBucketLevel(2, 2, 5), 3);
  assert.strictEqual(w.heatmapBucketLevel(1, 2, 3), 2);
  assert.strictEqual(w.heatmapBucketLevel(5, 2, 5), 5, '阶梯不超层数');
  assert.strictEqual(w.heatmapBucketLevel(4, 4, 3), 3);
});

test('heatmapPalette / heatmapLegendLevels：levels=5 逐字保持历史，其他层数线性等分', () => {
  assert.deepStrictEqual(w.heatmapPalette(5), [
    'color-mix(in srgb,var(--color-s) 25%,var(--color-surface))',
    'color-mix(in srgb,var(--color-s) 45%,var(--color-surface))',
    'color-mix(in srgb,var(--color-s) 65%,var(--color-surface))',
    'var(--color-s)',
    'color-mix(in srgb,var(--color-s) 40%,var(--color-a))'
  ]);
  assert.strictEqual(w.heatmapPalette(3).length, 3);
  assert.strictEqual(w.heatmapPalette(3)[1], 'var(--color-s)');
  assert.strictEqual(w.heatmapPalette(3)[2], 'color-mix(in srgb,var(--color-s) 40%,var(--color-a))');
  assert.strictEqual(w.heatmapPalette(7).length, 7);
  assert.strictEqual(w.heatmapPalette(2).length, 2);
  assert.deepStrictEqual(w.heatmapLegendLevels(5), [1, 2, 4], '历史图例 l1/l2/l4');
  assert.deepStrictEqual(w.heatmapLegendLevels(7), [1, 3, 6]);
  assert.deepStrictEqual(w.heatmapLegendLevels(2), [1]);
});

test('heatmapLegendText / heatmapTooltip：文案链与占位符替换', () => {
  const cfg = w.heatmapConfig(features);
  assert.strictEqual(w.heatmapLegendText(cfg, 'zh', 'low', '词典'), '少');
  assert.strictEqual(w.heatmapLegendText(cfg, 'en', 'low', 'Dict'), 'Less');
  assert.strictEqual(w.heatmapLegendText({ legendLowEn: '' }, 'en', 'low', 'Dict'), 'Dict', 'en 空串回退词典（无中文配置时不返回空）');
  assert.strictEqual(w.heatmapLegendText({ legendLow: '', legendLowEn: '' }, 'en', 'low', 'Dict'), 'Dict');
  assert.strictEqual(w.heatmapTooltip(cfg, 'zh', 2026, 1, 3, '篇', 'posts'), '2026-1: 3 篇');
  assert.strictEqual(w.heatmapTooltip(cfg, 'en', 2026, 1, 3, '篇', 'posts'), '2026-1: 3 posts');
  assert.strictEqual(w.heatmapTooltip({ tooltipFormat: '{year}/{month}·{count}' }, 'zh', 2026, 2, 0, '篇', 'posts'), '2026/2·0');
  assert.strictEqual(w.heatmapTooltip({ tooltipFormat: '', tooltipFormatEn: '' }, 'zh', 2026, 2, 0, '篇', 'posts'), '2026-2: 0 篇', '空模板回退内置');
  assert.strictEqual(w.heatmapTooltip({}, 'en', 2026, 2, 7, '篇', 'posts'), '2026-2: 7 posts');
});

test('statsConfig / statsLabel：卡片开关、跳转目标与 *En > 中文 > 词典链', () => {
  assert.deepStrictEqual(w.statsConfig({}), { enabled: true, showArchiveCards: true, linkArchive: '/archive/' });
  assert.strictEqual(w.statsConfig({ stats: { showArchiveCards: false, linkArchive: '' } }).showArchiveCards, false);
  assert.strictEqual(w.statsConfig({ stats: { linkArchive: '  ' } }).linkArchive, '', '空白串视为不跳转');
  const raw = { labelPosts: '文章', labelPostsEn: 'Articles', labelTags: '', labelTagsEn: '' };
  assert.strictEqual(w.statsLabel(raw, 'zh', 'labelPosts', '词典'), '文章');
  assert.strictEqual(w.statsLabel(raw, 'en', 'labelPosts', 'Dict'), 'Articles');
  assert.strictEqual(w.statsLabel(raw, 'en', 'labelTags', 'Dict'), 'Dict', '配置空串回退词典');
  assert.strictEqual(w.statsLabel({ labelPostsEn: 'OnlyEn' }, 'en', 'labelPosts', 'Dict'), 'OnlyEn');
  assert.strictEqual(w.statsLabel({ labelPostsEn: 'OnlyEn' }, 'zh', 'labelPosts', '词典'), '词典', 'zh 站不使用 *En');
  assert.strictEqual(w.statsLabel({}, 'zh', 'labelAvgPerDay', '词典', 'labelAvg'), '词典');
  assert.strictEqual(w.statsLabel({ labelAvg: '日均篇数' }, 'zh', 'labelAvgPerDay', '词典', 'labelAvg'), '日均篇数', 'fallbackKey 链');
  assert.strictEqual(w.statsLabel({ labelAvgPerDayEn: '' , labelAvgEn: ''}, 'en', 'labelAvgPerDay', 'Dict', 'labelAvg'), 'Dict');
});

test('mobileConfig：searchFullscreen/touchFallback/codeScrollHint 门控与 gap 默认', () => {
  assert.deepStrictEqual(w.mobileConfig({}), { enabled: true, searchFullscreen: true, buttonStackGap: '3.4rem', touchFallback: true, codeScrollHint: true });
  const off = w.mobileConfig({ mobile: { searchFullscreen: false, touchFallback: false, codeScrollHint: false, buttonStackGap: '1rem' } });
  assert.deepStrictEqual([off.searchFullscreen, off.touchFallback, off.codeScrollHint, off.buttonStackGap], [false, false, false, '1rem']);
  assert.strictEqual(w.mobileConfig({ mobile: { buttonStackGap: '  ' } }).buttonStackGap, '3.4rem');
});

test('contactPopupConfig / contactCopyText：宽度漂移修正与复制文案链', () => {
  assert.deepStrictEqual(w.contactPopupConfig({}), { enabled: true, popupWidth: '400px', showAllItems: true });
  const off = w.contactPopupConfig({ contactPopup: { popupWidth: '320px', showAllItems: false } });
  assert.strictEqual(off.popupWidth, '320px');
  assert.strictEqual(off.showAllItems, false);
  assert.strictEqual(w.contactPopupConfig({ contactPopup: { popupWidth: '' } }).popupWidth, '400px');
  assert.strictEqual(w.contactCopyText({}, 'zh', '复制'), '复制');
  assert.strictEqual(w.contactCopyText({ contactPopup: { copyText: '复制', copyTextEn: 'Copy it' } }, 'en', 'Copy'), 'Copy it');
  assert.strictEqual(w.contactCopyText({ contactPopup: { copyText: '复制', copyTextEn: '' } }, 'en', 'Copy'), '复制');
  assert.strictEqual(w.contactCopyText({}, 'en', 'Copy'), 'Copy');
});

test('ui-strings.json5：新增词典键双语齐全（codeScrollHint / legendLow / legendHigh）', () => {
  assert.ok(uiStrings.toolbar.codeScrollHint, 'zh toolbar.codeScrollHint 缺失');
  assert.ok(uiStrings.en.toolbar.codeScrollHint, 'en toolbar.codeScrollHint 缺失');
  assert.ok(uiStrings.archive.legendLow && uiStrings.archive.legendHigh, 'zh archive.legendLow/High 缺失');
  assert.ok(uiStrings.en.archive.legendLow && uiStrings.en.archive.legendHigh, 'en archive.legendLow/High 缺失');
});

test('删除键无残留引用（backToTop 重复键源码扫描）', () => {
  function walk(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'real-site', '.tmp-scripts'].includes(e.name)) continue;
        walk(p, out);
      } else out.push(p);
    }
    return out;
  }
  const pats = [/backToTop\.(rightOffset|bottomOffset)/];
  const offenders = [];
  for (const f of walk(ROOT, [])) {
    if (!/\.(js|ejs)$/.test(f) || f.endsWith('.test.js')) continue;
    const src = fs.readFileSync(f, 'utf-8');
    for (const p of pats) if (p.test(src)) offenders.push(path.relative(ROOT, f) + ' :: ' + p);
  }
  assert.deepStrictEqual(offenders, []);
});

// ---------------------------------------------------------------------------
// feed 合并删除、analytics/redirects/maintenance/performance/debug 接线、heatmap.palette。
// ---------------------------------------------------------------------------
test('features.json5：feed 模块已删除且 schema/site-defaults 同步（唯一来源 site.rss/subscribe）', () => {
  assert.ok(!('feed' in features), 'features.feed 应已删除');
  assert.ok(!('feed' in DEFAULT_FEATURES), 'schema feed 应已删除');
  const { DEFAULT_CONFIG } = require('./lib/site-defaults.js');
  assert.strictEqual(DEFAULT_CONFIG.site.rss.injectHeadLinks, true, 'site.rss.injectHeadLinks 默认 true');
});

test('analyticsConfig / buildAnalyticsTag：注入位置/beacon 开关/scriptSrc/siteTag 覆盖', () => {
  const def = w.analyticsConfig({});
  assert.deepStrictEqual(def, {
    enabled: true,
    scriptSrc: 'https://static.cloudflareinsights.com/beacon.min.js',
    injectAt: 'body',
    emitBeacon: true,
    siteTag: ''
  });
  assert.strictEqual(w.analyticsConfig({ analytics: { injectAt: 'head' } }).injectAt, 'head');
  assert.strictEqual(w.analyticsConfig({ analytics: { injectAt: 'bogus' } }).injectAt, 'body');
  assert.strictEqual(w.analyticsConfig({ analytics: { emitBeacon: false } }).emitBeacon, false);
  assert.strictEqual(w.analyticsConfig({ analytics: { siteTag: ' tag-x ' } }).siteTag, 'tag-x');
  assert.strictEqual(w.analyticsConfig({ analytics: { scriptSrc: '  ' } }).scriptSrc, 'https://static.cloudflareinsights.com/beacon.min.js');
  assert.strictEqual(w.buildAnalyticsTag(def, ''), '', '无 token 不输出脚本');
  assert.strictEqual(w.buildAnalyticsTag({ enabled: false }, 'tok'), '', 'enabled=false 不输出脚本');
  const tag = w.buildAnalyticsTag(def, 'tok"</script>');
  assert.ok(tag.startsWith('<script>') && tag.includes('data-cf-beacon'), tag);
  assert.ok(tag.includes('\\u003c/script>'), 'token 中的 </script> 必须转义');
  assert.ok(!tag.includes('tok"</script>'), '原始危险串不得出现');
  const noBeacon = w.buildAnalyticsTag(w.analyticsConfig({ analytics: { emitBeacon: false, scriptSrc: 'https://cdn.example/beacon.js' } }), 'tok');
  assert.ok(!noBeacon.includes('data-cf-beacon'), noBeacon);
  assert.ok(noBeacon.includes('https://cdn.example/beacon.js'), 'scriptSrc 生效');
});

test('normalizeRedirectRules：有效/清洗/非法与 warn-only|abort 两种策略', () => {
  const { normalizeRedirectRules } = require('./lib/redirect-rules');
  const ok = normalizeRedirectRules([
    { from: '/a/', to: '/b/', permanent: true },
    { from: '/old', to: '/new', permanent: false },
    { from: '/x', to: 'https://example.com/y' }
  ], 'abort');
  assert.deepStrictEqual(ok.valid.map(r => [r.from, r.to, r.status]), [['/a/', '/b/', 301], ['/old', '/new', 302], ['/x', 'https://example.com/y', 301]]);
  assert.strictEqual(ok.abortOnInvalid, true);
  const cleaned = normalizeRedirectRules([{ from: '/b\u0000ad', to: '/o\tk' }], 'warn-only');
  assert.strictEqual(cleaned.valid[0].from, '/bad');
  assert.strictEqual(cleaned.valid[0].to, '/ok');
  const invalid = normalizeRedirectRules([null, { from: 'no-slash', to: '/x' }, { from: '/a', to: 'javascript:alert(1)' }], 'warn-only');
  assert.strictEqual(invalid.valid.length, 0);
  assert.strictEqual(invalid.invalid.length, 3);
  assert.strictEqual(invalid.abortOnInvalid, false);
  assert.strictEqual(normalizeRedirectRules([{ from: 'x' }], 'abort').abortOnInvalid, true);
  assert.strictEqual(normalizeRedirectRules([], undefined).abortOnInvalid, true, '缺省策略为 abort');
});

test('resolveHeatmapPalette：fixed+足量色表 / 不足回退 auto / auto 忽略 palette', () => {
  const fixed = w.resolveHeatmapPalette(w.heatmapConfig({ heatmap: { levels: 3, scaling: 'fixed', palette: ['#1', '#2', '#3', '#4'] } }));
  assert.deepStrictEqual(fixed.colors, ['#1', '#2', '#3']);
  assert.strictEqual(fixed.warning, '');
  const short = w.resolveHeatmapPalette(w.heatmapConfig({ heatmap: { levels: 3, scaling: 'fixed', palette: ['#1'] } }));
  assert.ok(short.warning.length > 0, '不足色表应给出提示');
  assert.deepStrictEqual(short.colors, w.heatmapPalette(3));
  const auto = w.resolveHeatmapPalette(w.heatmapConfig({ heatmap: { levels: 5, scaling: 'auto', palette: ['#1', '#2', '#3', '#4', '#5'] } }));
  assert.deepStrictEqual(auto.colors, w.heatmapPalette(5));
  assert.strictEqual(auto.warning, '');
  assert.deepStrictEqual(w.heatmapConfig({ heatmap: { palette: [' #a ', '', 7] } }).palette, ['#a']);
});

test('performanceWarnings：超限逐项输出、缺省/非法阈值不告警（不阻断）', () => {
  const stats = { jsKb: 60, htmlRawMaxKb: 500, largeImages: [{ path: '/media/big.png', kb: 400 }] };
  const out = w.performanceWarnings({ warningJsKb: 55, warningHtmlKb: 400, warningImageKb: 300, warningBuildMs: 30000 }, stats, 31000);
  assert.strictEqual(out.length, 4);
  assert.ok(out[0].includes('JS 体积'));
  assert.ok(out.some(l => l.includes('big.png')));
  assert.ok(out[3].includes('构建耗时'));
  assert.deepStrictEqual(w.performanceWarnings({}, stats, 99999), [], '缺省阈值不告警');
  assert.deepStrictEqual(w.performanceWarnings({ warningJsKb: 0, warningHtmlKb: -1 }, stats, 0), []);
});

test('maintenanceWorkerConfig：setRetryAfter/retryAfter 归一化（Worker 链）', () => {
  const { maintenanceWorkerConfig } = require('./generate-security-config.js');
  assert.deepStrictEqual(maintenanceWorkerConfig({}), { setRetryAfter: true, retryAfter: 3600 });
  assert.deepStrictEqual(maintenanceWorkerConfig({ maintenance: { setRetryAfter: false, retryAfter: 120 } }), { setRetryAfter: false, retryAfter: 120 });
  assert.deepStrictEqual(maintenanceWorkerConfig({ maintenance: { retryAfter: '60' } }), { setRetryAfter: true, retryAfter: 60 });
  assert.strictEqual(maintenanceWorkerConfig({ maintenance: { retryAfter: -5 } }).retryAfter, 3600);
  assert.strictEqual(maintenanceWorkerConfig({ maintenance: { retryAfter: 'abc' } }).retryAfter, 3600);
  const { extractWorkerSecurity } = require('./generate-security-config.js');
  const extracted = extractWorkerSecurity({ headers: {} }, null, { maintenance: { setRetryAfter: false, retryAfter: 90 } });
  assert.deepStrictEqual(extracted.maintenance, { setRetryAfter: false, retryAfter: 90 });
});

test('debugConfig / configSummary：默认关闭、摘要脱敏', () => {
  assert.deepStrictEqual(w.debugConfig({}), { verbose: false, listPages: false, dumpConfig: false });
  assert.deepStrictEqual(w.debugConfig({ debug: { verbose: true, listPages: true, dumpConfig: true } }), { verbose: true, listPages: true, dumpConfig: true });
  const summary = w.configSummary({ site: { url: 'https://x.dev' }, features: { a: 1, b: 2 }, security: { csp: { enabled: true }, token: 'supersecret' } });
  assert.ok(summary.some(l => l.startsWith('features = 2')), summary.join(' | '));
  assert.ok(!summary.join('|').includes('supersecret'), '敏感值不得出现在摘要');
  assert.ok(summary.join('|').includes('token=***'));
});

test('删除模块无残留引用（feed：js/templates/scripts 源码扫描）', () => {
  function walk(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'real-site', '.tmp-scripts'].includes(e.name)) continue;
        walk(p, out);
      } else out.push(p);
    }
    return out;
  }
  const pats = [/\bfeatures\.feed\b/, /\bfeed:\s*\{[^}]*rssEnabled/];
  const offenders = [];
  for (const f of walk(ROOT, [])) {
    if (!/\.(js|ejs)$/.test(f) || f.endsWith('.test.js')) continue;
    const src = fs.readFileSync(f, 'utf-8');
    for (const p of pats) if (p.test(src)) offenders.push(path.relative(ROOT, f) + ' :: ' + p);
  }
  assert.deepStrictEqual(offenders, []);
});
