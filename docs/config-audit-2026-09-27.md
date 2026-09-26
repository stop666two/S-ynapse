# 配置硬编码审计报告（2026-09-27）

> 任务来源：用户诉求「有很多配置项被硬编码在代码里：要么 JSON5 文件里没有、要么既硬编码又 JSON 两边不统一。**必须只能在 JSON5 文件里调**，并且要有完整的注释。」
> 审计范围：`js/**`、`templates/**`、`scripts/build/**`、`scripts/lib/**`（排除 `*.test.js`、`.tmp-scripts/`、`node_modules/`、`dist/`、`real-site/`）。
> 配置体系：13 个 JSON5 + `features-schema.js` / `site-defaults.js` / `tuning-defaults.js` / `guard-defaults.js` 注册表 + `npm run verify:config` 门禁 + `docs/config-reference.md`。

## 一、审计统计

| 类别 | 定义 | 发现 | 已整改 | 剩余 |
|---|---|---|---|---|
| A 类 | 同一可调项既在 JSON5 又有代码硬编码（漂移风险） | 13 项 | 13 项（100%） | 0 |
| B 类第一批 | 仅代码硬编码，用户可感知（时序/尺寸/上限/层级） | 46 项 | 46 项 | 0 |
| B 类第二批 | 仅代码硬编码，内部/低感知（见「未闭环清单」） | 18 项 | 0 | 18 项（保守保留） |
| C 类 | 13 个 JSON5 注释不完整 | 4 个文件实测缺口 | 4 个已补齐 | 0（其余 9 文件经人工核验为块注释/行内注释策略，完整） |

> C 类说明：启发式统计（`键的紧邻上一行是否为注释`）会把「块注释 + 行内注释」策略误报为缺失（如 sidebar/tag-aliases/friends/guard/security 实际已逐字段说明）。人工核验后真实缺口为：`ui-strings.json5`（8 处分区注释缺失）、`features.json5`（`guards` 顶层键缺标题注释）、`navigation.json5`（菜单项 `target` 字段缺说明）、以及 `ui-strings.search.kbdHint` 新键。

## 二、A 类整改明细（全部已迁移，默认值与配置源一致）

| # | 类别 | 位置(file:line) | 现状值/来源 | 判定 | 目标文件与键名 | 备注 |
|---|---|---|---|---|---|---|
| A1 | A | `templates/layout.ejs:21` | og:image:width/height 硬编码 `1200`/`630`，实际产图 2560×1600 | 迁移 | `scripts/build.js` 注入 `baseData.ogImageSize`（`lib/og-size.js` 单一来源） | 修复了「meta 尺寸与实际 OG 图不符」的真实缺陷；验证产物为 2560×1600 与 meta 一致 |
| A2 | A | `templates/layout.ejs:205` | 快捷键帮助表键位硬编码 `/ D J K Esc ?` | 迁移 | `features.shortcuts.*` 动态渲染（`openSearch/toggleTheme/prevPost/nextPost/close/help`） | 改 JSON5 键位后提示表同步变化 |
| A3 | A | `templates/layout.ejs:128` | `<span class="search-kbd">Ctrl K</span>` 硬编码 | 迁移 | `ui-strings.json5` → `search.kbdHint`（zh/en） | 与 `search.js` 的 Ctrl+K 行为对齐 |
| A4 | A | `templates/layout.ejs`（m-toc-btn 媒体查询） | fallback `1024`，配置 `mobile.tocBreakpoint=900` | 迁移 | 读 `features.mobile.tocBreakpoint`，fallback 900 | 消除双默认漂移 |
| A5 | A | `templates/site-css.ejs:200` | 灯箱 `min(92vw,1600px)` 硬编码 1600 | 迁移 | `features.lightbox.maxSizePx`（已有键，未接线） | 两处 `1600px` 均改为读配置 |
| A6 | A | `templates/site-css.ejs:15` | 图片淡入 `transition:opacity .4s`（400ms） | 迁移 | `features.imageLazy.fadeInDurationMs`（已有键=300，未接线） | 以 JSON5 配置为权威；用户可在 JSON5 调整 |
| A7 | A | `templates/site-css.ejs:200` | 灯箱遮罩 `--lightbox-bgOpacity,.9` 无人设置变量 | 迁移 | `features.lightbox.backdropOpacity` 作为变量默认值 | 配置修改现在生效（变量仍可被 customCSS 覆盖） |
| A8 | A | `templates/site-css.ejs:443` | `.g-wm{z-index:40}` 硬编码 | 迁移 | 构建期读 `guard.watermark.zIndex` | 与 `watermark.js` 运行时覆盖同源 |
| A9 | A | `js/domains/core/code-block.js:57` | 「复制全部代码」恢复超时 `1500` 字面量 | 迁移 | `features.codeCopy.buttonTimeout`（已有键） | 同文件 `COPYTIMEOUT` 统一 |
| A10 | A | `js/domains/core/code-block.js:58` | 复制失败文案 `__T('toolbar.copyFailed')` 硬编码 | 迁移 | `features.codeBlock.copyFailText/copyFailTextEn`（已有键，未接线） | 文案统一来源 |
| A11 | A | `js/domains/features/background.js:13` | fallback `count=55`、`opacity=0.6` vs 配置 `72`/`0.7` | 迁移 | 兜底值与 `features-schema.js → background.particles` 同值 | 消除「两处默认值」 |
| A12 | A | `js/domains/features/background.js:9` | 窄屏断点 `640` 硬编码 | 迁移 | `features.background.particles.mobileMaxWidth`（新键，默认 640） | 见 B 类 |
| A13 | A | `js/core/boot.js:116` | `maxMs + 60` 缓冲硬编码 | 迁移 | `features.loading.failsafeBufferMs`（新键，默认 60） | 见 B 类 |

## 三、B 类第一批迁移明细（新键，默认值与整改前行为逐字一致）

### 3.1 浮层层级 z-index（30 项，统一到 `tuning.json5 → zIndex`）

| 目标键（`tuning.zIndex.*`） | 默认 | 原硬编码位置 |
|---|---|---|
| header | 1000 | `.site-header` |
| mobileNav | 999 | `.main-nav`（移动端抽屉） |
| announcement | 999 | `.announcement-bar` |
| mobileBottomNav | 1200 | `.m-bottom-nav` |
| readingDock / readingGear / readerPanel | 990 / 998 / 1500 | `.read-dock` / `.reader-gear` / `.reader-panel` |
| mobileToc / mobileTocDrawer | 999 / 1500 | `.m-toc-btn` / `.m-toc-drawer` |
| kbdHelp / searchOverlay / navBoostPanel / presetPop | 1500 / 2000 / 1200 / 1600 | 对应组件 |
| toast / scrollIndicator / readingTip | 1200 / 1100 / 10000 | `.toast-container` / `.scroll-progress` / `.rp-tip` |
| lightbox / reward / linkWarning / contactPopup | 2000 / 1900 / 3000 / 4000 | 对应浮层 |
| pwaInstall / softnavBusy / grain | 1050 / 2000 / 2000 | 对应覆盖层 |
| guardMenu / guardFlash / guardCurtain / guardLock / guardGate / guardWmOverLightbox | 1900 / 1890 / 1880 / 1895 / 1898 / 1700 | guard 各遮罩 |
| popupNotice | 2100 | `.pn-overlay` |

模板统一以 `var(--zIndex-键, 原值)` 消费（变量由 tuning 自动注入，缺失时保留原值兜底）。

### 3.2 时序/尺寸/超时（16 项）

| 目标键 | 默认 | 原硬编码位置 | 说明 |
|---|---|---|---|
| `features.tts.resumeIntervalMs` / `resumeMaxTries` | 500 / 3 | `js/domains/features/tts.js:59-63` | Chromium 长文本暂停心跳 |
| `features.popupNotice.removeDelayMs` | 240 | `js/domains/features/popup-notice.js:71` | 关闭后移除 DOM 延迟 |
| `features.search.focusDelayMs` | 100 | `js/domains/features/search.js:118` | 打开搜索后聚焦延迟 |
| `features.pageTransition.leaveGuardMs` / `reducedDurationMs` | 2500 / 70 | `js/domains/core/page-transition.js:16,17` | 导航失败兜底窗口 / reduced-motion 上限 |
| `features.sidebarDrag.touchLongPressMs` | 500 | `js/domains/features/sidebar-drag.js:92` | 触屏长按拖拽判定 |
| `guard.contextMenu.searchFocusDelayMs` | 60 | `js/domains/guard/context-menu.js:97` | 划词搜索聚焦延迟 |
| `features.mermaid.idleTimeoutMs` / `idleFallbackMs` | 1500 / 200 | `templates/layout.ejs`（vendor 懒加载） | requestIdleCallback 超时 |
| `features.mermaid.rerenderIdleTimeoutMs` / `rerenderIdleFallbackMs` | 300 / 60 | `templates/layout.ejs`（主题切换重渲染） | 同上 |
| `features.mermaid.renderTimeoutMs` | 10000 | `scripts/lib/mermaid-render.js:367`（经 `scripts/build/mermaid.js` 传入） | 构建期单块渲染超时 |
| `features.codeBlock.prismBatchMs` / `prismIdleTimeoutMs` / `prismIdleFallbackMs` | 8 / 300 / 60 | `templates/layout.ejs`（Prism 高亮批次） | 高亮时间片与空闲超时 |
| `features.background.particles.mobileMaxWidth` | 640 | `js/domains/features/background.js:9` | autoDisableMobile 窄屏阈值 |
| `features.loading.failsafeBufferMs` | 60 | `js/core/boot.js:116` | 硬超时额外缓冲 |
| `features.boot.configTimeoutMs` | 3000 | `js/core/runtime.js:7` | 外置配置加载超时（构建期经 `window.__CONFIG_TIMEOUT__` 注入，解决引导脚本「配置未加载」鸡生蛋问题） |
| `tuning.announcement.height` | 34px | `templates/site-css.ejs`（`--annH` 与公告条高度两处） | 公告条高度 |
| `tuning.layout.gridCollapseBreakpoint` | 640px | `templates/site-css.ejs:32`（`.blog-grid` 单列折叠） | 网格断点 |

### 3.3 兜底同源说明

前端 JS 无法 import 构建期 schema，保留的防御性兜底（如 `|| 120`、`isNaN(...) ? 250 : ...`）已统一为「与 `scripts/lib/features-schema.js → DEFAULT_FEATURES` 同值」，并在代码注释中注明来源；正常构建始终注入合并后的完整配置，兜底仅在配置缺失/非法时生效。

## 四、保留标准（未迁移项及理由）

| 项 | 位置 | 保留理由 |
|---|---|---|
| `z-index:2`（代码操作按钮/展开按钮） | `site-css.ejs` `.code-actions` / `.code-expand-btn` | 组件内部相对层级（父容器内），结构性 CSS |
| `z-index:-1`（`#bgFx`/hero 光晕）、`z-index:2`（颗粒纹理） | `site-css.ejs` | 结构性层叠（纹理按配置开关渲染，值本身非可调语义） |
| `z-index:4/5/6`（灯箱控件） | `site-css.ejs` | 灯箱内部结构性层级 |
| `160`/`numOctaves=2` 噪声 SVG 参数 | `site-css.ejs` | 视觉算法内部常量（密度由 `tuning.texture.noiseBaseFrequency` 控制） |
| `MAX_OG_DIMENSION=2560`、`DEFAULT_OG_SIZE` | `scripts/lib/og-size.js` | 与 `features.ogImage.autoSize.maxDimension` 同源的协议默认；纯函数库不读配置 |
| `REPORT_TIMEOUT/THROTTLE_FALLBACK_MS` | `guard/tamper-watch.js` | 与 `guard-defaults.js` 同值兜底（上限/下限为安全护栏） |
| `320px/12vh/78vh` 等纯设计尺寸 | `site-css.ejs` | 列入 B 类第二批（见下） |
| SVG viewBox / path 数据、正则、协议常量 | 全站 | 密码学/协议/第三方适配常量 |
| `scripts/a11y-audit.js`、`scripts/build/serve.js` 内部常量 | 工具脚本 | 测试/构建工具夹具，不面向站点行为 |

## 五、未闭环清单（B 类第二批 + 未接线键 + 跨文件重复）

### 5.1 B 类第二批（建议单独批次，逐项需 UI 回归验证）

| 位置 | 说明 | 建议方案 |
|---|---|---|
| `site-css.ejs` 约 20 处纯设计尺寸（search-kbd 36px、search-modal 78vh/12vh、error-svg 460px、m-toc-btn bottom 6rem、reader-gear 14.6rem 等） | 视觉微调值，改动需逐页视觉回归 | 归入 `tuning` 对应分类（search/reading/mobileToc 等） |
| `js/domains/features/morphicons.js:86-87` SVG 回退宽高 20 | vendor 图标适配常量 | 保留并注释或并入 `morphIcons` 新键 |
| `js/domains/features/background.js` 点半径 `1.8/1`、连线透明度 `0.35` | 粒子算法内部视觉参数 | 如需可调再迁移；当前保留 |
| `js/domains/core/motion.js:28` `Math.min(rippleDurationMs, 300)` 上限 | 涟漪降级上限 | 迁移为 `tuning.motion` 新键 |

### 5.2 配置键已存在但代码未消费（未接线/预留；本次未强改，避免行为风险）

- `features.themeToggle.animationMs`（250）与实际生效的 `theme.animation.transitionDuration`（0.25s）**跨文件重复**；实际行为由 theme 配置控制，`themeToggle.animationMs` 为历史未接线键 —— 建议下批次二选一（删除或接线），需确认用户配置兼容。
- `features.lightbox.openDurationMs` / `switchDurationMs`、`readingProgress.tipDisplayMs` / `ariaAnnounce`、`backToTop.scrollDurationMs` / `htmlAnchorFallback`、`dailyQuote.quoteColor`、`favorites.listIcon`、`cover.defaultPattern` / `preferImage`、`hotSearches.showInDropdown` / `showClear`、`readingTime.showInMeta`、`ogImage.useCover` / `gradientForNoCover`、`autoSummary.stripMarkdown`、`externalLink.showFullUrl` / `openInNewTab` / `whitelistNewTab` / `copyButtonText`、`themePresets.showInNavbar` / `previewOnHover`、`themeSchedule.applyInstantly`、`shortcuts.showHelpHint` / `helpTitle`、`toc.minLevel` / `maxLevel` / `defaultOpenLevel` / `highlightActive`、`mobileToc.overlayClose` / `lockScroll`、`readDock.show*`、`search.*` 预留组 —— 已在 `docs/config-reference.md` 标注或需补充「未接线」标注。
- **根因**：这些是「配置先行、功能未实现」的预留键，不属于硬编码漂移；但需防「死键复现」。建议下批次：要么接线，要么在 reference 中统一标注「预留未接线」。

### 5.3 无法配置的引导常量（架构性保留）

- `runtime.js` 的配置加载**重试 1 次**为固定策略（超时可配 `features.boot.configTimeoutMs`；重试次数未配置化，属引导协议常量）。
- `layout.ejs` 内联脚本在配置就绪前执行，故新键均带同值兜底（已在代码注明）。

## 六、验证证据（全部通过）

| 门禁 | 结果 |
|---|---|
| `npm run verify:config` | PASS（features ↔ schema / 9 结构文件 ↔ 注册表） |
| `npm run lint` | 0 错误 |
| `npm run typecheck` | 通过（tsc 无输出） |
| `npm test` | **377 tests / 82 suites / 0 fail** |
| `npm run test:build` | 2/2 通过（含 EJS 全量编译） |
| `npm run build -- --out .tmp-scripts/out/audit-build` | 成功；`generate-og` 复用 16、失败 0 |
| 产物对比（baseline dist ↔ 新构建） | 88 文件同名差异中 **86 个为 nonce/cache-hash/`__CONFIG_TIMEOUT__` 归一化后等价**；实质差异 = 预期配置化点（逐项见下） |
| 页面体积回归 | 每页 gzip +130~152B（全部来自配置注入/兜底变量）；**超 28KB 预算页数 baseline=2 / new=2**（零回归；`perfBudget.warnOnly=true` 本就告警） |
| OG meta 一致性 | 新构建 `og:image:width/height=2560/1600`，与实际 `og/zh/*.png` 尺寸一致（此前硬编码 1200×630 与实图不符） |

**产物体积差异逐项归因**：
1. 所有 HTML：+`window.__CONFIG_TIMEOUT__=3e3,`（约 30B）+ mermaid/prism 内联脚本的配置读取变量（约 400B raw / 130B gzip）；
2. `site.css`：+`--layout-gridCollapseBreakpoint`、`--announcement-height`、`--zIndex-*`（30 变量），并替换原字面量（净增约 1.6KB raw）；
3. `config.<hash>.json`：+53 个新键（结构化 diff 全部为 `undefined -> 默认值`，无既有值变化）；
4. 资产文件名 hash 变化：内容变化导致的 cache-bust 正常行为；
5. 新增 `og/{zh,en}/*.png` 16 张：基线 dist 为 `serve` 模式构建（不含 OG 产物），非代码差异。

## 七、复核方法（可复现）

```powershell
npm run verify:config
npm run lint; npm run typecheck
npm test; npm run test:build
npm run build -- --out .tmp-scripts/out/audit-build
# 对比基线（如需）：robocopy dist .tmp-scripts/out/baseline-dist /E
# 扫描脚本（一次性，保存在 .tmp-scripts/，不入库）：
#   scan-hardcode2.js / diff-dist3.js / verify-build-diff2.js / cmp-page-size.js
```

> 报告生成时间：2026-09-27（审计辅助脚本位于 `.tmp-scripts/`，该目录已被 `.gitignore` 排除）。

---

## 八、第二轮闭环结果（2026-09-27）

> 目标：把第一批未闭环项全部收口，并落实「配置只能在 JSON5 里调（含完整中文注释）」与「不存在看起来能调、实际无效且无标注的键」。

### 8.1 W1 — B 类第二批设计尺寸迁移（已完成，32 项）

全部默认值与迁移前逐字一致；模板以 `var(--{分类}-{键}, 原值)` 消费，构建时由 tuning 自动注入 CSS 变量；`scripts/lib/tuning-defaults.js` 与 `docs/config-reference.md` §10 同步（33 分类/237 项 → 37 分类/269 项）。

| 分类 | 新增键（默认值） | 原硬编码位置 |
|---|---|---|
| search | `overlayPadding '12vh 1rem 2rem'` / `modalPadding '2.5rem 2.5rem 2rem'` / `modalMaxHeight '78vh'` / `closeBtnSize '36px'` | `.search-overlay` / `.search-modal` / `.search-close` |
| reading | `dockRight '1.35rem'` / `dockBtnSize '40px'` / `dockRightTablet '1rem'` / `dockBottomTablet '6.4rem'` / `gearBottom '14.6rem'` / `gearMobileBottom '10.8rem'` / `panelBottom '13.2rem'` / `panelWidth '280px'` / `dockMobileBottom '14.2rem'` | `.read-dock` / `.dock-btn` / `.dock-ring` / `.reader-gear` / `.reader-panel` 及媒体查询 |
| mobileToc | `btnBottom '6rem'` / `btnRight '2rem'` / `btnMobileBottom '7.4rem'` / `btnMaxWidth '340px'` / `labelMaxWidth '9.5rem'`（另 `maxHeightVh`/`borderRadius` 改为读取 features，见 W2） | `.m-toc-btn` / `.m-toc-label` / 768px 媒体查询 |
| ui | `errorSvgMaxWidth '460px'` / `errorSuggestMaxWidth '560px'` / `errorCodeFontSize '7rem'` | `.error-svg` / `.error-suggest` / `.error-code` |
| lightbox | `btnSize '44px'` / `btnOffset '14px'` | `.lb-*` 控件（尺寸变量此前无人注入，现生效） |
| toast | `maxWidth '420px'` / `radius '999px'` / `offsetBottom '2rem'` | `.toast` / `--toast-radius` / `--toast-offsetBottom` |
| pagination | `btnMinWidth '40px'` / `btnHeight '40px'` | `.page-link` |
| backToTop | `hiddenOffset '20px'` | `.back-to-top` 隐藏态位移 |
| commandPalette | `listMaxHeight '420px'` | `.cmdp-list` |
| code | `windowDotSize '11px'` | `.cw-dot` |
| layout | `articlePadding '2rem'` | `.post-article` 三处内边距 |

证据：runner `.tmp-scripts/run-round2.js` 对 9 个页面读取 CSS 变量与 computed style 共 34 项 W1 断言全绿（含 404、图库灯箱、移动端 600px、平板 1000px 断点），截图 4 张（`.tmp-scripts/out/round2-*.png`）。

### 8.2 W2 — 未接线键收口（已完成）

机器扫描口径：对 `features.json5` 的 931 个叶子键，在 `js/`、`templates/`、`scripts/`（排除 schema/defaults）中按「叶键名零引用」判定。收口账目：

| 处置 | 数量 | 说明 |
|---|---|---|
| 已接线（功能已存在，本轮补读配置） | 35 | readingTime.showInMeta；toc.minLevel/maxLevel/highlightActive；mobileToc.overlayClose/lockScroll/autoClose/maxHeightVh/borderRadius；readDock.showProgressRing/showTocButton/showTopButton；externalLink.showFullUrl/openInNewTab；themePresets.showInNavbar/previewOnHover；themeSchedule.applyInstantly；dailyQuote.quoteColor；share.popupWidth/popupHeight/wechatText/wechatTextEn；tts.volume；comments.loadContainer；darkImageFilter.applyImages；shortcuts.helpTitle/helpTitleEn/showHelpTable；ogImage.useCover/gradientForNoCover；search.highlightMatches/closeOnOverlay/focusOnOpen；searchHighlight.enabled（审计中新发现未接线） |
| 已实现（功能新增） | 5 | hotSearches.top/showInDropdown/showClear（热门词）、readingProgress.tipDisplayMs/ariaAnnounce（气泡 + 播报 + 键盘） |
| 已标注（预留） | 142（135 新标注 + 7 上批已标注） | JSON5 逐键 `// ⚠ 未接线（预留）：<原因/替代>`；`docs/config-reference.md` 新增「3.0 未接线键总表」 |
| 已删除（重复键） | 1 | themeToggle.animationMs（W3） |

> 备注：2026-09-27 配置在库共 931 个叶子键；`enabled`/`height`/`size`/`count` 等通用名键无法被叶键名扫描可靠覆盖，本轮按跨文件重复清单人工核验（见 8.3），未列入机器账目。

### 8.3 W3 — 跨文件语义重复结论

| 重复对 | 处置 | 说明 |
|---|---|---|
| `themeToggle.animationMs` ↔ `theme.animation.transitionDuration` | **删除前者** | 实际生效后者（经 `tuning.motion.transitionDuration` 覆盖）；schema/config-reference/features 三处同步 |
| `backToTop.rightOffset/bottomOffset` ↔ `tuning.backToTop.offsetSide/offsetBottom` | 前者标注同义 | CSS 只消费 tuning；features 侧保留兼容 |
| `lightbox.maxWidthVw` ↔ `imageFit.lightbox.maxWidthPct` | 前者标注同义 | 模板读 imageFit |
| `listCover.aspectRatio` ↔ `tuning.card.imageAspect`/`theme.card` | 前者标注近似同义 | 卡片比例由 tuning 生效 |
| `contactPopup.popupWidth '360px'` ↔ 模板固定 `400px` | 标注漂移（待决策） | 接线将改变现有视觉 40px，未擅自改动 |
| `stats.label*` / `heatmap.legend*`/`tooltip*` / `series.badgeFormat*` 等文案键 ↔ `ui-strings.json5` | 标注（i18n 重复） | 实际文案按语言取自 ui-strings |
| `wordCount.onCards` ↔ `theme.card.showWordCount` | 标注同义 | 卡片字数由 theme 控制 |
| `features.motion.*` ↔ `tuning.motion.*`；`search.debounceMs/maxHistory/minChars/noResultText` ↔ `tuning.search.*` | 保留（双活、tuning 优先） | `motion.js`/`search.js` 以 `pick(tuning, features)` 读取，非死键 |

### 8.4 W4 — 小功能（已完成 2 项，均有配置键 + 中文注释 + 双语文案 + 无障碍）

1. **热门搜索**（`hotSearches.top` 默认 5 / `showInDropdown` true / `showClear` true）：本地词频 `s-hotSearches:hot`（≤50 词）累计，下拉渲染「热门搜索」分组（词频降序）+ 清空按钮；原生 button 可键盘操作、清空按钮带 `aria-label`；新增 `ui-strings.search.hot/clear/clearHot`。顺带修复同函数内 `saveHistory` 被调用两次导致的双重计入。
2. **阅读进度气泡**（`readingProgress.tipDisplayMs` 默认 500 / `ariaAnnounce` true）：点击跳转后气泡停留 `tipDisplayMs`，悬停/聚焦常显；进度条 `tabindex=0` + `aria-valuenow`，支持 ←/→（5%）、Home/End；`prefers-reduced-motion` 下滚动经 `__SB()` 降级。

### 8.5 W5 — 门禁与验证证据

| 门禁/验证 | 结果 |
|---|---|
| `npm run verify:config` | PASS（99 模块一致；tuning 新增 31 键 ↔ 注册表一致） |
| `npm run lint` | 0 错误 |
| `npm run typecheck` | 通过（tsc 无输出） |
| `npm test` | **379 tests / 82 suites / 0 fail**（新增 extractToc min/maxLevel 2 例） |
| `npm run test:build` | 2/2 通过（含 EJS 全量编译与 CSP nonce 断言） |
| 构建 `npm run build -- --out .tmp-scripts/out/round2-build` | 成功（6.93s，OG 复用 16/失败 0，search-index 8+8） |
| 产物体积（vs 上批 audit-build） | 页面 gzip 中位 **−5B**（31 页全部 ≤0 或微降）；超 28KB 预算页数 2→2；assets/js gzip 55.4→**56.7KB（+1.3KB）**，超 55KB 上限告警（`perfBudget.warnOnly=true`，非阻断） |
| 无头 runner `.tmp-scripts/run-round2.js` | **55 PASS / 0 FAIL**、0 控制台错误、端口 3324 已释放；截图 `.tmp-scripts/out/round2-{zh-home,zh-search-hot,zh-404,zh-article-mobile}.png` |
| runner 覆盖 | W1 变量+计算样式 34 项（含 404/灯箱/移动端/平板断点）；W2 运行时门控 11 项（search 高亮/遮罩/聚焦、mobileToc overlay/lock/autoClose、bundle 标记、SSR 默认态）；W4 热门搜索 5 项 + 进度气泡 3 项 |

### 8.6 W6 — 提交

| 提交 | 内容 |
|---|---|
| `6bc957a` | refactor(ai): tuning 设计尺寸第二批迁移（31 项）并同步默认值 |
| `13cd0f2` | refactor(ai): 删除重复键 themeToggle.animationMs（W3） |
| `e192443` | feat(ai): 接线 35 项预留配置并按键补全 ⚠ 未接线标注（W2） |
| `fe0e022` | feat(ai): 热门搜索与阅读进度气泡（W4） |
| `docs(ai)`（本提交） | CHANGELOG 与第二轮闭环结果 |

### 8.7 仍未闭环项（新发现 / 需用户决策）

1. **JS 预算超限**：assets/js gzip 55.4→56.7KB（上限 55KB，`warnOnly=true` 不阻断）。建议二选一：接受并调高 `features.perfBudget.jsKb`（JSON5 可调），或下一批压缩（热门词/进度逻辑可合并复用）。
2. **search 结果容器重复查询追加不清空**（既有缺陷，非本批引入）：`doSearchNow` 渲染结果前未清空 `#searchResults`，连续查询会叠加旧结果节点。建议下一批修复（`d.innerHTML=''` 于追加前）。
3. **readingTime 两处展示**：配置文案（`N阅读约需`）与模板内置 `N 分钟阅读` 默认同时显示；`showInMeta=false` 已可一并隐藏，但文案重复建议二选一（改模板会变更默认视觉，待确认）。
4. **contactPopup.popupWidth 漂移**：默认 360px vs 模板固定 400px；接线即改变现有视觉，待确认。
5. **search.matchTags/matchCategories**：接线将扩大搜索结果集合（默认 true 即启用），属行为变更，待确认后接线（当前已标注）。
6. **通用名键盲区**：`enabled/height/size/count` 等无法被叶键名扫描覆盖，需后续引入基于属性访问路径的静态分析或人工巡检清单。
7. 135 个预留键（`lightbox.openDurationMs`、`backToTop.scrollDurationMs`、`themeToggle.defaultTheme` 等）为功能未实现而不是硬编码漂移；如需要某键生效，建议单独立项实现并在本表更新状态。
