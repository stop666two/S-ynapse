# 配置开关矩阵（行为开关 → 消费位置 → 覆盖证据）

> 本文件由 `node scripts/gen-config-switch-matrix.js` 生成，禁止手改；
> 键全集来自 `features-schema.js` / `tuning-defaults.js` / `site-defaults.js`（site/navigation/sidebar/footer/theme/security/friends/tagAliases/contentPolicy 全段）/ `internals-defaults.js` 注册表；
> `guard.json5` 细节键由 `guard-defaults.js` 与 guard 测试覆盖，不在本矩阵。
> 覆盖证据优先级：`test()`/`it()` 断言回调内的 `// switch: <键路径>` 标记（或紧贴该测试上方的标记）> 测试代码中「叶名 + 所属模块名同现」的引用 > `scripts/config-switch-exemptions.json` 逐键豁免理由。
> 证据口径（审查 R-33）：注释与字符串字面量先净化再切词，marker 必须绑定到含 assert 的测试回调，既有引用必须落在 test 回调内且 ±2 行内出现所属模块名——「文本里出现过」不再算覆盖。
> 消费位置按「叶子键名 + 父段」评分定位首个源码引用，供人工复核；存在同名字段的模块以类型与默认值判别。
> 回退字面量必须与注册表默认一致，由 `scripts/config-fallback-bindings.json` + `verify:config-single-source` 锁定。
> 「缺失」行是已登记在 `scripts/config-switch-baseline.json` 的存量缺口：新增缺失会让门禁失败，基线只允许缩小。

统计：开关共 801（已测 341，既有引用 100，豁免 360，缺失 0）；缺失行均已在 `scripts/config-switch-baseline.json` 登记（只允许缩小）。

| 键路径 | 类型 | 默认 | 消费位置 | 测试证据 | 覆盖状态 |
| --- | --- | --- | --- | --- | --- |
| `contentPolicy.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/media-policy.test.js:46<br>scripts/media-policy.test.js:69 | 既有引用 |
| `contentPolicy.svgSanitize` | bool | true | scripts/build/media.js:115<br>scripts/lib/content-policy.js:37<br>scripts/lib/content-policy.js:63 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.analytics.emitBeacon` | bool | true | scripts/lib/feature-wiring.js:1389<br>scripts/lib/feature-wiring.js:1403<br>scripts/lib/feature-wiring.js:1404 | scripts/config-wiring.test.js:869 | 已测（marker） |
| `features.analytics.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:869 | 已测（marker） |
| `features.analytics.injectAt` | enum | `body` | templates/layout.ejs:99<br>templates/layout.ejs:230<br>scripts/lib/feature-wiring.js:1388 | scripts/config-wiring.test.js:869 | 已测（marker） |
| `features.anchorStabilize.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:197 | 已测（marker） |
| `features.anchorStabilize.maxTrackMs` | number | 8000 | js/domains/core/anchor-stabilize.js:20<br>js/domains/core/anchor-stabilize.js:21<br>js/domains/core/anchor-stabilize.js:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.anchorStabilize.settleMs` | number | 300 | js/domains/core/anchor-stabilize.js:19<br>js/domains/core/anchor-stabilize.js:52<br>js/domains/core/anchor-stabilize.js:71 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.dismissible` | bool | true | templates/layout.ejs:24<br>templates/layout.ejs:100 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:232 | 已测（marker） |
| `features.announcement.newTab` | bool | true | js/domains/core/external-link.js:13<br>js/domains/core/external-link.js:21<br>js/domains/features/popup-notice.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.pauseOnHover` | bool | true | js/domains/core/announcement.js:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.removeDelayMs` | number | 340 | js/core/runtime.js:12<br>js/domains/core/announcement.js:45<br>js/domains/features/continue-reading.js:102 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.announcement.rotateMs` | number | 6000 | templates/layout.ejs:100 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.showDot` | bool | true | templates/layout.ejs:100<br>templates/site-css.ejs:250 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.showProgress` | bool | false | js/domains/features/continue-reading.js:108<br>js/domains/features/continue-reading.js:167<br>js/domains/features/continue-reading.js:171 | scripts/config-coverage-features-a.test.js:232 | 已测（marker） |
| `features.announcement.tone` | enum | `accent` | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.transition` | enum | `fade` | templates/site-css.ejs:15<br>templates/site-css.ejs:37<br>templates/site-css.ejs:43 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.announcement.transitionMs` | number | 450 | templates/site-css.ejs:508<br>scripts/lib/feature-wiring.js:1186 | scripts/config-wiring.test.js:1154 | 已测（marker） |
| `features.atmosphere.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:197 | 已测（marker） |
| `features.atmosphere.glow` | bool | true | templates/site-css.ejs:423 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.atmosphere.grain` | bool | true | templates/site-css.ejs:399 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:333 | 已测（marker） |
| `features.authorCard.maxTimeline` | number | 20 | templates/page.ejs:19 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.showSkills` | bool | true | templates/page.ejs:18 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.showSocial` | bool | true | templates/page.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.authorCard.showTimeline` | bool | true | templates/page.ejs:19 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.autoSummary.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring-build-switches.test.js:143<br>scripts/config-wiring-build-switches.test.js:284 | 已测（marker） |
| `features.autoSummary.maxLength` | number | 160 | js/domains/features/daily-quote.js:47<br>js/domains/features/search-core.js:327<br>js/domains/features/search-core.js:329 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.autoSummary.stripMarkdown` | bool | true | scripts/build/articles.js:225 | scripts/config-wiring-build-switches.test.js:150<br>scripts/config-wiring.test.js:59 | 既有引用 |
| `features.backToTop.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:541<br>scripts/config-coverage-features-a.test.js:575 | 已测（marker） |
| `features.backToTop.htmlAnchorFallback` | bool | false | templates/layout.ejs:223<br>templates/layout.ejs:224<br>scripts/lib/feature-wiring.js:686 | scripts/config-wiring.test.js:708 | 已测（marker） |
| `features.backToTop.scrollDurationMs` | number | 450 | scripts/lib/feature-wiring.js:684<br>js/domains/core/reading.js:33 | scripts/config-wiring.test.js:708 | 已测（marker） |
| `features.backToTop.showAfterPx` | number | 400 | js/domains/core/reading.js:102 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.backToTop.smoothScroll` | bool | true | js/domains/core/reading.js:36<br>scripts/lib/feature-wiring.js:685 | scripts/config-wiring.test.js:708 | 已测（marker） |
| `features.backToTop.zIndex` | number | 999 | templates/site-css.ejs:234<br>templates/site-css.ejs:510<br>js/domains/guard/defaults.js:145 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.autoDisableMobile` | bool | false | js/domains/features/background.js:12 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.count` | number | 72 | js/domains/features/background.js:17<br>js/domains/features/continue-reading.js:39<br>js/domains/features/continue-reading.js:40 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.background.particles.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/save-data.test.js:45 | 既有引用 |
| `features.background.particles.linkDistance` | number | 120 | js/domains/features/background.js:17 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.mobileMaxWidth` | number | 640 | js/domains/features/background.js:12 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.opacity` | number | 0.7 | templates/site-css.ejs:1<br>templates/site-css.ejs:3<br>templates/site-css.ejs:15 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.background.particles.showLines` | bool | true | js/domains/features/background.js:38 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.background.particles.speed` | number | 0.5 | js/domains/features/background.js:17 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.bilingual.breakpointPx` | number | 1280 | templates/post.ejs:11<br>templates/site-css.ejs:256<br>templates/site-css.ejs:273 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.fetchTimeoutMs` | number | 10000 | scripts/lib/feature-wiring.js:1104<br>js/domains/features/bilingual-core.js:20<br>js/domains/features/bilingual-core.js:28 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.resizeDebounceMs` | number | 120 | scripts/lib/feature-wiring.js:1105<br>js/domains/features/bilingual-core.js:21<br>js/domains/features/bilingual-core.js:29 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.sideBySide` | bool | true | templates/post.ejs:88<br>templates/post.ejs:11<br>templates/site-css.ejs:256 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.bilingual.switch` | bool | true | templates/post.ejs:11<br>js/domains/features/bilingual-core.js:25<br>js/domains/features/lightbox-core.js:178 | scripts/bilingual-core.test.js:27<br>scripts/bilingual-core.test.js:52 | 已测（marker） |
| `features.boot.budgetMs` | number | 40 | js/core/boot.js:202<br>js/core/boot.js:203 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.configTimeoutMs` | number | 3000 | templates/layout.ejs:97 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:576<br>scripts/frontend-boot-overlay.test.js:40 | 既有引用 |
| `features.boot.heavyMode` | enum | `idle` | js/core/boot.js:204<br>js/core/boot.js:221<br>js/core/boot.js:222 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.idleFallbackMs` | number | 120 | js/core/boot.js:26 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.boot.idleTimeoutMs` | number | 800 | js/core/boot.js:212<br>js/core/boot.js:222<br>js/core/boot.js:223 | scripts/config-coverage-features-a.test.js:541<br>scripts/config-coverage-features-a.test.js:575 | 已测（marker） |
| `features.boot.interactionWake` | bool | true | js/core/boot.js:178 | scripts/frontend-boot-overlay.test.js:40 | 既有引用 |
| `features.boot.log` | bool | false | js/core/boot.js:15<br>js/core/boot.js:84<br>js/core/boot.js:117 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.breadcrumb.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:255 | 已测（marker） |
| `features.breadcrumb.showCurrent` | bool | true | js/domains/core/toc.js:25<br>templates/layout.ejs:66<br>templates/layout.ejs:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.breadcrumb.showHome` | bool | true | templates/layout.ejs:62 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.categoryChip` | bool | true | templates/index.ejs:42<br>templates/tag.ejs:17 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.coverOverlay` | bool | true | templates/index.ejs:41<br>templates/tag.ejs:16<br>scripts/generate-og.js:232 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:314 | 已测（marker） |
| `features.cardFx.hoverShine` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.cardFx.readTimeBadge` | bool | true | templates/index.ejs:43<br>templates/tag.ejs:18 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.blobRevokeDelayMs` | number | 1000 | js/domains/core/code-block.js:49 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.copyAllButton` | bool | false | js/domains/core/code-block.js:57 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.copyButtonVisibility` | enum | `hover` | js/domains/core/code-block.js:11 | scripts/lib/config.fuzz.test.js:165<br>scripts/lib/config.fuzz.test.js:168 | 既有引用 |
| `features.codeBlock.downloadButton` | bool | true | js/domains/core/code-block.js:34<br>js/domains/core/code-block.js:42<br>js/domains/features/lightbox.js:46 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-split.test.js:80<br>scripts/config-wiring-runtime-switches.test.js:252 | 既有引用 |
| `features.codeBlock.lineNumbers` | bool | true | scripts/build/markdown.js:26 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.prismBatchMs` | number | 8 | templates/layout.ejs:242 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.prismIdleFallbackMs` | number | 60 | templates/layout.ejs:242 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.prismIdleTimeoutMs` | number | 300 | templates/layout.ejs:242 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.scrollHintTolerancePx` | number | 8 | scripts/lib/feature-wiring.js:1180<br>scripts/lib/feature-wiring.js:1178<br>js/domains/core/code-block.js:71 | scripts/config-wiring.test.js:1154 | 已测（marker） |
| `features.codeBlock.showLanguageTag` | bool | true | js/domains/core/code-block.js:32<br>js/domains/core/code-block.js:36 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.windowBar` | bool | true | js/domains/core/code-block.js:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeBlock.wrapLongLines` | bool | false | scripts/build/markdown.js:240 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.codeCopy.buttonTimeout` | number | 1500 | js/domains/core/code-block.js:11<br>templates/layout.ejs:235 | scripts/config-coverage-features-a.test.js:541<br>scripts/config-coverage-features-a.test.js:575 | 已测（marker） |
| `features.codeCopy.enabled` | bool | true | js/domains/core/code-block.js:16<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-wiring-runtime-switches.test.js:251<br>scripts/config-wiring-runtime-switches.test.js:264 | 已测（marker） |
| `features.codeCopy.showLineNumbers` | bool | false | scripts/build/markdown.js:26<br>scripts/build/markdown.js:239 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.autoFocus` | bool | true | js/domains/features/command-palette.js:183<br>scripts/lib/feature-wiring.js:1247 | scripts/config-wiring.test.js:1317 | 已测（marker） |
| `features.commandPalette.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.commandPalette.includeActions` | bool | true | js/domains/features/command-palette.js:55 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.includeNavigation` | bool | true | js/domains/features/command-palette.js:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.includeSearch` | bool | true | js/domains/features/command-palette.js:73<br>js/domains/features/command-palette.js:146 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.commandPalette.maxResults` | number | 10 | scripts/lib/feature-wiring.js:1246<br>js/domains/features/command-palette.js:26<br>js/domains/features/command-palette.js:153 | scripts/config-wiring.test.js:1317 | 已测（marker） |
| `features.comments.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/compression-config.test.js:39<br>scripts/compression-config.test.js:42 | 既有引用 |
| `features.comments.loadContainer` | bool | true | templates/post.ejs:161 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.comments.loadDelayMs` | number | 300 | js/domains/features/comments.js:8 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.comments.renderPlaceholder` | bool | true | templates/post.ejs:204 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.contactPopup.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:827 | 已测（marker） |
| `features.contactPopup.maxItems` | number | 4 | js/domains/features/contact-popup.js:8<br>js/domains/features/reading-history.js:8<br>js/domains/features/reading-history.js:102 | scripts/config-coverage-features-a.test.js:541<br>scripts/config-coverage-features-a.test.js:575 | 已测（marker） |
| `features.contactPopup.showAllItems` | bool | true | js/domains/features/contact-popup.js:8<br>scripts/lib/feature-wiring.js:910 | scripts/config-wiring.test.js:827 | 已测（marker） |
| `features.contactPopup.showIcon` | bool | true | templates/layout.ejs:164 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.continueReading.clearConfirmMs` | number | 3000 | scripts/lib/feature-wiring.js:1020<br>js/domains/features/continue-reading.js:104<br>js/domains/features/continue-reading.js:105 | scripts/config-wiring.test.js:1287 | 已测（marker） |
| `features.continueReading.count` | number | 3 | js/domains/features/background.js:17<br>js/domains/features/continue-reading.js:39<br>js/domains/features/continue-reading.js:40 | scripts/config-wiring.test.js:1287 | 已测（marker） |
| `features.continueReading.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:314 | 已测（marker） |
| `features.continueReading.removeDelayMs` | number | 360 | scripts/lib/feature-wiring.js:1019<br>js/core/runtime.js:12<br>js/domains/core/announcement.js:45 | scripts/config-wiring.test.js:1287 | 已测（marker） |
| `features.continueReading.showProgress` | bool | true | js/domains/features/continue-reading.js:108<br>js/domains/features/continue-reading.js:167<br>js/domains/features/continue-reading.js:171 | scripts/config-wiring.test.js:1287 | 已测（marker） |
| `features.cover.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:145 | 已测（marker） |
| `features.cover.preferImage` | bool | true | templates/post.ejs:52<br>js/domains/features/cover.js:42<br>scripts/lib/feature-wiring.js:108 | scripts/config-wiring.test.js:145 | 已测（marker） |
| `features.cover.preview` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.customCSS.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:255 | 已测（marker） |
| `features.dailyQuote.api.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/csp.test.js:114<br>scripts/csp.test.js:115 | 既有引用 |
| `features.dailyQuote.api.maxLength` | number | 0 | js/domains/features/daily-quote.js:47<br>js/domains/features/search-core.js:327<br>js/domains/features/search-core.js:329 | scripts/daily-quote.test.js:147<br>scripts/daily-quote.test.js:149 | 既有引用 |
| `features.dailyQuote.api.minIntervalMs` | number | 1000 | js/domains/features/daily-quote.js:194<br>js/domains/features/daily-quote.js:72 | scripts/daily-quote.test.js:187<br>scripts/daily-quote.test.js:198 | 既有引用 |
| `features.dailyQuote.api.timeoutMs` | number | 5000 | js/domains/features/daily-quote.js:138<br>js/core/boot.js:23<br>js/core/boot.js:25 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.dailyQuote.count` | number | 0 | js/domains/features/background.js:17<br>js/domains/features/continue-reading.js:39<br>js/domains/features/continue-reading.js:40 | scripts/daily-quote.test.js:256<br>scripts/daily-quote.test.js:263 | 既有引用 |
| `features.dailyQuote.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:186<br>scripts/config-wiring.test.js:188 | 既有引用 |
| `features.dailyQuote.widgetStyle` | enum | `card` | js/domains/features/daily-quote.js:317 | scripts/config-wiring.test.js:130<br>scripts/config-wiring.test.js:183 | 已测（marker） |
| `features.darkImageFilter.applyImages` | bool | true | templates/site-css.ejs:116 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.darkImageFilter.applyVideos` | bool | true | templates/site-css.ejs:116 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.darkImageFilter.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:197 | 已测（marker） |
| `features.debug.dumpConfig` | bool | false | scripts/build.js:176<br>scripts/lib/feature-wiring.js:1437 | scripts/config-wiring.test.js:958 | 已测（marker） |
| `features.debug.listPages` | bool | false | scripts/build.js:480<br>scripts/lib/feature-wiring.js:1436 | scripts/config-wiring.test.js:958 | 已测（marker） |
| `features.debug.verbose` | bool | false | scripts/build/pages.js:619<br>scripts/build.js:174<br>scripts/build/pages.js:650 | scripts/config-wiring.test.js:958 | 已测（marker） |
| `features.errorPage.suggestCount` | number | 5 | templates/404.ejs:2<br>scripts/lib/feature-wiring.js:1202<br>scripts/lib/feature-wiring.js:1204 | scripts/config-wiring.test.js:1154 | 已测（marker） |
| `features.exportArticle.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/export-article.test.js:69 | 已测（marker） |
| `features.exportArticle.markdown` | bool | true | scripts/build/context.js:299<br>scripts/build/context.js:308<br>scripts/build/pages.js:795 | scripts/export-article.test.js:69 | 已测（marker） |
| `features.exportArticle.print` | bool | true | templates/post.ejs:80<br>templates/post.ejs:85<br>templates/site-css.ejs:402 | scripts/export-article.test.js:69 | 已测（marker） |
| `features.exportArticle.sourceFootnote` | bool | true | templates/post.ejs:85<br>scripts/lib/feature-wiring.js:1046<br>templates/post.ejs:86 | scripts/export-article.test.js:69 | 已测（marker） |
| `features.exportBackup.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring-build-switches.test.js:168<br>scripts/config-wiring-build-switches.test.js:214 | 已测（marker） |
| `features.exportBackup.includeConfig` | bool | true | scripts/export.js:130<br>scripts/export.js:174 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.exportBackup.includeMedia` | bool | true | scripts/export.js:129<br>scripts/export.js:170 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.externalLink.copyFeedbackMs` | number | 1500 | scripts/lib/feature-wiring.js:972<br>js/domains/core/external-link.js:19 | scripts/config-wiring.test.js:1241 | 已测（marker） |
| `features.externalLink.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.externalLink.mode` | enum | `warn` | js/core/soft-nav.js:152<br>js/core/soft-nav.js:174<br>js/core/soft-nav.js:175 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.externalLink.openInNewTab` | bool | true | js/domains/core/external-link.js:13 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.externalLink.showFullUrl` | bool | true | js/domains/core/external-link.js:13 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.externalLink.whitelistNewTab` | bool | false | js/domains/core/external-link.js:16 | scripts/config-wiring.test.js:224 | 既有引用 |
| `features.favorites.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:294 | 已测（marker） |
| `features.favorites.listIcon` | bool | true | js/domains/features/favorites.js:62 | scripts/config-wiring.test.js:61 | 既有引用 |
| `features.gallery.collectFeatured` | bool | true | scripts/build/pages.js:339<br>scripts/build/pages.js:765<br>scripts/build/collectors.js:84 | scripts/config-wiring.test.js:473 | 已测（marker） |
| `features.gallery.columns` | number | 4 | templates/site-css.ejs:247<br>scripts/build/config.js:245<br>scripts/build/config.js:392 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.gallery.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring-build-switches.test.js:94<br>scripts/config-wiring-build-switches.test.js:114 | 已测（marker） |
| `features.gallery.showCaption` | bool | true | templates/gallery.ejs:16<br>js/domains/features/lightbox.js:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.gallery.showSource` | bool | true | templates/gallery.ejs:18 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.giscus.enabled` | bool | false | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:294 | 已测（marker） |
| `features.guards.accessGate` | bool | true | js/domains/guard/access-gate.js:5<br>js/domains/guard/defaults.js:231 | scripts/config-coverage-features-a.test.js:482 | 已测（marker） |
| `features.guards.consoleGuard` | bool | true | js/domains/guard/console-guard.js:3<br>js/domains/guard/defaults.js:171 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.contextMenu` | bool | true | js/domains/guard/context-menu.js:17<br>js/domains/guard/context-menu.js:116<br>js/domains/guard/context-menu.js:134 | scripts/config-coverage-features-a.test.js:482 | 已测（marker） |
| `features.guards.copyGuard` | bool | true | js/domains/guard/copy-guard.js:4<br>js/domains/guard/copy-guard.js:24<br>js/domains/guard/defaults.js:75 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.devtoolsDetect` | bool | true | js/domains/guard/defaults.js:151<br>js/domains/guard/devtools-detect.js:3 | scripts/config-coverage-features-a.test.js:482 | 已测（marker） |
| `features.guards.enabled` | bool | true | js/core/main.js:125<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-split.test.js:51<br>scripts/config-split.test.js:71 | 既有引用 |
| `features.guards.hotkeyGuard` | bool | true | js/domains/guard/defaults.js:114<br>js/domains/guard/hotkey-guard.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.preset` | enum | `soft` | js/domains/guard/core.js:72<br>js/domains/features/theme-lab.js:195<br>js/domains/features/theme-lab.js:196 | scripts/config-split.test.js:51<br>scripts/config-split.test.js:71 | 既有引用 |
| `features.guards.privacyCurtain` | bool | true | js/domains/guard/defaults.js:189<br>js/domains/guard/privacy-curtain.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.selectionGuard` | bool | true | js/domains/guard/defaults.js:104<br>js/domains/guard/selection-guard.js:4 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.tamperWatch` | bool | true | js/domains/guard/defaults.js:201<br>js/domains/guard/tamper-watch.js:5 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.guards.watermark` | bool | true | js/domains/guard/defaults.js:131<br>js/domains/guard/watermark.js:3<br>templates/site-css.ejs:562 | scripts/config-coverage-features-a.test.js:482 | 已测（marker） |
| `features.heatmap.levels` | number | 5 | templates/site-css.ejs:249<br>scripts/build/pages.js:385<br>scripts/lib/feature-wiring.js:772 | scripts/config-wiring.test.js:752<br>scripts/config-wiring.test.js:771 | 已测（marker） |
| `features.heatmap.scaling` | enum | `auto` | scripts/lib/feature-wiring.js:784<br>scripts/lib/feature-wiring.js:1369 | scripts/config-wiring.test.js:918 | 已测（marker） |
| `features.heatmap.showLegend` | bool | true | templates/archive.ejs:7<br>templates/archive.ejs:33<br>scripts/lib/feature-wiring.js:788 | scripts/config-wiring.test.js:685 | 既有引用 |
| `features.heatmap.showMonthNumbers` | bool | true | templates/archive.ejs:7<br>templates/archive.ejs:33<br>scripts/lib/feature-wiring.js:795 | scripts/config-wiring.test.js:686 | 既有引用 |
| `features.hero.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.hero.heightVh` | number | 61.8 | templates/site-css.ejs:43 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showCta` | bool | true | scripts/build/pages.js:698<br>templates/index.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showDate` | bool | false | scripts/build/pages.js:702<br>templates/index.ejs:12<br>templates/category.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showSearch` | bool | true | scripts/build/pages.js:696<br>templates/index.ejs:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.showTags` | bool | true | scripts/build/pages.js:697<br>templates/index.ejs:17<br>templates/index.ejs:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hero.tagCount` | number | 8 | scripts/build/pages.js:704<br>scripts/build/pages.js:705<br>scripts/lib/test-payloads.js:147 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hotSearches.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.hotSearches.maxWords` | number | 50 | scripts/lib/feature-wiring.js:978<br>js/domains/features/search.js:356 | scripts/config-wiring.test.js:1241 | 已测（marker） |
| `features.hotSearches.showClear` | bool | true | js/domains/features/search.js:392 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hotSearches.showInDropdown` | bool | true | js/domains/features/search.js:354<br>js/domains/features/search.js:382 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hotSearches.top` | number | 5 | js/domains/core/motion.js:86<br>js/domains/core/nav-state.js:65<br>js/domains/core/navigation.js:36 | scripts/config-coverage-features-a.test.js:541<br>scripts/config-coverage-features-a.test.js:575 | 已测（marker） |
| `features.hreflang.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:255 | 已测（marker） |
| `features.hreflang.includeSelf` | bool | true | templates/layout.ejs:45 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.hreflang.xDefault` | bool | true | templates/layout.ejs:45 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.i18n.enabled` | bool | true | js/domains/core/i18n.js:1<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-coverage-features-a.test.js:255 | 已测（marker） |
| `features.i18n.navToggle` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.i18n.translationNotice` | bool | true | templates/post.ejs:16 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFallback.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.imageFallback.showAlt` | bool | true | js/domains/core/image-lazy.js:173 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.align` | enum | `center` | templates/site-css.ejs:530<br>scripts/generate-og.js:265<br>scripts/generate-og.js:268 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.cap` | number | 1.5 | js/domains/features/popup-notice.js:109<br>js/domains/core/save-data-core.js:93<br>js/domains/core/save-data-core.js:104 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.maxHeightVh` | number | 0 | templates/site-css.ejs:114<br>templates/site-css.ejs:246<br>js/domains/core/code-block.js:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.content.upscale` | enum | `never` | scripts/build/pages.js:281<br>templates/site-css.ejs:530<br>templates/site-css.ejs:529 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.cover.applyToCards` | bool | true | templates/site-css.ejs:532 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.cover.fit` | enum | `cover` | templates/layout.ejs:227<br>scripts/generate-og.js:575<br>scripts/build/assets.js:157 | scripts/config-coverage-features-a.test.js:218 | 已测（marker） |
| `features.imageFit.cover.maxHeightVh` | number | 0 | templates/site-css.ejs:246<br>templates/site-css.ejs:114<br>js/domains/core/code-block.js:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:197 | 已测（marker） |
| `features.imageFit.gallery.maxHeightPx` | number | 0 | templates/site-css.ejs:529 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.gallery.stretch` | bool | false | templates/site-css.ejs:533<br>templates/site-css.ejs:59 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.lightbox.fit` | enum | `contain` | templates/layout.ejs:227<br>scripts/build/assets.js:157<br>scripts/generate-og.js:575 | scripts/config-coverage-features-a.test.js:255 | 已测（marker） |
| `features.imageFit.lightbox.maxHeightVh` | number | 82 | templates/site-css.ejs:246<br>templates/site-css.ejs:114<br>js/domains/core/code-block.js:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageFit.lightbox.maxWidthPct` | number | 92 | templates/site-css.ejs:245<br>templates/site-css.ejs:246<br>scripts/lib/feature-wiring.js:671 | scripts/config-wiring.test.js:699 | 既有引用 |
| `features.imageLazy.eagerFirst` | number | 1 | templates/index.ejs:34<br>js/domains/core/image-lazy.js:138 | scripts/config-wiring.test.js:1028 | 既有引用 |
| `features.imageLazy.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.imageLazy.fadeIn` | bool | true | js/domains/core/image-lazy.js:136<br>templates/site-css.ejs:65<br>templates/site-css.ejs:300 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.imageLazy.fadeInDurationMs` | number | 300 | templates/site-css.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageLazy.lqip` | bool | true | scripts/build/media.js:218<br>js/domains/core/image-lazy.js:141<br>scripts/build/markdown.js:169 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageLazy.lqipWidth` | number | 24 | scripts/build/media.js:220 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.imageLazy.preserveAspectRatio` | bool | true | scripts/build/markdown.js:24<br>scripts/lib/feature-wiring.js:649 | scripts/config-wiring.test.js:473<br>scripts/config-wiring.test.js:527 | 已测（marker） |
| `features.incrementalBuild.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/incremental-build.test.js:78<br>scripts/incremental-build.test.js:97 | 已测（marker） |
| `features.incrementalBuild.skipUnchanged` | bool | true | scripts/lib/incremental.js:109 | scripts/incremental-build.test.js:78 | 已测（marker） |
| `features.incrementalBuild.watch` | bool | true | js/domains/features/morphicons.js:81<br>js/domains/features/morphicons.js:125<br>js/domains/features/morphicons.js:136 | scripts/incremental-build.test.js:78 | 已测（marker） |
| `features.lcpOptimize.asyncCjkFontCss` | bool | false | templates/layout.ejs:93 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.contentVisibility` | bool | false | templates/site-css.ejs:175 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.offscreenSkip.asideEstimatePx` | number | 900 | templates/site-css.ejs:176 | scripts/config-wiring.test.js:44 | 既有引用 |
| `features.lcpOptimize.offscreenSkip.cardEstimatePx` | number | 480 | templates/site-css.ejs:176 | scripts/config-wiring.test.js:43 | 既有引用 |
| `features.lcpOptimize.offscreenSkip.cardsFrom` | number | 4 | templates/site-css.ejs:176 | scripts/config-wiring.test.js:41<br>scripts/config-wiring.test.js:42 | 既有引用 |
| `features.lcpOptimize.offscreenSkip.enabled` | bool | false | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:39<br>scripts/config-wiring.test.js:40 | 既有引用 |
| `features.lcpOptimize.preloadFirstCard` | bool | false | templates/layout.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.revealExemptFirstPaint` | bool | false | templates/site-css.ejs:15<br>templates/site-css.ejs:319 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lcpOptimize.skipLatinFontPreloadOnCjk` | bool | false | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.captionMaxLines` | number | 2 | templates/site-css.ejs:246 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.clickTolerancePx` | number | 6 | scripts/lib/feature-wiring.js:944<br>js/domains/features/lightbox.js:33 | scripts/config-wiring.test.js:1212 | 已测（marker） |
| `features.lightbox.closeButton` | bool | true | js/domains/features/lightbox.js:44<br>js/domains/features/popup-notice.js:38<br>js/domains/features/popup-notice.js:127 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.lightbox.closeOnBackdrop` | bool | true | js/domains/features/lightbox.js:35<br>js/domains/features/popup-notice.js:145<br>scripts/lib/popup-notice-config.js:26 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.lightbox.dblClickZoom` | bool | true | js/domains/features/lightbox.js:34 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.dblClickZoomLevel` | number | 2 | scripts/lib/feature-wiring.js:943<br>js/domains/features/lightbox.js:32<br>scripts/lib/feature-wiring.js:938 | scripts/config-wiring.test.js:1212 | 已测（marker） |
| `features.lightbox.downloadButton` | bool | true | js/domains/core/code-block.js:34<br>js/domains/core/code-block.js:42<br>js/domains/features/lightbox.js:46 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/build.test.js:68<br>scripts/config-coverage-features-a.test.js:276 | 既有引用 |
| `features.lightbox.escToClose` | bool | true | js/domains/features/lightbox.js:35<br>js/domains/features/popup-notice.js:77<br>js/domains/features/popup-notice.js:86 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.lightbox.keyboardNavigate` | bool | true | js/domains/features/lightbox.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.minSize` | number | 60 | js/domains/features/lightbox.js:66 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.mouseSwipeThresholdPx` | number | 80 | scripts/lib/feature-wiring.js:942<br>js/domains/features/lightbox.js:28 | scripts/config-wiring.test.js:1212 | 已测（marker） |
| `features.lightbox.openDurationMs` | number | 180 | js/domains/features/lightbox.js:17<br>scripts/lib/feature-wiring.js:672 | scripts/config-wiring.test.js:692 | 已测（marker） |
| `features.lightbox.panEnabled` | bool | true | js/domains/features/lightbox.js:25 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.pinchEnabled` | bool | true | js/domains/features/lightbox.js:25 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.preloadAdjacent` | bool | true | js/domains/features/lightbox.js:68 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.prevNextButtons` | bool | true | js/domains/features/lightbox.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.rememberPosition` | bool | false | js/domains/core/read-position.js:3<br>js/domains/features/lightbox.js:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.rotateEnabled` | bool | true | js/domains/features/lightbox.js:25 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.showCaption` | bool | true | templates/gallery.ejs:16<br>js/domains/features/lightbox.js:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.showCounter` | bool | true | js/domains/features/lightbox.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.showZoomButtons` | bool | true | js/domains/features/lightbox.js:34 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.slideshow.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/lightbox-core.test.js:42 | 已测（marker） |
| `features.lightbox.slideshow.intervalMs` | number | 4000 | js/domains/features/lightbox.js:97<br>js/domains/features/lightbox-core.js:33<br>js/domains/features/lightbox-core.js:34 | scripts/lightbox-core.test.js:42 | 已测（marker） |
| `features.lightbox.swipeClose` | bool | true | js/domains/features/lightbox.js:35<br>js/domains/features/lightbox.js:141 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.swipeCloseThresholdPx` | number | 80 | scripts/lib/feature-wiring.js:941<br>js/domains/features/lightbox.js:28 | scripts/config-wiring.test.js:1212 | 已测（marker） |
| `features.lightbox.swipeThresholdPx` | number | 50 | scripts/lib/feature-wiring.js:940<br>js/domains/features/lightbox.js:28 | scripts/config-wiring.test.js:1212 | 已测（marker） |
| `features.lightbox.swipeToNavigate` | bool | true | js/domains/features/lightbox.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.switchDurationMs` | number | 120 | js/domains/features/lightbox.js:18<br>scripts/lib/feature-wiring.js:673 | scripts/config-wiring.test.js:692 | 已测（marker） |
| `features.lightbox.transitionDurationMs` | number | 220 | templates/site-css.ejs:246<br>scripts/lib/feature-wiring.js:669<br>js/domains/features/lightbox.js:16 | scripts/config-wiring.test.js:692 | 已测（marker） |
| `features.lightbox.wheelZoom` | bool | true | js/domains/features/lightbox.js:34 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.zoom.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/lightbox-core.test.js:18 | 已测（marker） |
| `features.lightbox.zoom.maxScale` | number | 4 | js/domains/features/lightbox-core.js:20<br>js/domains/features/lightbox.js:26<br>js/domains/features/lightbox-core.js:19 | scripts/lightbox-core.test.js:18 | 已测（marker） |
| `features.lightbox.zoomEnabled` | bool | true | js/domains/features/lightbox-core.js:18 | scripts/config-coverage-features-a.test.js:354 | 已测（marker） |
| `features.lightbox.zoomMax` | number | 4 | js/domains/features/lightbox-core.js:20 | scripts/config-coverage-features-a.test.js:354 | 已测（marker） |
| `features.lightbox.zoomMin` | number | 1 | js/domains/features/lightbox.js:26 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.lightbox.zoomStep` | number | 0.25 | js/domains/features/lightbox.js:26 | scripts/config-coverage-features-a.test.js:541<br>scripts/config-coverage-features-a.test.js:575 | 已测（marker） |
| `features.listCover.autoGenerate.backgroundStyle` | enum | `gradient` | scripts/lib/auto-cover.js:237<br>scripts/build/auto-cover.js:51<br>scripts/build/auto-cover.js:72 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.format` | enum | `webp` | templates/layout.ejs:31<br>js/domains/features/continue-reading.js:143<br>js/domains/features/reading-history.js:85 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.height` | number | 630 | js/domains/core/motion.js:81<br>js/domains/core/motion.js:84<br>js/domains/core/nav-state.js:64 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.showCategory` | bool | false | scripts/build/auto-cover.js:53<br>scripts/build/auto-cover.js:74<br>scripts/generate-og.js:278 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.showSiteName` | bool | true | scripts/build/auto-cover.js:52<br>scripts/build/auto-cover.js:73<br>scripts/lib/auto-cover.js:71 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.autoGenerate.width` | number | 1200 | js/domains/core/motion.js:81<br>js/domains/core/motion.js:84<br>js/domains/core/nav-state.js:60 | scripts/auto-cover.test.js:22 | 已测（marker） |
| `features.listCover.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:138 | 已测（marker） |
| `features.listCover.showOnArchive` | bool | true | scripts/lib/feature-wiring.js:100 | scripts/config-wiring.test.js:138 | 已测（marker） |
| `features.listCover.showOnHome` | bool | true | js/domains/features/reading-history.js:101 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.ariaBusy` | bool | true | js/core/boot.js:103<br>js/core/boot.js:158 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.delayMs` | number | 120 | js/core/boot.js:136<br>js/core/boot.js:137<br>js/core/boot.js:140 | scripts/frontend-boot-overlay.test.js:40 | 既有引用 |
| `features.loading.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/frontend-boot-overlay.test.js:40 | 既有引用 |
| `features.loading.fadeMs` | number | 380 | templates/site-css.ejs:510<br>js/core/boot.js:109<br>js/core/boot.js:110 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.failsafeBufferMs` | number | 60 | js/core/boot.js:156 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.maxShowMs` | number | 2000 | templates/site-css.ejs:511<br>js/core/boot.js:154 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.minShowMs` | number | 250 | js/core/boot.js:106 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.reducedMotion` | enum | `skip` | templates/site-css.ejs:301<br>templates/site-css.ejs:306<br>js/core/boot.js:97 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.showTitle` | bool | false | templates/layout.ejs:171<br>js/core/boot.js:39 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.spinner` | bool | true | js/core/boot.js:37 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.spinnerStyle` | enum | `orbit` | js/core/boot.js:38<br>js/core/boot.js:50<br>js/core/boot.js:52 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.loading.zIndex` | number | 3000 | templates/site-css.ejs:510<br>templates/site-css.ejs:234<br>js/domains/guard/defaults.js:145 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.dropCap` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:294 | 已测（marker） |
| `features.magazine.figureBleed` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.headingNumbers` | bool | false | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.magazine.tableHover` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.maintenance.enabled` | bool | false | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring-maintenance.test.js:72<br>scripts/config-wiring-maintenance.test.js:81 | 已测（marker） |
| `features.maintenance.retryAfter` | number | 3600 | workers/security-worker.js:302<br>scripts/build/serve.js:53<br>scripts/generate-security-config.js:187 | scripts/config-wiring.test.js:944 | 已测（marker） |
| `features.maintenance.setRetryAfter` | bool | true | workers/security-worker.js:301<br>scripts/build/serve.js:56<br>scripts/generate-security-config.js:201 | scripts/config-wiring.test.js:944 | 已测（marker） |
| `features.maintenance.status` | enum | 503 | js/core/boot.js:194<br>js/core/runtime.js:20<br>js/core/soft-nav.js:91 | scripts/config-wiring-maintenance.test.js:135<br>scripts/config-wiring-maintenance.test.js:290 | 已测（marker） |
| `features.math.autoDetect` | bool | true | scripts/build/markdown.js:60<br>scripts/build/markdown.js:245<br>js/domains/core/math-render.js:65 | scripts/config-wiring.test.js:387<br>scripts/config-wiring.test.js:527 | 已测（marker） |
| `features.math.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:387<br>scripts/config-wiring.test.js:572 | 已测（marker） |
| `features.math.mathml` | bool | true | js/domains/core/math-render.js:57<br>scripts/lib/feature-wiring.js:406 | scripts/config-wiring.test.js:387 | 已测（marker） |
| `features.math.renderRoundParens` | bool | true | js/domains/core/math-render.js:71<br>scripts/lib/feature-wiring.js:404<br>scripts/lib/feature-wiring.js:446 | scripts/config-wiring.test.js:387 | 已测（marker） |
| `features.math.renderSquareBrackets` | bool | true | js/domains/core/math-render.js:72<br>scripts/lib/feature-wiring.js:405<br>scripts/lib/feature-wiring.js:450 | scripts/config-wiring.test.js:387 | 已测（marker） |
| `features.math.strict` | bool | false | js/domains/core/math-render.js:56<br>js/domains/core/math-render.js:78<br>js/domains/core/math-render.js:100 | scripts/config-coverage-features-a.test.js:366<br>scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.math.throwOnError` | bool | false | js/domains/core/math-render.js:55<br>js/domains/core/math-render.js:77<br>js/domains/core/math-render.js:99 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mediaAudit.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring-build-switches.test.js:156<br>scripts/config-wiring-build-switches.test.js:184 | 已测（marker） |
| `features.mediaAudit.reportDuplicate` | bool | false | scripts/audit-media.js:148<br>scripts/audit-media.js:150 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mediaAudit.reportMissed` | bool | true | scripts/audit-media.js:146<br>scripts/audit-media.js:197 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mediaAudit.reportUnreferenced` | bool | true | scripts/audit-media.js:147<br>scripts/audit-media.js:207 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.autoDetect` | bool | true | js/domains/core/math-render.js:65<br>scripts/build/markdown.js:60<br>scripts/build/markdown.js:245 | scripts/config-wiring.test.js:441 | 已测（marker） |
| `features.mermaid.clientOptions.class.htmlLabels` | bool | false | scripts/lib/feature-wiring.js:1297<br>scripts/lib/feature-wiring.js:1293<br>scripts/lib/feature-wiring.js:1298 | scripts/config-wiring.test.js:1363<br>scripts/config-wiring.test.js:1364 | 既有引用 |
| `features.mermaid.clientOptions.flowchart.htmlLabels` | bool | false | scripts/lib/feature-wiring.js:1293<br>scripts/lib/feature-wiring.js:1297<br>scripts/lib/feature-wiring.js:1298 | scripts/config-wiring.test.js:1359<br>scripts/config-wiring.test.js:1403 | 既有引用 |
| `features.mermaid.clientOptions.state.htmlLabels` | bool | false | scripts/lib/feature-wiring.js:1298<br>scripts/lib/feature-wiring.js:1293<br>scripts/lib/feature-wiring.js:1297 | scripts/config-wiring.test.js:1363<br>scripts/config-wiring.test.js:1364 | 既有引用 |
| `features.mermaid.copyAfterRender` | bool | false | templates/layout.ejs:235<br>scripts/build/mermaid.js:24<br>scripts/build/mermaid.js:75 | scripts/config-wiring.test.js:441 | 已测（marker） |
| `features.mermaid.darkMode` | bool | true | js/domains/core/theme.js:6<br>scripts/build/assets.js:194<br>scripts/build/config.js:219 | scripts/mermaid-render.test.js:145 | 既有引用 |
| `features.mermaid.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:441 | 已测（marker） |
| `features.mermaid.followTheme` | bool | true | scripts/build/mermaid.js:23<br>scripts/lib/feature-wiring.js:537 | scripts/config-wiring.test.js:441 | 已测（marker） |
| `features.mermaid.idleFallbackMs` | number | 200 | js/core/boot.js:26 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.idleTimeoutMs` | number | 1500 | js/core/boot.js:212<br>js/core/boot.js:222<br>js/core/boot.js:223 | scripts/config-coverage-features-a.test.js:255 | 已测（marker） |
| `features.mermaid.mode` | enum | `build` | js/core/soft-nav.js:152<br>js/core/soft-nav.js:174<br>js/core/soft-nav.js:175 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.mermaid.renderTimeoutMs` | number | 10000 | scripts/build/mermaid.js:56 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.rerenderIdleFallbackMs` | number | 60 | templates/layout.ejs:238 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.rerenderIdleTimeoutMs` | number | 300 | templates/layout.ejs:238 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mermaid.size.fit` | enum | `scroll` | scripts/build/assets.js:157<br>scripts/generate-og.js:575<br>scripts/lib/mermaid-render.js:211 | scripts/config-coverage-features-a.test.js:541<br>scripts/config-coverage-features-a.test.js:575 | 已测（marker） |
| `features.mobile.codeScrollHint` | bool | true | templates/site-css.ejs:636<br>templates/site-css.ejs:637<br>js/domains/core/code-block.js:70 | scripts/config-wiring.test.js:819 | 已测（marker） |
| `features.mobile.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:819 | 已测（marker） |
| `features.mobile.safeAreaBottom` | bool | true | templates/site-css.ejs:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobile.searchFullscreen` | bool | true | templates/site-css.ejs:67<br>templates/site-css.ejs:68<br>scripts/lib/feature-wiring.js:895 | scripts/config-wiring.test.js:819 | 已测（marker） |
| `features.mobile.tapHighlight` | bool | false | templates/site-css.ejs:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobile.tocBreakpoint` | number | 900 | templates/site-css.ejs:235<br>templates/site-css.ejs:37 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobile.touchFallback` | bool | true | templates/site-css.ejs:634<br>templates/site-css.ejs:635<br>js/domains/features/touch-fallback.js:42 | scripts/config-wiring.test.js:819 | 已测（marker） |
| `features.mobileBottomNav.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:255 | 已测（marker） |
| `features.mobileBottomNav.onlyMobile` | bool | true | — | scripts/config-wiring.test.js:54 | 既有引用 |
| `features.mobileToc.autoClose` | bool | true | js/domains/core/toc.js:147 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobileToc.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:255 | 已测（marker） |
| `features.mobileToc.lockScroll` | bool | true | js/domains/core/toc.js:125<br>js/domains/core/toc.js:133<br>js/domains/core/toc.js:139 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobileToc.overlayClose` | bool | true | js/domains/core/toc.js:273 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.mobileToc.showCurrent` | bool | true | js/domains/core/toc.js:25<br>templates/layout.ejs:66<br>templates/layout.ejs:69 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.morphIcons.enabled` | bool | true | js/core/runtime.js:19<br>js/core/runtime.js:18<br>js/core/boot.js:97 | scripts/config-wiring-runtime-switches.test.js:149<br>scripts/config-wiring-runtime-switches.test.js:162 | 已测（marker） |
| `features.morphIcons.icons.copy` | bool | true | js/domains/features/daily-quote.js:264<br>js/domains/features/daily-quote.js:265<br>js/domains/features/daily-quote.js:266 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.morphIcons.icons.favorite` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.morphIcons.icons.menu` | bool | true | js/domains/guard/context-menu.js:37<br>js/domains/guard/context-menu.js:44<br>js/domains/guard/context-menu.js:45 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.morphIcons.icons.theme` | bool | true | js/core/runtime.js:19<br>scripts/build/config.js:146<br>js/domains/guard/context-menu.js:9 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.morphIcons.icons.tts` | bool | true | scripts/lib/feature-wiring.js:749<br>templates/post.ejs:78<br>js/core/deferred.js:41 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.morphIcons.idleTimeoutMs` | number | 3000 | scripts/lib/feature-wiring.js:984<br>js/core/boot.js:212<br>js/core/boot.js:222 | scripts/config-wiring.test.js:1241 | 已测（marker） |
| `features.morphIcons.preload` | enum | `interaction` | js/domains/features/lightbox.js:68<br>js/domains/features/lightbox.js:111<br>js/domains/features/morphicons.js:195 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.morphIcons.reducedMotion` | enum | `light` | templates/site-css.ejs:301<br>templates/site-css.ejs:306<br>js/core/boot.js:97 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.morphIcons.spring` | enum | `snappy` | js/domains/features/morphicons.js:46 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.buttonRipple` | bool | true | js/domains/core/motion.js:77 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.cardHoverLift` | bool | true | js/domains/core/motion.js:74 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.cardHoverLiftPx` | number | 4 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.cardHoverScale` | number | 1.02 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-a.test.js:541 | 已测（marker） |
| `features.motion.linkUnderline` | bool | true | js/domains/core/motion.js:71 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.reducedMotion` | enum | `light` | templates/site-css.ejs:301<br>templates/site-css.ejs:306<br>js/core/boot.js:97 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealBlocks` | bool | false | js/domains/core/motion.js:42 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealCards` | bool | true | js/domains/core/motion.js:39 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealCleanupMs` | number | 1400 | js/domains/core/motion.js:63 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealDelayMs` | number | 0 | js/domains/guard/defaults.js:196<br>js/domains/guard/privacy-curtain.js:25 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealDurationMs` | number | 250 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealHeadings` | bool | true | js/domains/core/motion.js:40 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealImages` | bool | true | js/domains/core/motion.js:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealOnce` | bool | true | js/domains/core/motion.js:46 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.revealStaggerMax` | number | 500 | — | scripts/config-wiring.test.js:120 | 已测（marker） |
| `features.motion.revealThreshold` | number | 0.08 | js/domains/core/motion.js:47 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.rippleDurationMs` | number | 500 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.motion.scrollReveal` | bool | true | js/domains/core/motion.js:37 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImage.autoSize.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/og-size.test.js:55 | 已测（marker） |
| `features.ogImage.autoSize.maxDimension` | number | 2560 | scripts/generate-og.js:425<br>scripts/build.js:275<br>scripts/lib/og-size.js:75 | scripts/og-size.test.js:63 | 已测（marker） |
| `features.ogImage.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/lib/malicious.fuzz.test.js:125<br>scripts/lib/malicious.fuzz.test.js:127 | 既有引用 |
| `features.ogImage.fontScale` | number | 0.75 | scripts/build/config.js:299<br>scripts/generate-og.js:431<br>scripts/generate-og.js:436 | scripts/config-coverage-features-a.test.js:429 | 已测（marker） |
| `features.ogImage.format` | enum | `png` | templates/layout.ejs:31<br>js/domains/features/continue-reading.js:143<br>js/domains/features/reading-history.js:85 | scripts/og-format.test.js:8 | 已测（marker） |
| `features.ogImage.gradientForNoCover` | bool | true | scripts/generate-og.js:600 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImage.jpegQuality` | number | 82 | scripts/lib/og-format.js:15 | scripts/config-coverage-features-a.test.js:410 | 已测（marker） |
| `features.ogImage.overlay.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/h2-dataflow.test.js:384<br>scripts/popup-notice-config.test.js:18 | 既有引用 |
| `features.ogImage.overlay.wrap` | number | 20 | js/core/main.js:101<br>js/core/main.js:102<br>js/core/main.js:103 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImage.useCover` | bool | true | scripts/generate-og.js:444<br>scripts/generate-og.js:568<br>scripts/lib/og-cache-key.js:25 | scripts/config-coverage-features-a.test.js:429 | 已测（marker） |
| `features.ogImageStyle.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/lib/malicious.fuzz.test.js:125<br>scripts/lib/malicious.fuzz.test.js:127 | 既有引用 |
| `features.ogImageStyle.fontSizeBase` | number | 64 | scripts/generate-og.js:598<br>templates/site-css.ejs:1 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImageStyle.maxLines` | number | 4 | scripts/generate-og.js:600<br>scripts/generate-og.js:597<br>scripts/lib/auto-cover.js:165 | scripts/config-coverage-features-a.test.js:429 | 已测（marker） |
| `features.ogImageStyle.palette` | enum | `theme` | scripts/generate-og.js:417<br>scripts/generate-og.js:600<br>templates/site-css.ejs:431 | scripts/config-coverage-features-a.test.js:429 | 已测（marker） |
| `features.ogImageStyle.showCategory` | bool | true | scripts/build/auto-cover.js:53<br>scripts/build/auto-cover.js:74<br>scripts/generate-og.js:278 | scripts/config-coverage-features-b.test.js:685 | 已测（marker） |
| `features.ogImageStyle.showSite` | bool | true | scripts/generate-og.js:267 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImageStyle.showUrl` | bool | true | scripts/generate-og.js:274 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.ogImageStyle.template` | enum | `aurora` | scripts/generate-og.js:286<br>scripts/generate-og.js:600<br>js/domains/features/continue-reading.js:63 | scripts/lib/malicious.fuzz.test.js:127 | 既有引用 |
| `features.ogImageStyle.useGradient` | bool | true | scripts/generate-og.js:600<br>templates/site-css.ejs:232<br>scripts/generate-og.js:337 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.durationMs` | number | 180 | templates/site-css.ejs:301<br>templates/site-css.ejs:306<br>js/core/runtime.js:12 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.pageTransition.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.pageTransition.leaveGuardMs` | number | 2500 | js/domains/core/page-transition.js:20 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.outDurationMs` | number | 120 | js/domains/core/page-transition.js:14<br>templates/site-css.ejs:303 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.reducedDurationMs` | number | 70 | js/domains/core/page-transition.js:21 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.reducedMotion` | enum | `light` | templates/site-css.ejs:301<br>templates/site-css.ejs:306<br>js/core/boot.js:97 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.pageTransition.type` | enum | `slide` | js/core/runtime.js:12<br>js/core/soft-nav.js:92<br>js/core/soft-nav.js:93 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.pagefind.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:155 | 已测（marker） |
| `features.pagefind.integrate` | bool | true | js/domains/features/search-page.js:193<br>js/domains/features/search.js:64<br>scripts/lib/feature-wiring.js:115 | scripts/config-wiring.test.js:155 | 已测（marker） |
| `features.perfBudget.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:593 | 已测（marker） |
| `features.perfBudget.htmlKb` | number | 40 | scripts/build/report.js:152<br>scripts/build/report.js:158<br>scripts/build/report.js:179 | scripts/build.test.js:662 | 已测（marker） |
| `features.perfBudget.htmlRawKb` | number | 50 | scripts/build/report.js:177<br>scripts/build/report.js:179<br>scripts/lib/perf-budget.js:5 | scripts/build.test.js:662 | 已测（marker） |
| `features.perfBudget.inlineConfigKb` | number | 2 | scripts/build.js:35<br>scripts/build.js:51<br>scripts/build.js:52 | scripts/build.test.js:662 | 已测（marker） |
| `features.perfBudget.jsKb` | number | 76 | scripts/build/report.js:179<br>scripts/lib/feature-wiring.js:1418<br>scripts/lib/perf-budget.js:5 | scripts/build.test.js:662 | 已测（marker） |
| `features.perfBudget.requests` | number | 12 | scripts/build/report.js:153<br>scripts/build/report.js:164<br>scripts/build/report.js:179 | scripts/build.test.js:662 | 已测（marker） |
| `features.perfBudget.warnOnly` | bool | true | scripts/build.js:431<br>scripts/build/report.js:218<br>scripts/build/report.js:220 | scripts/config-coverage-features-b.test.js:593 | 已测（marker） |
| `features.performance.warningBuildMs` | number | 30000 | scripts/lib/feature-wiring.js:1426 | scripts/config-wiring.test.js:932 | 已测（marker） |
| `features.performance.warningHtmlKb` | number | 400 | scripts/lib/feature-wiring.js:1419 | scripts/config-wiring.test.js:932 | 已测（marker） |
| `features.performance.warningImageKb` | number | 300 | scripts/build/report.js:207<br>scripts/lib/feature-wiring.js:1421 | scripts/config-wiring.test.js:932 | 已测（marker） |
| `features.performance.warningJsKb` | number | 80 | scripts/lib/feature-wiring.js:1417 | scripts/config-wiring.test.js:932 | 已测（marker） |
| `features.pinned.badgeStyle` | enum | `pill` | templates/post.ejs:15<br>templates/archive.ejs:35<br>templates/category.ejs:8 | scripts/config-wiring.test.js:55<br>scripts/config-wiring.test.js:86 | 既有引用 |
| `features.pinned.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:86<br>scripts/config-wiring.test.js:90 | 既有引用 |
| `features.pinned.sortRule` | enum | `pinned-first` | scripts/lib/feature-wiring.js:54<br>scripts/lib/feature-wiring.js:33<br>scripts/lib/feature-wiring.js:38 | scripts/config-wiring.test.js:56<br>scripts/config-wiring.test.js:86 | 既有引用 |
| `features.popupNotice.closeButton.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/popup-notice-config.test.js:16<br>scripts/popup-notice-config.test.js:18 | 既有引用 |
| `features.popupNotice.closeIcon` | bool | true | js/domains/features/popup-notice.js:136<br>scripts/lib/popup-notice-config.js:25<br>scripts/lib/popup-notice-config.js:80 | scripts/popup-notice-config.test.js:61 | 既有引用 |
| `features.popupNotice.closeOnBackdrop` | bool | true | js/domains/features/lightbox.js:35<br>js/domains/features/popup-notice.js:145<br>scripts/lib/popup-notice-config.js:26 | scripts/popup-notice-config.test.js:61 | 既有引用 |
| `features.popupNotice.delayMs` | number | 1500 | js/core/boot.js:136<br>js/core/boot.js:137<br>js/core/boot.js:140 | scripts/popup-notice-config.test.js:14<br>scripts/popup-notice-config.test.js:30 | 既有引用 |
| `features.popupNotice.enabled` | bool | false | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/popup-notice-config.test.js:14<br>scripts/popup-notice-config.test.js:46 | 既有引用 |
| `features.popupNotice.escToClose` | bool | true | js/domains/features/lightbox.js:35<br>js/domains/features/popup-notice.js:77<br>js/domains/features/popup-notice.js:86 | scripts/popup-notice-config.test.js:61 | 既有引用 |
| `features.popupNotice.qr.enabled` | bool | false | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/popup-notice-config.test.js:14<br>scripts/popup-notice-config.test.js:16 | 既有引用 |
| `features.popupNotice.removeDelayMs` | number | 240 | js/core/runtime.js:12<br>js/domains/core/announcement.js:45<br>js/domains/features/continue-reading.js:102 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.popupNotice.reshowOnChange` | bool | true | js/domains/features/popup-notice.js:15<br>scripts/lib/popup-notice-config.js:22 | scripts/popup-notice-config.test.js:14 | 既有引用 |
| `features.prevNext.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.prevNext.hideWhenMissing` | bool | false | templates/post.ejs:259 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.labelPosition` | enum | `left` | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.scrollToTopOnClick` | bool | true | js/domains/features/prev-next.js:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.showLabels` | bool | true | templates/post.ejs:264<br>templates/post.ejs:271 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prevNext.showThumbnail` | bool | false | templates/post.ejs:263<br>templates/post.ejs:270 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.printStyle.avoidBreaks` | bool | true | templates/site-css.ejs:401 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.printStyle.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.printStyle.expandLinks` | bool | true | templates/site-css.ejs:401 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.printStyle.hideInteractive` | bool | true | templates/site-css.ejs:401 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.prismTheme.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.pwa.assetCacheFirst` | bool | true | scripts/build/assets.js:244<br>scripts/build/assets.js:249<br>scripts/build/assets.js:259 | scripts/pwa-sw.test.js:66<br>scripts/pwa-sw.test.js:94 | 已测（marker） |
| `features.pwa.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:258<br>scripts/config-coverage-features-b.test.js:259 | 既有引用 |
| `features.pwa.installPrompt` | bool | true | templates/site-css.ejs:506<br>js/domains/features/pwa.js:61<br>js/domains/features/pwa.js:62 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.pwa.offlineNotice` | bool | true | js/domains/features/pwa.js:156 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.pwa.offlinePage` | bool | true | scripts/build/assets.js:181<br>scripts/build/assets.js:212<br>scripts/build/assets.js:242 | scripts/config-coverage-features-b.test.js:474 | 已测（marker） |
| `features.pwa.pageCacheLimit` | number | 24 | scripts/build/assets.js:245<br>scripts/build/assets.js:246<br>scripts/build/assets.js:260 | scripts/pwa-sw.test.js:94 | 已测（marker） |
| `features.pwa.pageNetworkFirst` | bool | true | scripts/build/assets.js:243<br>scripts/build/assets.js:249<br>scripts/build/assets.js:258 | scripts/pwa-sw.test.js:66<br>scripts/pwa-sw.test.js:94 | 已测（marker） |
| `features.pwa.precache` | bool | true | scripts/build/assets.js:213<br>scripts/build/assets.js:214<br>scripts/build/assets.js:231 | scripts/pwa-sw.test.js:94 | 已测（marker） |
| `features.pwa.registerSW` | bool | true | js/domains/features/pwa.js:133 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.pwa.reloadFallbackMs` | number | 3000 | scripts/lib/feature-wiring.js:1192<br>js/domains/features/pwa.js:54<br>js/domains/features/pwa.js:125 | scripts/config-wiring.test.js:1154 | 已测（marker） |
| `features.pwa.updateCheckIntervalMs` | number | 1800000 | js/domains/features/pwa.js:150 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.pwa.updatePrompt` | bool | true | templates/site-css.ejs:507<br>js/domains/features/pwa.js:136 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.pwa.updateToastMs` | number | 0 | js/domains/features/pwa.js:42 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.readDock.directionDeltaPx` | number | 12 | scripts/lib/feature-wiring.js:965<br>js/domains/core/reading.js:114<br>js/domains/core/reading.js:116 | scripts/config-wiring.test.js:1234 | 已测（marker） |
| `features.readDock.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.readDock.hideBelowPx` | number | 80 | scripts/lib/feature-wiring.js:964<br>js/domains/core/reading.js:114<br>js/domains/core/reading.js:115 | scripts/config-wiring.test.js:1234 | 已测（marker） |
| `features.readDock.hideOnScrollDown` | bool | true | js/domains/core/reading.js:118 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readDock.showProgressRing` | bool | true | js/domains/core/reading.js:187<br>js/domains/core/reading.js:192 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readDock.showTocButton` | bool | true | js/domains/core/reading.js:187<br>js/domains/core/reading.js:193 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readDock.showTopButton` | bool | true | js/domains/core/reading.js:187<br>js/domains/core/reading.js:194 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readMode.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.readMode.focusOnlyContent` | bool | true | js/domains/core/reading-mode.js:5 | scripts/config-wiring.test.js:53 | 既有引用 |
| `features.readMode.persist` | bool | true | scripts/lib/feature-wiring.js:1054<br>js/domains/core/reading-mode.js:7<br>js/domains/core/reading.js:4 | scripts/config-wiring.test.js:1254 | 已测（marker） |
| `features.readingHistory.clearable` | bool | true | js/domains/features/reading-history.js:111 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingHistory.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.readingHistory.maxItems` | number | 5 | js/domains/features/contact-popup.js:8<br>js/domains/features/reading-history.js:8<br>js/domains/features/reading-history.js:102 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.readingHistory.maxStored` | number | 50 | scripts/lib/feature-wiring.js:997<br>scripts/lib/feature-wiring.js:1018<br>js/domains/core/read-position.js:10 | scripts/config-wiring.test.js:1254 | 已测（marker） |
| `features.readingHistory.progressThrottleMs` | number | 800 | scripts/lib/feature-wiring.js:998<br>js/domains/features/reading-history.js:12<br>js/domains/features/reading-history.js:13 | scripts/config-wiring.test.js:1030<br>scripts/config-wiring.test.js:1206 | 既有引用 |
| `features.readingHistory.showOnHome` | bool | true | js/domains/features/reading-history.js:101 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.readingPanel.fontSizeDefault` | number | 19 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.fontSizeMax` | number | 26 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.fontSizeMin` | number | 15 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.fontSizeStep` | number | 1 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightDefault` | number | 1.9 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightMax` | number | 2.6 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightMin` | number | 1.4 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.lineHeightStep` | number | 0.1 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.remember` | bool | true | js/domains/features/lightbox.js:53<br>js/domains/features/lightbox.js:110<br>js/domains/features/lightbox.js:118 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.showReset` | bool | true | templates/post.ejs:120 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthDefault` | number | 800 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthMax` | number | 1200 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthMin` | number | 560 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingPanel.widthStep` | number | 40 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.ariaAnnounce` | bool | true | js/domains/core/reading.js:141 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.articleOnly` | bool | true | js/domains/core/reading.js:137 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.clickToJump` | bool | true | js/domains/core/reading.js:144 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.readingProgress.keyboardStep` | number | 0.05 | scripts/lib/feature-wiring.js:953<br>js/domains/core/reading.js:163<br>scripts/lib/feature-wiring.js:951 | scripts/config-wiring.test.js:1225 | 已测（marker） |
| `features.readingProgress.maxStoredPositions` | number | 80 | scripts/lib/feature-wiring.js:955<br>js/domains/core/read-position.js:9 | scripts/config-wiring.test.js:1225 | 已测（marker） |
| `features.readingProgress.minRestorePx` | number | 160 | scripts/lib/feature-wiring.js:954<br>js/domains/core/read-position.js:7<br>js/domains/core/read-position.js:8 | scripts/config-wiring.test.js:1225 | 已测（marker） |
| `features.readingProgress.rememberPosition` | bool | true | js/domains/core/read-position.js:3<br>js/domains/features/lightbox.js:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.rememberPositionMaxAgeHours` | number | 72 | js/domains/core/read-position.js:5 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.saveThrottleMs` | number | 400 | scripts/lib/feature-wiring.js:956<br>js/domains/core/read-position.js:11<br>js/domains/core/read-position.js:12 | scripts/config-wiring.test.js:1225 | 已测（marker） |
| `features.readingProgress.showDot` | bool | true | templates/layout.ejs:100<br>templates/site-css.ejs:250 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.showTip` | bool | true | js/domains/core/reading.js:77<br>js/domains/core/reading.js:78<br>js/domains/core/reading.js:88 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.tipDisplayMs` | number | 500 | js/domains/core/reading.js:76 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.updateThrottleMs` | number | 30 | js/domains/core/reading.js:212 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.useGradient` | bool | true | templates/site-css.ejs:232<br>scripts/generate-og.js:337<br>scripts/generate-og.js:600 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingProgress.zIndex` | number | 1000 | templates/site-css.ejs:234<br>templates/site-css.ejs:510<br>js/domains/guard/defaults.js:145 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingTime.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.readingTime.showInMeta` | bool | true | templates/post.ejs:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingTime.wordsPerMinuteCJK` | number | 250 | scripts/build/articles.js:316 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.readingTime.wordsPerMinuteLatin` | number | 200 | scripts/build/articles.js:317 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.redirects.applyInServe` | bool | true | scripts/build/serve.js:58 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.redirects.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/h2-dataflow.test.js:311<br>scripts/h2-dataflow.test.js:315 | 既有引用 |
| `features.redirects.generatePagesFile` | bool | true | scripts/build/security-files.js:28 | scripts/h2-dataflow.test.js:311 | 既有引用 |
| `features.redirects.invalidRule` | enum | `abort` | scripts/build/security-files.js:36<br>scripts/lib/redirect-rules.js:26<br>scripts/lib/redirect-rules.js:34 | scripts/config-wiring.test.js:897 | 已测（marker） |
| `features.related.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.related.excerptLength` | number | 80 | templates/post.ejs:152<br>js/domains/features/search-page.js:15<br>js/domains/features/search.js:227 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.related.excludeCurrent` | bool | true | scripts/lib/feature-wiring.js:601<br>scripts/lib/related.js:21<br>scripts/lib/related.js:26 | scripts/config-wiring.test.js:473 | 已测（marker） |
| `features.related.minScore` | number | 2 | scripts/lib/related.js:20<br>scripts/lib/related.js:32 | scripts/build.test.js:700 | 已测（marker） |
| `features.related.sameCategoryWeight` | number | 2 | scripts/lib/related.js:19 | scripts/build.test.js:700 | 已测（marker） |
| `features.related.sameTagWeight` | number | 3 | scripts/lib/related.js:18 | scripts/build.test.js:700 | 已测（marker） |
| `features.related.showCount` | bool | false | js/domains/features/search-page.js:17<br>js/domains/features/search.js:243<br>scripts/lib/feature-wiring.js:176 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.related.showExcerpt` | bool | true | templates/post.ejs:152<br>templates/category.ejs:32<br>templates/index.ejs:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.related.topN` | number | 4 | scripts/lib/related.js:35<br>scripts/build/report.js:20<br>scripts/build/report.js:80 | scripts/build.test.js:700 | 已测（marker） |
| `features.reward.closeByBtn` | bool | true | js/domains/features/reward.js:29<br>scripts/lib/feature-wiring.js:761 | scripts/config-wiring.test.js:742 | 已测（marker） |
| `features.reward.closeByEsc` | bool | true | js/domains/features/reward.js:35<br>scripts/lib/feature-wiring.js:763 | scripts/config-wiring.test.js:742 | 已测（marker） |
| `features.reward.closeByOverlay` | bool | true | js/domains/features/reward.js:30<br>scripts/lib/feature-wiring.js:762 | scripts/config-wiring.test.js:742 | 已测（marker） |
| `features.reward.enabled` | bool | false | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.reward.showNote` | bool | true | templates/post.ejs:233 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.saveDataMode.auto` | bool | true | templates/layout.ejs:23<br>templates/site-css.ejs:7<br>templates/site-css.ejs:15 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.animations` | bool | true | templates/site-css.ejs:18<br>js/domains/core/save-data-core.js:30<br>scripts/lib/feature-wiring.js:1127 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.lazyAggressive` | bool | true | js/domains/core/image-lazy.js:18<br>js/domains/core/save-data-core.js:33<br>scripts/lib/feature-wiring.js:1130 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.lowResImages` | bool | true | js/domains/core/image-lazy.js:17<br>js/domains/core/save-data-core.js:32<br>scripts/lib/feature-wiring.js:1129 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.lowResMaxWidthPx` | number | 0 | scripts/lib/feature-wiring.js:1132<br>js/domains/core/image-lazy.js:14<br>js/domains/core/image-lazy.js:19 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.particles` | bool | true | js/domains/features/background.js:6<br>js/domains/core/save-data-core.js:31<br>js/domains/features/background.js:56 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.degrade.systemFontsOnly` | bool | true | templates/site-css.ejs:19<br>js/domains/core/save-data-core.js:34<br>scripts/lib/feature-wiring.js:1131 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.saveDataMode.manual` | bool | true | templates/layout.ejs:23<br>templates/post.ejs:113<br>templates/post.ejs:115 | scripts/save-data.test.js:29<br>scripts/save-data.test.js:55 | 已测（marker） |
| `features.schemaRich.articleSection` | bool | true | templates/layout.ejs:54 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.authorUrl` | bool | true | templates/layout.ejs:54 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.blogHomepage` | bool | true | templates/layout.ejs:54 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.breadcrumbs` | bool | true | templates/layout.ejs:55 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.dateModified` | bool | true | templates/layout.ejs:54 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.image` | bool | true | templates/layout.ejs:54<br>templates/post.ejs:229<br>templates/post.ejs:230 | scripts/config-coverage-features-b.test.js:450 | 已测（marker） |
| `features.schemaRich.keywords` | bool | true | templates/layout.ejs:54 | scripts/config-coverage-features-b.test.js:450 | 已测（marker） |
| `features.schemaRich.timeRequired` | bool | true | templates/layout.ejs:54 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.schemaRich.wordCount` | bool | true | templates/layout.ejs:54<br>scripts/lib/feature-wiring.js:609<br>templates/category.ejs:25 | scripts/config-coverage-features-b.test.js:450 | 已测（marker） |
| `features.scrollBehavior.behavior` | enum | `smooth` | templates/site-css.ejs:7<br>js/core/runtime.js:11<br>js/domains/core/anchor-stabilize.js:47 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.scrollBehavior.enabled` | bool | true | js/core/runtime.js:11<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.scrollBehavior.respectReducedMotion` | bool | true | templates/site-css.ejs:7<br>js/core/runtime.js:11<br>templates/site-css.ejs:301 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.scrollIndicator.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.scrollIndicator.gradient` | bool | true | templates/site-css.ejs:492 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.scrollIndicator.respectReducedMotion` | bool | true | templates/site-css.ejs:495<br>templates/site-css.ejs:7<br>templates/site-css.ejs:301 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.closeOnOverlay` | bool | true | js/domains/features/search.js:419 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.debounceMs` | number | 120 | js/domains/features/search.js:181 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:564<br>scripts/config-coverage-features-b.test.js:565 | 既有引用 |
| `features.search.excerptLength` | number | 120 | templates/post.ejs:152<br>js/domains/features/search-page.js:15<br>js/domains/features/search.js:227 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.focusDelayMs` | number | 100 | js/domains/features/search.js:139<br>js/domains/guard/access-gate.js:120<br>js/domains/guard/defaults.js:233 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.focusOnOpen` | bool | true | js/domains/features/search.js:126 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.highlightMatches` | bool | true | js/domains/features/search-page.js:22<br>js/domains/features/search.js:230 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.includeContent` | bool | true | scripts/build/feeds.js:327 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.index.bigram` | bool | true | js/domains/features/search-core.js:205<br>js/domains/features/search-page.js:19<br>scripts/build/feeds.js:360 | scripts/search-core.test.js:81 | 已测（marker） |
| `features.search.index.maxGzipKb` | number | 60 | scripts/build/feeds.js:342<br>scripts/lib/search-index.js:22<br>scripts/lib/search-index.js:26 | scripts/lib/search.fuzz.test.js:246<br>scripts/lib/search.fuzz.test.js:250 | 既有引用 |
| `features.search.matchCategories` | bool | true | js/domains/features/search-core.js:203<br>js/domains/features/search-core.js:227<br>js/domains/features/search-core.js:241 | scripts/config-wiring.test.js:230<br>scripts/config-wiring.test.js:249 | 已测（marker） |
| `features.search.matchTags` | bool | true | js/domains/features/search-core.js:202<br>js/domains/features/search-core.js:227<br>js/domains/features/search-core.js:238 | scripts/config-wiring.test.js:230<br>scripts/config-wiring.test.js:249 | 已测（marker） |
| `features.search.maxHistory` | number | 5 | js/domains/features/search.js:337 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.maxResults` | number | 30 | js/domains/features/command-palette.js:26<br>js/domains/features/command-palette.js:153<br>js/domains/features/search-page.js:14 | scripts/theme-override.test.js:94 | 既有引用 |
| `features.search.minChars` | number | 1 | js/domains/features/search-page.js:13<br>js/domains/features/search.js:190<br>js/domains/guard/copy-guard.js:62 | scripts/theme-override.test.js:95 | 既有引用 |
| `features.search.resultTagCount` | number | 6 | scripts/lib/feature-wiring.js:1150<br>js/domains/features/search-page.js:18<br>js/domains/features/search-page.js:87 | scripts/config-wiring.test.js:1154 | 已测（marker） |
| `features.search.showCount` | bool | true | js/domains/features/search-page.js:17<br>js/domains/features/search.js:243<br>scripts/lib/feature-wiring.js:176 | scripts/config-wiring.test.js:230 | 已测（marker） |
| `features.search.showHistoryOnFocus` | bool | true | js/domains/features/search.js:168 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.search.weightContent` | number | 1 | scripts/build/feeds.js:331<br>js/domains/features/search-page.js:16<br>js/domains/features/search.js:242 | scripts/config-wiring.test.js:230<br>scripts/config-wiring.test.js:249 | 已测（marker） |
| `features.search.weightExcerpt` | number | 2 | scripts/build/feeds.js:330<br>js/domains/features/search-page.js:16<br>js/domains/features/search.js:242 | scripts/config-wiring.test.js:230<br>scripts/search-core.test.js:138 | 已测（marker） |
| `features.search.weightTitle` | number | 5 | scripts/build/feeds.js:329<br>js/domains/features/search-page.js:16<br>js/domains/features/search.js:242 | scripts/config-wiring.test.js:230<br>scripts/config-wiring.test.js:249 | 已测（marker） |
| `features.searchEnginePing.enabled` | bool | false | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:535 | 已测（marker） |
| `features.searchEnginePing.onlyProduction` | bool | true | scripts/build/feeds.js:280 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.searchEnginePing.timeoutMs` | number | 5000 | scripts/build/feeds.js:299<br>js/core/boot.js:23<br>js/core/boot.js:25 | scripts/config-coverage-features-b.test.js:535 | 已测（marker） |
| `features.searchHighlight.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.searchHighlight.maxMatches` | number | 20 | js/domains/features/search-core.js:289<br>js/domains/features/search-page.js:23<br>js/domains/features/search-page.js:40 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.series.defaultWidgetCount` | number | 8 | scripts/lib/feature-wiring.js:569 | scripts/config-wiring.test.js:453 | 已测（marker） |
| `features.series.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:453 | 已测（marker） |
| `features.series.order` | enum | `asc` | scripts/build/pages.js:860<br>scripts/lib/series-page.js:19<br>scripts/lib/series-page.js:62 | scripts/config-coverage-features-b.test.js:641 | 已测（marker） |
| `features.series.pageEnabled` | bool | true | scripts/build/feeds.js:221<br>scripts/build/pages.js:761<br>scripts/build/pages.js:855 | scripts/config-wiring.test.js:453 | 已测（marker） |
| `features.series.showBadge` | bool | true | templates/post.ejs:15<br>scripts/lib/feature-wiring.js:37<br>scripts/lib/feature-wiring.js:560 | scripts/config-wiring.test.js:453 | 已测（marker） |
| `features.series.showNavPanel` | bool | true | templates/post.ejs:209<br>scripts/lib/feature-wiring.js:563 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.series.showPosition` | bool | true | templates/post.ejs:213<br>templates/series-page.ejs:9<br>scripts/lib/feature-wiring.js:568 | scripts/config-wiring.test.js:453 | 已测（marker） |
| `features.series.sidebarWidget` | bool | true | templates/layout.ejs:181<br>templates/layout.ejs:194<br>scripts/lib/feature-wiring.js:564 | scripts/config-wiring.test.js:453 | 已测（marker） |
| `features.share.copiedShowMs` | number | 2500 | js/domains/features/share.js:10 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.copyFallback` | bool | true | js/domains/features/share.js:31<br>js/domains/features/share.js:32 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.share.popupHeight` | number | 520 | js/domains/features/share.js:43 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.popupWidth` | number | 640 | js/domains/features/share.js:43<br>scripts/lib/feature-wiring.js:906<br>scripts/lib/feature-wiring.js:909 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.share.showLabel` | bool | false | templates/post.ejs:224 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.share.useNativeShare` | bool | false | js/domains/features/share.js:11 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.shortcuts.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:167 | 已测（marker） |
| `features.shortcuts.ignoreInInputs` | bool | true | js/domains/features/shortcuts.js:20 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.shortcuts.showHelpHint` | bool | true | scripts/build/pages.js:400<br>scripts/lib/feature-wiring.js:128<br>scripts/build/pages.js:17 | scripts/config-wiring.test.js:167 | 已测（marker） |
| `features.shortcuts.showHelpTable` | bool | true | templates/layout.ejs:228 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.sidebarDrag.hapticMs` | number | 10 | js/domains/features/sidebar-drag.js:54<br>js/domains/features/sidebar-drag.js:55<br>js/domains/features/sidebar-drag.js:63 | scripts/config-wiring.test.js:1454<br>scripts/config-wiring.test.js:1455 | 既有引用 |
| `features.sidebarDrag.persistOrder` | bool | true | js/domains/features/sidebar-drag.js:7<br>js/domains/features/sidebar-drag.js:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.resetOnLoadFail` | bool | true | js/domains/features/sidebar-drag.js:22 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.showHandleOnHover` | bool | true | js/domains/features/sidebar-drag.js:118 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.touchLongPress` | bool | true | js/domains/features/sidebar-drag.js:99<br>js/domains/features/sidebar-drag.js:100<br>js/domains/features/sidebar-drag.js:123 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sidebarDrag.touchLongPressMs` | number | 500 | js/domains/features/sidebar-drag.js:101 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sitemap.maxUrlsPerFile` | number | 500 | scripts/build/feeds.js:174 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.sitemap.split` | bool | true | js/core/runtime.js:10<br>js/core/soft-nav.js:181<br>js/domains/core/code-block.js:1 | scripts/h2-dataflow.test.js:297<br>scripts/lib/feeds.fuzz.test.js:250 | 既有引用 |
| `features.softNavigation.cacheMaxEntries` | number | 16 | scripts/lib/feature-wiring.js:990<br>templates/layout.ejs:97<br>js/core/soft-nav.js:16 | scripts/config-wiring.test.js:1254 | 已测（marker） |
| `features.softNavigation.cacheTtlMs` | number | 300000 | templates/layout.ejs:97<br>js/core/soft-nav.js:20 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.softNavigation.prefetchDelayMs` | number | 80 | js/core/soft-nav.js:232 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.prefetchOnHover` | bool | true | js/core/soft-nav.js:221 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.scrollToTop` | bool | true | js/core/soft-nav.js:183<br>js/domains/core/reading.js:30<br>js/domains/core/reading.js:180 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.timeoutMs` | number | 10000 | js/core/boot.js:23<br>js/core/boot.js:25<br>js/core/boot.js:26 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.softNavigation.toggle.defaultOn` | bool | true | js/core/soft-nav.js:38<br>js/domains/core/seamless-nav.js:23 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.softNavigation.toggle.show` | bool | true | templates/layout.ejs:141<br>js/domains/features/bilingual.js:123<br>js/domains/features/bilingual.js:122 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.softNavigation.viewTransition` | bool | true | templates/layout.ejs:141<br>templates/index.ejs:40<br>templates/index.ejs:50 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.delivery` | enum | `inline` | scripts/build/security-files.js:162<br>js/domains/core/seamless-nav.js:39 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.eagerness` | enum | `moderate` | scripts/build/security-files.js:164<br>js/domains/core/seamless-nav.js:65 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.speculation.mode` | enum | `both` | js/core/soft-nav.js:152<br>js/core/soft-nav.js:174<br>js/core/soft-nav.js:175 | scripts/config-coverage-features-b.test.js:501 | 已测（marker） |
| `features.speculation.toggle.defaultOn` | bool | true | js/core/soft-nav.js:38<br>js/domains/core/seamless-nav.js:23 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.speculation.toggle.show` | bool | true | templates/layout.ejs:141<br>js/domains/features/bilingual.js:123<br>js/domains/features/bilingual.js:122 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.stats.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:804 | 既有引用 |
| `features.stats.showArchiveCards` | bool | true | templates/archive.ejs:6<br>templates/archive.ejs:13<br>scripts/lib/feature-wiring.js:868 | scripts/config-wiring.test.js:803 | 已测（marker） |
| `features.stats.showSidebar` | bool | true | templates/layout.ejs:180<br>templates/layout.ejs:193 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.subscribe.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.subscribe.jsonFeed` | bool | true | scripts/build/feeds.js:108<br>scripts/build/feeds.js:147<br>scripts/build/minify.js:826 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.subscribe.newTab` | bool | true | js/domains/core/external-link.js:13<br>js/domains/core/external-link.js:21<br>js/domains/features/popup-notice.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.subscribe.rss` | bool | true | templates/layout.ejs:202<br>scripts/build/config.js:423<br>scripts/build/config.js:424 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.supSub.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:360 | 已测（marker） |
| `features.supSub.preserveUnmatched` | bool | true | scripts/build/markdown.js:46<br>scripts/build/markdown.js:128<br>scripts/lib/feature-wiring.js:287 | scripts/config-wiring.test.js:360<br>scripts/config-wiring.test.js:368 | 已测（marker） |
| `features.supSub.skipInsideMath` | bool | true | scripts/build/markdown.js:45<br>scripts/build/markdown.js:51<br>scripts/lib/feature-wiring.js:286 | scripts/config-wiring.test.js:360 | 已测（marker） |
| `features.themeLab.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/theme-lab.test.js:114 | 已测（marker） |
| `features.themePresets.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.themePresets.persistChoice` | bool | true | js/domains/features/theme-presets.js:7 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themePresets.pickerVisible` | bool | true | js/domains/features/theme-presets.js:7 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themePresets.previewOnHover` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themePresets.showInNavbar` | bool | true | templates/layout.ejs:144 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.applyInstantly` | bool | true | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.checkIntervalMs` | number | 60000 | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.enabled` | bool | false | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.themeSchedule.respectManualOverride` | bool | true | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.smoothTransition` | bool | true | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeSchedule.smoothTransitionMs` | number | 350 | js/domains/features/theme-schedule.js:3 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeToggle.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring-runtime-switches.test.js:80<br>scripts/config-wiring-runtime-switches.test.js:97 | 已测（marker） |
| `features.themeToggle.toggleIconSwap` | bool | true | js/domains/features/morphicons.js:105<br>templates/layout.ejs:238 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.themeToggle.zIndex` | number | 100 | templates/site-css.ejs:234<br>templates/site-css.ejs:510<br>js/domains/guard/defaults.js:145 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toast.durationMs` | number | 2500 | js/core/runtime.js:12<br>templates/site-css.ejs:301<br>templates/site-css.ejs:306 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.toast.enabled` | bool | true | js/core/runtime.js:12<br>js/core/runtime.js:18<br>js/core/runtime.js:19 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.toast.maxVisible` | number | 3 | js/core/runtime.js:12<br>scripts/build/pages.js:714 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toast.position` | enum | `bottom-center` | js/core/runtime.js:12<br>templates/layout.ejs:235<br>templates/post.ejs:47 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.toast.removeDelayMs` | number | 300 | js/core/runtime.js:12<br>js/domains/core/announcement.js:45<br>js/domains/features/continue-reading.js:102 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.toc.activeOffset` | number | 120 | js/domains/core/toc.js:183 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.collapsible` | bool | true | js/domains/core/toc.js:167<br>js/domains/core/toc.js:182<br>templates/site-css.ejs:120 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.toc.defaultOpenLevel` | number | 2 | js/domains/core/toc.js:179 | scripts/config-wiring.test.js:111 | 已测（marker） |
| `features.toc.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.toc.groupCollapse` | bool | true | js/domains/core/toc.js:189 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.highlightActive` | bool | true | js/domains/core/toc.js:19 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.maxLevel` | number | 4 | scripts/build/articles.js:327<br>scripts/lib/utils.js:218<br>scripts/lib/utils.js:222 | scripts/config-coverage-features-b.test.js:625 | 已测（marker） |
| `features.toc.maxWidthPx` | number | 320 | templates/site-css.ejs:37 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.minLevel` | number | 2 | scripts/build/articles.js:327<br>js/domains/core/toc.js:180<br>scripts/lib/feature-wiring.js:70 | scripts/config-coverage-features-b.test.js:625 | 已测（marker） |
| `features.toc.progressLine` | bool | true | js/domains/core/toc.js:31 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.showTitle` | bool | true | templates/layout.ejs:171<br>js/core/boot.js:39 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.updateUrl` | bool | true | js/domains/core/toc.js:237 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.toc.visitedFade` | bool | true | js/domains/core/toc.js:23 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tocScrollSpy.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:714 | 已测（marker） |
| `features.tocScrollSpy.offset` | number | 80 | js/domains/core/navigation.js:8<br>js/domains/core/navigation.js:10<br>js/domains/core/toc.js:183 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tocScrollSpy.throttleMs` | number | 60 | js/domains/guard/tamper-watch.js:23<br>js/domains/guard/tamper-watch.js:24 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.tts.highlightParagraph` | bool | false | js/domains/features/tts.js:30<br>scripts/lib/feature-wiring.js:753 | scripts/config-wiring.test.js:717 | 已测（marker） |
| `features.tts.highlightReading` | bool | true | js/domains/features/tts.js:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.pitch` | number | 1 | js/domains/features/tts.js:100 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.preferDefaultVoice` | bool | true | js/domains/features/tts.js:91<br>scripts/lib/feature-wiring.js:738<br>scripts/lib/feature-wiring.js:751 | scripts/config-wiring.test.js:717 | 已测（marker） |
| `features.tts.rate` | number | 0.5 | js/domains/features/tts.js:99<br>scripts/perf-audit.js:219 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.tts.resumeIntervalMs` | number | 500 | js/domains/features/tts.js:110 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.resumeMaxTries` | number | 3 | js/domains/features/tts.js:110 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.tts.volume` | number | 1 | js/domains/features/tts.js:101 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.viewTransition.durationMs` | number | 180 | templates/site-css.ejs:306<br>templates/site-css.ejs:301<br>js/core/runtime.js:12 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.viewTransition.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:251<br>scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.viewTransition.reducedMotion` | enum | `light` | templates/site-css.ejs:306<br>templates/site-css.ejs:301<br>js/core/boot.js:97 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.viewTransition.shared` | bool | true | templates/index.ejs:40<br>templates/index.ejs:50<br>templates/post.ejs:15 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.viewTransition.toggle.defaultOn` | bool | true | js/core/soft-nav.js:38<br>js/domains/core/seamless-nav.js:23 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.viewTransition.toggle.show` | bool | true | templates/layout.ejs:141<br>js/domains/features/bilingual.js:123<br>js/domains/features/bilingual.js:122 | scripts/config-coverage-features-b.test.js:376 | 已测（marker） |
| `features.viewTransition.type` | enum | `fade` | js/core/runtime.js:12<br>js/core/soft-nav.js:92<br>js/core/soft-nav.js:93 | scripts/config-coverage-features-b.test.js:251 | 已测（marker） |
| `features.wikiLinks.allowCustomLabel` | bool | true | scripts/build/articles.js:266<br>scripts/lib/feature-wiring.js:244<br>scripts/lib/utils.js:352 | scripts/config-wiring.test.js:270<br>scripts/config-wiring.test.js:284 | 已测（marker） |
| `features.wikiLinks.caseInsensitive` | bool | true | scripts/build/articles.js:265<br>scripts/lib/feature-wiring.js:243<br>scripts/lib/utils.js:351 | scripts/config-wiring.test.js:270<br>scripts/config-wiring.test.js:284 | 已测（marker） |
| `features.wikiLinks.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-wiring.test.js:270 | 已测（marker） |
| `features.wikiLinks.openNewTab` | bool | false | js/domains/guard/context-menu.js:103<br>js/domains/guard/defaults.js:59 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `features.wikiLinks.unknownMode` | enum | `text` | scripts/build/articles.js:263<br>scripts/lib/feature-wiring.js:241<br>scripts/lib/utils.js:349 | scripts/config-wiring.test.js:270<br>scripts/config-wiring.test.js:284 | 已测（marker） |
| `features.wordCount.countCjkChars` | bool | true | scripts/build/articles.js:312<br>scripts/lib/feature-wiring.js:621<br>scripts/lib/utils.js:182 | scripts/config-wiring.test.js:485 | 既有引用 |
| `features.wordCount.countDigits` | bool | true | scripts/build/articles.js:312<br>scripts/lib/feature-wiring.js:622<br>scripts/lib/utils.js:183 | scripts/config-wiring.test.js:340<br>scripts/config-wiring.test.js:341 | 既有引用 |
| `features.wordCount.enabled` | bool | true | js/core/runtime.js:18<br>js/core/runtime.js:19<br>js/core/boot.js:97 | scripts/config-coverage-features-b.test.js:641 | 已测（marker） |
| `features.wordCount.inArticle` | bool | true | templates/post.ejs:37<br>scripts/lib/feature-wiring.js:615 | scripts/config-wiring.test.js:485 | 既有引用 |
| `features.wordCount.onCards` | bool | true | templates/category.ejs:25<br>templates/index.ejs:63<br>templates/series-page.ejs:24 | scripts/config-wiring.test.js:354<br>scripts/config-wiring.test.js:485 | 既有引用 |
| `features.wordCount.wpm` | number | 265 | scripts/lib/feature-wiring.js:611<br>scripts/build/articles.js:322<br>scripts/lib/feature-wiring.js:620 | scripts/config-wiring.test.js:483 | 已测（marker） |
| `footer.beian.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:213 | 已测（marker） |
| `footer.bottomLinks.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:213 | 已测（marker） |
| `footer.columnItems.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:213 | 已测（marker） |
| `footer.columns` | number | 3 | templates/site-css.ejs:209<br>scripts/build/config.js:245<br>scripts/build/config.js:392 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `footer.options.linkHoverUnderline` | bool | true | templates/site-css.ejs:211 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `footer.poweredBy.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:213 | 已测（marker） |
| `footer.social.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/malicious.test.js:718 | 既有引用 |
| `friends.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:450 | 已测（marker） |
| `friends.sidebarCount` | number | 8 | scripts/lib/feature-wiring.js:1214 | scripts/config-wiring.test.js:1130<br>scripts/config-wiring.test.js:1131 | 既有引用 |
| `internals.audit.a11y.htmlSummaryMax` | number | 120 | scripts/a11y-audit.js:35 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.audit.a11y.nodesPerRuleMax` | number | 3 | scripts/a11y-audit.js:36 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.audit.a11y.pages` | number | 0 | scripts/a11y-audit.js:77<br>js/domains/features/reading-panel.js:55<br>js/domains/features/reading-panel.js:60 | scripts/config-coverage-nonfeatures.test.js:708 | 已测（marker） |
| `internals.audit.distHash.previewLimit` | number | 20 | scripts/dist-hash-guard.js:14<br>scripts/release-prune.js:87<br>scripts/release-prune.js:90 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.cache.fontsTtlDays` | number | 7 | scripts/build/cjk-fonts.js:68 | scripts/internals.test.js:35 | 既有引用 |
| `internals.cache.mediaTtlDays` | number | 0 | scripts/build/media.js:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.cache.mermaidTtlDays` | number | 0 | scripts/build/mermaid.js:52 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.cache.ogTtlDays` | number | 0 | scripts/generate-og.js:27 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ci.aggregate` | bool | true | scripts/ci-checks.js:28<br>scripts/ci-env.js:22<br>scripts/ci-checks.js:178 | scripts/internals.test.js:47 | 既有引用 |
| `internals.ci.checkTimeoutMs` | number | 600000 | scripts/check-internals.js:146<br>scripts/ci-checks.js:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ci.skip.consecutiveClean` | number | 5 | scripts/lib/ci-skip.js:61<br>scripts/lib/ci-skip.js:87<br>scripts/lib/ci-skip.js:90 | scripts/ci-skip.test.js:47<br>scripts/ci-skip.test.js:55 | 既有引用 |
| `internals.ci.skip.consecutiveErrors` | number | 2 | scripts/lib/ci-skip.js:60<br>scripts/lib/ci-skip.js:78<br>scripts/lib/ci-skip.js:81 | scripts/ci-skip.test.js:47<br>scripts/ci-skip.test.js:55 | 既有引用 |
| `internals.ci.skip.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-wiring.test.js:39<br>scripts/config-wiring.test.js:40 | 既有引用 |
| `internals.ci.skip.ignoreWarnings` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ci.skip.requireSameHead` | bool | true | scripts/lib/ci-skip.js:59<br>scripts/lib/ci-skip.js:66 | scripts/ci-skip.test.js:47<br>scripts/ci-skip.test.js:55 | 既有引用 |
| `internals.deploy.verifyOnDeploy` | bool | true | scripts/deploy-pages.js:23 | scripts/config-coverage-nonfeatures.test.js:667 | 已测（marker） |
| `internals.ports.a11y` | number | 3224 | scripts/a11y-audit.js:29<br>scripts/a11y-audit.js:35<br>scripts/a11y-audit.js:36 | scripts/internals.test.js:32<br>scripts/internals.test.js:46 | 既有引用 |
| `internals.ports.perf` | number | 3000 | scripts/perf-audit.js:26<br>scripts/build/report.js:205<br>scripts/build/report.js:207 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.ports.serve` | number | 3000 | scripts/build/serve.js:33<br>scripts/build/context.js:265<br>scripts/build/context.js:430 | scripts/internals.test.js:31<br>scripts/internals.test.js:45 | 既有引用 |
| `internals.release.listLimit` | number | 200 | scripts/release-prune.js:60 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.release.previewLimit` | number | 20 | scripts/release-prune.js:87<br>scripts/dist-hash-guard.js:14<br>scripts/release-prune.js:90 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.report.maxBuildMsWarn` | number | 0 | scripts/build.js:405<br>scripts/build.js:406<br>scripts/build.js:407 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `internals.report.topN` | number | 10 | scripts/build/report.js:20<br>scripts/build/report.js:188<br>scripts/lib/feature-wiring.js:1226 | scripts/config-wiring.test.js:1154 | 已测（marker） |
| `navigation.navbar.fixed` | bool | true | templates/site-css.ejs:41<br>templates/site-css.ejs:59<br>scripts/build/config.js:330 | scripts/config-coverage-nonfeatures.test.js:325 | 已测（marker） |
| `navigation.navbar.shadow` | bool | true | js/domains/features/theme-presets.js:2<br>scripts/build/config.js:320<br>scripts/build/config.js:328 | scripts/config-coverage-nonfeatures.test.js:325 | 已测（marker） |
| `navigation.navbarOptions.glassAlpha` | number | 0 | templates/site-css.ejs:1 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `navigation.navbarOptions.shadowShow` | bool | true | templates/site-css.ejs:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `navigation.search.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-features-b.test.js:564<br>scripts/config-coverage-features-b.test.js:565 | 既有引用 |
| `navigation.socialInNav.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:231 | 已测（marker） |
| `security.csp.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/build.test.js:542<br>scripts/build.test.js:545 | 既有引用 |
| `security.csp.reportOnly` | bool | false | scripts/build/security-files.js:133<br>scripts/generate-security-config.js:165<br>workers/security-worker.js:255 | scripts/build.test.js:526<br>scripts/build.test.js:585 | 既有引用 |
| `security.forceHttps` | bool | true | scripts/generate-security-config.js:171<br>workers/security-worker.js:52<br>workers/security-worker.js:310 | scripts/config-wiring.test.js:1140 | 既有引用 |
| `security.hardening.cspReportMaxBytes` | number | 16384 | scripts/generate-security-config.js:169<br>scripts/generate-security-config.js:180<br>workers/security-worker.js:50 | scripts/build.test.js:534<br>scripts/build.test.js:535 | 既有引用 |
| `security.rateLimiting.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/build.test.js:513<br>scripts/config-wiring.test.js:1139 | 既有引用 |
| `security.rateLimiting.maxRequests` | number | 100 | scripts/generate-security-config.js:148<br>workers/lib/rate-limit.mjs:9<br>workers/lib/rate-limit.mjs:15 | scripts/build.test.js:513<br>scripts/build.test.js:514 | 既有引用 |
| `security.rateLimiting.maxTrackedEntries` | number | 5000 | scripts/generate-security-config.js:151<br>scripts/generate-security-config.js:152<br>scripts/generate-security-config.js:153 | scripts/build.test.js:513<br>scripts/build.test.js:515 | 既有引用 |
| `security.rateLimiting.windowMs` | number | 60000 | scripts/generate-security-config.js:149<br>workers/lib/rate-limit.mjs:8<br>workers/lib/rate-limit.mjs:14 | scripts/build.test.js:513<br>scripts/build.test.js:523 | 既有引用 |
| `security.robots.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:419 | 已测（marker） |
| `sidebar.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-wiring.test.js:462 | 既有引用 |
| `sidebar.options.borderShow` | bool | false | templates/site-css.ejs:180 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.options.hoverLift` | bool | true | templates/site-css.ejs:180 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.options.titleWeight` | number | 600 | templates/site-css.ejs:2 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `sidebar.recentPoolSize` | number | 10 | scripts/lib/feature-wiring.js:1219 | scripts/config-wiring.test.js:1154 | 已测（marker） |
| `sidebar.sticky` | bool | true | templates/site-css.ejs:37<br>templates/site-css.ejs:255<br>templates/site-css.ejs:267 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.avif.effort` | number | 5 | scripts/build/media.js:237 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.avif.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:541 | 已测（marker） |
| `site.build.avif.quality` | number | 50 | scripts/build/media.js:179<br>scripts/build/media.js:188<br>scripts/build/media.js:237 | scripts/config-coverage-nonfeatures.test.js:541 | 已测（marker） |
| `site.build.buildReport` | bool | true | scripts/build.js:414<br>scripts/build.js:421 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.cacheControl` | bool | true | scripts/build/security-files.js:183 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.cjkFonts.cacheTtlDays` | number | 7 | scripts/build/cjk-fonts.js:30<br>scripts/build/cjk-fonts.js:31<br>scripts/build/cjk-fonts.js:40 | scripts/cjk-fonts.test.js:356<br>scripts/config-wiring.test.js:1125 | 既有引用 |
| `site.build.cjkFonts.concurrency` | number | 6 | scripts/build/cjk-fonts.js:29<br>scripts/build/cjk-fonts.js:37<br>scripts/build/cjk-fonts.js:38 | scripts/cjk-fonts.test.js:387<br>scripts/config-wiring.test.js:1124 | 既有引用 |
| `site.build.cjkFonts.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/cjk-fonts.test.js:401<br>scripts/config-coverage-nonfeatures.test.js:640 | 既有引用 |
| `site.build.cjkFonts.fetchTimeoutMs` | number | 15000 | js/domains/features/bilingual-core.js:20<br>js/domains/features/bilingual-core.js:28<br>js/domains/features/bilingual.js:72 | scripts/config-coverage-nonfeatures.test.js:610 | 已测（marker） |
| `site.build.cjkSpacing` | bool | true | scripts/build/articles.js:275<br>scripts/build/pages.js:467 | scripts/h2-dataflow.test.js:243 | 既有引用 |
| `site.build.cleanDist` | bool | true | scripts/build.js:186<br>scripts/build.js:187<br>scripts/build/media.js:25 | scripts/config-coverage-nonfeatures.test.js:574<br>scripts/config-wiring-build-switches.test.js:287 | 既有引用 |
| `site.build.copyStatic` | bool | true | scripts/build/media.js:35<br>scripts/build.js:66<br>scripts/build.js:217 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.criticalCss.asyncNonCritical` | bool | true | scripts/build/pages.js:187 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.criticalCss.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:311 | 已测（marker） |
| `site.build.enableCacheBusting` | bool | false | scripts/build/feeds.js:332<br>scripts/build/minify.js:748 | scripts/cache-bust.test.js:132<br>scripts/h2-dataflow.test.js:349 | 既有引用 |
| `site.build.forceContentWidth` | bool | true | templates/layout.ejs:170<br>templates/site-css.ejs:36 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.generateArchive` | bool | true | scripts/build/feeds.js:203<br>scripts/build/pages.js:827 | scripts/config-coverage-nonfeatures.test.js:295 | 已测（marker） |
| `site.build.generateCategories` | bool | true | scripts/build/feeds.js:211<br>scripts/build/pages.js:842 | scripts/config-coverage-nonfeatures.test.js:295 | 已测（marker） |
| `site.build.generateGallery` | bool | true | scripts/lib/build-switch-gates.js:17 | scripts/config-coverage-nonfeatures.test.js:295 | 已测（marker） |
| `site.build.generateIndex` | bool | true | scripts/build/feeds.js:190<br>scripts/build/pages.js:776<br>scripts/build/pages.js:939 | scripts/h2-dataflow.test.js:182 | 既有引用 |
| `site.build.generateTags` | bool | true | scripts/build/feeds.js:207<br>scripts/build/pages.js:832 | scripts/config-coverage-nonfeatures.test.js:295 | 已测（marker） |
| `site.build.hashLength` | number | 10 | scripts/build/pages.js:172 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.mediaQuality` | number | 85 | scripts/build/media.js:179 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.minifyCSS` | bool | false | scripts/build/minify.js:219<br>scripts/build/minify.js:268<br>scripts/build/minify.js:733 | scripts/config-coverage-nonfeatures.test.js:487 | 已测（marker） |
| `site.build.minifyHTML` | bool | false | scripts/build/minify.js:197<br>scripts/build/minify.js:732 | scripts/config-coverage-nonfeatures.test.js:487 | 已测（marker） |
| `site.build.minifyJS` | bool | false | scripts/build.js:291<br>scripts/build/minify.js:241<br>scripts/build/minify.js:734 | scripts/config-coverage-nonfeatures.test.js:487 | 已测（marker） |
| `site.build.optimizeMedia` | bool | false | scripts/build/media.js:168<br>scripts/build.js:66<br>scripts/build.js:221 | scripts/config-coverage-nonfeatures.test.js:541 | 已测（marker） |
| `site.build.relatedArticles` | bool | true | scripts/lib/related.js:44<br>scripts/lib/related.js:35<br>templates/post.ejs:4 | scripts/build-smoke.test.js:763<br>scripts/config-wiring-related.test.js:11 | 已测（marker） |
| `site.build.removeConsole` | bool | false | scripts/build/minify.js:249 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.build.reportTopN` | number | 10 | scripts/build/report.js:207<br>scripts/lib/feature-wiring.js:1224<br>scripts/build/report.js:188 | scripts/config-wiring.test.js:1154 | 已测（marker） |
| `site.build.usePictureTag` | bool | true | scripts/build/markdown.js:25 | scripts/config-wiring.test.js:530<br>scripts/config-wiring.test.js:623 | 既有引用 |
| `site.comments.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/compression-config.test.js:39<br>scripts/compression-config.test.js:42 | 既有引用 |
| `site.externalLinkWarning.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:240 | 已测（marker） |
| `site.favicon.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:357 | 已测（marker） |
| `site.hero.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:248 | 已测（marker） |
| `site.hero.showCta` | bool | true | scripts/build/pages.js:698<br>templates/index.ejs:15 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.hero.showSearch` | bool | true | scripts/build/pages.js:696<br>templates/index.ejs:14 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.hero.showTags` | bool | true | scripts/build/pages.js:697<br>templates/index.ejs:17<br>templates/index.ejs:6 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.hero.tagCount` | number | 8 | scripts/build/pages.js:704<br>scripts/build/pages.js:705<br>scripts/lib/test-payloads.js:147 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.prefetchNextPage` | bool | false | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.preloadFeaturedImage` | bool | true | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.preloadFonts` | bool | true | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.performance.resourceHints` | bool | true | templates/layout.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.postsPerPage` | number | 10 | scripts/build/config.js:421<br>scripts/build/feeds.js:192<br>scripts/build/pages.js:682 | scripts/config-coverage-nonfeatures.test.js:284 | 已测（marker） |
| `site.pwa.enabled` | bool | true | js/core/runtime.js:18<br>js/core/boot.js:97<br>js/core/boot.js:202 | scripts/config-coverage-features-b.test.js:258<br>scripts/config-coverage-features-b.test.js:259 | 既有引用 |
| `site.reward.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:267 | 已测（marker） |
| `site.rss.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-features-b.test.js:387<br>scripts/config-coverage-features-b.test.js:388 | 既有引用 |
| `site.rss.fullContent` | bool | true | scripts/build/feeds.js:82<br>scripts/lib/feed-options.js:13<br>scripts/build/feeds.js:141 | scripts/build.test.js:738 | 已测（marker） |
| `site.rss.injectHeadLinks` | bool | true | templates/layout.ejs:49 | scripts/config-wiring.test.js:865 | 既有引用 |
| `site.rss.jsonFeed.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-features-b.test.js:387<br>scripts/config-coverage-features-b.test.js:388 | 既有引用 |
| `site.rss.jsonFeed.fullContent` | bool | false | scripts/build/feeds.js:82<br>scripts/lib/feed-options.js:13<br>scripts/build/feeds.js:141 | scripts/build.test.js:738 | 已测（marker） |
| `site.rss.jsonFeed.maxItems` | number | 20 | scripts/build/feeds.js:73<br>scripts/build/feeds.js:74<br>scripts/lib/feed-options.js:15 | scripts/build.test.js:738 | 已测（marker） |
| `site.rss.maxItems` | number | 50 | scripts/build/feeds.js:73<br>scripts/build/feeds.js:74<br>scripts/lib/feed-options.js:15 | scripts/build.test.js:738 | 已测（marker） |
| `site.seo.articleTimes` | bool | true | templates/layout.ejs:42 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.seo.canonicalURL` | bool | false | templates/layout.ejs:48 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.seo.ogImageAlt` | bool | true | templates/layout.ejs:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.seo.structuredData.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:258 | 已测（marker） |
| `site.seo.twitterLabels` | bool | true | templates/layout.ejs:43 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.showRepoLink` | bool | true | templates/layout.ejs:135<br>templates/layout.ejs:218 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.sitemap.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-features-b.test.js:564<br>scripts/config-coverage-features-b.test.js:565 | 既有引用 |
| `site.sitemap.priority` | number | 0.8 | scripts/build/feeds.js:203<br>scripts/build/feeds.js:191<br>scripts/build/feeds.js:195 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `site.social.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/malicious.test.js:718 | 既有引用 |
| `site.webAnalytics.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:379 | 已测（marker） |
| `tagAliases.enabled` | bool | true | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/config-coverage-nonfeatures.test.js:459 | 已测（marker） |
| `theme.animation.enable` | bool | true | js/domains/features/bilingual.js:65<br>js/domains/features/bilingual.js:103<br>js/domains/features/bilingual.js:164 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.avatar.badge` | bool | true | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.avatar.ring` | bool | false | js/domains/core/reading.js:49<br>js/domains/core/reading.js:112<br>js/domains/core/reading.js:189 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.button.hoverScale` | number | 1.02 | — | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.excerptLength` | number | 150 | scripts/build/articles.js:300<br>js/domains/features/search-page.js:15<br>js/domains/features/search.js:227 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.readTimeSpeed` | number | 265 | scripts/build/articles.js:322 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showCategories` | bool | true | templates/index.ejs:6<br>templates/index.ejs:56<br>templates/tag.ejs:29 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showDate` | bool | true | templates/category.ejs:15<br>templates/index.ejs:6<br>templates/index.ejs:53 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showExcerpt` | bool | true | templates/category.ejs:32<br>templates/index.ejs:6<br>templates/index.ejs:70 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showReadTime` | bool | true | templates/category.ejs:28<br>templates/index.ejs:6<br>templates/index.ejs:66 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showTags` | bool | true | templates/index.ejs:6<br>templates/index.ejs:73<br>templates/tag.ejs:46 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.card.showWordCount` | bool | true | templates/category.ejs:25<br>templates/index.ejs:63<br>templates/series-page.ejs:24 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.contentOffset` | number | 0 | templates/site-css.ejs:33 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.darkMode.enabled` | bool | false | js/core/boot.js:97<br>js/core/boot.js:202<br>js/core/main.js:125 | scripts/h2-dataflow.test.js:367<br>scripts/theme-override.test.js:77 | 既有引用 |
| `theme.darkMode.toggle` | bool | true | js/core/soft-nav.js:27<br>js/domains/core/code-block.js:55<br>js/domains/core/nav-state.js:56 | scripts/config-coverage-nonfeatures.test.js:276 | 已测（marker） |
| `theme.fontSystem.numbersMono` | bool | true | scripts/build/config.js:300 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.fontSystem.scale` | number | 1 | scripts/build/config.js:299<br>js/domains/features/lightbox-core.js:64<br>js/domains/features/lightbox-core.js:66 | scripts/config-coverage-nonfeatures.test.js:343 | 已测（marker） |
| `theme.headerContentGap` | number | 0 | templates/site-css.ejs:32 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.headingFontWeight` | number | 700 | templates/site-css.ejs:1 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `theme.lineHeight` | number | 1.8 | templates/site-css.ejs:1<br>scripts/generate-og.js:219<br>scripts/generate-og.js:225 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.card.bentoFeatured` | bool | true | templates/index.ejs:32 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.header.scrollShrink` | bool | true | js/domains/core/navigation.js:5 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.damping` | number | 30 | js/domains/features/morphicons.js:37<br>js/domains/features/morphicons.js:42<br>js/domains/features/morphicons.js:44 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.reducedDamping` | number | 55 | js/domains/features/morphicons.js:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.reducedStiffness` | number | 900 | js/domains/features/morphicons.js:41 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.morphicons.stiffness` | number | 420 | js/domains/features/morphicons.js:37<br>js/domains/features/morphicons.js:42<br>js/domains/features/morphicons.js:44 | 豁免理由见 `scripts/config-switch-exemptions.json` | 豁免 |
| `tuning.search.indexRetry` | number | 1 | scripts/lib/feature-wiring.js:1259<br>js/domains/features/search-page.js:20<br>js/domains/features/search.js:22 | scripts/config-wiring.test.js:1326 | 已测（marker） |
| `tuning.search.indexTimeoutMs` | number | 5000 | scripts/lib/feature-wiring.js:1258<br>js/domains/features/search-page.js:20<br>js/domains/features/search.js:20 | scripts/config-wiring.test.js:1326 | 已测（marker） |
