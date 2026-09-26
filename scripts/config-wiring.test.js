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
