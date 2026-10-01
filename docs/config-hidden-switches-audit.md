# 隐藏开关与重复默认审计（JSON5 单一事实源收敛）

> 范围：`js/domains/**`（49 文件）、`js/core/**`、`workers/**`、`scripts/build/**`、`templates/**`（含内联脚本）。
> 排除：`guard.bypass`（上一轮已配置化）、`articles/`、`real-site/`。
> 方法：逐文件通读 + 关键词扫描（硬编码布尔/字符串开关、魔法时长/阈值/上限、`localStorage` 键、`data-*` 控制标记、`window.__*__` 行为标记、代码常量与 JSON5 同义键双份）。
> 口径：A = 用户可精细化控制，应进 JSON5；B = 代码与配置双份/配置键未接线，去重且 canonical 为 JSON5，代码缺省回退历史行为；C = 内部实现细节，保留并在本报告说明理由。
> 分类统计：**A 21 项（本次接入）**、**B 6 组（本次去重/接线）**、**C 25 项（保留）**。

---

## 1. A 类：本次接入 JSON5 的键（新增 21 键，默认值 = 历史行为）

### 1.1 features.json5（17 键）

| 位置（file:line 审计时） | 现值 | 分类 | 处置（键 → 默认 → 消费点） | 默认行为 |
|---|---|---|---|---|
| `js/domains/features/lightbox.js:54` | 触屏横向滑动阈值 `> 50` | A | 新增 `features.lightbox.swipeThresholdPx: 50` → lightbox.js 触屏切图 | 不变 |
| `js/domains/features/lightbox.js:54` | 下拉关闭阈值 `dy > 80` | A | 新增 `features.lightbox.swipeCloseThresholdPx: 80` → lightbox.js 下拉关闭 | 不变 |
| `js/domains/features/lightbox.js:55` | 鼠标拖拽切图阈值 `> 80` | A | 新增 `features.lightbox.mouseSwipeThresholdPx: 80` → lightbox.js 桌面拖拽 | 不变 |
| `js/domains/features/lightbox.js:58` | 双击放大倍数硬编码 `zoomTo(2, …)` | A | 新增 `features.lightbox.dblClickZoomLevel: 2` → lightbox.js 双击 | 不变 |
| `js/domains/features/lightbox.js:46` | 遮罩点击判定容差 `> 6` px | A | 新增 `features.lightbox.clickTolerancePx: 6` → lightbox.js 遮罩关闭 | 不变 |
| `js/domains/core/reading.js:135` | 进度条键盘步进 `0.05` | A | 新增 `features.readingProgress.keyboardStep: 0.05` → reading.js ←/→ 步进 | 不变 |
| `js/domains/core/read-position.js:26` | 恢复滚动位置最小 y `> 160` | A | 新增 `features.readingProgress.minRestorePx: 160` → read-position.js | 不变 |
| `js/domains/core/read-position.js:16` | 记忆位置条目上限 `80` | A | 新增 `features.readingProgress.maxStoredPositions: 80` → read-position.js 淘汰 | 不变 |
| `js/domains/core/read-position.js:33` | 滚动保存节流 `400` ms | A | 新增 `features.readingProgress.saveThrottleMs: 400` → read-position.js | 不变 |
| `js/domains/core/reading.js:95` | 阅读坞「近顶部」阈值 `now < 80` | A | 新增 `features.readDock.hideBelowPx: 80` → reading.js | 不变 |
| `js/domains/core/reading.js:96-97` | 阅读坞方向判定增量 `±12` px | A | 新增 `features.readDock.directionDeltaPx: 12` → reading.js | 不变 |
| `js/domains/core/external-link.js:19` | 复制反馈停留 `COPY_FEEDBACK_MS = 1500` | A | 新增 `features.externalLink.copyFeedbackMs: 1500` → external-link.js | 不变 |
| `js/domains/features/search.js:378-381` | 热门词表上限硬编码 `50`（JSON5 注释已写「最多 50 词」） | A | 新增 `features.hotSearches.maxWords: 50` → search.js `bumpHot` | 不变 |
| `js/domains/features/morphicons.js:192` | idle 预加载超时 `{ timeout: 3000 }` | A | 新增 `features.morphIcons.idleTimeoutMs: 3000` → morphicons.js | 不变 |
| `js/core/soft-nav.js:7,63` | 预取缓存条数 `CACHE_MAX = 16` | A | 新增 `features.softNavigation.cacheMaxEntries: 16` → soft-nav.js `trimCache` | 不变 |
| `js/domains/features/reading-history.js:14` | 本地存储上限 `slice(0, 50)`（JSON5 未暴露，文档仅写「上限 50 条」） | A | 新增 `features.readingHistory.maxStored: 50` → reading-history.js | 不变 |
| `js/domains/core/reading.js:4-5`、`reading-mode.js:7` | 阅读模式持久化键 `'readingMode'` 两处硬编码；`features.readMode.persist` 未接线 | B/A | 新增 `features.readMode.storageKey: 'readingMode'`；接通既有 `persist` | 不变 |

### 1.2 tuning.json5（4 键）

| 位置 | 现值 | 分类 | 处置（键 → 默认 → 消费点） | 默认行为 |
|---|---|---|---|---|
| `js/domains/features/search.js:17` | 代码读 `TNS.indexTimeoutMs`，但 tuning.json5/注册表/文档均无此键（隐藏键） | A | 新增 `tuning.search.indexTimeoutMs: 5000`（注册表 + 文档） | 不变 |
| `js/domains/features/search.js:25` | 索引加载失败重试 1 次硬编码 | A | 新增 `tuning.search.indexRetry: 1` → search.js `fetchOnce` | 不变 |
| `js/domains/features/search.js:337` | 代码读 `TNS.errorText`（隐藏键），且 en 站无专属文案 | A | 新增 `tuning.search.errorText: ''`、`tuning.search.errorTextEn: ''` → search.js 按语言取值链 | 不变（空串回退 i18n） |

---

## 2. B 类：去重/接线（6 组，canonical = JSON5/schema，代码回退历史行为）

| 位置 | 双份/漂移事实 | 处置 | 默认行为 |
|---|---|---|---|
| `js/domains/features/command-palette.js:26` | 代码回退 `maxResults` 为 **8**，JSON5/schema 默认 **10**（三处三值，degrade 模式取值漂移） | 代码回退对齐 10；canonical 纯函数 `commandPaletteConfig` 锁定 | 正常构建不变；degrade 模式修正为文档默认值 |
| `js/domains/features/command-palette.js:24-25` | 注释与回退热键为旧值 `'k'`，JSON5/schema 为 `'ctrl+shift+p'` | 回退值/注释同步为 `'ctrl+shift+p'` | 同上 |
| `js/domains/core/reading.js:4-5` + `reading-mode.js:7` | 存储键 `'readingMode'` 双处硬编码；`features.readMode.persist` 有键无消费（死配置） | `readMode.storageKey` 单一来源 + `persist` 接线（false=不读写、并清理旧值） | true 时与历史一致 |
| `js/domains/core/seamless-nav.js:10-23` | `storeKey(cfg)` 无回退：配置缺省（degrade/老配置）时 localStorage 键为 `undefined` | 补 JSON5 默认回退 `'s-view-transition'` / `'s-speculation'` | 正常构建不变；degrade 模式修正 |
| `templates/layout.ejs:215`（mermaid 复制反馈） | 硬编码 `1500` ms，与 `features.codeCopy.buttonTimeout` 语义相同（双份默认） | 改读 `features.codeCopy.buttonTimeout`（单一来源） | 不变（默认 1500） |
| `features.mermaid.version`（`features.json5:1071`、schema） | 值 `11.4.1` 与实际安装 vendor `11.17.2` 不一致；唯一消费点核查：**零消费**（构建期缓存键走 `scripts/lib/mermaid-render.js:357` 读 `package.json` 版本） | 值更新为 `11.17.2`；注释写明「镜像 package.json 安装版本」；新增守卫测试锁定二者一致 | 不变 |

> 说明：代码侧回退值保留（degrade 模式 `__CRIT__` 仅含 guards，缺失键必须有历史行为兜底），但回退值必须与 JSON5/schema 默认一致——本轮把漂移的 `commandPalette` 两处修正，其余抽样一致。

---

## 3. C 类：保留（内部实现细节，不配置；列出理由）

| 位置 | 常量/开关 | 保留理由 |
|---|---|---|
| `js/domains/features/search.js:364` | `HOT_SUFFIX = ':hot'` | 存储键格式约定，注释与文档已明示 `storageKey + ':hot'`；改键=数据迁移，非调参 |
| `js/domains/features/popup-notice.js:163` | `key + ':session'` | 同上（sessionStorage 命名空间后缀） |
| `js/domains/core/reading.js:89` | 进度环周长 `R = 100.5` | SVG 几何常量（r=16 圆周长），改值只影响进度环描边比例，属实现细节 |
| `js/domains/core/background.js` | 粒子半径 `Math.random()*1.8+1`、连线透明度系数 `0.35`、默认色 `139,153,168` | 渲染细节，已有 `count/speed/linkDistance/opacity/showLines` 覆盖用户可调面 |
| `js/domains/features/daily-quote.js:16` | 每日选句散列 `date*7+month*3+year` | 确定性算法常量，非用户策略 |
| `js/domains/core/announcement.js:1`、`popup-notice.js:3` | `hashStr` 的 `h*31` | 字符串哈希算法常量 |
| `js/domains/guard/watermark.js` | 平铺数量 `72/80` | 由布局算法与字号/间距决定；与 `gapX/gapY` 已有键重复表达 |
| `js/domains/guard/context-menu.js:210` | 长按位移容差 `> 8` px | 手势去抖实现细节；`trigger.longPressMs` 已可调 |
| `js/domains/guard/context-menu.js:214`、`sidebar-drag.js:58` | `navigator.vibrate(10)` | 触觉反馈时长由平台定义，10ms 为设备惯例值，非站点策略 |
| `js/domains/guard/devtools-detect.js:12` | `RELOAD_KEY = 's-dt-reload'` | 会话熔断键（防止刷新死循环），安全机制内部约定 |
| `js/domains/features/morphicons.js:4-8` | SVG path `d` 常量 | 图标资产 |
| `js/domains/core/code-block.js:3` | `TERM` 语言前缀表 | 内容渲染约定（bash→`$`），无用户调参需求 |
| `js/domains/core/code-block.js:67-68` | 横滚提示容差 `8`/`4` px | 溢出检测防抖 | 
| `js/domains/features/lightbox.js:29` | `'s-lb-pos:'` 前缀 | 会话级记忆键；`rememberPosition` 已控制开关，键名非调参面 |
| `workers/security-worker.js:18` | `CSP_REPORT_MAX_BYTES = 16384` | 边缘防护上限（防滥用），安全语义 |
| `workers/security-worker.js:20` | `RateLimiter(5000)` 内存条目上限 | 内存保护实现细节；限速策略已全量在 security.json5 |
| `workers/security-worker.js:146` | `LOG_LEVELS` 映射 | RFC 5424 级别映射常量 |
| `workers/security-worker.js:185` | 日志盐 `'|s-ynapse-log'` | 哈希盐（可被 `LOG_IP_SECRET` 覆盖），安全实现 |
| `workers/lib/ip-utils.mjs:115` | 解码循环上限 `3` | 防双重编码绕过的固定深度 |
| `scripts/build/cjk-fonts.js:15-16` | `CHUNK_LIST_TTL_MS`(7 天)/`DOWNLOAD_CONCURRENCY`(6) | 构建缓存 TTL 与并发；`fetchTimeoutMs/weights/family` 已配置化 |
| `scripts/lib/og-size.js:12` | `MAX_OG_DIMENSION = 2560` | 对应 `features.ogImage.autoSize.maxDimension` 硬上限保护 |
| `scripts/lib/auto-cover.js:24,28` | `MAX_DIMENSION 4096`/`TITLE_MAX_LINES 3` | 输入钳制上限；用户可调面已由 `autoGenerate.width/height` 覆盖 |
| `scripts/lib/config-split.js:14` | `CRITICAL_MAX_BYTES = 2048` | 内联降级子集体积门禁（工程约束） |
| `scripts/lib/mermaid-render.js:32` | 缓存键 sha256 截断 16 位 | 内容寻址实现细节 |

---

## 4. 顺带修正

1. **`features.mermaid.version`**：核实为「仅历史标识、零消费」——构建期 SSR 与缓存键使用 `scripts/lib/mermaid-render.js:357` 读取的 `package.json` 安装版本（现 11.17.2）；客户端 vendor 由 `scripts/build/assets.js:77` 复制同一安装版本。处置：值更新为 `11.17.2` 并加注释；新增守卫测试断言 `features.mermaid.version === package.json.dependencies.mermaid`，防止再次漂移。
2. **配置项计数口径核对**：新增 `scripts/lib/config-count.js`（口径：对象逐层展开、数组元素逐项计入且元素为对象时不再展开）+ `scripts/config-count.test.js`，同时锁定 README 声明的 features 模块数/项数、tuning 分类数/项数、guard 目录树计数与实测一致。实测（本轮前）：features 97/919、tuning 37/269、guard 11/177、全仓 2697 项；本轮接入后：features 97/936、tuning 37/273、全仓 2718 项（README/config-reference 已同步，测试锁定）。
3. **`tuning.search` 隐藏键**：`indexTimeoutMs`/`errorText` 从「仅代码可读」转为注册表+文档可见，并补 `errorTextEn`/`indexRetry`。

## 5. 验证证据

- 单测：`scripts/config-wiring.test.js` 新增 12 个 canonical 纯函数与 12 组用例（默认态=历史行为 + 覆盖生效 + 非法回退）；`scripts/config-count.test.js` 4 组用例（计数口径单元 + features/tuning/guard/total 实测锁定 + README/config-reference 文档计数核对 + mermaid 版本一致性）。
- Runner：`.tmp-scripts/run-hidden-switches.js`（端口 3333，父死/空闲看门狗 + 端口释放校验 + 自收尾），三组代表性开关两态验证，**20 PASS / 0 FAIL，端口 3333 释放正常**：
  1. `readMode.persist` true/false（localStorage 写入 + 刷新恢复）+ `readMode.storageKey` 覆盖；
  2. `hotSearches.maxWords` 默认 50 vs 覆盖 2（4 词词频表分别保留 4 / 截断为 2）；
  3. `tuning.search.errorText` 默认 i18n 文案 vs 自定义文案（拦截 search-index.json 强制失败）；
  全部断言默认态与历史行为一致、覆盖态生效、0 控制台错误（索引中断噪音已豁免）。
- 门禁：`npm test`、`npm run lint`、`npm run typecheck`、`npm run test:build`、`verify:config`/`verify:config-refs`/`verify:config-comments`/`verify:config-docs` 全绿；一次 `--out` 真实构建成功（17–23s）。

## 6. 残余与需拍板项

- `templates/layout.ejs` 内联 mermaid 客户端脚本的 `securityLevel:'strict'`、flowchart `curve:'basis'` 等为渲染策略常量，未配置化（如需可另立 `features.mermaid.clientOptions` 透传，属新功能面）。
- `js/domains/guard/watermark.js` 移动端断点硬编码 `768px`，与 `tuning.layout.mobileBreakpoint` 同值双份；guard 运行时当前不读 `__TUNING__`，接入需新增依赖，建议下轮评估（本轮不改，避免守卫模块加载期耦合 tuning）。
- 本报告 C 类清单中的 `vibrate(10)`、`s-lb-pos:`、`s-dt-reload` 键等如需开放，属新增功能决策，请用户拍板。

## 7. 配置扩张（H3）裁决记录

本轮把 P1–P3 共 29 项隐藏开关接入 JSON5（默认值 = 历史行为，逐键注释，`verify:config-refs` 零未接线）。其中三处「二选一」裁决如下，作为后续维护的单一来源依据：

1. **主题色收编：本波不把窗口点色/高亮色并入 `theme`**。`features.codeBlock.windowDotColors`（代码窗口栏三圆点）与 `features.searchHighlight.markColor/markColorDark`（搜索命中底色）保持 features 单源，不复制为 `theme.colors.*`。理由：两者是「组件装饰色」而非站点调色板语义，并入 theme 会形成双源（theme 调色板切换 vs 组件专用色），违反单一事实源；若未来需要主题级联动，应以 `var(--color-*)` 引用而非新增 theme 键。对应消费点：`templates/site-css.ejs`（`mark` 规则直接内联浅/深两色，`[data-theme="dark"]` 覆盖；`.cw-dot` 三色规则）。
2. **搜索遮罩底色放 `tuning.search.overlayBackdrop`（而非 `features.search`）**。与同组 `overlayPadding` 一致：纯视觉参数归 tuning 注入 `--search-overlayBackdrop` CSS 变量，features.search 只保留行为开关；消费点 `templates/site-css.ejs → .search-overlay`。
3. **两份内部参数的公开键回退关系**：新增 `site.build.reportTopN` 优先、缺失回退 `internals.report.topN`；新增 `site.build.cjkFonts.cacheTtlDays` 优先、缺失回退 `internals.cache.fontsTtlDays`。站点配置面向用户、internals 面向工程内部；两个 internals 键保留为降级/派生副本场景的回退，均仍被代码消费（`verify:config-refs` 通过）。

其余口径说明：`sidebar.recentPoolSize`（默认 10）决定 `recentPosts` 数据池，`sidebar.widgets[].count` 只能池内截取（count > 池时按池大小渲染）；`features.errorPage.suggestCount` 复用同一池且被池大小隐含封顶。
