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
    /\blinkBehavior\b/
  ];
  const offenders = [];
  for (const f of walk(ROOT, [])) {
    if (!/\.(js|ejs)$/.test(f) || f.endsWith('.test.js')) continue;
    const src = fs.readFileSync(f, 'utf-8');
    for (const p of pats) if (p.test(src)) offenders.push(path.relative(ROOT, f) + ' :: ' + p);
  }
  assert.deepStrictEqual(offenders, []);
});
