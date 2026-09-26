'use strict';
// 第三轮配置闭环 W1（15 项键接线）单测：键注册表 / 删除项 / 纯函数语义 / 往返边界。
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
// 第四轮 W2（2026-09-27）：搜索加权/标签分类/计数/空结果、外链新标签与复制、双链参数化、删除重复键。
// ---------------------------------------------------------------------------
test('features.json5：第四轮删除项与 schema 同步（pinyinFuzzy/placeholder/linkBehavior）', () => {
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

test('删除键无残留引用（W1+W2：js/templates/scripts 源码扫描）', () => {
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
// 第五轮 W3（2026-09-27）：math/supSub/mermaid/series/related/wordCount/gallery/imageLazy 接线。
// ---------------------------------------------------------------------------
test('features.json5：第五轮删除项与默认值口径修正（incrementalByDefault / skipInsideMath / countDigits）', () => {
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
