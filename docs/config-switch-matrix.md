# 配置开关矩阵（行为开关 → 消费位置 → 覆盖证据）

> 本文件由 `node scripts/gen-config-switch-matrix.js` 生成，禁止手改；
> 键全集来自 `features-schema.js` / `tuning-defaults.js` / `site-defaults.js`（site/navigation/sidebar/footer/theme/security/friends/tagAliases/contentPolicy 全段）/ `internals-defaults.js` 注册表；
> `guard.json5` 细节键由 `guard-defaults.js` 与 guard 测试覆盖，不在本矩阵。
> 覆盖证据优先级：测试内 `// switch: <键路径>` 标记 > 既有测试键名引用 > `scripts/config-switch-exemptions.json` 豁免理由。
> 消费位置按「叶子键名 + 父段」评分定位首个源码引用，供人工复核；存在同名字段的模块以类型与默认值判别。
> 回退字面量必须与注册表默认一致，由 `scripts/config-fallback-bindings.json` + `verify:config-single-source` 锁定。

统计：开关共 819（已测 164，既有引用 291，豁免 364，缺失 0）；缺失必须为 0 才能通过 `verify:config-single-source`。

| 键路径 | 类型 | 默认 | 消费位置 | 测试证据 | 覆盖状态 |
| --- | --- | --- | --- | --- | --- |
| `contentPolicy.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `contentPolicy.svgSanitize` | bool | true | scripts/build/media.js:95<br>scripts/lib/content-policy.js:37<br>scripts/lib/content-policy.js:63 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.analytics.emitBeacon` | bool | true | scripts/lib/feature-wiring.js:1379<br>scripts/lib/feature-wiring.js:1389<br>scripts/lib/feature-wiring.js:1396 | scripts/config-wiring.test.js:886 | 已测（marker） |
| `features.analytics.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:886 | 已测（marker） |
| `features.analytics.injectAt` | enum | `body` | scripts/build/pages.js:376<br>scripts/build/pages.js:287<br>scripts/lib/feature-wiring.js:1379 | scripts/config-wiring.test.js:886 | 已测（marker） |
| `features.anchorStabilize.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.anchorStabilize.maxTrackMs` | number | 8000 | js/domains/core/anchor-stabilize.js:4<br>js/domains/core/anchor-stabilize.js:20<br>js/domains/core/anchor-stabilize.js:21 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.anchorStabilize.settleMs` | number | 300 | js/domains/core/anchor-stabilize.js:3<br>js/domains/core/anchor-stabilize.js:19<br>js/domains/core/anchor-stabilize.js:52 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.dismissible` | bool | true | templates/layout.ejs:24<br>templates/layout.ejs:100 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.announcement.newTab` | bool | true | js/domains/core/external-link.js:14<br>js/domains/core/external-link.js:22<br>js/domains/features/popup-notice.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.pauseOnHover` | bool | true | js/domains/core/announcement.js:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.removeDelayMs` | number | 340 | js/core/runtime.js:12<br>js/domains/core/announcement.js:45<br>js/domains/features/continue-reading.js:102 | scripts/config-wiring.test.js:1303<br>scripts/config-wiring.test.js:1050 | 既有引用 |
| `features.announcement.rotateMs` | number | 6000 | templates/layout.ejs:100 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.showDot` | bool | true | templates/layout.ejs:100<br>templates/site-css.ejs:250 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.showProgress` | bool | false | js/domains/features/continue-reading.js:108<br>js/domains/features/continue-reading.js:167<br>js/domains/features/continue-reading.js:171 | scripts/config-wiring.test.js:1303<br>scripts/config-wiring.test.js:1305 | 既有引用 |
| `features.announcement.tone` | enum | `accent` | templates/layout.ejs:100 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.transition` | enum | `fade` | templates/site-css.ejs:15<br>templates/site-css.ejs:37<br>templates/site-css.ejs:43 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.transitionMs` | number | 450 | templates/site-css.ejs:508<br>scripts/lib/feature-wiring.js:1186 | scripts/config-wiring.test.js:1170 | 已测（marker） |
| `features.atmosphere.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.atmosphere.glow` | bool | true | templates/site-css.ejs:423<br>templates/site-css.ejs:646 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.atmosphere.grain` | bool | true | templates/site-css.ejs:399 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.authorCard.maxTimeline` | number | 20 | templates/page.ejs:19 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.showSkills` | bool | true | templates/page.ejs:18 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.showSocial` | bool | true | templates/page.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.showTimeline` | bool | true | templates/page.ejs:19 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.autoSummary.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.autoSummary.maxLength` | number | 160 | js/domains/features/daily-quote.js:37<br>js/domains/features/daily-quote.js:47<br>js/domains/features/search-core.js:327 | scripts/daily-quote.test.js:122<br>scripts/daily-quote.test.js:145 | 既有引用 |
| `features.autoSummary.stripMarkdown` | bool | true | scripts/build/articles.js:216<br>scripts/lib/feature-wiring.js:133<br>scripts/build/articles.js:219 | scripts/config-wiring.test.js:58 | 既有引用 |
| `features.background.particles.autoDisableMobile` | bool | false | js/domains/features/background.js:12 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.count` | number | 72 | js/domains/features/search.js:282<br>js/domains/features/background.js:17<br>js/domains/features/continue-reading.js:36 | scripts/config-wiring.test.js:1303<br>scripts/build-report-html.test.js:62 | 既有引用 |
| `features.background.particles.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:43 | 既有引用 |
| `features.background.particles.linkDistance` | number | 120 | js/domains/features/background.js:17 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.mobileMaxWidth` | number | 640 | js/domains/features/background.js:12 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.opacity` | number | 0.7 | templates/404.ejs:11<br>templates/site-css.ejs:1<br>templates/site-css.ejs:3 | scripts/critical-css.test.js:61<br>scripts/critical-css.test.js:62 | 既有引用 |
| `features.background.particles.showLines` | bool | true | js/domains/features/background.js:38 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.speed` | number | 0.5 | js/domains/features/background.js:17 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.backToTop.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.backToTop.htmlAnchorFallback` | bool | false | templates/layout.ejs:223<br>templates/layout.ejs:224<br>scripts/lib/feature-wiring.js:680 | scripts/config-wiring.test.js:716 | 已测（marker） |
| `features.backToTop.scrollDurationMs` | number | 450 | js/domains/core/reading.js:19<br>scripts/lib/feature-wiring.js:684<br>js/domains/core/reading.js:33 | scripts/config-wiring.test.js:716 | 已测（marker） |
| `features.backToTop.showAfterPx` | number | 400 | js/domains/core/reading.js:93 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.backToTop.smoothScroll` | bool | true | js/domains/core/reading.js:20<br>js/domains/core/reading.js:36<br>scripts/lib/feature-wiring.js:679 | scripts/config-wiring.test.js:716 | 已测（marker） |
| `features.backToTop.zIndex` | number | 999 | templates/site-css.ejs:234<br>templates/site-css.ejs:510<br>js/domains/guard/defaults.js:145 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.bilingual.breakpointPx` | number | 1280 | templates/post.ejs:11<br>templates/site-css.ejs:256<br>templates/site-css.ejs:273 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.fetchTimeoutMs` | number | 10000 | scripts/lib/feature-wiring.js:1104<br>js/domains/features/bilingual-core.js:11<br>js/domains/features/bilingual-core.js:20 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.resizeDebounceMs` | number | 120 | scripts/lib/feature-wiring.js:1105<br>js/domains/features/bilingual-core.js:11<br>js/domains/features/bilingual-core.js:21 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.sideBySide` | bool | true | templates/post.ejs:88<br>templates/post.ejs:11<br>templates/post.ejs:22 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.switch` | bool | true | templates/post.ejs:11<br>js/domains/features/bilingual-core.js:10<br>js/domains/features/bilingual-core.js:25 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.boot.budgetMs` | number | 40 | js/core/boot.js:167<br>js/core/boot.js:168 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.configTimeoutMs` | number | 3000 | js/core/runtime.js:14<br>templates/layout.ejs:97 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/boot.test.js:15<br>scripts/boot.test.js:21 | 既有引用 |
| `features.boot.heavyMode` | enum | `idle` | js/core/boot.js:169<br>js/core/boot.js:186<br>js/core/boot.js:187 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.idleFallbackMs` | number | 120 | js/core/boot.js:21<br>templates/layout.ejs:234 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.idleTimeoutMs` | number | 800 | js/domains/features/morphicons.js:189<br>js/core/boot.js:177<br>js/core/boot.js:187 | scripts/config-wiring.test.js:1257<br>scripts/config-wiring.test.js:1016 | 既有引用 |
| `features.boot.interactionWake` | bool | true | js/core/boot.js:143 | scripts/boot.test.js:21 | 既有引用 |
| `features.boot.log` | bool | false | js/core/boot.js:10<br>js/core/boot.js:175<br>js/core/boot.js:98 | scripts/cjk-fonts.test.js:26<br>scripts/cjk-fonts.test.js:272 | 既有引用 |
| `features.breadcrumb.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.breadcrumb.showCurrent` | bool | true | js/domains/core/toc.js:25<br>templates/layout.ejs:66<br>templates/layout.ejs:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.breadcrumb.showHome` | bool | true | templates/layout.ejs:62 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.categoryChip` | bool | true | templates/index.ejs:42<br>templates/tag.ejs:17 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.coverOverlay` | bool | true | templates/index.ejs:41<br>templates/tag.ejs:16<br>scripts/generate-og.js:232 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.cardFx.hoverShine` | bool | true | templates/index.ejs:36<br>templates/tag.ejs:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.readTimeBadge` | bool | true | templates/index.ejs:43<br>templates/tag.ejs:18 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.blobRevokeDelayMs` | number | 1000 | js/domains/core/code-block.js:45 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.copyAllButton` | bool | false | js/domains/core/code-block.js:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.copyButtonVisibility` | enum | `hover` | js/domains/core/code-block.js:11 | scripts/lib/config.fuzz.test.js:165<br>scripts/lib/config.fuzz.test.js:168 | 既有引用 |
| `features.codeBlock.downloadButton` | bool | true | js/domains/core/code-block.js:30<br>js/domains/core/code-block.js:38<br>js/domains/features/lightbox.js:46 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.codeBlock.lineNumbers` | bool | true | scripts/build/markdown.js:26<br>scripts/build/markdown.js:234 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.prismBatchMs` | number | 8 | templates/layout.ejs:242 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.prismIdleFallbackMs` | number | 60 | templates/layout.ejs:242 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.prismIdleTimeoutMs` | number | 300 | templates/layout.ejs:242 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.scrollHintTolerancePx` | number | 8 | scripts/lib/feature-wiring.js:1180<br>scripts/lib/feature-wiring.js:1178<br>js/domains/core/code-block.js:67 | scripts/config-wiring.test.js:1170 | 已测（marker） |
| `features.codeBlock.showLanguageTag` | bool | true | js/domains/core/code-block.js:28<br>js/domains/core/code-block.js:32 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.windowBar` | bool | true | js/domains/core/code-block.js:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.wrapLongLines` | bool | false | scripts/build/markdown.js:240<br>scripts/build/markdown.js:235 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeCopy.buttonTimeout` | number | 1500 | js/domains/core/code-block.js:11<br>templates/layout.ejs:235 | scripts/config-wiring.test.js:1360<br>scripts/config-wiring.test.js:1358 | 既有引用 |
| `features.codeCopy.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.codeCopy.showLineNumbers` | bool | false | scripts/build/markdown.js:26<br>scripts/build/markdown.js:239 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.autoFocus` | bool | true | js/domains/features/command-palette.js:183<br>scripts/lib/feature-wiring.js:1247 | scripts/config-wiring.test.js:1333 | 已测（marker） |
| `features.commandPalette.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.commandPalette.includeActions` | bool | true | js/domains/features/command-palette.js:55 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.includeNavigation` | bool | true | js/domains/features/command-palette.js:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.includeSearch` | bool | true | js/domains/features/command-palette.js:73<br>js/domains/features/command-palette.js:146 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.maxResults` | number | 10 | scripts/lib/feature-wiring.js:1246<br>js/domains/features/command-palette.js:26<br>js/domains/features/command-palette.js:153 | scripts/config-wiring.test.js:1333 | 已测（marker） |
| `features.comments.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.comments.loadContainer` | bool | true | templates/post.ejs:161 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.comments.loadDelayMs` | number | 300 | js/domains/features/comments.js:8 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.comments.renderPlaceholder` | bool | true | templates/post.ejs:204 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.contactPopup.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:835 | 已测（marker） |
| `features.contactPopup.maxItems` | number | 4 | js/domains/features/contact-popup.js:8<br>js/domains/features/reading-history.js:6<br>js/domains/features/reading-history.js:5 | scripts/build.test.js:721<br>scripts/build.test.js:724 | 既有引用 |
| `features.contactPopup.showAllItems` | bool | true | js/domains/features/contact-popup.js:8<br>js/domains/features/contact-popup.js:2<br>scripts/lib/feature-wiring.js:903 | scripts/config-wiring.test.js:835 | 已测（marker） |
| `features.contactPopup.showIcon` | bool | true | templates/layout.ejs:164 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.continueReading.clearConfirmMs` | number | 3000 | scripts/lib/feature-wiring.js:1020<br>js/domains/features/continue-reading.js:104<br>js/domains/features/continue-reading.js:105 | scripts/config-wiring.test.js:1303 | 已测（marker） |
| `features.continueReading.count` | number | 3 | js/domains/features/search.js:282<br>js/domains/features/background.js:17<br>js/domains/features/continue-reading.js:36 | scripts/config-wiring.test.js:1303 | 已测（marker） |
| `features.continueReading.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.continueReading.removeDelayMs` | number | 360 | scripts/lib/feature-wiring.js:1019<br>js/core/runtime.js:12<br>js/domains/core/announcement.js:45 | scripts/config-wiring.test.js:1303 | 已测（marker） |
| `features.continueReading.showProgress` | bool | true | scripts/lib/feature-wiring.js:1002<br>js/domains/features/continue-reading.js:108<br>js/domains/features/continue-reading.js:167 | scripts/config-wiring.test.js:1303 | 已测（marker） |
| `features.cover.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:144 | 已测（marker） |
| `features.cover.preferImage` | bool | true | js/domains/features/cover.js:28<br>scripts/build/pages.js:331<br>templates/post.ejs:52 | scripts/config-wiring.test.js:144 | 已测（marker） |
| `features.cover.preview` | bool | true | scripts/build.js:198<br>scripts/build/context.js:149 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.customCSS.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.dailyQuote.api.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/build-smoke.test.js:230<br>scripts/auto-cover.test.js:22 | 既有引用 |
| `features.dailyQuote.api.maxLength` | number | 0 | js/domains/features/daily-quote.js:37<br>js/domains/features/daily-quote.js:47<br>js/domains/features/search-core.js:327 | scripts/daily-quote.test.js:122<br>scripts/daily-quote.test.js:145 | 既有引用 |
| `features.dailyQuote.api.minIntervalMs` | number | 1000 | js/domains/features/daily-quote.js:194<br>js/domains/features/daily-quote.js:65<br>js/domains/features/daily-quote.js:72 | scripts/daily-quote.test.js:187<br>scripts/daily-quote.test.js:196 | 既有引用 |
| `features.dailyQuote.api.timeoutMs` | number | 5000 | js/domains/features/daily-quote.js:138<br>js/core/boot.js:18<br>js/core/boot.js:20 | scripts/cjk-fonts.test.js:159<br>scripts/cjk-fonts.test.js:165 | 既有引用 |
| `features.dailyQuote.count` | number | 0 | js/domains/features/search.js:282<br>js/domains/features/background.js:17<br>js/domains/features/continue-reading.js:36 | scripts/config-wiring.test.js:1303<br>scripts/build-report-html.test.js:62 | 既有引用 |
| `features.dailyQuote.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/build-smoke.test.js:230<br>scripts/auto-cover.test.js:22 | 既有引用 |
| `features.dailyQuote.widgetStyle` | enum | `card` | scripts/lib/feature-wiring.js:92<br>js/domains/features/daily-quote.js:317 | scripts/config-wiring.test.js:129<br>scripts/config-wiring.test.js:182 | 已测（marker） |
| `features.darkImageFilter.applyImages` | bool | true | templates/site-css.ejs:116 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.darkImageFilter.applyVideos` | bool | true | templates/site-css.ejs:116 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.darkImageFilter.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.debug.dumpConfig` | bool | false | scripts/lib/feature-wiring.js:1441<br>scripts/build.js:163<br>scripts/lib/feature-wiring.js:1437 | scripts/config-wiring.test.js:974 | 已测（marker） |
| `features.debug.listPages` | bool | false | scripts/build.js:463<br>scripts/build.js:464<br>scripts/lib/feature-wiring.js:1436 | scripts/config-wiring.test.js:974 | 已测（marker） |
| `features.debug.verbose` | bool | false | scripts/build/pages.js:599<br>scripts/build.js:161<br>scripts/build/pages.js:630 | scripts/config-wiring.test.js:974 | 已测（marker） |
| `features.errorPage.suggestCount` | number | 5 | scripts/lib/feature-wiring.js:1195<br>templates/404.ejs:2<br>scripts/lib/feature-wiring.js:1202 | scripts/config-wiring.test.js:1170 | 已测（marker） |
| `features.exportArticle.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/export-article.test.js:69 | 已测（marker） |
| `features.exportArticle.markdown` | bool | true | scripts/build/pages.js:768<br>scripts/lib/md-export.js:2<br>scripts/lib/md-export.js:3 | scripts/export-article.test.js:69 | 已测（marker） |
| `features.exportArticle.print` | bool | true | js/domains/features/export-article.js:1<br>scripts/build/pages.js:381<br>templates/post.ejs:80 | scripts/export-article.test.js:69 | 已测（marker） |
| `features.exportArticle.sourceFootnote` | bool | true | templates/post.ejs:85<br>scripts/lib/feature-wiring.js:1031<br>scripts/lib/feature-wiring.js:1046 | scripts/export-article.test.js:69 | 已测（marker） |
| `features.exportBackup.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.exportBackup.includeConfig` | bool | true | scripts/export.js:120<br>scripts/export.js:164 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.exportBackup.includeMedia` | bool | true | scripts/export.js:119<br>scripts/export.js:160 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.externalLink.copyFeedbackMs` | number | 1500 | js/domains/core/external-link.js:19<br>scripts/lib/feature-wiring.js:972<br>js/domains/core/external-link.js:20 | scripts/config-wiring.test.js:1257 | 已测（marker） |
| `features.externalLink.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.externalLink.mode` | enum | `warn` | js/core/soft-nav.js:152<br>js/core/soft-nav.js:170<br>js/core/soft-nav.js:171 | scripts/build-errors.test.js:42<br>scripts/build-errors.test.js:54 | 既有引用 |
| `features.externalLink.openInNewTab` | bool | true | js/domains/core/external-link.js:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.externalLink.showFullUrl` | bool | true | js/domains/core/external-link.js:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.externalLink.whitelistNewTab` | bool | false | js/domains/core/external-link.js:15<br>js/domains/core/external-link.js:17 | scripts/config-wiring.test.js:223 | 既有引用 |
| `features.favorites.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.favorites.listIcon` | bool | true | js/domains/features/favorites.js:62 | scripts/config-wiring.test.js:60 | 既有引用 |
| `features.gallery.collectFeatured` | bool | true | scripts/build/collectors.js:81<br>scripts/build/pages.js:320<br>scripts/build/pages.js:743 | scripts/config-wiring.test.js:481 | 已测（marker） |
| `features.gallery.columns` | number | 4 | templates/site-css.ejs:247<br>scripts/build/config.js:222<br>scripts/build/config.js:245 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.gallery.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.gallery.maxItems` | number | 0 | js/domains/features/reading-history.js:6<br>js/domains/features/contact-popup.js:8<br>js/domains/features/reading-history.js:5 | scripts/build.test.js:721<br>scripts/build.test.js:724 | 既有引用 |
| `features.gallery.order` | enum | `newest` | templates/post.ejs:221<br>templates/post.ejs:222<br>js/domains/features/search.js:258 | scripts/build.test.js:68<br>scripts/theme-override.test.js:88 | 既有引用 |
| `features.gallery.showCaption` | bool | true | templates/gallery.ejs:16<br>js/domains/features/lightbox.js:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.gallery.showSource` | bool | true | templates/gallery.ejs:18 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.giscus.enabled` | bool | false | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.guards.accessGate` | bool | true | js/domains/guard/access-gate.js:5<br>js/domains/guard/access-gate.js:138<br>js/domains/guard/bypass.js:2 | scripts/guard-bypass.test.js:162 | 既有引用 |
| `features.guards.consoleGuard` | bool | true | js/domains/guard/console-guard.js:3<br>js/domains/guard/console-guard.js:69<br>js/domains/guard/core.js:95 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.contextMenu` | bool | true | scripts/build/config.js:380<br>scripts/lib/feature-wiring.js:1348<br>js/domains/guard/context-menu.js:17 | scripts/config-link-safety.test.js:39<br>scripts/config-link-safety.test.js:91 | 既有引用 |
| `features.guards.copyGuard` | bool | true | js/domains/guard/copy-guard.js:3<br>js/domains/guard/copy-guard.js:25<br>js/domains/guard/copy-guard.js:106 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.devtoolsDetect` | bool | true | js/domains/guard/core.js:94<br>js/domains/guard/defaults.js:151<br>js/domains/guard/devtools-detect.js:3 | scripts/config-wiring.test.js:1474<br>scripts/config-wiring.test.js:1475 | 既有引用 |
| `features.guards.enabled` | bool | true | js/core/main.js:102<br>js/core/main.js:99<br>js/core/runtime.js:18 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.guards.hotkeyGuard` | bool | true | js/domains/guard/core.js:92<br>js/domains/guard/defaults.js:114<br>js/domains/guard/hotkey-guard.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.preset` | enum | `soft` | js/domains/guard/core.js:72<br>templates/layout.ejs:144<br>js/domains/features/theme-lab.js:177 | scripts/build.test.js:610<br>scripts/build.test.js:611 | 既有引用 |
| `features.guards.privacyCurtain` | bool | true | js/domains/guard/core.js:96<br>js/domains/guard/defaults.js:189<br>js/domains/guard/privacy-curtain.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.selectionGuard` | bool | true | js/domains/guard/core.js:91<br>js/domains/guard/defaults.js:104<br>js/domains/guard/selection-guard.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.tamperWatch` | bool | true | js/domains/guard/core.js:97<br>js/domains/guard/defaults.js:201<br>js/domains/guard/tamper-watch.js:5 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.watermark` | bool | true | js/domains/guard/core.js:93<br>js/domains/guard/defaults.js:131<br>js/domains/guard/watermark.js:1 | scripts/config-wiring.test.js:1447<br>scripts/config-wiring.test.js:1448 | 既有引用 |
| `features.heatmap.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.heatmap.levels` | number | 5 | scripts/lib/feature-wiring.js:1373<br>templates/site-css.ejs:249<br>scripts/build/pages.js:365 | scripts/config-wiring.test.js:760<br>scripts/config-wiring.test.js:779 | 已测（marker） |
| `features.heatmap.scaling` | enum | `auto` | scripts/lib/feature-wiring.js:1373<br>scripts/lib/feature-wiring.js:784<br>scripts/lib/feature-wiring.js:777 | scripts/config-wiring.test.js:935 | 已测（marker） |
| `features.heatmap.showLegend` | bool | true | scripts/lib/feature-wiring.js:776<br>templates/archive.ejs:7<br>templates/archive.ejs:33 | scripts/config-wiring.test.js:693 | 既有引用 |
| `features.heatmap.showMonthNumbers` | bool | true | scripts/lib/feature-wiring.js:776<br>templates/archive.ejs:7<br>templates/archive.ejs:33 | scripts/config-wiring.test.js:694 | 既有引用 |
| `features.hero.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.hero.heightVh` | number | 61.8 | templates/site-css.ejs:43 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showCta` | bool | true | scripts/build/pages.js:678<br>templates/index.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showDate` | bool | false | scripts/build/pages.js:682<br>templates/index.ejs:12<br>templates/category.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showSearch` | bool | true | scripts/build/pages.js:676<br>templates/index.ejs:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showTags` | bool | true | scripts/build/pages.js:677<br>templates/index.ejs:17<br>templates/index.ejs:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.tagCount` | number | 8 | scripts/build/pages.js:684<br>scripts/build/pages.js:685<br>scripts/lib/test-payloads.js:147 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hotSearches.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.hotSearches.maxWords` | number | 50 | js/domains/features/search.js:349<br>scripts/lib/feature-wiring.js:978<br>js/domains/features/search.js:350 | scripts/config-wiring.test.js:1257 | 已测（marker） |
| `features.hotSearches.showClear` | bool | true | js/domains/features/search.js:386 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hotSearches.showInDropdown` | bool | true | js/domains/features/search.js:348<br>js/domains/features/search.js:376 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hotSearches.top` | number | 5 | templates/layout.ejs:144<br>templates/layout.ejs:223<br>templates/layout.ejs:224 | scripts/bilingual-core.test.js:73<br>scripts/build-report-html.test.js:62 | 既有引用 |
| `features.hreflang.canonical` | bool | true | js/core/soft-nav.js:123<br>js/domains/features/search.js:240<br>scripts/lib/feature-wiring.js:12 | scripts/config-wiring.test.js:197<br>scripts/config-wiring.test.js:673 | 既有引用 |
| `features.hreflang.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.hreflang.includeSelf` | bool | true | templates/layout.ejs:45 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hreflang.xDefault` | bool | true | templates/layout.ejs:45 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.i18n.enabled` | bool | true | js/domains/core/i18n.js:1<br>js/core/main.js:99<br>js/core/runtime.js:18 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.i18n.navToggle` | bool | true | templates/layout.ejs:139<br>js/domains/core/nav-state.js:56<br>js/domains/core/navigation.js:18 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.i18n.translationNotice` | bool | true | templates/post.ejs:16 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFallback.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.imageFallback.showAlt` | bool | true | js/domains/core/image-lazy.js:173 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.align` | enum | `center` | templates/site-css.ejs:530<br>scripts/generate-og.js:265<br>scripts/generate-og.js:268 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.cap` | number | 1.5 | js/domains/features/popup-notice.js:109<br>scripts/build/pages.js:265<br>templates/site-css.ejs:530 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.maxHeightVh` | number | 0 | templates/site-css.ejs:114<br>templates/site-css.ejs:246<br>js/domains/core/code-block.js:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.upscale` | enum | `never` | scripts/build/pages.js:265<br>templates/site-css.ejs:530<br>templates/site-css.ejs:529 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.cover.applyToCards` | bool | true | templates/site-css.ejs:532 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.cover.fit` | enum | `cover` | templates/layout.ejs:227<br>scripts/generate-og.js:575<br>templates/site-css.ejs:529 | scripts/mermaid-render.test.js:105 | 既有引用 |
| `features.imageFit.cover.maxHeightVh` | number | 0 | templates/site-css.ejs:246<br>templates/site-css.ejs:529<br>templates/site-css.ejs:114 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.imageFit.gallery.maxHeightPx` | number | 0 | templates/site-css.ejs:529 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.gallery.stretch` | bool | false | templates/site-css.ejs:533<br>templates/site-css.ejs:59 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.lightbox.fit` | enum | `contain` | templates/layout.ejs:227<br>scripts/build/assets.js:157<br>scripts/generate-og.js:575 | scripts/mermaid-render.test.js:105 | 既有引用 |
| `features.imageFit.lightbox.maxHeightVh` | number | 82 | templates/site-css.ejs:246<br>templates/site-css.ejs:114<br>js/domains/core/code-block.js:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.lightbox.maxWidthPct` | number | 92 | scripts/lib/feature-wiring.js:664<br>templates/site-css.ejs:245<br>templates/site-css.ejs:246 | scripts/config-wiring.test.js:707<br>scripts/config-wiring.test.js:708 | 既有引用 |
| `features.imageLazy.eagerFirst` | number | 1 | templates/index.ejs:34<br>js/domains/core/image-lazy.js:138 | scripts/config-wiring.test.js:1053<br>scripts/config-wiring.test.js:1118 | 既有引用 |
| `features.imageLazy.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.imageLazy.fadeIn` | bool | true | js/domains/core/image-lazy.js:136<br>templates/site-css.ejs:65<br>templates/site-css.ejs:300 | scripts/critical-css.test.js:61<br>scripts/critical-css.test.js:64 | 既有引用 |
| `features.imageLazy.fadeInDurationMs` | number | 300 | templates/site-css.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageLazy.lqip` | bool | true | scripts/build/media.js:198<br>js/domains/core/image-lazy.js:141<br>scripts/build/markdown.js:169 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageLazy.lqipWidth` | number | 24 | scripts/build/media.js:200 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageLazy.preserveAspectRatio` | bool | true | scripts/build/pages.js:30<br>scripts/build/pages.js:52<br>scripts/build/markdown.js:5 | scripts/config-wiring.test.js:481<br>scripts/config-wiring.test.js:535 | 已测（marker） |
| `features.incrementalBuild.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/incremental-build.test.js:78<br>scripts/incremental-build.test.js:97 | 已测（marker） |
| `features.incrementalBuild.skipUnchanged` | bool | true | scripts/lib/incremental.js:94<br>scripts/lib/incremental.js:109 | scripts/incremental-build.test.js:78 | 已测（marker） |
| `features.incrementalBuild.watch` | bool | true | scripts/build.js:169<br>js/domains/features/morphicons.js:81<br>js/domains/features/morphicons.js:125 | scripts/incremental-build.test.js:78 | 已测（marker） |
| `features.lcpOptimize.asyncCjkFontCss` | bool | false | templates/layout.ejs:93 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.contentVisibility` | bool | false | templates/site-css.ejs:175 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.offscreenSkip.asideEstimatePx` | number | 900 | templates/site-css.ejs:176 | scripts/config-wiring.test.js:43 | 既有引用 |
| `features.lcpOptimize.offscreenSkip.cardEstimatePx` | number | 480 | templates/site-css.ejs:176 | scripts/config-wiring.test.js:42 | 既有引用 |
| `features.lcpOptimize.offscreenSkip.cardsFrom` | number | 4 | templates/site-css.ejs:176 | scripts/config-wiring.test.js:41<br>scripts/config-wiring.test.js:40 | 既有引用 |
| `features.lcpOptimize.offscreenSkip.enabled` | bool | false | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.lcpOptimize.preloadFirstCard` | bool | false | templates/layout.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.revealExemptFirstPaint` | bool | false | templates/site-css.ejs:15<br>templates/site-css.ejs:319 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.skipLatinFontPreloadOnCjk` | bool | false | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.captionMaxLines` | number | 2 | templates/site-css.ejs:246 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.clickTolerancePx` | number | 6 | scripts/lib/feature-wiring.js:944<br>js/domains/features/lightbox.js:33 | scripts/config-wiring.test.js:1228 | 已测（marker） |
| `features.lightbox.closeButton` | bool | true | js/domains/features/lightbox.js:44<br>js/domains/features/popup-notice.js:38<br>js/domains/features/popup-notice.js:127 | scripts/popup-notice-config.test.js:18<br>scripts/popup-notice-config.test.js:61 | 既有引用 |
| `features.lightbox.closeOnBackdrop` | bool | true | js/domains/features/lightbox.js:35<br>js/domains/features/popup-notice.js:145<br>scripts/lib/popup-notice-config.js:26 | scripts/popup-notice-config.test.js:19<br>scripts/popup-notice-config.test.js:61 | 既有引用 |
| `features.lightbox.dblClickZoom` | bool | true | js/domains/features/lightbox.js:34 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.dblClickZoomLevel` | number | 2 | scripts/lib/feature-wiring.js:943<br>js/domains/features/lightbox.js:32<br>scripts/lib/feature-wiring.js:938 | scripts/config-wiring.test.js:1228 | 已测（marker） |
| `features.lightbox.downloadButton` | bool | true | js/domains/core/code-block.js:30<br>js/domains/core/code-block.js:38<br>js/domains/features/lightbox.js:46 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.lightbox.escToClose` | bool | true | js/domains/features/lightbox-core.js:140<br>js/domains/features/lightbox.js:35<br>js/domains/features/popup-notice.js:77 | scripts/popup-notice-config.test.js:19<br>scripts/popup-notice-config.test.js:61 | 既有引用 |
| `features.lightbox.keyboardNavigate` | bool | true | js/domains/features/lightbox-core.js:141<br>js/domains/features/lightbox.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.minSize` | number | 60 | js/domains/features/lightbox.js:66 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.mouseSwipeThresholdPx` | number | 80 | scripts/lib/feature-wiring.js:942<br>js/domains/features/lightbox.js:28 | scripts/config-wiring.test.js:1228 | 已测（marker） |
| `features.lightbox.openDurationMs` | number | 180 | js/domains/features/lightbox.js:13<br>js/domains/features/lightbox.js:17<br>scripts/lib/feature-wiring.js:665 | scripts/config-wiring.test.js:700 | 已测（marker） |
| `features.lightbox.panEnabled` | bool | true | js/domains/features/lightbox.js:25 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.pinchEnabled` | bool | true | js/domains/features/lightbox.js:25 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.preloadAdjacent` | bool | true | js/domains/features/lightbox.js:68 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.prevNextButtons` | bool | true | js/domains/features/lightbox.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.rememberPosition` | bool | false | js/domains/core/read-position.js:3<br>js/domains/features/lightbox.js:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.rotateEnabled` | bool | true | js/domains/features/lightbox.js:25 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.showCaption` | bool | true | templates/gallery.ejs:16<br>js/domains/features/lightbox.js:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.showCounter` | bool | true | js/domains/features/lightbox.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.showZoomButtons` | bool | true | js/domains/features/lightbox.js:34 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.slideshow.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/lightbox-core.test.js:42 | 已测（marker） |
| `features.lightbox.slideshow.intervalMs` | number | 4000 | js/domains/features/lightbox.js:97<br>js/domains/features/lightbox-core.js:28<br>js/domains/features/lightbox-core.js:33 | scripts/lightbox-core.test.js:42 | 已测（marker） |
| `features.lightbox.swipeClose` | bool | true | js/domains/features/lightbox.js:35<br>js/domains/features/lightbox.js:141 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.swipeCloseThresholdPx` | number | 80 | scripts/lib/feature-wiring.js:941<br>js/domains/features/lightbox.js:28 | scripts/config-wiring.test.js:1228 | 已测（marker） |
| `features.lightbox.swipeThresholdPx` | number | 50 | scripts/lib/feature-wiring.js:940<br>js/domains/features/lightbox.js:28 | scripts/config-wiring.test.js:1228 | 已测（marker） |
| `features.lightbox.swipeToNavigate` | bool | true | js/domains/features/lightbox.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.switchDurationMs` | number | 120 | js/domains/features/lightbox.js:13<br>js/domains/features/lightbox.js:18<br>scripts/lib/feature-wiring.js:665 | scripts/config-wiring.test.js:700 | 已测（marker） |
| `features.lightbox.transitionDurationMs` | number | 220 | templates/site-css.ejs:246<br>scripts/lib/feature-wiring.js:669<br>js/domains/features/lightbox.js:13 | scripts/config-wiring.test.js:700 | 已测（marker） |
| `features.lightbox.wheelZoom` | bool | true | js/domains/features/lightbox.js:34 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.zoom.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/lightbox-core.test.js:18 | 已测（marker） |
| `features.lightbox.zoom.maxScale` | number | 4 | js/domains/features/lightbox-core.js:13<br>js/domains/features/lightbox-core.js:20<br>js/domains/features/lightbox.js:26 | scripts/lightbox-core.test.js:18 | 已测（marker） |
| `features.lightbox.zoomEnabled` | bool | true | js/domains/features/lightbox-core.js:12<br>js/domains/features/lightbox-core.js:18<br>js/domains/features/lightbox.js:22 | scripts/lightbox-core.test.js:23<br>scripts/lightbox-core.test.js:27 | 既有引用 |
| `features.lightbox.zoomMax` | number | 4 | js/domains/features/lightbox-core.js:13<br>js/domains/features/lightbox-core.js:20<br>js/domains/features/lightbox.js:22 | scripts/lightbox-core.test.js:23<br>scripts/lightbox-core.test.js:27 | 既有引用 |
| `features.lightbox.zoomMin` | number | 1 | js/domains/features/lightbox.js:26<br>js/domains/features/lightbox.js:58 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.zoomStep` | number | 0.25 | js/domains/features/lightbox.js:26 | scripts/check-config-docs.test.js:24 | 既有引用 |
| `features.listCover.autoGenerate.backgroundStyle` | enum | `gradient` | scripts/lib/auto-cover.js:237<br>scripts/build/auto-cover.js:51<br>scripts/build/auto-cover.js:72 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.format` | enum | `webp` | scripts/lib/og-format.js:3<br>templates/layout.ejs:31<br>js/domains/features/continue-reading.js:143 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.height` | number | 630 | js/domains/core/code-block.js:6<br>js/domains/core/code-block.js:7<br>js/domains/core/code-block.js:12 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.showCategory` | bool | false | scripts/build/auto-cover.js:53<br>scripts/build/auto-cover.js:74<br>scripts/generate-og.js:278 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.showSiteName` | bool | true | scripts/build/auto-cover.js:52<br>scripts/build/auto-cover.js:73<br>scripts/lib/auto-cover.js:58 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.width` | number | 1200 | js/domains/core/code-block.js:6<br>js/domains/core/code-block.js:7<br>js/domains/core/code-block.js:12 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:137 | 已测（marker） |
| `features.listCover.lazy` | bool | true | templates/index.ejs:40<br>templates/post.ejs:263<br>templates/post.ejs:270 | scripts/build-smoke.test.js:340<br>scripts/build.test.js:239 | 既有引用 |
| `features.listCover.showOnArchive` | bool | true | scripts/build/pages.js:324<br>scripts/lib/feature-wiring.js:97<br>templates/site-css.ejs:391 | scripts/config-wiring.test.js:137 | 已测（marker） |
| `features.listCover.showOnHome` | bool | true | js/domains/features/reading-history.js:98 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.ariaBusy` | bool | true | js/core/boot.js:84<br>js/core/boot.js:123 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.delayMs` | number | 120 | js/core/boot.js:103<br>js/core/boot.js:104<br>js/core/boot.js:105 | scripts/popup-notice-config.test.js:14<br>scripts/popup-notice-config.test.js:29 | 既有引用 |
| `features.loading.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/boot.test.js:15<br>scripts/boot.test.js:21 | 既有引用 |
| `features.loading.fadeMs` | number | 380 | templates/site-css.ejs:510<br>js/core/boot.js:90<br>js/core/boot.js:91 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.failsafeBufferMs` | number | 60 | js/core/boot.js:121 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.maxShowMs` | number | 2000 | templates/site-css.ejs:511<br>js/core/boot.js:119 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.minShowMs` | number | 250 | js/core/boot.js:87 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.reducedMotion` | enum | `skip` | js/domains/core/nav-state.js:4<br>templates/site-css.ejs:301<br>templates/site-css.ejs:306 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.showTitle` | bool | false | templates/layout.ejs:171<br>js/core/boot.js:34 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.spinner` | bool | true | js/core/boot.js:32 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.spinnerStyle` | enum | `orbit` | js/core/boot.js:33<br>js/core/boot.js:45<br>js/core/boot.js:47 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.zIndex` | number | 3000 | templates/site-css.ejs:510<br>templates/site-css.ejs:234<br>js/domains/guard/defaults.js:145 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.dropCap` | bool | true | templates/post.ejs:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.magazine.figureBleed` | bool | true | templates/post.ejs:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.headingNumbers` | bool | false | templates/post.ejs:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.tableHover` | bool | true | templates/post.ejs:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.maintenance.enabled` | bool | false | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.maintenance.retryAfter` | number | 3600 | scripts/build/serve.js:28<br>scripts/generate-security-config.js:170<br>workers/security-worker.js:265 | scripts/config-wiring.test.js:961 | 已测（marker） |
| `features.maintenance.setRetryAfter` | bool | true | scripts/build/serve.js:28<br>scripts/generate-security-config.js:170<br>workers/security-worker.js:265 | scripts/config-wiring.test.js:961 | 已测（marker） |
| `features.maintenance.status` | enum | 503 | js/core/boot.js:28<br>js/core/boot.js:159<br>js/core/runtime.js:12 | scripts/build-report-html.test.js:99<br>scripts/build-smoke.test.js:142 | 既有引用 |
| `features.math.autoDetect` | bool | true | scripts/build/markdown.js:244<br>scripts/build/articles.js:265<br>scripts/build/markdown.js:4 | scripts/config-wiring.test.js:395<br>scripts/config-wiring.test.js:535 | 已测（marker） |
| `features.math.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:395<br>scripts/config-wiring.test.js:580 | 已测（marker） |
| `features.math.mathml` | bool | true | js/domains/core/math-render.js:57<br>scripts/build/markdown.js:4<br>scripts/lib/feature-wiring.js:386 | scripts/config-wiring.test.js:395 | 已测（marker） |
| `features.math.renderRoundParens` | bool | true | js/domains/core/math-render.js:71<br>scripts/build/markdown.js:40<br>scripts/lib/feature-wiring.js:404 | scripts/config-wiring.test.js:395 | 已测（marker） |
| `features.math.renderSquareBrackets` | bool | true | js/domains/core/math-render.js:72<br>scripts/build/markdown.js:40<br>scripts/lib/feature-wiring.js:405 | scripts/config-wiring.test.js:395 | 已测（marker） |
| `features.math.strict` | bool | false | js/domains/core/math-render.js:56<br>js/domains/core/math-render.js:78<br>js/domains/core/math-render.js:100 | scripts/atomic-write.test.js:1<br>scripts/auto-cover.test.js:1 | 既有引用 |
| `features.math.throwOnError` | bool | false | js/domains/core/math-render.js:55<br>js/domains/core/math-render.js:77<br>js/domains/core/math-render.js:99 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mediaAudit.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.mediaAudit.reportDuplicate` | bool | false | scripts/audit-media.js:137<br>scripts/audit-media.js:139 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mediaAudit.reportMissed` | bool | true | scripts/audit-media.js:135<br>scripts/audit-media.js:186 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mediaAudit.reportUnreferenced` | bool | true | scripts/audit-media.js:136<br>scripts/audit-media.js:196 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.autoDetect` | bool | true | scripts/build/mermaid.js:20<br>scripts/lib/feature-wiring.js:528<br>scripts/build/markdown.js:244 | scripts/config-wiring.test.js:449 | 已测（marker） |
| `features.mermaid.clientOptions.class.htmlLabels` | bool | false | scripts/lib/feature-wiring.js:1282<br>scripts/lib/feature-wiring.js:1297<br>scripts/lib/feature-wiring.js:1293 | scripts/config-wiring.test.js:1379<br>scripts/config-wiring.test.js:1375 | 既有引用 |
| `features.mermaid.clientOptions.flowchart.htmlLabels` | bool | false | scripts/lib/feature-wiring.js:1282<br>scripts/lib/feature-wiring.js:1293<br>scripts/lib/feature-wiring.js:1297 | scripts/config-wiring.test.js:1375<br>scripts/config-wiring.test.js:1419 | 既有引用 |
| `features.mermaid.clientOptions.state.htmlLabels` | bool | false | scripts/lib/feature-wiring.js:1282<br>scripts/lib/feature-wiring.js:1298<br>scripts/lib/feature-wiring.js:1293 | scripts/config-wiring.test.js:1380<br>scripts/config-wiring.test.js:1375 | 既有引用 |
| `features.mermaid.copyAfterRender` | bool | false | scripts/lib/mermaid-render.js:241<br>templates/layout.ejs:235<br>scripts/build/mermaid.js:24 | scripts/config-wiring.test.js:449 | 已测（marker） |
| `features.mermaid.darkMode` | bool | true | templates/layout.ejs:238<br>js/domains/core/theme.js:6<br>js/domains/core/theme.js:7 | scripts/auto-cover.test.js:71<br>scripts/build.test.js:615 | 既有引用 |
| `features.mermaid.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:449 | 已测（marker） |
| `features.mermaid.followTheme` | bool | true | templates/layout.ejs:234<br>scripts/build/mermaid.js:22<br>scripts/build/mermaid.js:23 | scripts/config-wiring.test.js:449 | 已测（marker） |
| `features.mermaid.idleFallbackMs` | number | 200 | templates/layout.ejs:234<br>js/core/boot.js:21 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.idleTimeoutMs` | number | 1500 | templates/layout.ejs:234<br>js/domains/features/morphicons.js:189<br>js/core/boot.js:177 | scripts/config-wiring.test.js:1257<br>scripts/config-wiring.test.js:1016 | 既有引用 |
| `features.mermaid.mode` | enum | `build` | js/core/soft-nav.js:152<br>js/core/soft-nav.js:170<br>js/core/soft-nav.js:171 | scripts/build-errors.test.js:42<br>scripts/build-errors.test.js:54 | 既有引用 |
| `features.mermaid.renderTimeoutMs` | number | 10000 | scripts/build/mermaid.js:55<br>scripts/build/mermaid.js:56 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.rerenderIdleFallbackMs` | number | 60 | templates/layout.ejs:238 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.rerenderIdleTimeoutMs` | number | 300 | templates/layout.ejs:238 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.size.fit` | enum | `scroll` | scripts/build/assets.js:157<br>scripts/generate-og.js:575<br>scripts/lib/feature-wiring.js:1280 | scripts/mermaid-render.test.js:105 | 既有引用 |
| `features.mobile.codeScrollHint` | bool | true | js/domains/core/code-block.js:63<br>templates/site-css.ejs:636<br>templates/site-css.ejs:637 | scripts/config-wiring.test.js:827 | 已测（marker） |
| `features.mobile.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:827 | 已测（marker） |
| `features.mobile.safeAreaBottom` | bool | true | templates/site-css.ejs:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobile.searchFullscreen` | bool | true | templates/site-css.ejs:67<br>templates/site-css.ejs:68<br>scripts/lib/feature-wiring.js:888 | scripts/config-wiring.test.js:827 | 已测（marker） |
| `features.mobile.tapHighlight` | bool | false | templates/site-css.ejs:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobile.tocBreakpoint` | number | 900 | templates/site-css.ejs:235<br>templates/site-css.ejs:37 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobile.touchFallback` | bool | true | js/domains/features/touch-fallback.js:1<br>templates/site-css.ejs:634<br>templates/site-css.ejs:635 | scripts/config-wiring.test.js:827 | 已测（marker） |
| `features.mobileBottomNav.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.mobileBottomNav.onlyMobile` | bool | true | templates/layout.ejs:225 | scripts/config-wiring.test.js:53 | 既有引用 |
| `features.mobileToc.autoClose` | bool | true | js/domains/core/toc.js:136 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobileToc.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.mobileToc.lockScroll` | bool | true | js/domains/core/toc.js:130<br>js/domains/core/toc.js:131<br>js/domains/core/toc.js:154 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobileToc.overlayClose` | bool | true | js/domains/core/toc.js:167 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobileToc.position` | enum | `right` | templates/layout.ejs:235<br>templates/post.ejs:47<br>templates/post.ejs:73 | scripts/build-smoke.test.js:509<br>scripts/build.test.js:23 | 既有引用 |
| `features.mobileToc.showCurrent` | bool | true | js/domains/core/toc.js:25<br>templates/layout.ejs:66<br>templates/layout.ejs:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.morphIcons.enabled` | bool | true | js/core/runtime.js:19<br>js/core/main.js:99<br>js/core/runtime.js:18 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.morphIcons.icons.copy` | bool | true | js/domains/core/code-block.js:35<br>js/domains/core/code-block.js:36<br>js/domains/core/code-block.js:59 | scripts/theme-override.test.js:88<br>scripts/theme-override.test.js:93 | 既有引用 |
| `features.morphIcons.icons.favorite` | bool | true | js/domains/features/morphicons.js:124<br>js/domains/features/morphicons.js:164 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.morphIcons.icons.menu` | bool | true | js/domains/features/morphicons.js:146<br>js/domains/features/morphicons.js:166<br>js/domains/guard/context-menu.js:1 | scripts/config-link-safety.test.js:33<br>scripts/config-link-safety.test.js:69 | 既有引用 |
| `features.morphIcons.icons.theme` | bool | true | js/core/runtime.js:19<br>templates/category.ejs:25<br>js/core/main.js:5 | scripts/config-split.test.js:26<br>scripts/build-smoke.test.js:336 | 既有引用 |
| `features.morphIcons.icons.tts` | bool | true | js/core/deferred.js:10<br>js/core/main.js:69<br>js/domains/features/tts.js:109 | scripts/config-wiring.test.js:686<br>scripts/config-wiring.test.js:687 | 既有引用 |
| `features.morphIcons.idleTimeoutMs` | number | 3000 | js/domains/features/morphicons.js:189<br>scripts/lib/feature-wiring.js:984<br>js/core/boot.js:177 | scripts/config-wiring.test.js:1257 | 已测（marker） |
| `features.morphIcons.preload` | enum | `interaction` | templates/layout.ejs:53<br>js/domains/features/lightbox.js:68<br>js/domains/features/lightbox.js:111 | scripts/build-smoke.test.js:301<br>scripts/build-smoke.test.js:350 | 既有引用 |
| `features.morphIcons.reducedMotion` | enum | `light` | js/domains/core/nav-state.js:4<br>templates/site-css.ejs:301<br>templates/site-css.ejs:306 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.morphIcons.spring` | enum | `snappy` | js/domains/features/morphicons.js:46<br>scripts/build/assets.js:99 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.buttonRipple` | bool | true | js/domains/core/motion.js:77 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.cardHoverLift` | bool | true | js/domains/core/motion.js:74 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.cardHoverLiftPx` | number | 4 | js/domains/core/motion.js:13 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.cardHoverScale` | number | 1.02 | js/domains/core/motion.js:16 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.enabled` | bool | true | js/domains/core/nav-state.js:4<br>js/core/main.js:99<br>js/core/runtime.js:18 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.motion.linkUnderline` | bool | true | js/domains/core/motion.js:71 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.reducedMotion` | enum | `light` | js/domains/core/nav-state.js:4<br>templates/site-css.ejs:301<br>templates/site-css.ejs:306 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealBlocks` | bool | false | js/domains/core/motion.js:42 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealCards` | bool | true | js/domains/core/motion.js:39 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealCleanupMs` | number | 1400 | js/domains/core/motion.js:63 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealDelayMs` | number | 0 | js/domains/core/motion.js:30<br>js/domains/guard/defaults.js:196<br>js/domains/guard/privacy-curtain.js:25 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealDurationMs` | number | 250 | js/domains/core/motion.js:20<br>js/domains/core/motion.js:24 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealHeadings` | bool | true | js/domains/core/motion.js:40 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealImages` | bool | true | js/domains/core/motion.js:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealOnce` | bool | true | js/domains/core/motion.js:46 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealStaggerMax` | number | 500 | js/domains/core/motion.js:31<br>js/domains/core/motion.js:33 | scripts/config-wiring.test.js:119 | 已测（marker） |
| `features.motion.revealThreshold` | number | 0.08 | js/domains/core/motion.js:47 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.rippleDurationMs` | number | 500 | js/domains/core/motion.js:19<br>js/domains/core/motion.js:28 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.scrollReveal` | bool | true | js/domains/core/motion.js:37 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImage.autoSize.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/og-size.test.js:55 | 已测（marker） |
| `features.ogImage.autoSize.maxDimension` | number | 2560 | scripts/generate-og.js:419<br>scripts/generate-og.js:425<br>scripts/build.js:262 | scripts/og-size.test.js:63 | 已测（marker） |
| `features.ogImage.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.ogImage.fontScale` | number | 0.75 | scripts/build/config.js:299<br>scripts/generate-og.js:431<br>scripts/generate-og.js:436 | scripts/h2-dataflow.test.js:381 | 既有引用 |
| `features.ogImage.format` | enum | `png` | scripts/lib/og-format.js:3<br>templates/layout.ejs:31<br>js/domains/features/continue-reading.js:143 | scripts/og-format.test.js:8 | 已测（marker） |
| `features.ogImage.gradientForNoCover` | bool | true | scripts/generate-og.js:600 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImage.jpegQuality` | number | 82 | scripts/lib/og-format.js:3<br>scripts/lib/og-format.js:7<br>scripts/lib/og-format.js:15 | scripts/og-format.test.js:24<br>scripts/og-format.test.js:25 | 既有引用 |
| `features.ogImage.overlay.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.ogImage.overlay.wrap` | number | 20 | js/core/runtime.js:12<br>js/domains/features/pwa.js:68<br>js/domains/features/pwa.js:74 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImage.useCover` | bool | true | scripts/generate-og.js:432<br>scripts/generate-og.js:444<br>scripts/generate-og.js:568 | scripts/h2-dataflow.test.js:379<br>scripts/h2-dataflow.test.js:384 | 既有引用 |
| `features.ogImageStyle.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.ogImageStyle.fontSizeBase` | number | 64 | scripts/generate-og.js:598<br>templates/site-css.ejs:1 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImageStyle.maxLines` | number | 4 | scripts/generate-og.js:600<br>scripts/generate-og.js:597<br>scripts/lib/auto-cover.js:159 | scripts/auto-cover.test.js:102<br>scripts/auto-cover.test.js:107 | 既有引用 |
| `features.ogImageStyle.palette` | enum | `theme` | scripts/generate-og.js:417<br>scripts/generate-og.js:600<br>scripts/lib/feature-wiring.js:1373 | scripts/config-wiring.test.js:935<br>scripts/build.test.js:628 | 既有引用 |
| `features.ogImageStyle.showCategory` | bool | true | scripts/build/auto-cover.js:53<br>scripts/build/auto-cover.js:74<br>scripts/generate-og.js:278 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:32 | 既有引用 |
| `features.ogImageStyle.showSite` | bool | true | scripts/generate-og.js:267 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImageStyle.showUrl` | bool | true | scripts/generate-og.js:274 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImageStyle.template` | enum | `aurora` | scripts/generate-og.js:286<br>scripts/generate-og.js:600<br>js/domains/features/bilingual-core.js:61 | scripts/lib/malicious.fuzz.test.js:127<br>scripts/lib/malicious.fuzz.test.js:128 | 既有引用 |
| `features.ogImageStyle.useGradient` | bool | true | scripts/generate-og.js:600<br>templates/site-css.ejs:232<br>scripts/generate-og.js:337 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pagefind.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:154 | 已测（marker） |
| `features.pagefind.integrate` | bool | true | js/domains/features/search.js:62<br>scripts/build/feeds.js:384<br>js/domains/features/search.js:64 | scripts/config-wiring.test.js:154 | 已测（marker） |
| `features.pageTransition.durationMs` | number | 180 | templates/site-css.ejs:301<br>templates/site-css.ejs:306<br>js/core/runtime.js:12 | scripts/config-split.test.js:8 | 既有引用 |
| `features.pageTransition.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.pageTransition.leaveGuardMs` | number | 2500 | js/domains/core/page-transition.js:20 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.outDurationMs` | number | 120 | js/domains/core/page-transition.js:14<br>templates/site-css.ejs:303 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.reducedDurationMs` | number | 70 | js/domains/core/page-transition.js:21 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.reducedMotion` | enum | `light` | templates/site-css.ejs:301<br>js/domains/core/nav-state.js:4<br>templates/site-css.ejs:306 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.type` | enum | `slide` | js/core/runtime.js:12<br>js/core/soft-nav.js:92<br>js/core/soft-nav.js:93 | scripts/config-switch-guards.test.js:35<br>scripts/build.test.js:216 | 既有引用 |
| `features.perfBudget.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.perfBudget.htmlKb` | number | 40 | scripts/build/report.js:152<br>scripts/build/report.js:158<br>scripts/build/report.js:179 | scripts/build.test.js:645 | 已测（marker） |
| `features.perfBudget.htmlRawKb` | number | 50 | scripts/build/report.js:177<br>scripts/build/report.js:179<br>scripts/lib/perf-budget.js:5 | scripts/build.test.js:645 | 已测（marker） |
| `features.perfBudget.inlineConfigKb` | number | 2 | scripts/build.js:28<br>scripts/build.js:34<br>scripts/build.js:50 | scripts/build.test.js:645 | 已测（marker） |
| `features.perfBudget.jsKb` | number | 75 | scripts/build/report.js:179<br>scripts/lib/feature-wiring.js:1418<br>scripts/lib/perf-budget.js:5 | scripts/build.test.js:645 | 已测（marker） |
| `features.perfBudget.requests` | number | 12 | scripts/build/report.js:153<br>scripts/build/report.js:164<br>scripts/build/report.js:179 | scripts/build.test.js:645 | 已测（marker） |
| `features.perfBudget.warnOnly` | bool | true | scripts/build.js:415<br>scripts/lib/feature-wiring.js:1411<br>scripts/lib/perf-budget.js:48 | scripts/build-report-html.test.js:67 | 既有引用 |
| `features.performance.warningBuildMs` | number | 30000 | scripts/lib/feature-wiring.js:1427<br>scripts/lib/feature-wiring.js:1426 | scripts/config-wiring.test.js:949 | 已测（marker） |
| `features.performance.warningHtmlKb` | number | 400 | scripts/lib/feature-wiring.js:1420<br>scripts/lib/feature-wiring.js:1419 | scripts/config-wiring.test.js:949 | 已测（marker） |
| `features.performance.warningImageKb` | number | 300 | scripts/lib/feature-wiring.js:1424<br>scripts/build/report.js:207<br>scripts/lib/feature-wiring.js:1421 | scripts/config-wiring.test.js:949 | 已测（marker） |
| `features.performance.warningJsKb` | number | 80 | scripts/lib/feature-wiring.js:1418<br>scripts/lib/feature-wiring.js:1417 | scripts/config-wiring.test.js:949 | 已测（marker） |
| `features.pinned.badgeStyle` | enum | `pill` | templates/post.ejs:15<br>scripts/lib/feature-wiring.js:28<br>templates/archive.ejs:35 | scripts/config-wiring.test.js:54<br>scripts/config-wiring.test.js:85 | 既有引用 |
| `features.pinned.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.pinned.sortRule` | enum | `pinned-first` | scripts/build/articles.js:342<br>scripts/lib/feature-wiring.js:28<br>scripts/lib/feature-wiring.js:33 | scripts/config-wiring.test.js:55<br>scripts/config-wiring.test.js:85 | 既有引用 |
| `features.popupNotice.closeButton.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.popupNotice.closeIcon` | bool | true | scripts/lib/popup-notice-config.js:25<br>scripts/lib/popup-notice-config.js:81<br>js/domains/features/popup-notice.js:136 | scripts/popup-notice-config.test.js:19<br>scripts/popup-notice-config.test.js:61 | 既有引用 |
| `features.popupNotice.closeOnBackdrop` | bool | true | scripts/lib/popup-notice-config.js:26<br>scripts/lib/popup-notice-config.js:81<br>js/domains/features/lightbox.js:35 | scripts/popup-notice-config.test.js:19<br>scripts/popup-notice-config.test.js:61 | 既有引用 |
| `features.popupNotice.delayMs` | number | 1500 | scripts/lib/popup-notice-config.js:17<br>js/core/boot.js:103<br>js/core/boot.js:104 | scripts/popup-notice-config.test.js:14<br>scripts/popup-notice-config.test.js:29 | 既有引用 |
| `features.popupNotice.enabled` | bool | false | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.popupNotice.escToClose` | bool | true | scripts/lib/popup-notice-config.js:27<br>scripts/lib/popup-notice-config.js:81<br>js/domains/features/lightbox-core.js:140 | scripts/popup-notice-config.test.js:19<br>scripts/popup-notice-config.test.js:61 | 既有引用 |
| `features.popupNotice.qr.enabled` | bool | false | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.popupNotice.removeDelayMs` | number | 240 | js/core/runtime.js:12<br>js/domains/core/announcement.js:45<br>js/domains/features/continue-reading.js:102 | scripts/config-wiring.test.js:1303<br>scripts/config-wiring.test.js:1050 | 既有引用 |
| `features.popupNotice.reshowOnChange` | bool | true | scripts/lib/popup-notice-config.js:22<br>js/domains/features/popup-notice.js:15 | scripts/popup-notice-config.test.js:14 | 既有引用 |
| `features.prevNext.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.prevNext.hideWhenMissing` | bool | false | templates/post.ejs:259 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.labelPosition` | enum | `left` | templates/post.ejs:260 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.scrollToTopOnClick` | bool | true | js/domains/features/prev-next.js:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.showLabels` | bool | true | templates/post.ejs:264<br>templates/post.ejs:271 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.showThumbnail` | bool | false | templates/post.ejs:263<br>templates/post.ejs:270 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.printStyle.avoidBreaks` | bool | true | templates/site-css.ejs:401 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.printStyle.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.printStyle.expandLinks` | bool | true | templates/site-css.ejs:401 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.printStyle.hideInteractive` | bool | true | templates/site-css.ejs:401 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prismTheme.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.pwa.assetCacheFirst` | bool | true | scripts/build/assets.js:244<br>scripts/build/assets.js:249<br>scripts/build/assets.js:259 | scripts/pwa-sw.test.js:66<br>scripts/pwa-sw.test.js:94 | 已测（marker） |
| `features.pwa.enabled` | bool | true | js/core/runtime.js:18<br>js/core/main.js:99<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.pwa.installPrompt` | bool | true | templates/site-css.ejs:506<br>js/domains/features/pwa.js:61<br>js/domains/features/pwa.js:62 | scripts/pwa-sw.test.js:158 | 既有引用 |
| `features.pwa.offlineNotice` | bool | true | js/domains/features/pwa.js:156 | scripts/pwa-sw.test.js:156 | 既有引用 |
| `features.pwa.offlinePage` | bool | true | scripts/build/assets.js:181<br>scripts/build/assets.js:212<br>scripts/build/assets.js:242 | scripts/pwa-sw.test.js:156 | 既有引用 |
| `features.pwa.pageCacheLimit` | number | 24 | scripts/build/assets.js:245<br>scripts/build/assets.js:246<br>scripts/build/assets.js:260 | scripts/pwa-sw.test.js:94 | 已测（marker） |
| `features.pwa.pageNetworkFirst` | bool | true | scripts/build/assets.js:243<br>scripts/build/assets.js:249<br>scripts/build/assets.js:258 | scripts/pwa-sw.test.js:66<br>scripts/pwa-sw.test.js:94 | 已测（marker） |
| `features.pwa.precache` | bool | true | scripts/build/assets.js:213<br>scripts/build/assets.js:214<br>scripts/build/assets.js:231 | scripts/pwa-sw.test.js:94 | 已测（marker） |
| `features.pwa.registerSW` | bool | true | js/domains/features/pwa.js:133 | scripts/pwa-sw.test.js:156 | 既有引用 |
| `features.pwa.reloadFallbackMs` | number | 3000 | js/domains/features/pwa.js:49<br>scripts/lib/feature-wiring.js:1189<br>scripts/lib/feature-wiring.js:1192 | scripts/config-wiring.test.js:1170 | 已测（marker） |
| `features.pwa.updateCheckIntervalMs` | number | 1800000 | js/domains/features/pwa.js:150 | scripts/pwa-sw.test.js:149<br>scripts/pwa-sw.test.js:158 | 既有引用 |
| `features.pwa.updatePrompt` | bool | true | templates/site-css.ejs:507<br>js/domains/features/pwa.js:136 | scripts/pwa-sw.test.js:156 | 既有引用 |
| `features.pwa.updateToastMs` | number | 0 | js/domains/features/pwa.js:42 | scripts/pwa-sw.test.js:159 | 既有引用 |
| `features.readDock.directionDeltaPx` | number | 12 | scripts/lib/feature-wiring.js:965<br>js/domains/core/reading.js:104<br>js/domains/core/reading.js:105 | scripts/config-wiring.test.js:1250 | 已测（marker） |
| `features.readDock.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.readDock.hideBelowPx` | number | 80 | scripts/lib/feature-wiring.js:964<br>js/domains/core/reading.js:104<br>js/domains/core/reading.js:105 | scripts/config-wiring.test.js:1250 | 已测（marker） |
| `features.readDock.hideOnScrollDown` | bool | true | js/domains/core/reading.js:109 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readDock.showProgressRing` | bool | true | js/domains/core/reading.js:174<br>js/domains/core/reading.js:179 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readDock.showTocButton` | bool | true | js/domains/core/reading.js:174<br>js/domains/core/reading.js:180 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readDock.showTopButton` | bool | true | js/domains/core/reading.js:174<br>js/domains/core/reading.js:181 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingHistory.clearable` | bool | true | js/domains/features/reading-history.js:108 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingHistory.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.readingHistory.maxItems` | number | 5 | js/domains/features/reading-history.js:6<br>js/domains/features/contact-popup.js:8<br>js/domains/features/reading-history.js:5 | scripts/build.test.js:721<br>scripts/build.test.js:724 | 既有引用 |
| `features.readingHistory.maxStored` | number | 50 | js/domains/features/continue-reading.js:99<br>js/domains/features/reading-history.js:6<br>scripts/lib/feature-wiring.js:997 | scripts/config-wiring.test.js:1270 | 已测（marker） |
| `features.readingHistory.progressThrottleMs` | number | 800 | scripts/lib/feature-wiring.js:998<br>js/domains/features/reading-history.js:9<br>js/domains/features/reading-history.js:10 | scripts/config-wiring.test.js:1055<br>scripts/config-wiring.test.js:1111 | 既有引用 |
| `features.readingHistory.showOnHome` | bool | true | js/domains/features/reading-history.js:98 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.readingPanel.fontSizeDefault` | number | 19 | templates/post.ejs:110 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.fontSizeMax` | number | 26 | templates/post.ejs:110 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.fontSizeMin` | number | 15 | templates/post.ejs:110 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.fontSizeStep` | number | 1 | templates/post.ejs:110 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightDefault` | number | 1.9 | templates/post.ejs:111 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightMax` | number | 2.6 | templates/post.ejs:111 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightMin` | number | 1.4 | templates/post.ejs:111 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightStep` | number | 0.1 | templates/post.ejs:111 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.position` | enum | `right` | templates/layout.ejs:235<br>templates/post.ejs:47<br>templates/post.ejs:73 | scripts/build-smoke.test.js:509<br>scripts/build.test.js:23 | 既有引用 |
| `features.readingPanel.remember` | bool | true | js/domains/features/lightbox.js:53<br>js/domains/features/lightbox.js:110<br>js/domains/features/lightbox.js:118 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.showReset` | bool | true | templates/post.ejs:120 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthDefault` | number | 800 | templates/post.ejs:112 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthMax` | number | 1200 | templates/post.ejs:112 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthMin` | number | 560 | templates/post.ejs:112 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthStep` | number | 40 | templates/post.ejs:112 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.ariaAnnounce` | bool | true | js/domains/core/reading.js:132 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.articleOnly` | bool | true | js/domains/core/reading.js:128 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.clickToJump` | bool | true | js/domains/core/reading.js:135 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.readingProgress.keyboardStep` | number | 0.05 | js/domains/core/reading.js:150<br>scripts/lib/feature-wiring.js:953<br>js/domains/core/reading.js:151 | scripts/config-wiring.test.js:1241 | 已测（marker） |
| `features.readingProgress.maxStoredPositions` | number | 80 | scripts/lib/feature-wiring.js:955<br>js/domains/core/read-position.js:9 | scripts/config-wiring.test.js:1241 | 已测（marker） |
| `features.readingProgress.minRestorePx` | number | 160 | scripts/lib/feature-wiring.js:954<br>js/domains/core/read-position.js:7<br>js/domains/core/read-position.js:8 | scripts/config-wiring.test.js:1241 | 已测（marker） |
| `features.readingProgress.rememberPosition` | bool | true | js/domains/core/read-position.js:3<br>js/domains/features/lightbox.js:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.rememberPositionMaxAgeHours` | number | 72 | js/domains/core/read-position.js:5 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.saveThrottleMs` | number | 400 | scripts/lib/feature-wiring.js:956<br>js/domains/core/read-position.js:11<br>js/domains/core/read-position.js:12 | scripts/config-wiring.test.js:1241 | 已测（marker） |
| `features.readingProgress.showDot` | bool | true | templates/layout.ejs:100<br>templates/site-css.ejs:250 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.showTip` | bool | true | js/domains/core/reading.js:68<br>js/domains/core/reading.js:69<br>js/domains/core/reading.js:79 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.tipDisplayMs` | number | 500 | js/domains/core/reading.js:67 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.updateThrottleMs` | number | 30 | js/domains/core/reading.js:199 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.useGradient` | bool | true | templates/site-css.ejs:232<br>scripts/generate-og.js:337<br>scripts/generate-og.js:600 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.zIndex` | number | 1000 | templates/site-css.ejs:234<br>templates/site-css.ejs:510<br>js/domains/guard/defaults.js:145 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingTime.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.readingTime.showInMeta` | bool | true | templates/post.ejs:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingTime.wordsPerMinuteCJK` | number | 250 | scripts/lib/utils.js:146<br>scripts/build/articles.js:307<br>scripts/build/articles.js:297 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingTime.wordsPerMinuteLatin` | number | 200 | scripts/lib/utils.js:146<br>scripts/build/articles.js:308<br>scripts/build/articles.js:297 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readMode.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.readMode.focusOnlyContent` | bool | true | js/domains/core/reading-mode.js:2<br>js/domains/core/reading-mode.js:5 | scripts/config-wiring.test.js:52 | 既有引用 |
| `features.readMode.fontScale` | number | 1 | scripts/build/config.js:299<br>scripts/generate-og.js:431<br>scripts/generate-og.js:436 | scripts/h2-dataflow.test.js:381 | 既有引用 |
| `features.readMode.persist` | bool | true | scripts/lib/feature-wiring.js:1050<br>scripts/lib/feature-wiring.js:1054<br>js/domains/core/reading-mode.js:6 | scripts/config-wiring.test.js:1270 | 已测（marker） |
| `features.redirects.applyInServe` | bool | true | scripts/build/serve.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.redirects.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.redirects.generatePagesFile` | bool | true | scripts/build/security-files.js:27<br>scripts/build/security-files.js:29<br>scripts/build/security-files.js:28 | scripts/h2-dataflow.test.js:311 | 既有引用 |
| `features.redirects.invalidRule` | enum | `abort` | scripts/lib/redirect-rules.js:3<br>scripts/build/security-files.js:36<br>scripts/lib/redirect-rules.js:24 | scripts/config-wiring.test.js:914 | 已测（marker） |
| `features.related.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.related.excerptLength` | number | 80 | templates/post.ejs:152<br>js/domains/features/search-page.js:15<br>js/domains/features/search.js:227 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.related.excludeCurrent` | bool | true | scripts/lib/feature-wiring.js:598<br>scripts/lib/feature-wiring.js:601<br>scripts/lib/related.js:9 | scripts/config-wiring.test.js:481 | 已测（marker） |
| `features.related.minScore` | number | 2 | scripts/lib/related.js:7<br>scripts/lib/related.js:20<br>scripts/lib/related.js:32 | scripts/build.test.js:683 | 已测（marker） |
| `features.related.sameCategoryWeight` | number | 2 | scripts/lib/related.js:6<br>scripts/lib/related.js:19 | scripts/build.test.js:683 | 已测（marker） |
| `features.related.sameTagWeight` | number | 3 | scripts/lib/related.js:5<br>scripts/lib/related.js:18 | scripts/build.test.js:683 | 已测（marker） |
| `features.related.showCount` | bool | false | templates/post.ejs:153<br>js/domains/features/search.js:282<br>js/domains/features/search-page.js:17 | scripts/config-wiring.test.js:210<br>scripts/config-wiring.test.js:229 | 既有引用 |
| `features.related.showExcerpt` | bool | true | templates/post.ejs:152<br>templates/category.ejs:32<br>templates/index.ejs:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.related.topN` | number | 4 | scripts/lib/related.js:35<br>scripts/build/report.js:18<br>scripts/build/report.js:20 | scripts/build.test.js:683 | 已测（marker） |
| `features.reward.closeByBtn` | bool | true | js/domains/features/reward.js:2<br>js/domains/features/reward.js:29<br>scripts/lib/feature-wiring.js:761 | scripts/config-wiring.test.js:750 | 已测（marker） |
| `features.reward.closeByEsc` | bool | true | js/domains/features/reward.js:2<br>js/domains/features/reward.js:35<br>scripts/lib/feature-wiring.js:763 | scripts/config-wiring.test.js:750 | 已测（marker） |
| `features.reward.closeByOverlay` | bool | true | js/domains/features/reward.js:2<br>js/domains/features/reward.js:30<br>scripts/lib/feature-wiring.js:762 | scripts/config-wiring.test.js:750 | 已测（marker） |
| `features.reward.enabled` | bool | false | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.reward.showNote` | bool | true | templates/post.ejs:233 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.saveDataMode.auto` | bool | true | templates/layout.ejs:23<br>templates/site-css.ejs:7<br>templates/site-css.ejs:15 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.animations` | bool | true | templates/site-css.ejs:18<br>js/domains/core/save-data-core.js:30<br>scripts/lib/feature-wiring.js:1127 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.lazyAggressive` | bool | true | js/domains/core/image-lazy.js:5<br>js/domains/core/image-lazy.js:18<br>js/domains/core/save-data-core.js:33 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.lowResImages` | bool | true | js/domains/core/image-lazy.js:4<br>js/domains/core/image-lazy.js:17<br>js/domains/core/save-data-core.js:32 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.lowResMaxWidthPx` | number | 0 | scripts/lib/feature-wiring.js:1132<br>js/domains/core/save-data-core.js:18<br>scripts/lib/feature-wiring.js:1115 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.particles` | bool | true | js/domains/features/background.js:2<br>js/domains/features/background.js:6<br>js/domains/features/background.js:54 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.systemFontsOnly` | bool | true | templates/site-css.ejs:19<br>js/domains/core/save-data-core.js:34<br>scripts/lib/feature-wiring.js:1131 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.manual` | bool | true | templates/layout.ejs:23<br>templates/post.ejs:113<br>templates/post.ejs:115 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.schemaRich.articleSection` | bool | true | templates/layout.ejs:54 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.authorUrl` | bool | true | templates/layout.ejs:54 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.blogHomepage` | bool | true | templates/layout.ejs:54 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.breadcrumbs` | bool | true | templates/layout.ejs:55 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.dateModified` | bool | true | templates/layout.ejs:54<br>scripts/build/articles.js:226 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.schemaRich.image` | bool | true | templates/layout.ejs:54<br>templates/layout.ejs:38<br>templates/layout.ejs:41 | scripts/build-smoke.test.js:418<br>scripts/build-smoke.test.js:421 | 既有引用 |
| `features.schemaRich.keywords` | bool | true | templates/layout.ejs:54<br>templates/layout.ejs:32 | scripts/i18n-residuals.test.js:1 | 既有引用 |
| `features.schemaRich.timeRequired` | bool | true | templates/layout.ejs:54 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.wordCount` | bool | true | templates/layout.ejs:54<br>scripts/build/articles.js:298<br>scripts/build/articles.js:301 | scripts/config-wiring.test.js:348<br>scripts/config-wiring.test.js:362 | 既有引用 |
| `features.scrollBehavior.behavior` | enum | `smooth` | templates/site-css.ejs:7<br>js/core/runtime.js:11<br>js/domains/core/anchor-stabilize.js:47 | scripts/build-smoke.test.js:310<br>scripts/mermaid-render.test.js:25 | 既有引用 |
| `features.scrollBehavior.enabled` | bool | true | js/core/runtime.js:11<br>js/core/main.js:99<br>js/core/runtime.js:18 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.scrollBehavior.respectReducedMotion` | bool | true | templates/site-css.ejs:7<br>js/core/runtime.js:11<br>templates/site-css.ejs:301 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.scrollIndicator.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.scrollIndicator.gradient` | bool | true | templates/site-css.ejs:492<br>js/domains/features/cover.js:8<br>scripts/lib/auto-cover.js:57 | scripts/auto-cover.test.js:23<br>scripts/auto-cover.test.js:30 | 既有引用 |
| `features.scrollIndicator.respectReducedMotion` | bool | true | templates/site-css.ejs:495<br>templates/site-css.ejs:7<br>templates/site-css.ejs:301 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.closeOnOverlay` | bool | true | js/domains/features/search.js:413 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.debounceMs` | number | 120 | js/domains/features/search.js:181 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.search.excerptLength` | number | 120 | templates/post.ejs:152<br>js/domains/features/search-page.js:15<br>js/domains/features/search.js:227 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.focusDelayMs` | number | 100 | js/domains/features/search.js:124<br>js/domains/features/search.js:139<br>js/domains/guard/access-gate.js:102 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.focusOnOpen` | bool | true | js/domains/features/search.js:124<br>js/domains/features/search.js:126 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.highlightMatches` | bool | true | js/domains/features/search-page.js:22<br>js/domains/features/search.js:230 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.includeContent` | bool | true | scripts/build/feeds.js:360<br>scripts/build/feeds.js:323 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.index.bigram` | bool | true | scripts/lib/search-index.js:17<br>js/domains/features/search-core.js:205<br>js/domains/features/search-page.js:19 | scripts/search-core.test.js:81 | 已测（marker） |
| `features.search.index.maxGzipKb` | number | 60 | scripts/build/feeds.js:307<br>scripts/build/feeds.js:355<br>scripts/build/feeds.js:360 | scripts/build-smoke.test.js:65<br>scripts/lib/search.fuzz.test.js:246 | 既有引用 |
| `features.search.matchCategories` | bool | true | js/domains/features/search-core.js:191<br>js/domains/features/search-core.js:203<br>js/domains/features/search-core.js:227 | scripts/config-wiring.test.js:229<br>scripts/config-wiring.test.js:248 | 已测（marker） |
| `features.search.matchTags` | bool | true | js/domains/features/search-core.js:191<br>js/domains/features/search-core.js:202<br>js/domains/features/search-core.js:227 | scripts/config-wiring.test.js:229<br>scripts/config-wiring.test.js:248 | 已测（marker） |
| `features.search.maxHistory` | number | 5 | js/domains/features/search.js:331 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.maxResults` | number | 30 | js/domains/features/command-palette.js:26<br>js/domains/features/command-palette.js:153<br>js/domains/features/search-page.js:14 | scripts/theme-override.test.js:88<br>scripts/theme-override.test.js:94 | 既有引用 |
| `features.search.minChars` | number | 1 | js/domains/features/search-page.js:13<br>js/domains/features/search.js:190<br>js/domains/guard/copy-guard.js:63 | scripts/theme-override.test.js:95 | 既有引用 |
| `features.search.resultTagCount` | number | 6 | js/domains/features/search-page.js:87<br>scripts/lib/feature-wiring.js:1147<br>scripts/lib/feature-wiring.js:1150 | scripts/config-wiring.test.js:1170 | 已测（marker） |
| `features.search.showCount` | bool | true | js/domains/features/search.js:282<br>templates/post.ejs:153<br>js/domains/features/search-page.js:17 | scripts/config-wiring.test.js:229 | 已测（marker） |
| `features.search.showHistoryOnFocus` | bool | true | js/domains/features/search.js:168 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.weightContent` | number | 1 | js/domains/features/search.js:238<br>scripts/lib/feature-wiring.js:168<br>scripts/build/feeds.js:327 | scripts/config-wiring.test.js:229<br>scripts/config-wiring.test.js:248 | 已测（marker） |
| `features.search.weightExcerpt` | number | 2 | js/domains/features/search.js:238<br>scripts/lib/feature-wiring.js:168<br>scripts/build/feeds.js:326 | scripts/config-wiring.test.js:229<br>scripts/search-core.test.js:138 | 已测（marker） |
| `features.search.weightTitle` | number | 5 | js/domains/features/search.js:238<br>scripts/lib/feature-wiring.js:168<br>scripts/build/feeds.js:325 | scripts/config-wiring.test.js:229<br>scripts/config-wiring.test.js:248 | 已测（marker） |
| `features.searchEnginePing.enabled` | bool | false | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.searchEnginePing.onlyProduction` | bool | true | scripts/build/feeds.js:276 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.searchEnginePing.timeoutMs` | number | 5000 | scripts/build/feeds.js:295<br>js/core/boot.js:18<br>js/core/boot.js:20 | scripts/cjk-fonts.test.js:159<br>scripts/cjk-fonts.test.js:165 | 既有引用 |
| `features.searchHighlight.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.searchHighlight.maxMatches` | number | 20 | js/domains/features/search-core.js:277<br>js/domains/features/search-core.js:289<br>js/domains/features/search-page.js:23 | scripts/search-core.test.js:170<br>scripts/search-core.test.js:180 | 既有引用 |
| `features.series.defaultWidgetCount` | number | 8 | templates/layout.ejs:181<br>templates/layout.ejs:194<br>scripts/lib/feature-wiring.js:569 | scripts/config-wiring.test.js:461 | 已测（marker） |
| `features.series.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:461 | 已测（marker） |
| `features.series.order` | enum | `asc` | scripts/build/pages.js:837<br>scripts/lib/series-page.js:19<br>scripts/lib/series-page.js:39 | scripts/series-page.test.js:50<br>scripts/build.test.js:68 | 既有引用 |
| `features.series.pageEnabled` | bool | true | scripts/build/feeds.js:215<br>scripts/build/feeds.js:217<br>scripts/build/pages.js:739 | scripts/config-wiring.test.js:461 | 已测（marker） |
| `features.series.showBadge` | bool | true | templates/post.ejs:15<br>scripts/lib/feature-wiring.js:37<br>scripts/lib/feature-wiring.js:560 | scripts/config-wiring.test.js:461 | 已测（marker） |
| `features.series.showNavPanel` | bool | true | templates/post.ejs:209<br>scripts/lib/feature-wiring.js:563 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.series.showPosition` | bool | true | templates/post.ejs:213<br>templates/series-page.ejs:9<br>templates/post.ejs:212 | scripts/config-wiring.test.js:461 | 已测（marker） |
| `features.series.sidebarWidget` | bool | true | templates/layout.ejs:181<br>templates/layout.ejs:194<br>scripts/lib/feature-wiring.js:564 | scripts/config-wiring.test.js:461 | 已测（marker） |
| `features.share.copiedShowMs` | number | 2500 | js/domains/features/share.js:10 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.copyFallback` | bool | true | js/domains/features/share.js:31<br>js/domains/features/share.js:32 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.share.popupHeight` | number | 520 | js/domains/features/share.js:43 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.popupWidth` | number | 640 | js/domains/features/contact-popup.js:3<br>js/domains/features/share.js:43<br>scripts/lib/feature-wiring.js:902 | scripts/config-wiring.test.js:672<br>scripts/config-wiring.test.js:679 | 既有引用 |
| `features.share.position` | enum | `toolbar` | templates/layout.ejs:235<br>templates/post.ejs:47<br>templates/post.ejs:73 | scripts/build-smoke.test.js:509<br>scripts/build.test.js:23 | 既有引用 |
| `features.share.showLabel` | bool | false | templates/post.ejs:224 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.useNativeShare` | bool | false | js/domains/features/share.js:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.shortcuts.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:166 | 已测（marker） |
| `features.shortcuts.ignoreInInputs` | bool | true | js/domains/features/shortcuts.js:20 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.shortcuts.showHelpHint` | bool | true | js/domains/features/shortcuts.js:29<br>scripts/build/pages.js:379<br>scripts/lib/feature-wiring.js:127 | scripts/config-wiring.test.js:166 | 已测（marker） |
| `features.shortcuts.showHelpTable` | bool | true | templates/layout.ejs:228 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.sidebarDrag.hapticMs` | number | 10 | js/domains/features/sidebar-drag.js:53<br>scripts/lib/feature-wiring.js:1348<br>js/domains/features/sidebar-drag.js:54 | scripts/config-wiring.test.js:1470<br>scripts/config-wiring.test.js:1471 | 既有引用 |
| `features.sidebarDrag.persistOrder` | bool | true | js/domains/features/sidebar-drag.js:7<br>js/domains/features/sidebar-drag.js:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.resetOnLoadFail` | bool | true | js/domains/features/sidebar-drag.js:22 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.showHandleOnHover` | bool | true | js/domains/features/sidebar-drag.js:118 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.touchLongPress` | bool | true | js/domains/features/sidebar-drag.js:97<br>js/domains/features/sidebar-drag.js:99<br>js/domains/features/sidebar-drag.js:100 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.touchLongPressMs` | number | 500 | js/domains/features/sidebar-drag.js:97<br>js/domains/features/sidebar-drag.js:101 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sitemap.maxUrlsPerFile` | number | 500 | scripts/build/feeds.js:172 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sitemap.split` | bool | true | js/core/runtime.js:10<br>js/core/soft-nav.js:177<br>js/domains/core/code-block.js:1 | scripts/build-smoke.test.js:75<br>scripts/build-smoke.test.js:217 | 既有引用 |
| `features.softNavigation.cacheMaxEntries` | number | 16 | js/core/soft-nav.js:12<br>js/core/soft-nav.js:73<br>scripts/lib/feature-wiring.js:990 | scripts/config-wiring.test.js:1270 | 已测（marker） |
| `features.softNavigation.cacheTtlMs` | number | 300000 | js/core/soft-nav.js:12<br>templates/layout.ejs:97<br>js/core/soft-nav.js:20 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.softNavigation.prefetchDelayMs` | number | 80 | js/core/soft-nav.js:228 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.prefetchOnHover` | bool | true | js/core/soft-nav.js:217 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.scrollToTop` | bool | true | js/core/soft-nav.js:179<br>js/domains/core/reading.js:30<br>js/domains/core/reading.js:167 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.timeoutMs` | number | 10000 | js/core/boot.js:18<br>js/core/boot.js:20<br>js/core/boot.js:21 | scripts/cjk-fonts.test.js:159<br>scripts/cjk-fonts.test.js:165 | 既有引用 |
| `features.softNavigation.toggle.defaultOn` | bool | true | js/core/soft-nav.js:38<br>js/domains/core/seamless-nav.js:22 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.toggle.show` | bool | true | templates/layout.ejs:141<br>js/domains/features/bilingual.js:123<br>js/core/runtime.js:12 | scripts/release-archive.test.js:48<br>scripts/release-validate.test.js:153 | 既有引用 |
| `features.softNavigation.viewTransition` | bool | true | templates/layout.ejs:141<br>js/domains/core/seamless-nav.js:10<br>templates/index.ejs:40 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.delivery` | enum | `inline` | scripts/build/security-files.js:162<br>js/domains/core/seamless-nav.js:38<br>scripts/build/security-files.js:159 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.eagerness` | enum | `moderate` | scripts/build/security-files.js:164<br>js/domains/core/seamless-nav.js:68 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.speculation.mode` | enum | `both` | js/core/soft-nav.js:152<br>js/core/soft-nav.js:170<br>js/core/soft-nav.js:171 | scripts/build-errors.test.js:42<br>scripts/build-errors.test.js:54 | 既有引用 |
| `features.speculation.toggle.defaultOn` | bool | true | js/core/soft-nav.js:38<br>js/domains/core/seamless-nav.js:22 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.toggle.show` | bool | true | templates/layout.ejs:141<br>js/domains/features/bilingual.js:123<br>js/core/runtime.js:12 | scripts/release-archive.test.js:48<br>scripts/release-validate.test.js:153 | 既有引用 |
| `features.stats.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.stats.showArchiveCards` | bool | true | scripts/lib/feature-wiring.js:862<br>templates/archive.ejs:6<br>templates/archive.ejs:13 | scripts/config-wiring.test.js:811 | 已测（marker） |
| `features.stats.showSidebar` | bool | true | templates/layout.ejs:180<br>templates/layout.ejs:193 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.subscribe.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.subscribe.jsonFeed` | bool | true | scripts/build/config.js:367<br>scripts/build/feeds.js:102<br>scripts/build/feeds.js:106 | scripts/build.test.js:721<br>scripts/build.test.js:722 | 既有引用 |
| `features.subscribe.newTab` | bool | true | js/domains/core/external-link.js:14<br>js/domains/core/external-link.js:22<br>js/domains/features/popup-notice.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.subscribe.rss` | bool | true | templates/layout.ejs:202<br>js/core/soft-nav.js:144<br>scripts/build/config.js:367 | scripts/config-wiring.test.js:878<br>scripts/build-errors.test.js:18 | 既有引用 |
| `features.supSub.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:368 | 已测（marker） |
| `features.supSub.preserveUnmatched` | bool | true | scripts/build/markdown.js:110<br>scripts/build/markdown.js:46<br>scripts/build/markdown.js:128 | scripts/config-wiring.test.js:368<br>scripts/config-wiring.test.js:376 | 已测（marker） |
| `features.supSub.skipInsideMath` | bool | true | scripts/build/markdown.js:42<br>scripts/lib/feature-wiring.js:325<br>scripts/build/markdown.js:45 | scripts/config-wiring.test.js:368 | 已测（marker） |
| `features.themeLab.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/theme-lab.test.js:114 | 已测（marker） |
| `features.themePresets.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.themePresets.persistChoice` | bool | true | js/domains/features/theme-presets.js:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themePresets.pickerVisible` | bool | true | js/domains/features/theme-presets.js:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themePresets.previewOnHover` | bool | true | templates/layout.ejs:144 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themePresets.showInNavbar` | bool | true | templates/layout.ejs:144 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.applyInstantly` | bool | true | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.checkIntervalMs` | number | 60000 | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.enabled` | bool | false | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.themeSchedule.respectManualOverride` | bool | true | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.smoothTransition` | bool | true | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.smoothTransitionMs` | number | 350 | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeToggle.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.themeToggle.toggleIconSwap` | bool | true | js/domains/features/morphicons.js:105<br>templates/layout.ejs:238 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeToggle.zIndex` | number | 100 | templates/site-css.ejs:234<br>templates/site-css.ejs:510<br>js/domains/guard/defaults.js:145 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toast.durationMs` | number | 2500 | js/core/runtime.js:12<br>templates/site-css.ejs:301<br>templates/site-css.ejs:306 | scripts/config-split.test.js:8 | 既有引用 |
| `features.toast.enabled` | bool | true | js/core/runtime.js:12<br>js/core/main.js:99<br>js/core/runtime.js:18 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.toast.maxVisible` | number | 3 | js/core/runtime.js:12<br>scripts/build/pages.js:545<br>scripts/build/pages.js:694 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toast.position` | enum | `bottom-center` | js/core/runtime.js:12<br>templates/layout.ejs:235<br>templates/post.ejs:47 | scripts/build-smoke.test.js:509<br>scripts/build.test.js:23 | 既有引用 |
| `features.toast.removeDelayMs` | number | 300 | js/core/runtime.js:12<br>js/domains/core/announcement.js:45<br>js/domains/features/continue-reading.js:102 | scripts/config-wiring.test.js:1303<br>scripts/config-wiring.test.js:1050 | 既有引用 |
| `features.toc.activeOffset` | number | 120 | js/domains/core/toc.js:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.collapsible` | bool | true | js/domains/core/code-block.js:49<br>js/domains/core/toc.js:53<br>js/domains/core/toc.js:68 | scripts/build-report-html.test.js:208 | 既有引用 |
| `features.toc.defaultOpenLevel` | number | 2 | js/domains/core/toc.js:63<br>scripts/lib/feature-wiring.js:67<br>js/domains/core/toc.js:65 | scripts/config-wiring.test.js:110 | 已测（marker） |
| `features.toc.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.toc.groupCollapse` | bool | true | js/domains/core/toc.js:75 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.highlightActive` | bool | true | js/domains/core/toc.js:19 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.maxLevel` | number | 4 | scripts/lib/utils.js:191<br>scripts/build/articles.js:318<br>scripts/lib/feature-wiring.js:69 | scripts/build.test.js:206 | 既有引用 |
| `features.toc.maxWidthPx` | number | 320 | templates/site-css.ejs:37 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.minLevel` | number | 2 | js/domains/core/toc.js:63<br>scripts/lib/utils.js:191<br>scripts/build/articles.js:318 | scripts/build.test.js:201<br>scripts/config-wiring.test.js:109 | 既有引用 |
| `features.toc.progressLine` | bool | true | js/domains/core/toc.js:31 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.showTitle` | bool | true | templates/layout.ejs:171<br>js/core/boot.js:34 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.smoothScroll` | bool | true | js/domains/core/reading.js:20<br>js/domains/core/reading.js:36<br>scripts/lib/feature-wiring.js:679 | scripts/config-wiring.test.js:716<br>scripts/config-wiring.test.js:717 | 既有引用 |
| `features.toc.updateUrl` | bool | true | js/domains/core/toc.js:123 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.visitedFade` | bool | true | js/domains/core/toc.js:23 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tocScrollSpy.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.tocScrollSpy.offset` | number | 80 | js/domains/core/navigation.js:8<br>js/domains/core/navigation.js:10<br>js/domains/core/toc.js:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tocScrollSpy.throttleMs` | number | 60 | js/domains/guard/tamper-watch.js:23<br>js/domains/guard/tamper-watch.js:24 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.tts.highlightParagraph` | bool | false | scripts/lib/feature-wiring.js:747<br>js/domains/features/tts.js:3<br>js/domains/features/tts.js:30 | scripts/config-wiring.test.js:725 | 已测（marker） |
| `features.tts.highlightReading` | bool | true | js/domains/features/tts.js:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.pitch` | number | 1 | js/domains/features/tts.js:100 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.preferDefaultVoice` | bool | true | scripts/lib/feature-wiring.js:747<br>js/domains/features/tts.js:2<br>js/domains/features/tts.js:91 | scripts/config-wiring.test.js:725 | 已测（marker） |
| `features.tts.rate` | number | 0.5 | templates/post.ejs:78<br>js/domains/features/tts.js:99<br>scripts/perf-audit.js:219 | scripts/build.test.js:508<br>scripts/security-worker.test.js:146 | 既有引用 |
| `features.tts.resumeIntervalMs` | number | 500 | js/domains/features/tts.js:110 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.resumeMaxTries` | number | 3 | js/domains/features/tts.js:110 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.volume` | number | 1 | js/domains/features/tts.js:101 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.viewTransition.durationMs` | number | 180 | templates/site-css.ejs:306<br>templates/site-css.ejs:301<br>js/core/runtime.js:12 | scripts/config-split.test.js:8 | 既有引用 |
| `features.viewTransition.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.viewTransition.reducedMotion` | enum | `light` | templates/site-css.ejs:306<br>js/domains/core/nav-state.js:4<br>templates/site-css.ejs:301 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.viewTransition.shared` | bool | true | templates/index.ejs:40<br>templates/index.ejs:50<br>templates/post.ejs:15 | scripts/build-report-html.test.js:53<br>scripts/build-report-html.test.js:151 | 既有引用 |
| `features.viewTransition.toggle.defaultOn` | bool | true | js/core/soft-nav.js:38<br>js/domains/core/seamless-nav.js:22 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.viewTransition.toggle.show` | bool | true | templates/layout.ejs:141<br>js/domains/features/bilingual.js:123<br>js/core/runtime.js:12 | scripts/release-archive.test.js:48<br>scripts/release-validate.test.js:153 | 既有引用 |
| `features.viewTransition.type` | enum | `fade` | js/core/runtime.js:12<br>js/core/soft-nav.js:92<br>js/core/soft-nav.js:93 | scripts/config-switch-guards.test.js:35<br>scripts/build.test.js:216 | 既有引用 |
| `features.wikiLinks.allowCustomLabel` | bool | true | scripts/build/articles.js:253<br>scripts/build/articles.js:260<br>scripts/lib/feature-wiring.js:244 | scripts/config-wiring.test.js:269<br>scripts/config-wiring.test.js:283 | 已测（marker） |
| `features.wikiLinks.caseInsensitive` | bool | true | scripts/build/articles.js:253<br>scripts/build/articles.js:129<br>scripts/build/articles.js:259 | scripts/config-wiring.test.js:269<br>scripts/config-wiring.test.js:283 | 已测（marker） |
| `features.wikiLinks.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring.test.js:269 | 已测（marker） |
| `features.wikiLinks.openNewTab` | bool | false | js/domains/guard/context-menu.js:103<br>js/domains/guard/context-menu.js:139<br>js/domains/guard/defaults.js:59 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.wikiLinks.unknownMode` | enum | `text` | scripts/build/articles.js:253<br>scripts/build/articles.js:257<br>scripts/lib/feature-wiring.js:241 | scripts/config-wiring.test.js:269<br>scripts/config-wiring.test.js:283 | 已测（marker） |
| `features.wordCount.countCjkChars` | bool | true | scripts/build/articles.js:301<br>scripts/build/articles.js:303<br>scripts/lib/feature-wiring.js:607 | scripts/config-wiring.test.js:493<br>scripts/config-wiring.test.js:512 | 既有引用 |
| `features.wordCount.countDigits` | bool | true | scripts/build/articles.js:301<br>scripts/build/articles.js:303<br>scripts/lib/feature-wiring.js:607 | scripts/config-wiring.test.js:348<br>scripts/config-wiring.test.js:349 | 既有引用 |
| `features.wordCount.enabled` | bool | true | js/core/main.js:99<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/auto-cover.test.js:22<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `features.wordCount.inArticle` | bool | true | templates/post.ejs:37<br>scripts/lib/feature-wiring.js:605<br>scripts/lib/feature-wiring.js:615 | scripts/config-wiring.test.js:493 | 既有引用 |
| `features.wordCount.onCards` | bool | true | templates/category.ejs:25<br>templates/index.ejs:63<br>templates/series-page.ejs:24 | scripts/config-wiring.test.js:362<br>scripts/config-wiring.test.js:493 | 既有引用 |
| `features.wordCount.wpm` | number | 265 | scripts/build/articles.js:298<br>scripts/lib/feature-wiring.js:611<br>scripts/build/articles.js:313 | scripts/config-wiring.test.js:491 | 已测（marker） |
| `footer.beian.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `footer.bottomLinks.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `footer.columnItems.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `footer.columns` | number | 3 | scripts/build/config.js:392<br>templates/site-css.ejs:209<br>scripts/build/config.js:222 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `footer.options.linkHoverUnderline` | bool | true | templates/site-css.ejs:211 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `footer.poweredBy.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `footer.social.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `friends.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `friends.sidebarCount` | number | 8 | scripts/lib/feature-wiring.js:1214 | scripts/config-wiring.test.js:1123<br>scripts/config-wiring.test.js:1155 | 既有引用 |
| `internals.audit.a11y.htmlSummaryMax` | number | 120 | scripts/a11y-audit.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.audit.a11y.nodesPerRuleMax` | number | 3 | scripts/a11y-audit.js:36 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.audit.a11y.pages` | number | 0 | scripts/a11y-audit.js:77<br>js/domains/features/reading-panel.js:55<br>js/domains/features/reading-panel.js:60 | scripts/bilingual-core.test.js:7<br>scripts/bilingual-core.test.js:130 | 既有引用 |
| `internals.audit.distHash.previewLimit` | number | 20 | scripts/dist-hash-guard.js:13<br>scripts/dist-hash-guard.js:14<br>scripts/release-prune.js:86 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.cache.fontsTtlDays` | number | 7 | scripts/build/cjk-fonts.js:22<br>scripts/build/cjk-fonts.js:68 | scripts/internals.test.js:35 | 既有引用 |
| `internals.cache.mediaTtlDays` | number | 0 | scripts/build/media.js:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.cache.mermaidTtlDays` | number | 0 | scripts/build/mermaid.js:52 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.cache.ogTtlDays` | number | 0 | scripts/generate-og.js:27 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ci.aggregate` | bool | true | scripts/ci-checks.js:10<br>scripts/ci-checks.js:28<br>scripts/ci-env.js:22 | scripts/config-switch-guards.test.js:30<br>scripts/internals.test.js:47 | 既有引用 |
| `internals.ci.checkTimeoutMs` | number | 600000 | scripts/ci-checks.js:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ci.skip.consecutiveClean` | number | 5 | scripts/lib/ci-skip.js:14<br>scripts/lib/ci-skip.js:55<br>scripts/lib/ci-skip.js:61 | scripts/ci-skip.test.js:47<br>scripts/ci-skip.test.js:55 | 既有引用 |
| `internals.ci.skip.consecutiveErrors` | number | 2 | scripts/lib/ci-skip.js:14<br>scripts/lib/ci-skip.js:55<br>scripts/lib/ci-skip.js:60 | scripts/ci-skip.test.js:47<br>scripts/ci-skip.test.js:55 | 既有引用 |
| `internals.ci.skip.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `internals.ci.skip.ignoreWarnings` | bool | true | scripts/lib/ci-skip.js:12 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ci.skip.requireSameHead` | bool | true | scripts/lib/ci-skip.js:55<br>scripts/lib/ci-skip.js:59<br>scripts/lib/ci-skip.js:66 | scripts/ci-skip.test.js:47<br>scripts/ci-skip.test.js:55 | 既有引用 |
| `internals.deploy.verifyOnDeploy` | bool | true | scripts/deploy-pages.js:23<br>scripts/deploy-pages.js:7 | scripts/internals.test.js:57 | 既有引用 |
| `internals.ports.a11y` | number | 3224 | scripts/a11y-audit.js:29<br>scripts/a11y-audit.js:35<br>scripts/a11y-audit.js:36 | scripts/internals.test.js:32<br>scripts/internals.test.js:46 | 既有引用 |
| `internals.ports.perf` | number | 3000 | scripts/perf-audit.js:36<br>scripts/perf-audit.js:26<br>scripts/build/report.js:205 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ports.serve` | number | 3000 | scripts/build/serve.js:25<br>scripts/a11y-audit.js:6<br>scripts/a11y-audit.js:11 | scripts/internals.test.js:31<br>scripts/internals.test.js:45 | 既有引用 |
| `internals.release.listLimit` | number | 200 | scripts/release-prune.js:20<br>scripts/release-prune.js:60 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.release.previewLimit` | number | 20 | scripts/release-prune.js:86<br>scripts/release-prune.js:87<br>scripts/release-prune.js:91 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.report.maxBuildMsWarn` | number | 0 | scripts/build.js:388<br>scripts/build.js:391<br>scripts/build.js:389 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.report.topN` | number | 10 | scripts/build/report.js:18<br>scripts/build/report.js:20<br>scripts/build/report.js:183 | scripts/config-wiring.test.js:1170 | 已测（marker） |
| `navigation.navbar.fixed` | bool | true | templates/site-css.ejs:41<br>templates/site-css.ejs:59<br>js/domains/core/code-block.js:36 | scripts/build.test.js:244<br>scripts/config-wiring.test.js:934 | 既有引用 |
| `navigation.navbar.shadow` | bool | true | templates/site-css.ejs:41<br>js/domains/features/theme-presets.js:1<br>scripts/build/config.js:220 | scripts/malicious.test.js:493<br>scripts/popup-notice-config.test.js:53 | 既有引用 |
| `navigation.navbar.showLogo` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `navigation.navbarOptions.glassAlpha` | number | 0 | templates/site-css.ejs:1 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `navigation.navbarOptions.shadowShow` | bool | true | templates/site-css.ejs:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `navigation.search.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `navigation.socialInNav.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `navigation.userMenu.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `security.csp.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `security.csp.reportOnly` | bool | false | scripts/build/security-files.js:133<br>scripts/generate-security-config.js:151<br>workers/security-worker.js:222 | scripts/build.test.js:522<br>scripts/build.test.js:568 | 既有引用 |
| `security.forceHttps` | bool | false | scripts/generate-security-config.js:157<br>workers/security-config.js:83<br>workers/security-worker.js:52 | scripts/build.test.js:514<br>scripts/build.test.js:574 | 既有引用 |
| `security.hardening.cspReportMaxBytes` | number | 16384 | scripts/generate-security-config.js:154<br>scripts/generate-security-config.js:163<br>scripts/generate-security-config.js:155 | scripts/build.test.js:527<br>scripts/config-wiring.test.js:1159 | 既有引用 |
| `security.rateLimiting.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `security.rateLimiting.maxRequests` | number | 100 | scripts/generate-security-config.js:137<br>workers/lib/rate-limit.mjs:9<br>workers/lib/rate-limit.mjs:15 | scripts/build.test.js:509<br>scripts/build.test.js:510 | 既有引用 |
| `security.rateLimiting.maxTrackedEntries` | number | 5000 | workers/security-worker.js:92<br>scripts/generate-security-config.js:140<br>scripts/generate-security-config.js:141 | scripts/config-wiring.test.js:1157<br>scripts/config-wiring.test.js:1158 | 既有引用 |
| `security.rateLimiting.windowMs` | number | 60000 | scripts/generate-security-config.js:138<br>workers/lib/rate-limit.mjs:8<br>workers/lib/rate-limit.mjs:14 | scripts/build.test.js:509<br>scripts/build.test.js:519 | 既有引用 |
| `security.robots.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `sidebar.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `sidebar.mobile.collapsed` | bool | true | templates/site-css.ejs:235<br>templates/site-css.ejs:37<br>js/domains/core/nav-state.js:57 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.mobile.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `sidebar.mobile.overlay` | bool | true | js/core/boot.js:79<br>js/core/boot.js:85<br>js/core/boot.js:92 | scripts/h2-dataflow.test.js:379<br>scripts/h2-dataflow.test.js:384 | 既有引用 |
| `sidebar.mobile.toggleButton` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.options.borderShow` | bool | false | templates/site-css.ejs:180 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.options.hoverLift` | bool | true | templates/site-css.ejs:180 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.options.titleWeight` | number | 600 | templates/site-css.ejs:2 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.recentPoolSize` | number | 10 | scripts/lib/feature-wiring.js:1217<br>scripts/lib/feature-wiring.js:1219 | scripts/config-wiring.test.js:1170 | 已测（marker） |
| `sidebar.sticky` | bool | true | templates/site-css.ejs:37<br>templates/site-css.ejs:255<br>templates/site-css.ejs:267 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.avif.effort` | number | 5 | scripts/build/media.js:217 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.avif.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/build-smoke.test.js:174<br>scripts/auto-cover.test.js:22 | 既有引用 |
| `site.build.avif.quality` | number | 50 | scripts/build/media.js:159<br>scripts/build/media.js:168<br>scripts/build/media.js:217 | scripts/h2-dataflow.test.js:381<br>scripts/og-format.test.js:10 | 既有引用 |
| `site.build.buildReport` | bool | true | scripts/build.js:398<br>scripts/build.js:405 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.cacheControl` | bool | true | scripts/build/security-files.js:182<br>scripts/build/security-files.js:183 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.cjkFonts.cacheTtlDays` | number | 7 | scripts/build/cjk-fonts.js:22<br>scripts/build/cjk-fonts.js:30<br>scripts/build/cjk-fonts.js:31 | scripts/config-wiring.test.js:1138<br>scripts/config-wiring.test.js:1150 | 既有引用 |
| `site.build.cjkFonts.concurrency` | number | 6 | scripts/build/cjk-fonts.js:29<br>scripts/build/cjk-fonts.js:37<br>scripts/build/cjk-fonts.js:38 | scripts/config-wiring.test.js:1137<br>scripts/config-wiring.test.js:1149 | 既有引用 |
| `site.build.cjkFonts.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/build-smoke.test.js:174<br>scripts/auto-cover.test.js:22 | 既有引用 |
| `site.build.cjkFonts.fetchTimeoutMs` | number | 15000 | js/domains/features/bilingual-core.js:11<br>js/domains/features/bilingual-core.js:20<br>js/domains/features/bilingual-core.js:28 | scripts/cjk-fonts.test.js:91<br>scripts/bilingual-core.test.js:27 | 既有引用 |
| `site.build.cjkSpacing` | bool | true | scripts/build/articles.js:269<br>scripts/build/pages.js:447 | scripts/h2-dataflow.test.js:243 | 既有引用 |
| `site.build.cleanDist` | bool | true | scripts/build.js:173<br>scripts/build.js:174<br>scripts/build/media.js:25 | scripts/malicious.test.js:301<br>scripts/malicious.test.js:587 | 既有引用 |
| `site.build.copyStatic` | bool | true | scripts/build/media.js:35<br>scripts/build.js:64<br>scripts/build.js:204 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.criticalCss.asyncNonCritical` | bool | true | scripts/build/pages.js:185 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.criticalCss.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/build-smoke.test.js:174<br>scripts/auto-cover.test.js:22 | 既有引用 |
| `site.build.enableCacheBusting` | bool | false | scripts/build/feeds.js:328<br>scripts/build/minify.js:743 | scripts/cache-bust.test.js:15<br>scripts/compression-pipeline.test.js:270 | 既有引用 |
| `site.build.forceContentWidth` | bool | true | templates/layout.ejs:170<br>templates/site-css.ejs:36 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.generateArchive` | bool | true | scripts/build/feeds.js:201<br>scripts/build/pages.js:804 | scripts/lib/feeds.fuzz.test.js:86<br>scripts/h2-dataflow.test.js:57 | 既有引用 |
| `site.build.generateCategories` | bool | true | scripts/build/feeds.js:207<br>scripts/build/pages.js:819 | scripts/lib/feeds.fuzz.test.js:86<br>scripts/h2-dataflow.test.js:59 | 既有引用 |
| `site.build.generateGallery` | bool | true | scripts/build/feeds.js:202<br>scripts/build/pages.js:864 | scripts/lib/feeds.fuzz.test.js:86<br>scripts/h2-dataflow.test.js:60 | 既有引用 |
| `site.build.generateIndex` | bool | true | scripts/build/feeds.js:188<br>scripts/build/pages.js:753<br>scripts/build/pages.js:907 | scripts/h2-dataflow.test.js:182<br>scripts/lib/feeds.fuzz.test.js:86 | 既有引用 |
| `site.build.generateTags` | bool | true | scripts/build/feeds.js:203<br>scripts/build/pages.js:809 | scripts/lib/feeds.fuzz.test.js:86<br>scripts/h2-dataflow.test.js:58 | 既有引用 |
| `site.build.hashLength` | number | 10 | scripts/build/pages.js:170 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.mediaQuality` | number | 85 | scripts/build/media.js:159 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.minifyCSS` | bool | false | scripts/build/minify.js:214<br>scripts/build/minify.js:263<br>scripts/build/minify.js:728 | scripts/compression-pipeline.test.js:270 | 既有引用 |
| `site.build.minifyHTML` | bool | false | scripts/build/minify.js:187<br>scripts/build/minify.js:192<br>scripts/build/minify.js:727 | scripts/compression-pipeline.test.js:270<br>scripts/config-switch-guards.test.js:23 | 既有引用 |
| `site.build.minifyJS` | bool | false | scripts/build.js:278<br>scripts/build/minify.js:236<br>scripts/build/minify.js:729 | scripts/compression-pipeline.test.js:270 | 既有引用 |
| `site.build.optimizeMedia` | bool | false | scripts/build/media.js:148<br>scripts/build.js:64<br>scripts/build.js:208 | scripts/malicious.test.js:301<br>scripts/malicious.test.js:587 | 既有引用 |
| `site.build.relatedArticles` | bool | true | scripts/build.js:245<br>scripts/lib/related.js:13<br>scripts/lib/related.js:35 | scripts/build.test.js:695<br>scripts/build.test.js:696 | 既有引用 |
| `site.build.removeConsole` | bool | false | scripts/build/minify.js:234<br>scripts/build/minify.js:244 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.reportTopN` | number | 10 | scripts/build/report.js:183<br>scripts/build/report.js:207<br>scripts/lib/feature-wiring.js:1222 | scripts/config-wiring.test.js:1170 | 已测（marker） |
| `site.build.usePictureTag` | bool | true | scripts/build/markdown.js:25 | scripts/config-wiring.test.js:538<br>scripts/config-wiring.test.js:631 | 既有引用 |
| `site.comments.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.externalLinkWarning.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.favicon.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.hero.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.hero.showCta` | bool | true | scripts/build/pages.js:678<br>templates/index.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.hero.showSearch` | bool | true | scripts/build/pages.js:676<br>templates/index.ejs:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.hero.showTags` | bool | true | scripts/build/pages.js:677<br>templates/index.ejs:17<br>templates/index.ejs:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.hero.tagCount` | number | 8 | scripts/build/pages.js:684<br>scripts/build/pages.js:685<br>scripts/lib/test-payloads.js:147 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.prefetchNextPage` | bool | false | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.preloadFeaturedImage` | bool | true | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.preloadFonts` | bool | true | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.resourceHints` | bool | true | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.postsPerPage` | number | 10 | scripts/build/config.js:421<br>scripts/build/feeds.js:190<br>scripts/build/pages.js:662 | scripts/theme-override.test.js:17<br>scripts/config-link-safety.test.js:27 | 既有引用 |
| `site.pwa.enabled` | bool | true | js/core/runtime.js:18<br>js/core/boot.js:78<br>js/core/boot.js:167 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.reward.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.rss.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.rss.fullContent` | bool | true | scripts/build/feeds.js:45<br>scripts/build/feeds.js:80<br>scripts/build/feeds.js:101 | scripts/build.test.js:721 | 已测（marker） |
| `site.rss.injectHeadLinks` | bool | true | templates/layout.ejs:49 | scripts/config-wiring.test.js:882 | 既有引用 |
| `site.rss.jsonFeed.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.rss.jsonFeed.fullContent` | bool | false | scripts/lib/feed-options.js:4<br>scripts/build/feeds.js:45<br>scripts/build/feeds.js:80 | scripts/build.test.js:721 | 已测（marker） |
| `site.rss.jsonFeed.maxItems` | number | 20 | scripts/lib/feed-options.js:4<br>scripts/build/feeds.js:71<br>scripts/build/feeds.js:101 | scripts/build.test.js:721 | 已测（marker） |
| `site.rss.maxItems` | number | 50 | scripts/build/feeds.js:71<br>scripts/build/feeds.js:101<br>scripts/lib/feed-options.js:4 | scripts/build.test.js:721 | 已测（marker） |
| `site.seo.articleTimes` | bool | true | templates/layout.ejs:42 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.seo.canonicalURL` | bool | false | templates/layout.ejs:48 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.seo.ogImageAlt` | bool | true | templates/layout.ejs:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.seo.structuredData.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.seo.twitterLabels` | bool | true | templates/layout.ejs:43 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.showRepoLink` | bool | true | templates/layout.ejs:135<br>templates/layout.ejs:218 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.sitemap.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.sitemap.priority` | number | 0.8 | scripts/build/feeds.js:201<br>scripts/build/feeds.js:202<br>scripts/build/articles.js:188 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.social.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `site.webAnalytics.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `tagAliases.enabled` | bool | true | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `theme.animation.enable` | bool | true | js/domains/features/bilingual.js:65<br>js/domains/features/bilingual.js:103<br>js/domains/features/bilingual.js:164 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.avatar.badge` | bool | true | templates/layout.ejs:172<br>templates/layout.ejs:186<br>scripts/build/articles.js:300 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.avatar.ring` | bool | false | templates/layout.ejs:172<br>templates/layout.ejs:186<br>js/core/boot.js:33 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.button.hoverScale` | number | 1.02 | js/domains/core/motion.js:16 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.excerptLength` | number | 150 | scripts/build/articles.js:291<br>js/domains/features/search-page.js:15<br>js/domains/features/search.js:227 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.readTimeSpeed` | number | 265 | scripts/build/articles.js:298<br>scripts/build/articles.js:313 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showCategories` | bool | true | templates/index.ejs:6<br>templates/index.ejs:56<br>templates/tag.ejs:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showDate` | bool | true | templates/category.ejs:15<br>templates/index.ejs:6<br>templates/index.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showExcerpt` | bool | true | templates/category.ejs:32<br>templates/index.ejs:6<br>templates/index.ejs:70 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showReadTime` | bool | true | templates/category.ejs:28<br>templates/index.ejs:6<br>templates/index.ejs:66 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showTags` | bool | true | templates/index.ejs:6<br>templates/index.ejs:73<br>templates/tag.ejs:46 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showWordCount` | bool | true | templates/category.ejs:25<br>templates/index.ejs:63<br>templates/series-page.ejs:24 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.contentOffset` | number | 0 | templates/site-css.ejs:33 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.darkMode.enabled` | bool | false | js/core/boot.js:78<br>js/core/boot.js:167<br>js/core/main.js:99 | scripts/auto-cover.test.js:22<br>scripts/auto-cover.test.js:25 | 既有引用 |
| `theme.darkMode.toggle` | bool | true | js/core/soft-nav.js:5<br>js/core/soft-nav.js:27<br>js/domains/core/code-block.js:51 | scripts/lightbox-core.test.js:217<br>scripts/lightbox-core.test.js:219 | 既有引用 |
| `theme.fontSystem.bodyWeight` | number | 400 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.fontSystem.numbersMono` | bool | true | scripts/build/config.js:300 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.fontSystem.scale` | number | 1 | js/domains/features/lightbox-core.js:64<br>js/domains/features/lightbox-core.js:66<br>js/domains/features/lightbox-core.js:67 | scripts/config-wiring.test.js:1370<br>scripts/config-wiring.test.js:1383 | 既有引用 |
| `theme.headerContentGap` | number | 0 | templates/site-css.ejs:32 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.headingFontWeight` | number | 700 | templates/site-css.ejs:1 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.lineHeight` | number | 1.8 | templates/site-css.ejs:1<br>scripts/generate-og.js:219<br>scripts/generate-og.js:225 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.card.bentoFeatured` | bool | true | templates/index.ejs:31<br>templates/index.ejs:32 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.header.scrollShrink` | bool | true | js/domains/core/navigation.js:5 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.damping` | number | 30 | js/domains/features/morphicons.js:37<br>js/domains/features/morphicons.js:42<br>js/domains/features/morphicons.js:44 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.reducedDamping` | number | 55 | js/domains/features/morphicons.js:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.reducedStiffness` | number | 900 | js/domains/features/morphicons.js:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.stiffness` | number | 420 | js/domains/features/morphicons.js:37<br>js/domains/features/morphicons.js:42<br>js/domains/features/morphicons.js:44 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.search.indexRetry` | number | 1 | scripts/lib/feature-wiring.js:1259<br>js/domains/features/search-page.js:20<br>js/domains/features/search.js:22 | scripts/config-wiring.test.js:1342 | 已测（marker） |
| `tuning.search.indexTimeoutMs` | number | 5000 | scripts/lib/feature-wiring.js:1251<br>scripts/lib/feature-wiring.js:1258<br>js/domains/features/search-page.js:20 | scripts/config-wiring.test.js:1342 | 已测（marker） |
