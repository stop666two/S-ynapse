# 配置开关矩阵（行为开关 → 消费位置 → 覆盖证据）

> 本文件由 `node scripts/gen-config-switch-matrix.js` 生成，禁止手改；
> 键全集来自 `features-schema.js` / `tuning-defaults.js` / `site-defaults.js`（site/navigation/sidebar/footer/theme/security/friends/tagAliases/contentPolicy 全段）/ `internals-defaults.js` 注册表；
> `guard.json5` 细节键由 `guard-defaults.js` 与 guard 测试覆盖，不在本矩阵。
> 覆盖证据优先级：`test()`/`it()` 断言回调内的 `// switch: <键路径>` 标记（或紧贴该测试上方的标记）> 测试代码中「叶名 + 所属模块名同现」的引用 > `scripts/config-switch-exemptions.json` 逐键豁免理由。
> 证据口径：注释与字符串字面量先净化再切词，marker 必须绑定到含 assert 的测试回调，既有引用必须落在 test 回调内且 ±2 行内出现所属模块名——「文本里出现过」不再算覆盖。
> 消费位置按「叶子键名 + 父段」评分定位首个源码引用，供人工复核；存在同名字段的模块以类型与默认值判别。
> 回退字面量必须与注册表默认一致，由 `scripts/config-fallback-bindings.json` + `verify:config-single-source` 锁定。
> 「缺失」行是已登记在 `scripts/config-switch-baseline.json` 的存量缺口：新增缺失会让门禁失败，基线只允许缩小。

统计：开关共 801（已测 341，既有引用 100，豁免 360，缺失 0）；缺失行均已在 `scripts/config-switch-baseline.json` 登记（只允许缩小）。

| 键路径 | 类型 | 默认 | 消费位置 | 测试证据 | 覆盖状态 |
| --- | --- | --- | --- | --- | --- |
| `contentPolicy.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/media-policy.test.js | 既有引用 |
| `contentPolicy.svgSanitize` | bool | true | scripts/build/media.js<br>scripts/lib/content-policy.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.analytics.emitBeacon` | bool | true | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.analytics.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.analytics.injectAt` | enum | `body` | templates/layout.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.anchorStabilize.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.anchorStabilize.maxTrackMs` | number | 8000 | js/domains/core/anchor-stabilize.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.anchorStabilize.settleMs` | number | 300 | js/domains/core/anchor-stabilize.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.dismissible` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.announcement.newTab` | bool | true | js/domains/core/external-link.js<br>js/domains/features/popup-notice.js<br>js/domains/guard/context-menu.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.pauseOnHover` | bool | true | js/domains/core/announcement.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.removeDelayMs` | number | 340 | js/core/runtime.js<br>js/domains/core/announcement.js<br>js/domains/features/continue-reading.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.announcement.rotateMs` | number | 6000 | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.showDot` | bool | true | templates/layout.ejs<br>templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.showProgress` | bool | false | js/domains/features/continue-reading.js<br>scripts/lib/feature-wiring.js<br>templates/layout.ejs | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.announcement.tone` | enum | `accent` | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.transition` | enum | `fade` | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.transitionMs` | number | 450 | templates/site-css.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.atmosphere.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.atmosphere.glow` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.atmosphere.grain` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.authorCard.maxTimeline` | number | 20 | templates/page.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.showSkills` | bool | true | templates/page.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.showSocial` | bool | true | templates/page.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.showTimeline` | bool | true | templates/page.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.autoSummary.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring-build-switches.test.js | 已测（marker） |
| `features.autoSummary.maxLength` | number | 160 | js/domains/features/daily-quote.js<br>js/domains/features/search-core.js<br>scripts/build/articles.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.autoSummary.stripMarkdown` | bool | true | scripts/build/articles.js | scripts/config-wiring-build-switches.test.js<br>scripts/config-wiring.test.js | 既有引用 |
| `features.backToTop.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.backToTop.htmlAnchorFallback` | bool | false | templates/layout.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.backToTop.scrollDurationMs` | number | 450 | scripts/lib/feature-wiring.js<br>js/domains/core/reading.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.backToTop.showAfterPx` | number | 400 | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.backToTop.smoothScroll` | bool | true | js/domains/core/reading.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.backToTop.zIndex` | number | 999 | templates/site-css.ejs<br>js/domains/guard/defaults.js<br>js/domains/guard/watermark.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.autoDisableMobile` | bool | false | js/domains/features/background.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.count` | number | 72 | js/domains/features/background.js<br>js/domains/features/continue-reading.js<br>js/domains/features/lightbox-core.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.background.particles.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/save-data.test.js | 既有引用 |
| `features.background.particles.linkDistance` | number | 120 | js/domains/features/background.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.mobileMaxWidth` | number | 640 | js/domains/features/background.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.opacity` | number | 0.7 | templates/site-css.ejs<br>js/domains/core/code-block.js<br>js/domains/core/external-link.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.background.particles.showLines` | bool | true | js/domains/features/background.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.speed` | number | 0.5 | js/domains/features/background.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.bilingual.breakpointPx` | number | 1280 | templates/post.ejs<br>templates/site-css.ejs<br>js/domains/features/bilingual-core.js | scripts/bilingual-core.test.js<br>scripts/config-wiring.test.js | 已测（marker） |
| `features.bilingual.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/bilingual-core.test.js<br>scripts/config-wiring.test.js | 已测（marker） |
| `features.bilingual.fetchTimeoutMs` | number | 10000 | scripts/lib/feature-wiring.js<br>js/domains/features/bilingual-core.js<br>js/domains/features/bilingual.js | scripts/bilingual-core.test.js<br>scripts/config-wiring.test.js | 已测（marker） |
| `features.bilingual.resizeDebounceMs` | number | 120 | scripts/lib/feature-wiring.js<br>js/domains/features/bilingual-core.js<br>js/domains/features/bilingual.js | scripts/bilingual-core.test.js<br>scripts/config-wiring.test.js | 已测（marker） |
| `features.bilingual.sideBySide` | bool | true | templates/post.ejs<br>templates/site-css.ejs<br>js/domains/features/bilingual-core.js | scripts/bilingual-core.test.js<br>scripts/config-wiring.test.js | 已测（marker） |
| `features.bilingual.switch` | bool | true | templates/post.ejs<br>js/domains/features/bilingual-core.js<br>js/domains/features/lightbox-core.js | scripts/bilingual-core.test.js<br>scripts/config-wiring.test.js | 已测（marker） |
| `features.boot.budgetMs` | number | 40 | js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.configTimeoutMs` | number | 3000 | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js<br>scripts/frontend-boot-overlay.test.js | 既有引用 |
| `features.boot.heavyMode` | enum | `idle` | js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.idleFallbackMs` | number | 120 | js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.idleTimeoutMs` | number | 800 | js/core/boot.js<br>js/domains/features/morphicons.js<br>scripts/lib/feature-wiring.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.boot.interactionWake` | bool | true | js/core/boot.js | scripts/frontend-boot-overlay.test.js | 既有引用 |
| `features.boot.log` | bool | false | js/core/boot.js<br>js/domains/guard/access-gate.js<br>js/domains/guard/console-guard.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.breadcrumb.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.breadcrumb.showCurrent` | bool | true | js/domains/core/toc.js<br>templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.breadcrumb.showHome` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.categoryChip` | bool | true | templates/index.ejs<br>templates/tag.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.coverOverlay` | bool | true | templates/index.ejs<br>templates/tag.ejs<br>scripts/generate-og.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.cardFx.hoverShine` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.readTimeBadge` | bool | true | templates/index.ejs<br>templates/tag.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.blobRevokeDelayMs` | number | 1000 | js/domains/core/code-block.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.copyAllButton` | bool | false | js/domains/core/code-block.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.copyButtonVisibility` | enum | `hover` | js/domains/core/code-block.js | scripts/lib/config.fuzz.test.js | 既有引用 |
| `features.codeBlock.downloadButton` | bool | true | js/domains/core/code-block.js<br>js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-split.test.js<br>scripts/config-wiring-runtime-switches.test.js | 既有引用 |
| `features.codeBlock.lineNumbers` | bool | true | scripts/build/markdown.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.prismBatchMs` | number | 8 | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.prismIdleFallbackMs` | number | 60 | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.prismIdleTimeoutMs` | number | 300 | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.scrollHintTolerancePx` | number | 8 | scripts/lib/feature-wiring.js<br>js/domains/core/code-block.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.codeBlock.showLanguageTag` | bool | true | js/domains/core/code-block.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.windowBar` | bool | true | js/domains/core/code-block.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.wrapLongLines` | bool | false | scripts/build/markdown.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeCopy.buttonTimeout` | number | 1500 | js/domains/core/code-block.js<br>templates/layout.ejs | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.codeCopy.enabled` | bool | true | js/domains/core/code-block.js<br>js/core/runtime.js<br>js/core/boot.js | scripts/config-wiring-runtime-switches.test.js | 已测（marker） |
| `features.codeCopy.showLineNumbers` | bool | false | scripts/build/markdown.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.autoFocus` | bool | true | js/domains/features/command-palette.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.commandPalette.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.commandPalette.includeActions` | bool | true | js/domains/features/command-palette.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.includeNavigation` | bool | true | js/domains/features/command-palette.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.includeSearch` | bool | true | js/domains/features/command-palette.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.maxResults` | number | 10 | scripts/lib/feature-wiring.js<br>js/domains/features/command-palette.js<br>js/domains/features/search-page.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.comments.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/compression-config.test.js<br>scripts/compression-pipeline.test.js | 既有引用 |
| `features.comments.loadContainer` | bool | true | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.comments.loadDelayMs` | number | 300 | js/domains/features/comments.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.comments.renderPlaceholder` | bool | true | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.contactPopup.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.contactPopup.maxItems` | number | 4 | js/domains/features/contact-popup.js<br>js/domains/features/reading-history.js<br>scripts/build/feeds.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.contactPopup.showAllItems` | bool | true | js/domains/features/contact-popup.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.contactPopup.showIcon` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.continueReading.clearConfirmMs` | number | 3000 | scripts/lib/feature-wiring.js<br>js/domains/features/continue-reading.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.continueReading.count` | number | 3 | js/domains/features/background.js<br>js/domains/features/continue-reading.js<br>js/domains/features/lightbox-core.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.continueReading.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.continueReading.removeDelayMs` | number | 360 | scripts/lib/feature-wiring.js<br>js/core/runtime.js<br>js/domains/core/announcement.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.continueReading.showProgress` | bool | true | js/domains/features/continue-reading.js<br>scripts/lib/feature-wiring.js<br>templates/layout.ejs | scripts/config-wiring.test.js | 已测（marker） |
| `features.cover.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.cover.preferImage` | bool | true | templates/post.ejs<br>js/domains/features/cover.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.cover.preview` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.customCSS.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.dailyQuote.api.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/csp.test.js<br>scripts/daily-quote.test.js | 既有引用 |
| `features.dailyQuote.api.maxLength` | number | 0 | js/domains/features/daily-quote.js<br>js/domains/features/search-core.js<br>scripts/build/articles.js | scripts/daily-quote.test.js | 既有引用 |
| `features.dailyQuote.api.minIntervalMs` | number | 1000 | js/domains/features/daily-quote.js | scripts/daily-quote.test.js | 既有引用 |
| `features.dailyQuote.api.timeoutMs` | number | 5000 | js/domains/features/daily-quote.js<br>js/core/boot.js<br>js/core/soft-nav.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.dailyQuote.count` | number | 0 | js/domains/features/background.js<br>js/domains/features/continue-reading.js<br>js/domains/features/lightbox-core.js | scripts/daily-quote.test.js | 既有引用 |
| `features.dailyQuote.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js<br>scripts/csp.test.js | 既有引用 |
| `features.dailyQuote.widgetStyle` | enum | `card` | js/domains/features/daily-quote.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.darkImageFilter.applyImages` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.darkImageFilter.applyVideos` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.darkImageFilter.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.debug.dumpConfig` | bool | false | scripts/build.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.debug.listPages` | bool | false | scripts/build.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.debug.verbose` | bool | false | scripts/build/pages.js<br>scripts/build.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.errorPage.suggestCount` | number | 5 | templates/404.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.exportArticle.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/export-article.test.js | 已测（marker） |
| `features.exportArticle.markdown` | bool | true | scripts/build/context.js<br>scripts/build/pages.js<br>scripts/lib/feature-wiring.js | scripts/export-article.test.js | 已测（marker） |
| `features.exportArticle.print` | bool | true | templates/post.ejs<br>templates/site-css.ejs<br>js/domains/features/export-article.js | scripts/export-article.test.js | 已测（marker） |
| `features.exportArticle.sourceFootnote` | bool | true | templates/post.ejs<br>scripts/lib/feature-wiring.js | scripts/export-article.test.js | 已测（marker） |
| `features.exportBackup.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring-build-switches.test.js | 已测（marker） |
| `features.exportBackup.includeConfig` | bool | true | scripts/export.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.exportBackup.includeMedia` | bool | true | scripts/export.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.externalLink.copyFeedbackMs` | number | 1500 | scripts/lib/feature-wiring.js<br>js/domains/core/external-link.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.externalLink.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.externalLink.mode` | enum | `warn` | js/core/soft-nav.js<br>js/domains/core/external-link.js<br>js/domains/core/seamless-nav.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.externalLink.openInNewTab` | bool | true | js/domains/core/external-link.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.externalLink.showFullUrl` | bool | true | js/domains/core/external-link.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.externalLink.whitelistNewTab` | bool | false | js/domains/core/external-link.js | scripts/config-wiring.test.js | 既有引用 |
| `features.favorites.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.favorites.listIcon` | bool | true | js/domains/features/favorites.js | scripts/config-wiring.test.js | 既有引用 |
| `features.gallery.collectFeatured` | bool | true | scripts/build/pages.js<br>scripts/build/collectors.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.gallery.columns` | number | 4 | templates/site-css.ejs<br>scripts/build/config.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.gallery.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring-build-switches.test.js | 已测（marker） |
| `features.gallery.showCaption` | bool | true | templates/gallery.ejs<br>js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.gallery.showSource` | bool | true | templates/gallery.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.giscus.enabled` | bool | false | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.guards.accessGate` | bool | true | js/domains/guard/access-gate.js<br>js/domains/guard/defaults.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.guards.consoleGuard` | bool | true | js/domains/guard/console-guard.js<br>js/domains/guard/defaults.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.contextMenu` | bool | true | js/domains/guard/context-menu.js<br>js/domains/guard/defaults.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.guards.copyGuard` | bool | true | js/domains/guard/copy-guard.js<br>js/domains/guard/defaults.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.devtoolsDetect` | bool | true | js/domains/guard/defaults.js<br>js/domains/guard/devtools-detect.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.guards.enabled` | bool | true | js/core/main.js<br>js/core/runtime.js<br>js/core/boot.js | scripts/config-split.test.js<br>scripts/lib/config.fuzz.test.js | 既有引用 |
| `features.guards.hotkeyGuard` | bool | true | js/domains/guard/defaults.js<br>js/domains/guard/hotkey-guard.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.preset` | enum | `soft` | js/domains/guard/core.js<br>js/domains/features/theme-lab.js<br>js/domains/guard/defaults.js | scripts/config-split.test.js | 既有引用 |
| `features.guards.privacyCurtain` | bool | true | js/domains/guard/defaults.js<br>js/domains/guard/privacy-curtain.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.selectionGuard` | bool | true | js/domains/guard/defaults.js<br>js/domains/guard/selection-guard.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.tamperWatch` | bool | true | js/domains/guard/defaults.js<br>js/domains/guard/tamper-watch.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.watermark` | bool | true | js/domains/guard/defaults.js<br>js/domains/guard/watermark.js<br>templates/site-css.ejs | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.heatmap.levels` | number | 5 | templates/site-css.ejs<br>scripts/build/pages.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.heatmap.scaling` | enum | `auto` | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.heatmap.showLegend` | bool | true | templates/archive.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 既有引用 |
| `features.heatmap.showMonthNumbers` | bool | true | templates/archive.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 既有引用 |
| `features.hero.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.hero.heightVh` | number | 61.8 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showCta` | bool | true | scripts/build/pages.js<br>templates/index.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showDate` | bool | false | scripts/build/pages.js<br>templates/index.ejs<br>templates/category.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showSearch` | bool | true | scripts/build/pages.js<br>templates/index.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showTags` | bool | true | scripts/build/pages.js<br>templates/index.ejs<br>templates/tag.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.tagCount` | number | 8 | scripts/build/pages.js<br>scripts/lib/test-payloads.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hotSearches.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.hotSearches.maxWords` | number | 50 | scripts/lib/feature-wiring.js<br>js/domains/features/search.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.hotSearches.showClear` | bool | true | js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hotSearches.showInDropdown` | bool | true | js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hotSearches.top` | number | 5 | js/domains/core/motion.js<br>js/domains/core/nav-state.js<br>js/domains/core/navigation.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.hreflang.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.hreflang.includeSelf` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hreflang.xDefault` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.i18n.enabled` | bool | true | js/domains/core/i18n.js<br>js/core/runtime.js<br>js/core/boot.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.i18n.navToggle` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.i18n.translationNotice` | bool | true | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFallback.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.imageFallback.showAlt` | bool | true | js/domains/core/image-lazy.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.align` | enum | `center` | templates/site-css.ejs<br>scripts/generate-og.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.cap` | number | 1.5 | js/domains/features/popup-notice.js<br>js/domains/core/save-data-core.js<br>js/domains/features/continue-reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.maxHeightVh` | number | 0 | templates/site-css.ejs<br>js/domains/core/code-block.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.upscale` | enum | `never` | scripts/build/pages.js<br>templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.cover.applyToCards` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.cover.fit` | enum | `cover` | templates/layout.ejs<br>scripts/generate-og.js<br>scripts/build/assets.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.imageFit.cover.maxHeightVh` | number | 0 | templates/site-css.ejs<br>js/domains/core/code-block.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.imageFit.gallery.maxHeightPx` | number | 0 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.gallery.stretch` | bool | false | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.lightbox.fit` | enum | `contain` | templates/layout.ejs<br>scripts/build/assets.js<br>scripts/generate-og.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.imageFit.lightbox.maxHeightVh` | number | 82 | templates/site-css.ejs<br>js/domains/core/code-block.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.lightbox.maxWidthPct` | number | 92 | templates/site-css.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 既有引用 |
| `features.imageLazy.eagerFirst` | number | 1 | templates/index.ejs<br>js/domains/core/image-lazy.js | scripts/config-wiring.test.js | 既有引用 |
| `features.imageLazy.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.imageLazy.fadeIn` | bool | true | js/domains/core/image-lazy.js<br>templates/site-css.ejs | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.imageLazy.fadeInDurationMs` | number | 300 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageLazy.lqip` | bool | true | scripts/build/media.js<br>js/domains/core/image-lazy.js<br>scripts/build/markdown.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageLazy.lqipWidth` | number | 24 | scripts/build/media.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageLazy.preserveAspectRatio` | bool | true | scripts/build/markdown.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.incrementalBuild.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/incremental-build.test.js | 已测（marker） |
| `features.incrementalBuild.skipUnchanged` | bool | true | scripts/lib/incremental.js | scripts/incremental-build.test.js | 已测（marker） |
| `features.incrementalBuild.watch` | bool | true | js/domains/features/morphicons.js<br>js/domains/guard/defaults.js<br>js/domains/guard/tamper-watch.js | scripts/incremental-build.test.js | 已测（marker） |
| `features.lcpOptimize.asyncCjkFontCss` | bool | false | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.contentVisibility` | bool | false | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.offscreenSkip.asideEstimatePx` | number | 900 | templates/site-css.ejs | scripts/config-wiring.test.js | 既有引用 |
| `features.lcpOptimize.offscreenSkip.cardEstimatePx` | number | 480 | templates/site-css.ejs | scripts/config-wiring.test.js | 既有引用 |
| `features.lcpOptimize.offscreenSkip.cardsFrom` | number | 4 | templates/site-css.ejs | scripts/config-wiring.test.js | 既有引用 |
| `features.lcpOptimize.offscreenSkip.enabled` | bool | false | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 既有引用 |
| `features.lcpOptimize.preloadFirstCard` | bool | false | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.revealExemptFirstPaint` | bool | false | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.skipLatinFontPreloadOnCjk` | bool | false | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.captionMaxLines` | number | 2 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.clickTolerancePx` | number | 6 | scripts/lib/feature-wiring.js<br>js/domains/features/lightbox.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.lightbox.closeButton` | bool | true | js/domains/features/lightbox.js<br>js/domains/features/popup-notice.js<br>scripts/lib/popup-notice-config.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.lightbox.closeOnBackdrop` | bool | true | js/domains/features/lightbox.js<br>js/domains/features/popup-notice.js<br>scripts/lib/popup-notice-config.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.lightbox.dblClickZoom` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.dblClickZoomLevel` | number | 2 | scripts/lib/feature-wiring.js<br>js/domains/features/lightbox.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.lightbox.downloadButton` | bool | true | js/domains/core/code-block.js<br>js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/build.test.js<br>scripts/config-coverage-features-a.test.js | 既有引用 |
| `features.lightbox.escToClose` | bool | true | js/domains/features/lightbox.js<br>js/domains/features/popup-notice.js<br>scripts/lib/popup-notice-config.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.lightbox.keyboardNavigate` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.minSize` | number | 60 | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.mouseSwipeThresholdPx` | number | 80 | scripts/lib/feature-wiring.js<br>js/domains/features/lightbox.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.lightbox.openDurationMs` | number | 180 | js/domains/features/lightbox.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.lightbox.panEnabled` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.pinchEnabled` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.preloadAdjacent` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.prevNextButtons` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.rememberPosition` | bool | false | js/domains/core/read-position.js<br>js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.rotateEnabled` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.showCaption` | bool | true | templates/gallery.ejs<br>js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.showCounter` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.showZoomButtons` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.slideshow.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/lightbox-core.test.js | 已测（marker） |
| `features.lightbox.slideshow.intervalMs` | number | 4000 | js/domains/features/lightbox.js<br>js/domains/features/lightbox-core.js<br>js/domains/guard/defaults.js | scripts/lightbox-core.test.js | 已测（marker） |
| `features.lightbox.swipeClose` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.swipeCloseThresholdPx` | number | 80 | scripts/lib/feature-wiring.js<br>js/domains/features/lightbox.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.lightbox.swipeThresholdPx` | number | 50 | scripts/lib/feature-wiring.js<br>js/domains/features/lightbox.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.lightbox.swipeToNavigate` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.switchDurationMs` | number | 120 | js/domains/features/lightbox.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.lightbox.transitionDurationMs` | number | 220 | templates/site-css.ejs<br>scripts/lib/feature-wiring.js<br>js/domains/features/lightbox.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.lightbox.wheelZoom` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.zoom.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/lightbox-core.test.js | 已测（marker） |
| `features.lightbox.zoom.maxScale` | number | 4 | js/domains/features/lightbox-core.js<br>js/domains/features/lightbox.js | scripts/lightbox-core.test.js | 已测（marker） |
| `features.lightbox.zoomEnabled` | bool | true | js/domains/features/lightbox-core.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.lightbox.zoomMax` | number | 4 | js/domains/features/lightbox-core.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.lightbox.zoomMin` | number | 1 | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.zoomStep` | number | 0.25 | js/domains/features/lightbox.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.listCover.autoGenerate.backgroundStyle` | enum | `gradient` | scripts/lib/auto-cover.js<br>scripts/build/auto-cover.js | scripts/auto-cover.test.js | 已测（marker） |
| `features.listCover.autoGenerate.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/auto-cover.test.js | 已测（marker） |
| `features.listCover.autoGenerate.format` | enum | `webp` | templates/layout.ejs<br>js/domains/features/continue-reading.js<br>js/domains/features/reading-history.js | scripts/auto-cover.test.js | 已测（marker） |
| `features.listCover.autoGenerate.height` | number | 630 | js/domains/core/motion.js<br>js/domains/core/nav-state.js<br>js/domains/core/reading.js | scripts/auto-cover.test.js | 已测（marker） |
| `features.listCover.autoGenerate.showCategory` | bool | false | scripts/build/auto-cover.js<br>scripts/generate-og.js<br>scripts/lib/auto-cover.js | scripts/auto-cover.test.js | 已测（marker） |
| `features.listCover.autoGenerate.showSiteName` | bool | true | scripts/build/auto-cover.js<br>scripts/lib/auto-cover.js | scripts/auto-cover.test.js | 已测（marker） |
| `features.listCover.autoGenerate.width` | number | 1200 | js/domains/core/motion.js<br>js/domains/core/nav-state.js<br>js/domains/core/reading.js | scripts/auto-cover.test.js | 已测（marker） |
| `features.listCover.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.listCover.showOnArchive` | bool | true | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.listCover.showOnHome` | bool | true | js/domains/features/reading-history.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.ariaBusy` | bool | true | js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.delayMs` | number | 120 | js/core/boot.js<br>js/domains/features/popup-notice.js<br>scripts/lib/cjk-fonts.js | scripts/frontend-boot-overlay.test.js | 既有引用 |
| `features.loading.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/frontend-boot-overlay.test.js | 既有引用 |
| `features.loading.fadeMs` | number | 380 | templates/site-css.ejs<br>js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.failsafeBufferMs` | number | 60 | js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.maxShowMs` | number | 2000 | templates/site-css.ejs<br>js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.minShowMs` | number | 250 | js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.reducedMotion` | enum | `skip` | templates/site-css.ejs<br>js/core/boot.js<br>js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.showTitle` | bool | false | templates/layout.ejs<br>js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.spinner` | bool | true | js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.spinnerStyle` | enum | `orbit` | js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.zIndex` | number | 3000 | templates/site-css.ejs<br>js/domains/guard/defaults.js<br>js/domains/guard/watermark.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.dropCap` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.magazine.figureBleed` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.headingNumbers` | bool | false | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.tableHover` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.maintenance.enabled` | bool | false | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring-maintenance.test.js | 已测（marker） |
| `features.maintenance.retryAfter` | number | 3600 | workers/security-worker.js<br>scripts/build/serve.js<br>scripts/generate-security-config.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.maintenance.setRetryAfter` | bool | true | workers/security-worker.js<br>scripts/build/serve.js<br>scripts/generate-security-config.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.maintenance.status` | enum | 503 | js/core/boot.js<br>js/core/runtime.js<br>js/core/soft-nav.js | scripts/config-wiring-maintenance.test.js | 已测（marker） |
| `features.math.autoDetect` | bool | true | scripts/build/markdown.js<br>js/domains/core/math-render.js<br>scripts/build/mermaid.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.math.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.math.mathml` | bool | true | js/domains/core/math-render.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.math.renderRoundParens` | bool | true | js/domains/core/math-render.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.math.renderSquareBrackets` | bool | true | js/domains/core/math-render.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.math.strict` | bool | false | js/domains/core/math-render.js<br>js/domains/guard/selection-guard.js<br>scripts/lib/feature-wiring.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.math.throwOnError` | bool | false | js/domains/core/math-render.js<br>scripts/lib/feature-wiring.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mediaAudit.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring-build-switches.test.js | 已测（marker） |
| `features.mediaAudit.reportDuplicate` | bool | false | scripts/audit-media.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mediaAudit.reportMissed` | bool | true | scripts/audit-media.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mediaAudit.reportUnreferenced` | bool | true | scripts/audit-media.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.autoDetect` | bool | true | js/domains/core/math-render.js<br>scripts/build/markdown.js<br>scripts/build/mermaid.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.mermaid.clientOptions.class.htmlLabels` | bool | false | scripts/lib/feature-wiring.js<br>scripts/lib/mermaid-render.js | scripts/config-wiring.test.js | 既有引用 |
| `features.mermaid.clientOptions.flowchart.htmlLabels` | bool | false | scripts/lib/feature-wiring.js<br>scripts/lib/mermaid-render.js | scripts/config-wiring.test.js | 既有引用 |
| `features.mermaid.clientOptions.state.htmlLabels` | bool | false | scripts/lib/feature-wiring.js<br>scripts/lib/mermaid-render.js | scripts/config-wiring.test.js | 既有引用 |
| `features.mermaid.copyAfterRender` | bool | false | templates/layout.ejs<br>scripts/build/mermaid.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.mermaid.darkMode` | bool | true | js/domains/core/theme.js<br>scripts/build/assets.js<br>scripts/build/config.js | scripts/mermaid-render.test.js | 既有引用 |
| `features.mermaid.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.mermaid.followTheme` | bool | true | scripts/build/mermaid.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.mermaid.idleFallbackMs` | number | 200 | js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.idleTimeoutMs` | number | 1500 | js/core/boot.js<br>js/domains/features/morphicons.js<br>scripts/lib/feature-wiring.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.mermaid.mode` | enum | `build` | js/core/soft-nav.js<br>js/domains/core/external-link.js<br>js/domains/core/seamless-nav.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.mermaid.renderTimeoutMs` | number | 10000 | scripts/build/mermaid.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.rerenderIdleFallbackMs` | number | 60 | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.rerenderIdleTimeoutMs` | number | 300 | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.size.fit` | enum | `scroll` | scripts/build/assets.js<br>scripts/generate-og.js<br>scripts/lib/mermaid-render.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.mobile.codeScrollHint` | bool | true | templates/site-css.ejs<br>js/domains/core/code-block.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.mobile.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.mobile.safeAreaBottom` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobile.searchFullscreen` | bool | true | templates/site-css.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.mobile.tapHighlight` | bool | false | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobile.tocBreakpoint` | number | 900 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobile.touchFallback` | bool | true | templates/site-css.ejs<br>js/domains/features/touch-fallback.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.mobileBottomNav.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.mobileBottomNav.onlyMobile` | bool | true | — | scripts/config-wiring.test.js | 既有引用 |
| `features.mobileToc.autoClose` | bool | true | js/domains/core/toc.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobileToc.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.mobileToc.lockScroll` | bool | true | js/domains/core/toc.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobileToc.overlayClose` | bool | true | js/domains/core/toc.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobileToc.showCurrent` | bool | true | js/domains/core/toc.js<br>templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.morphIcons.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring-runtime-switches.test.js | 已测（marker） |
| `features.morphIcons.icons.copy` | bool | true | js/domains/features/daily-quote.js<br>js/domains/guard/context-menu.js<br>js/domains/guard/defaults.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.morphIcons.icons.favorite` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.morphIcons.icons.menu` | bool | true | js/domains/guard/context-menu.js<br>scripts/build/config.js<br>scripts/build/pages.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.morphIcons.icons.theme` | bool | true | js/core/runtime.js<br>scripts/build/config.js<br>js/domains/guard/context-menu.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.morphIcons.icons.tts` | bool | true | scripts/lib/feature-wiring.js<br>templates/post.ejs<br>js/core/deferred.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.morphIcons.idleTimeoutMs` | number | 3000 | scripts/lib/feature-wiring.js<br>js/core/boot.js<br>js/domains/features/morphicons.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.morphIcons.preload` | enum | `interaction` | js/domains/features/lightbox.js<br>js/domains/features/morphicons.js<br>scripts/coverage-web.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.morphIcons.reducedMotion` | enum | `light` | templates/site-css.ejs<br>js/core/boot.js<br>js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.morphIcons.spring` | enum | `snappy` | js/domains/features/morphicons.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.buttonRipple` | bool | true | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.cardHoverLift` | bool | true | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.cardHoverLiftPx` | number | 4 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.cardHoverScale` | number | 1.02 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.motion.linkUnderline` | bool | true | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.reducedMotion` | enum | `light` | templates/site-css.ejs<br>js/core/boot.js<br>js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealBlocks` | bool | false | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealCards` | bool | true | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealCleanupMs` | number | 1400 | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealDelayMs` | number | 0 | js/domains/guard/defaults.js<br>js/domains/guard/privacy-curtain.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealDurationMs` | number | 250 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealHeadings` | bool | true | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealImages` | bool | true | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealOnce` | bool | true | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealStaggerMax` | number | 500 | — | scripts/config-wiring.test.js | 已测（marker） |
| `features.motion.revealThreshold` | number | 0.08 | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.rippleDurationMs` | number | 500 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.scrollReveal` | bool | true | js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImage.autoSize.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/og-size.test.js | 已测（marker） |
| `features.ogImage.autoSize.maxDimension` | number | 2560 | scripts/generate-og.js<br>scripts/build.js<br>scripts/lib/og-size.js | scripts/og-size.test.js | 已测（marker） |
| `features.ogImage.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/lib/malicious.fuzz.test.js | 既有引用 |
| `features.ogImage.fontScale` | number | 0.75 | scripts/build/config.js<br>scripts/generate-og.js<br>scripts/lib/og-cache-key.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.ogImage.format` | enum | `png` | templates/layout.ejs<br>js/domains/features/continue-reading.js<br>js/domains/features/reading-history.js | scripts/og-format.test.js | 已测（marker） |
| `features.ogImage.gradientForNoCover` | bool | true | scripts/generate-og.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImage.jpegQuality` | number | 82 | scripts/lib/og-format.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.ogImage.overlay.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/h2-dataflow.test.js<br>scripts/popup-notice-config.test.js | 既有引用 |
| `features.ogImage.overlay.wrap` | number | 20 | js/core/main.js<br>js/core/runtime.js<br>js/domains/features/pwa.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImage.useCover` | bool | true | scripts/generate-og.js<br>scripts/lib/og-cache-key.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.ogImageStyle.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/lib/malicious.fuzz.test.js | 既有引用 |
| `features.ogImageStyle.fontSizeBase` | number | 64 | scripts/generate-og.js<br>templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImageStyle.maxLines` | number | 4 | scripts/generate-og.js<br>scripts/lib/auto-cover.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.ogImageStyle.palette` | enum | `theme` | scripts/generate-og.js<br>templates/site-css.ejs<br>scripts/lib/feature-wiring.js | scripts/config-coverage-features-a.test.js | 已测（marker） |
| `features.ogImageStyle.showCategory` | bool | true | scripts/build/auto-cover.js<br>scripts/generate-og.js<br>scripts/lib/auto-cover.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.ogImageStyle.showSite` | bool | true | scripts/generate-og.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImageStyle.showUrl` | bool | true | scripts/generate-og.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImageStyle.template` | enum | `aurora` | scripts/generate-og.js<br>js/domains/features/continue-reading.js<br>scripts/build/render.js | scripts/lib/malicious.fuzz.test.js | 既有引用 |
| `features.ogImageStyle.useGradient` | bool | true | scripts/generate-og.js<br>templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.durationMs` | number | 180 | templates/site-css.ejs<br>js/core/runtime.js<br>scripts/ci-checks.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pageTransition.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pageTransition.leaveGuardMs` | number | 2500 | js/domains/core/page-transition.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.outDurationMs` | number | 120 | js/domains/core/page-transition.js<br>templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.reducedDurationMs` | number | 70 | js/domains/core/page-transition.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.reducedMotion` | enum | `light` | templates/site-css.ejs<br>js/core/boot.js<br>js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.type` | enum | `slide` | js/core/runtime.js<br>js/core/soft-nav.js<br>js/domains/core/code-block.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pagefind.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.pagefind.integrate` | bool | true | js/domains/features/search-page.js<br>js/domains/features/search.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.perfBudget.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.perfBudget.htmlKb` | number | 40 | scripts/build/report.js<br>scripts/lib/perf-budget.js | scripts/build.test.js | 已测（marker） |
| `features.perfBudget.htmlRawKb` | number | 50 | scripts/build/report.js<br>scripts/lib/perf-budget.js | scripts/build.test.js | 已测（marker） |
| `features.perfBudget.inlineConfigKb` | number | 2 | scripts/build.js<br>scripts/build/report.js<br>scripts/lib/perf-budget.js | scripts/build.test.js | 已测（marker） |
| `features.perfBudget.jsKb` | number | 77 | scripts/build/report.js<br>scripts/lib/feature-wiring.js<br>scripts/lib/perf-budget.js | scripts/build.test.js | 已测（marker） |
| `features.perfBudget.requests` | number | 12 | scripts/build/report.js<br>scripts/lib/perf-budget.js | scripts/build.test.js | 已测（marker） |
| `features.perfBudget.warnOnly` | bool | true | scripts/build.js<br>scripts/build/report.js<br>scripts/lib/build-report-html.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.performance.warningBuildMs` | number | 30000 | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.performance.warningHtmlKb` | number | 400 | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.performance.warningImageKb` | number | 300 | scripts/build/report.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.performance.warningJsKb` | number | 80 | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.pinned.badgeStyle` | enum | `pill` | templates/post.ejs<br>templates/archive.ejs<br>templates/category.ejs | scripts/config-wiring.test.js | 既有引用 |
| `features.pinned.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 既有引用 |
| `features.pinned.sortRule` | enum | `pinned-first` | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 既有引用 |
| `features.popupNotice.closeButton.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/popup-notice-config.test.js | 既有引用 |
| `features.popupNotice.closeIcon` | bool | true | js/domains/features/popup-notice.js<br>scripts/lib/popup-notice-config.js | scripts/popup-notice-config.test.js | 既有引用 |
| `features.popupNotice.closeOnBackdrop` | bool | true | js/domains/features/lightbox.js<br>js/domains/features/popup-notice.js<br>scripts/lib/popup-notice-config.js | scripts/popup-notice-config.test.js | 既有引用 |
| `features.popupNotice.delayMs` | number | 1500 | js/core/boot.js<br>js/domains/features/popup-notice.js<br>scripts/lib/cjk-fonts.js | scripts/popup-notice-config.test.js | 既有引用 |
| `features.popupNotice.enabled` | bool | false | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/popup-notice-config.test.js | 既有引用 |
| `features.popupNotice.escToClose` | bool | true | js/domains/features/lightbox.js<br>js/domains/features/popup-notice.js<br>scripts/lib/popup-notice-config.js | scripts/popup-notice-config.test.js | 既有引用 |
| `features.popupNotice.qr.enabled` | bool | false | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/popup-notice-config.test.js | 既有引用 |
| `features.popupNotice.removeDelayMs` | number | 240 | js/core/runtime.js<br>js/domains/core/announcement.js<br>js/domains/features/continue-reading.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.popupNotice.reshowOnChange` | bool | true | js/domains/features/popup-notice.js<br>scripts/lib/popup-notice-config.js | scripts/popup-notice-config.test.js | 既有引用 |
| `features.prevNext.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.prevNext.hideWhenMissing` | bool | false | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.labelPosition` | enum | `left` | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.scrollToTopOnClick` | bool | true | js/domains/features/prev-next.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.showLabels` | bool | true | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.showThumbnail` | bool | false | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.printStyle.avoidBreaks` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.printStyle.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.printStyle.expandLinks` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.printStyle.hideInteractive` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prismTheme.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pwa.assetCacheFirst` | bool | true | scripts/build/assets.js<br>scripts/lib/pwa-sw.js | scripts/pwa-sw.test.js | 已测（marker） |
| `features.pwa.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js<br>scripts/config-split.test.js | 既有引用 |
| `features.pwa.installPrompt` | bool | true | templates/site-css.ejs<br>js/domains/features/pwa.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pwa.offlineNotice` | bool | true | js/domains/features/pwa.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pwa.offlinePage` | bool | true | scripts/build/assets.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pwa.pageCacheLimit` | number | 24 | scripts/build/assets.js<br>scripts/lib/pwa-sw.js | scripts/pwa-sw.test.js | 已测（marker） |
| `features.pwa.pageNetworkFirst` | bool | false | scripts/build/assets.js<br>scripts/lib/pwa-sw.js | scripts/pwa-sw.test.js | 已测（marker） |
| `features.pwa.precache` | bool | true | scripts/build/assets.js<br>scripts/lib/pwa-sw.js | scripts/pwa-sw.test.js | 已测（marker） |
| `features.pwa.registerSW` | bool | true | js/domains/features/pwa.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pwa.reloadFallbackMs` | number | 3000 | scripts/lib/feature-wiring.js<br>js/domains/features/pwa.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.pwa.updateCheckIntervalMs` | number | 1800000 | js/domains/features/pwa.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pwa.updatePrompt` | bool | true | templates/site-css.ejs<br>js/domains/features/pwa.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.pwa.updateToastMs` | number | 0 | js/domains/features/pwa.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.readDock.directionDeltaPx` | number | 12 | scripts/lib/feature-wiring.js<br>js/domains/core/reading.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.readDock.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.readDock.hideBelowPx` | number | 80 | scripts/lib/feature-wiring.js<br>js/domains/core/reading.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.readDock.hideOnScrollDown` | bool | true | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readDock.showProgressRing` | bool | true | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readDock.showTocButton` | bool | true | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readDock.showTopButton` | bool | true | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readMode.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.readMode.focusOnlyContent` | bool | true | js/domains/core/reading-mode.js | scripts/config-wiring.test.js | 既有引用 |
| `features.readMode.persist` | bool | true | scripts/lib/feature-wiring.js<br>js/domains/core/reading-mode.js<br>js/domains/core/reading.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.readingHistory.clearable` | bool | true | js/domains/features/reading-history.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingHistory.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.readingHistory.maxItems` | number | 5 | js/domains/features/contact-popup.js<br>js/domains/features/reading-history.js<br>scripts/build/feeds.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.readingHistory.maxStored` | number | 50 | scripts/lib/feature-wiring.js<br>js/domains/core/read-position.js<br>js/domains/features/continue-reading.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.readingHistory.progressThrottleMs` | number | 800 | scripts/lib/feature-wiring.js<br>js/domains/features/reading-history.js | scripts/config-wiring.test.js | 既有引用 |
| `features.readingHistory.showOnHome` | bool | true | js/domains/features/reading-history.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.readingPanel.fontSizeDefault` | number | 19 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.fontSizeMax` | number | 26 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.fontSizeMin` | number | 15 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.fontSizeStep` | number | 1 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightDefault` | number | 1.9 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightMax` | number | 2.6 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightMin` | number | 1.4 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightStep` | number | 0.1 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.remember` | bool | true | js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.showReset` | bool | true | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthDefault` | number | 800 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthMax` | number | 1200 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthMin` | number | 560 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthStep` | number | 40 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.ariaAnnounce` | bool | true | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.articleOnly` | bool | true | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.clickToJump` | bool | true | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.readingProgress.keyboardStep` | number | 0.05 | scripts/lib/feature-wiring.js<br>js/domains/core/reading.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.readingProgress.maxStoredPositions` | number | 80 | scripts/lib/feature-wiring.js<br>js/domains/core/read-position.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.readingProgress.minRestorePx` | number | 160 | scripts/lib/feature-wiring.js<br>js/domains/core/read-position.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.readingProgress.rememberPosition` | bool | true | js/domains/core/read-position.js<br>js/domains/features/lightbox.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.rememberPositionMaxAgeHours` | number | 72 | js/domains/core/read-position.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.saveThrottleMs` | number | 400 | scripts/lib/feature-wiring.js<br>js/domains/core/read-position.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.readingProgress.showDot` | bool | true | templates/layout.ejs<br>templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.showTip` | bool | true | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.tipDisplayMs` | number | 500 | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.updateThrottleMs` | number | 30 | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.useGradient` | bool | true | templates/site-css.ejs<br>scripts/generate-og.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.zIndex` | number | 1000 | templates/site-css.ejs<br>js/domains/guard/defaults.js<br>js/domains/guard/watermark.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingTime.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.readingTime.showInMeta` | bool | true | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingTime.wordsPerMinuteCJK` | number | 250 | scripts/build/articles.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingTime.wordsPerMinuteLatin` | number | 200 | scripts/build/articles.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.redirects.applyInServe` | bool | true | scripts/build/serve.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.redirects.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/h2-dataflow.test.js | 既有引用 |
| `features.redirects.generatePagesFile` | bool | true | scripts/build/security-files.js | scripts/h2-dataflow.test.js | 既有引用 |
| `features.redirects.invalidRule` | enum | `abort` | scripts/build/security-files.js<br>scripts/lib/redirect-rules.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.related.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.related.excerptLength` | number | 80 | templates/post.ejs<br>js/domains/features/search-page.js<br>js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.related.excludeCurrent` | bool | true | scripts/lib/feature-wiring.js<br>scripts/lib/related.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.related.minScore` | number | 2 | scripts/lib/related.js | scripts/build.test.js | 已测（marker） |
| `features.related.sameCategoryWeight` | number | 2 | scripts/lib/related.js | scripts/build.test.js | 已测（marker） |
| `features.related.sameTagWeight` | number | 3 | scripts/lib/related.js | scripts/build.test.js | 已测（marker） |
| `features.related.showCount` | bool | false | js/domains/features/search-page.js<br>js/domains/features/search.js<br>scripts/lib/feature-wiring.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.related.showExcerpt` | bool | true | templates/post.ejs<br>templates/category.ejs<br>templates/index.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.related.topN` | number | 4 | scripts/lib/related.js<br>scripts/build/report.js<br>scripts/lib/feature-wiring.js | scripts/build.test.js | 已测（marker） |
| `features.reward.closeByBtn` | bool | true | js/domains/features/reward.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.reward.closeByEsc` | bool | true | js/domains/features/reward.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.reward.closeByOverlay` | bool | true | js/domains/features/reward.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.reward.enabled` | bool | false | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.reward.showNote` | bool | true | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.saveDataMode.auto` | bool | true | templates/layout.ejs<br>templates/site-css.ejs<br>js/domains/core/reading.js | scripts/save-data.test.js | 已测（marker） |
| `features.saveDataMode.degrade.animations` | bool | true | templates/site-css.ejs<br>js/domains/core/save-data-core.js<br>scripts/lib/feature-wiring.js | scripts/save-data.test.js | 已测（marker） |
| `features.saveDataMode.degrade.lazyAggressive` | bool | true | js/domains/core/image-lazy.js<br>js/domains/core/save-data-core.js<br>scripts/lib/feature-wiring.js | scripts/save-data.test.js | 已测（marker） |
| `features.saveDataMode.degrade.lowResImages` | bool | true | js/domains/core/image-lazy.js<br>js/domains/core/save-data-core.js<br>scripts/lib/feature-wiring.js | scripts/save-data.test.js | 已测（marker） |
| `features.saveDataMode.degrade.lowResMaxWidthPx` | number | 0 | scripts/lib/feature-wiring.js<br>js/domains/core/image-lazy.js<br>js/domains/core/save-data-core.js | scripts/save-data.test.js | 已测（marker） |
| `features.saveDataMode.degrade.particles` | bool | true | js/domains/features/background.js<br>js/domains/core/save-data-core.js<br>scripts/lib/feature-wiring.js | scripts/save-data.test.js | 已测（marker） |
| `features.saveDataMode.degrade.systemFontsOnly` | bool | true | templates/site-css.ejs<br>js/domains/core/save-data-core.js<br>scripts/lib/feature-wiring.js | scripts/save-data.test.js | 已测（marker） |
| `features.saveDataMode.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/save-data.test.js | 已测（marker） |
| `features.saveDataMode.manual` | bool | true | templates/layout.ejs<br>templates/post.ejs<br>js/domains/core/save-data-core.js | scripts/save-data.test.js | 已测（marker） |
| `features.schemaRich.articleSection` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.authorUrl` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.blogHomepage` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.breadcrumbs` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.dateModified` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.image` | bool | true | templates/layout.ejs<br>templates/post.ejs<br>js/domains/features/popup-notice.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.schemaRich.keywords` | bool | true | templates/layout.ejs | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.schemaRich.timeRequired` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.wordCount` | bool | true | templates/layout.ejs<br>scripts/lib/feature-wiring.js<br>templates/category.ejs | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.scrollBehavior.behavior` | enum | `smooth` | templates/site-css.ejs<br>js/core/runtime.js<br>js/domains/core/anchor-stabilize.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.scrollBehavior.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.scrollBehavior.respectReducedMotion` | bool | true | templates/site-css.ejs<br>js/core/runtime.js<br>js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.scrollIndicator.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.scrollIndicator.gradient` | bool | true | templates/site-css.ejs | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.scrollIndicator.respectReducedMotion` | bool | true | templates/site-css.ejs<br>js/core/runtime.js<br>js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.closeOnOverlay` | bool | true | js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.debounceMs` | number | 120 | js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js<br>scripts/config-wiring.test.js | 既有引用 |
| `features.search.excerptLength` | number | 120 | templates/post.ejs<br>js/domains/features/search-page.js<br>js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.focusDelayMs` | number | 100 | js/domains/features/search.js<br>js/domains/guard/access-gate.js<br>js/domains/guard/defaults.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.focusOnOpen` | bool | true | js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.highlightMatches` | bool | true | js/domains/features/search-page.js<br>js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.includeContent` | bool | true | scripts/build/feeds.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.index.bigram` | bool | true | js/domains/features/search-core.js<br>js/domains/features/search-page.js<br>scripts/build/feeds.js | scripts/search-core.test.js | 已测（marker） |
| `features.search.index.maxGzipKb` | number | 60 | scripts/build/feeds.js<br>scripts/lib/search-index.js | scripts/lib/search.fuzz.test.js<br>scripts/search-index.test.js | 既有引用 |
| `features.search.matchCategories` | bool | true | js/domains/features/search-core.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | scripts/config-wiring.test.js<br>scripts/search-core.test.js | 已测（marker） |
| `features.search.matchTags` | bool | true | js/domains/features/search-core.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | scripts/config-wiring.test.js<br>scripts/search-core.test.js | 已测（marker） |
| `features.search.maxHistory` | number | 5 | js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.maxResults` | number | 30 | js/domains/features/command-palette.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | scripts/theme-override.test.js | 既有引用 |
| `features.search.minChars` | number | 1 | js/domains/features/search-page.js<br>js/domains/features/search.js<br>js/domains/guard/copy-guard.js | scripts/theme-override.test.js | 既有引用 |
| `features.search.resultTagCount` | number | 6 | scripts/lib/feature-wiring.js<br>js/domains/features/search-page.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.search.showCount` | bool | true | js/domains/features/search-page.js<br>js/domains/features/search.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.search.showHistoryOnFocus` | bool | true | js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.weightContent` | number | 1 | scripts/build/feeds.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | scripts/config-wiring.test.js<br>scripts/search-core.test.js | 已测（marker） |
| `features.search.weightExcerpt` | number | 2 | scripts/build/feeds.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | scripts/config-wiring.test.js<br>scripts/search-core.test.js | 已测（marker） |
| `features.search.weightTitle` | number | 5 | scripts/build/feeds.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | scripts/config-wiring.test.js<br>scripts/search-core.test.js | 已测（marker） |
| `features.searchEnginePing.enabled` | bool | false | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.searchEnginePing.onlyProduction` | bool | true | scripts/build/feeds.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.searchEnginePing.timeoutMs` | number | 5000 | scripts/build/feeds.js<br>js/core/boot.js<br>js/core/soft-nav.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.searchHighlight.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.searchHighlight.maxMatches` | number | 20 | js/domains/features/search-core.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.series.defaultWidgetCount` | number | 8 | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.series.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.series.order` | enum | `asc` | scripts/build/pages.js<br>scripts/lib/series-page.js<br>templates/post.ejs | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.series.pageEnabled` | bool | true | scripts/build/feeds.js<br>scripts/build/pages.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.series.showBadge` | bool | true | templates/post.ejs<br>scripts/lib/feature-wiring.js<br>templates/archive.ejs | scripts/config-wiring.test.js | 已测（marker） |
| `features.series.showNavPanel` | bool | true | templates/post.ejs<br>scripts/lib/feature-wiring.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.series.showPosition` | bool | true | templates/post.ejs<br>templates/series-page.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.series.sidebarWidget` | bool | true | templates/layout.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.share.copiedShowMs` | number | 2500 | js/domains/features/share.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.copyFallback` | bool | true | js/domains/features/share.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.share.popupHeight` | number | 520 | js/domains/features/share.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.popupWidth` | number | 640 | js/domains/features/share.js<br>scripts/lib/feature-wiring.js<br>templates/site-css.ejs | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.share.showLabel` | bool | false | templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.useNativeShare` | bool | false | js/domains/features/share.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.shortcuts.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.shortcuts.ignoreInInputs` | bool | true | js/domains/features/shortcuts.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.shortcuts.showHelpHint` | bool | true | scripts/build/pages.js<br>scripts/lib/feature-wiring.js<br>templates/layout.ejs | scripts/config-wiring.test.js | 已测（marker） |
| `features.shortcuts.showHelpTable` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.sidebarDrag.hapticMs` | number | 10 | js/domains/features/sidebar-drag.js<br>js/domains/guard/context-menu.js<br>js/domains/guard/defaults.js | scripts/config-wiring.test.js | 既有引用 |
| `features.sidebarDrag.persistOrder` | bool | true | js/domains/features/sidebar-drag.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.resetOnLoadFail` | bool | true | js/domains/features/sidebar-drag.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.showHandleOnHover` | bool | true | js/domains/features/sidebar-drag.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.touchLongPress` | bool | true | js/domains/features/sidebar-drag.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.touchLongPressMs` | number | 500 | js/domains/features/sidebar-drag.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sitemap.maxUrlsPerFile` | number | 500 | scripts/build/feeds.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sitemap.split` | bool | true | js/core/runtime.js<br>js/core/soft-nav.js<br>js/domains/core/code-block.js | scripts/h2-dataflow.test.js<br>scripts/lib/feeds.fuzz.test.js | 既有引用 |
| `features.softNavigation.cacheMaxEntries` | number | 16 | scripts/lib/feature-wiring.js<br>templates/layout.ejs<br>js/core/soft-nav.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.softNavigation.cacheTtlMs` | number | 300000 | templates/layout.ejs<br>js/core/soft-nav.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.softNavigation.prefetchDelayMs` | number | 80 | js/core/soft-nav.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.prefetchOnHover` | bool | true | js/core/soft-nav.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.scrollToTop` | bool | true | js/core/soft-nav.js<br>js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.timeoutMs` | number | 10000 | js/core/boot.js<br>js/core/soft-nav.js<br>js/domains/features/bilingual.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.softNavigation.toggle.defaultOn` | bool | true | js/core/soft-nav.js<br>js/domains/core/seamless-nav.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.toggle.show` | bool | true | templates/layout.ejs<br>js/domains/features/bilingual.js<br>js/domains/features/daily-quote.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.softNavigation.viewTransition` | bool | true | templates/layout.ejs<br>templates/index.ejs<br>templates/post.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.delivery` | enum | `inline` | scripts/build/security-files.js<br>js/domains/core/seamless-nav.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.eagerness` | enum | `moderate` | scripts/build/security-files.js<br>js/domains/core/seamless-nav.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.speculation.mode` | enum | `both` | js/core/soft-nav.js<br>js/domains/core/external-link.js<br>js/domains/core/seamless-nav.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.speculation.toggle.defaultOn` | bool | true | js/core/soft-nav.js<br>js/domains/core/seamless-nav.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.toggle.show` | bool | true | templates/layout.ejs<br>js/domains/features/bilingual.js<br>js/domains/features/daily-quote.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.stats.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 既有引用 |
| `features.stats.showArchiveCards` | bool | true | templates/archive.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.stats.showSidebar` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.subscribe.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.subscribe.jsonFeed` | bool | true | scripts/build/feeds.js<br>scripts/build/minify.js<br>scripts/build/security-files.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.subscribe.newTab` | bool | true | js/domains/core/external-link.js<br>js/domains/features/popup-notice.js<br>js/domains/guard/context-menu.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.subscribe.rss` | bool | true | templates/layout.ejs<br>scripts/build/config.js<br>scripts/build/feeds.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.supSub.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.supSub.preserveUnmatched` | bool | true | scripts/build/markdown.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.supSub.skipInsideMath` | bool | true | scripts/build/markdown.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.themeLab.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/theme-lab.test.js | 已测（marker） |
| `features.themePresets.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.themePresets.persistChoice` | bool | true | js/domains/features/theme-presets.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themePresets.pickerVisible` | bool | true | js/domains/features/theme-presets.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themePresets.previewOnHover` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themePresets.showInNavbar` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.applyInstantly` | bool | true | js/domains/features/theme-schedule.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.checkIntervalMs` | number | 60000 | js/domains/features/theme-schedule.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.enabled` | bool | false | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.themeSchedule.respectManualOverride` | bool | true | js/domains/features/theme-schedule.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.smoothTransition` | bool | true | js/domains/features/theme-schedule.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.smoothTransitionMs` | number | 350 | js/domains/features/theme-schedule.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeToggle.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring-runtime-switches.test.js | 已测（marker） |
| `features.themeToggle.toggleIconSwap` | bool | true | js/domains/features/morphicons.js<br>templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeToggle.zIndex` | number | 100 | templates/site-css.ejs<br>js/domains/guard/defaults.js<br>js/domains/guard/watermark.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toast.durationMs` | number | 2500 | js/core/runtime.js<br>templates/site-css.ejs<br>scripts/ci-checks.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.toast.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.toast.maxVisible` | number | 3 | js/core/runtime.js<br>scripts/build/pages.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toast.position` | enum | `bottom-center` | js/core/runtime.js<br>templates/layout.ejs<br>templates/post.ejs | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.toast.removeDelayMs` | number | 300 | js/core/runtime.js<br>js/domains/core/announcement.js<br>js/domains/features/continue-reading.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.toc.activeOffset` | number | 120 | js/domains/core/toc.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.collapsible` | bool | true | js/domains/core/toc.js<br>templates/site-css.ejs | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.toc.defaultOpenLevel` | number | 2 | js/domains/core/toc.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.toc.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.toc.groupCollapse` | bool | true | js/domains/core/toc.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.highlightActive` | bool | true | js/domains/core/toc.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.maxLevel` | number | 4 | scripts/build/articles.js<br>scripts/lib/utils.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.toc.maxWidthPx` | number | 320 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.minLevel` | number | 2 | scripts/build/articles.js<br>js/domains/core/toc.js<br>scripts/lib/feature-wiring.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.toc.progressLine` | bool | true | js/domains/core/toc.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.showTitle` | bool | true | templates/layout.ejs<br>js/core/boot.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.updateUrl` | bool | true | js/domains/core/toc.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.visitedFade` | bool | true | js/domains/core/toc.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tocScrollSpy.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.tocScrollSpy.offset` | number | 80 | js/domains/core/navigation.js<br>js/domains/core/toc.js<br>scripts/coverage-web.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tocScrollSpy.throttleMs` | number | 60 | js/domains/guard/tamper-watch.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.tts.highlightParagraph` | bool | false | js/domains/features/tts.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.tts.highlightReading` | bool | true | js/domains/features/tts.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.pitch` | number | 1 | js/domains/features/tts.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.preferDefaultVoice` | bool | true | js/domains/features/tts.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.tts.rate` | number | 0.5 | js/domains/features/tts.js<br>scripts/perf-audit.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.tts.resumeIntervalMs` | number | 500 | js/domains/features/tts.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.resumeMaxTries` | number | 3 | js/domains/features/tts.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.volume` | number | 1 | js/domains/features/tts.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.viewTransition.durationMs` | number | 180 | templates/site-css.ejs<br>js/core/runtime.js<br>scripts/ci-checks.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.viewTransition.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.viewTransition.reducedMotion` | enum | `light` | templates/site-css.ejs<br>js/core/boot.js<br>js/domains/core/motion.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.viewTransition.shared` | bool | true | templates/index.ejs<br>templates/post.ejs<br>templates/tag.ejs | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.viewTransition.toggle.defaultOn` | bool | true | js/core/soft-nav.js<br>js/domains/core/seamless-nav.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.viewTransition.toggle.show` | bool | true | templates/layout.ejs<br>js/domains/features/bilingual.js<br>js/domains/features/daily-quote.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.viewTransition.type` | enum | `fade` | js/core/runtime.js<br>js/core/soft-nav.js<br>js/domains/core/code-block.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.wikiLinks.allowCustomLabel` | bool | true | scripts/build/articles.js<br>scripts/lib/feature-wiring.js<br>scripts/lib/utils.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.wikiLinks.caseInsensitive` | bool | true | scripts/build/articles.js<br>scripts/lib/feature-wiring.js<br>scripts/lib/utils.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.wikiLinks.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.wikiLinks.openNewTab` | bool | false | js/domains/guard/context-menu.js<br>js/domains/guard/defaults.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.wikiLinks.unknownMode` | enum | `text` | scripts/build/articles.js<br>scripts/lib/feature-wiring.js<br>scripts/lib/utils.js | scripts/config-wiring.test.js | 已测（marker） |
| `features.wordCount.countCjkChars` | bool | true | scripts/build/articles.js<br>scripts/lib/feature-wiring.js<br>scripts/lib/utils.js | scripts/config-wiring.test.js | 既有引用 |
| `features.wordCount.countDigits` | bool | true | scripts/build/articles.js<br>scripts/lib/feature-wiring.js<br>scripts/lib/utils.js | scripts/config-wiring.test.js | 既有引用 |
| `features.wordCount.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js | 已测（marker） |
| `features.wordCount.inArticle` | bool | true | templates/post.ejs<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 既有引用 |
| `features.wordCount.onCards` | bool | true | templates/category.ejs<br>templates/index.ejs<br>templates/series-page.ejs | scripts/config-wiring.test.js | 既有引用 |
| `features.wordCount.wpm` | number | 265 | scripts/lib/feature-wiring.js<br>scripts/build/articles.js | scripts/config-wiring.test.js | 已测（marker） |
| `footer.beian.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `footer.bottomLinks.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `footer.columnItems.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `footer.columns` | number | 3 | templates/site-css.ejs<br>scripts/build/config.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `footer.options.linkHoverUnderline` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `footer.poweredBy.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `footer.social.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/malicious.test.js | 既有引用 |
| `friends.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `friends.sidebarCount` | number | 8 | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 既有引用 |
| `internals.audit.a11y.htmlSummaryMax` | number | 120 | scripts/a11y-audit.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.audit.a11y.nodesPerRuleMax` | number | 3 | scripts/a11y-audit.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.audit.a11y.pages` | number | 0 | scripts/a11y-audit.js<br>js/domains/features/reading-panel.js<br>scripts/build.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `internals.audit.distHash.previewLimit` | number | 20 | scripts/dist-hash-guard.js<br>scripts/release-prune.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.cache.fontsTtlDays` | number | 7 | scripts/build/cjk-fonts.js | scripts/internals.test.js | 既有引用 |
| `internals.cache.mediaTtlDays` | number | 0 | scripts/build/media.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.cache.mermaidTtlDays` | number | 0 | scripts/build/mermaid.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.cache.ogTtlDays` | number | 0 | scripts/generate-og.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ci.aggregate` | bool | true | scripts/ci-checks.js<br>scripts/ci-env.js<br>scripts/ci-skip.js | scripts/internals.test.js | 既有引用 |
| `internals.ci.checkTimeoutMs` | number | 600000 | scripts/check-internals.js<br>scripts/ci-checks.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ci.skip.consecutiveClean` | number | 5 | scripts/lib/ci-skip.js | scripts/ci-skip.test.js | 既有引用 |
| `internals.ci.skip.consecutiveErrors` | number | 2 | scripts/lib/ci-skip.js | scripts/ci-skip.test.js | 既有引用 |
| `internals.ci.skip.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-wiring.test.js<br>scripts/incremental-build.test.js | 既有引用 |
| `internals.ci.skip.ignoreWarnings` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ci.skip.requireSameHead` | bool | true | scripts/lib/ci-skip.js | scripts/ci-skip.test.js | 既有引用 |
| `internals.deploy.verifyOnDeploy` | bool | true | scripts/deploy-pages.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `internals.ports.a11y` | number | 3224 | scripts/a11y-audit.js | scripts/internals.test.js | 既有引用 |
| `internals.ports.perf` | number | 3000 | scripts/perf-audit.js<br>scripts/build/report.js<br>scripts/lib/feature-wiring.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ports.serve` | number | 3000 | scripts/build/serve.js<br>scripts/build/context.js<br>scripts/lib/compression-config.js | scripts/internals.test.js | 既有引用 |
| `internals.release.listLimit` | number | 200 | scripts/release-prune.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.release.previewLimit` | number | 20 | scripts/release-prune.js<br>scripts/dist-hash-guard.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.report.maxBuildMsWarn` | number | 0 | scripts/build.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.report.topN` | number | 10 | scripts/build/report.js<br>scripts/lib/feature-wiring.js<br>scripts/lib/related.js | scripts/config-wiring.test.js | 已测（marker） |
| `navigation.navbar.fixed` | bool | true | templates/site-css.ejs<br>scripts/build/config.js<br>scripts/build/pages.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `navigation.navbar.shadow` | bool | true | js/domains/features/theme-presets.js<br>scripts/build/config.js<br>scripts/generate-og.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `navigation.navbarOptions.glassAlpha` | number | 0 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `navigation.navbarOptions.shadowShow` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `navigation.search.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-features-b.test.js<br>scripts/config-wiring.test.js | 既有引用 |
| `navigation.socialInNav.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `security.csp.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/build.test.js<br>scripts/config-coverage-nonfeatures.test.js | 既有引用 |
| `security.csp.reportOnly` | bool | false | scripts/build/security-files.js<br>scripts/generate-security-config.js<br>workers/security-worker.js | scripts/build.test.js<br>scripts/config-coverage-nonfeatures.test.js | 既有引用 |
| `security.forceHttps` | bool | true | scripts/generate-security-config.js<br>workers/security-worker.js | scripts/config-wiring.test.js | 既有引用 |
| `security.hardening.cspReportMaxBytes` | number | 16384 | scripts/generate-security-config.js<br>workers/security-worker.js | scripts/build.test.js<br>scripts/config-wiring.test.js | 既有引用 |
| `security.rateLimiting.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/build.test.js<br>scripts/config-wiring.test.js | 既有引用 |
| `security.rateLimiting.maxRequests` | number | 100 | scripts/generate-security-config.js<br>workers/lib/rate-limit.mjs<br>workers/lib/security-fallbacks.js | scripts/build.test.js | 既有引用 |
| `security.rateLimiting.maxTrackedEntries` | number | 5000 | scripts/generate-security-config.js<br>workers/lib/security-fallbacks.js<br>workers/security-worker.js | scripts/build.test.js<br>scripts/config-wiring.test.js | 既有引用 |
| `security.rateLimiting.windowMs` | number | 60000 | scripts/generate-security-config.js<br>workers/lib/rate-limit.mjs<br>workers/lib/security-fallbacks.js | scripts/build.test.js | 既有引用 |
| `security.robots.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `sidebar.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-wiring.test.js | 既有引用 |
| `sidebar.options.borderShow` | bool | false | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.options.hoverLift` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.options.titleWeight` | number | 600 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.recentPoolSize` | number | 10 | scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `sidebar.sticky` | bool | true | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.avif.effort` | number | 5 | scripts/build/media.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.avif.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.avif.quality` | number | 50 | scripts/build/media.js<br>scripts/build/auto-cover.js<br>scripts/generate-og.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.buildReport` | bool | true | scripts/build.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.cacheControl` | bool | true | scripts/build/security-files.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.cjkFonts.cacheTtlDays` | number | 7 | scripts/build/cjk-fonts.js<br>scripts/build/mermaid.js<br>scripts/lib/mermaid-render.js | scripts/cjk-fonts.test.js<br>scripts/config-wiring.test.js | 既有引用 |
| `site.build.cjkFonts.concurrency` | number | 6 | scripts/build/cjk-fonts.js | scripts/cjk-fonts.test.js<br>scripts/config-wiring.test.js | 既有引用 |
| `site.build.cjkFonts.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/cjk-fonts.test.js<br>scripts/config-coverage-nonfeatures.test.js | 既有引用 |
| `site.build.cjkFonts.fetchTimeoutMs` | number | 15000 | js/domains/features/bilingual-core.js<br>js/domains/features/bilingual.js<br>scripts/build/cjk-fonts.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.cjkSpacing` | bool | true | scripts/build/articles.js<br>scripts/build/pages.js | scripts/h2-dataflow.test.js | 既有引用 |
| `site.build.cleanDist` | bool | true | scripts/build.js<br>scripts/build/media.js | scripts/config-coverage-nonfeatures.test.js<br>scripts/config-wiring-build-switches.test.js | 既有引用 |
| `site.build.copyStatic` | bool | true | scripts/build/media.js<br>scripts/build.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.criticalCss.asyncNonCritical` | bool | true | scripts/build/pages.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.criticalCss.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.enableCacheBusting` | bool | false | scripts/build/feeds.js<br>scripts/build/minify.js | scripts/cache-bust.test.js<br>scripts/h2-dataflow.test.js | 既有引用 |
| `site.build.forceContentWidth` | bool | true | templates/layout.ejs<br>templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.generateArchive` | bool | true | scripts/build/feeds.js<br>scripts/build/pages.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.generateCategories` | bool | true | scripts/build/feeds.js<br>scripts/build/pages.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.generateGallery` | bool | true | scripts/lib/build-switch-gates.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.generateIndex` | bool | true | scripts/build/feeds.js<br>scripts/build/pages.js | scripts/h2-dataflow.test.js | 既有引用 |
| `site.build.generateTags` | bool | true | scripts/build/feeds.js<br>scripts/build/pages.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.hashLength` | number | 10 | scripts/build/pages.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.mediaQuality` | number | 85 | scripts/build/media.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.minifyCSS` | bool | false | scripts/build/minify.js<br>scripts/build/pages.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.minifyHTML` | bool | false | scripts/build/minify.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.minifyJS` | bool | false | scripts/build.js<br>scripts/build/minify.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.optimizeMedia` | bool | false | scripts/build/media.js<br>scripts/build.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.build.relatedArticles` | bool | true | scripts/lib/related.js<br>templates/post.ejs | scripts/build-smoke.test.js<br>scripts/config-wiring-related.test.js | 已测（marker） |
| `site.build.removeConsole` | bool | false | scripts/build/minify.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.reportTopN` | number | 10 | scripts/build/report.js<br>scripts/lib/feature-wiring.js | scripts/config-wiring.test.js | 已测（marker） |
| `site.build.usePictureTag` | bool | true | scripts/build/markdown.js | scripts/config-wiring.test.js | 既有引用 |
| `site.comments.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/compression-config.test.js<br>scripts/compression-pipeline.test.js | 既有引用 |
| `site.externalLinkWarning.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.favicon.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.hero.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.hero.showCta` | bool | true | scripts/build/pages.js<br>templates/index.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.hero.showSearch` | bool | true | scripts/build/pages.js<br>templates/index.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.hero.showTags` | bool | true | scripts/build/pages.js<br>templates/index.ejs<br>templates/tag.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.hero.tagCount` | number | 8 | scripts/build/pages.js<br>scripts/lib/test-payloads.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.prefetchNextPage` | bool | false | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.preloadFeaturedImage` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.preloadFonts` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.resourceHints` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.postsPerPage` | number | 10 | scripts/build/config.js<br>scripts/build/feeds.js<br>scripts/build/pages.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.pwa.enabled` | bool | true | js/core/runtime.js<br>js/core/boot.js<br>js/core/main.js | scripts/config-coverage-features-b.test.js<br>scripts/config-split.test.js | 既有引用 |
| `site.reward.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.rss.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-features-b.test.js<br>scripts/h2-dataflow.test.js | 既有引用 |
| `site.rss.fullContent` | bool | true | scripts/build/feeds.js<br>scripts/lib/feed-options.js | scripts/build.test.js | 已测（marker） |
| `site.rss.injectHeadLinks` | bool | true | templates/layout.ejs | scripts/config-wiring.test.js | 既有引用 |
| `site.rss.jsonFeed.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-features-b.test.js<br>scripts/h2-dataflow.test.js | 既有引用 |
| `site.rss.jsonFeed.fullContent` | bool | false | scripts/build/feeds.js<br>scripts/lib/feed-options.js | scripts/build.test.js | 已测（marker） |
| `site.rss.jsonFeed.maxItems` | number | 20 | scripts/build/feeds.js<br>scripts/lib/feed-options.js<br>js/domains/features/contact-popup.js | scripts/build.test.js | 已测（marker） |
| `site.rss.maxItems` | number | 50 | scripts/build/feeds.js<br>scripts/lib/feed-options.js<br>js/domains/features/contact-popup.js | scripts/build.test.js | 已测（marker） |
| `site.seo.articleTimes` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.seo.canonicalURL` | bool | false | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.seo.ogImageAlt` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.seo.structuredData.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `site.seo.twitterLabels` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.showRepoLink` | bool | true | templates/layout.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.sitemap.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-features-b.test.js<br>scripts/config-coverage-nonfeatures.test.js | 既有引用 |
| `site.sitemap.priority` | number | 0.8 | scripts/build/feeds.js<br>scripts/perf-audit.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.social.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/malicious.test.js | 既有引用 |
| `site.webAnalytics.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `tagAliases.enabled` | bool | true | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `theme.animation.enable` | bool | true | js/domains/features/bilingual.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.avatar.badge` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.avatar.ring` | bool | false | js/domains/core/reading.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.button.hoverScale` | number | 1.02 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.excerptLength` | number | 150 | scripts/build/articles.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.readTimeSpeed` | number | 265 | scripts/build/articles.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showCategories` | bool | true | templates/index.ejs<br>templates/tag.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showDate` | bool | true | templates/category.ejs<br>templates/index.ejs<br>templates/series-page.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showExcerpt` | bool | true | templates/category.ejs<br>templates/index.ejs<br>templates/series-page.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showReadTime` | bool | true | templates/category.ejs<br>templates/index.ejs<br>templates/series-page.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showTags` | bool | true | templates/index.ejs<br>templates/tag.ejs<br>scripts/build/pages.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showWordCount` | bool | true | templates/category.ejs<br>templates/index.ejs<br>templates/series-page.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.contentOffset` | number | 0 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.darkMode.enabled` | bool | false | js/core/boot.js<br>js/core/main.js<br>js/core/runtime.js | scripts/h2-dataflow.test.js<br>scripts/theme-override.test.js | 既有引用 |
| `theme.darkMode.toggle` | bool | true | js/core/soft-nav.js<br>js/domains/core/code-block.js<br>js/domains/core/nav-state.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `theme.fontSystem.numbersMono` | bool | true | scripts/build/config.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.fontSystem.scale` | number | 1 | scripts/build/config.js<br>js/domains/features/lightbox-core.js<br>js/domains/features/lightbox.js | scripts/config-coverage-nonfeatures.test.js | 已测（marker） |
| `theme.headerContentGap` | number | 0 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.headingFontWeight` | number | 700 | templates/site-css.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.lineHeight` | number | 1.8 | templates/site-css.ejs<br>scripts/generate-og.js<br>scripts/lib/auto-cover.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.card.bentoFeatured` | bool | true | templates/index.ejs | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.header.scrollShrink` | bool | true | js/domains/core/navigation.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.damping` | number | 30 | js/domains/features/morphicons.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.reducedDamping` | number | 55 | js/domains/features/morphicons.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.reducedStiffness` | number | 900 | js/domains/features/morphicons.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.stiffness` | number | 420 | js/domains/features/morphicons.js | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.search.indexRetry` | number | 1 | scripts/lib/feature-wiring.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | scripts/config-wiring.test.js | 已测（marker） |
| `tuning.search.indexTimeoutMs` | number | 5000 | scripts/lib/feature-wiring.js<br>js/domains/features/search-page.js<br>js/domains/features/search.js | scripts/config-wiring.test.js | 已测（marker） |
