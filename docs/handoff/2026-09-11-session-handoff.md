# S-ynapse 会话交接文档(详细版)

> **生成时间**: 2026-09-11
> **项目路径**: `D:\administrator\Documents\project\S-ynapse`
> **上一会话主题**: 配置扩展批次 1B/1C 收尾 + 批2/ESM 迁移准备
> **文档用途**: 新会话启动后先完整阅读本文档,即可无缝续接工作

---

## 0. 如何使用本文档

1. 先读「第 2 节 Git 状态」——工作区有未提交的重要工作
2. 再读「第 6 节 下一步待办」——按优先级执行
3. 执行时参考「第 7 节 环境与工具」「第 9 节 踩坑清单」
4. 用户偏好见「第 8 节」——违反会被用户纠正

---

## 1. 用户核心请求汇总(历史脉络)

### 本会话已完成的用户请求
| 请求 | 状态 |
|---|---|
| 完成文档 1-4(CHANGELOG/README/config-reference/归档规划) | ✅ 已提交 402a7eb |
| "尽可能增加更多的配置"(配置扩展批1A/1B/1C) | 1A 已提交;1B/1C 未提交 |
| "IIFE 迁移 ESM"方案确认 | 方案已定,未开始 |
| scrollspy 修复 | ✅ 已提交 9d09899 |
| 内容级双语(zh/en 目录+翻译+URL前缀) | ✅ 已提交(7fc4d3b 等) |
| 全站页面语言化 + UI 英化 | ✅ 已提交(5eca34d) |

### 用户最近原话(未完成部分)
- "1，2，3，4完成，对了尽可能增加更多的配置，以及那个一部分的IIFE换为其他的搞好了吗？"
- "是IIFE迁移ESM"(确认迁移方向)
- ESM 决策 4 问全答:①全量迁移+按功能拆分模块 ②保留 window 全局注入 ③新建 js/ 源目录→构建复制 dist/js/(terser+cache-bust) ④现代浏览器即可(无 nomodule 回退)
- 配置扩展 3 问全答:①两者都要(深挖现有 72 模块+新增新模块) ②全部接线生效(不许只写 schema) ③先配置后 ESM
- "紧急停止写完整的文档。准备开新的会话。"
- "放在项目里面,还要不要进入git。以及不够详细"(本文档回应)

### 用户长期偏好(必须遵守)
1. **每完成一步必须 git commit 保存进度**(反复强调,"防止到时候后期丢失")
2. **有问题必须问用户**(grill-me / question),尤其配置类决策
3. **配置优先**:尽可能加配置,但每个配置必须接线生效
4. **不推送远端、不创建 tag**(除非用户明确要求)
5. 先规划后执行;批量任务可分批次+子代理
6. 子代理提示词必须完全自包含

---

## 2. Git 状态(关键!)

### 已提交(本地,未推送)
```
6147c1e feat(ai): wire 22 new config params across 8 modules — 批1A
402a7eb docs: 1.0.3 changelog + README bilingual section + config-reference en fields + archive i18n plan
9d09899 fix: scrollspy IIFE missing invocation parens — TOC progress/current now works; remove debug marker
5eca34d feat(i18n): language-aware UI rendering — en pages render English at build time
44c5b89 fix(i18n): root 404.html fallback + language redirect rules
2595dcd fix(i18n): per-language RSS/JSON feeds + og images + sitemap
7fc4d3b feat: translate 19 articles to english
66d4ab8 feat(i18n): full UI translation via __T() runtime + search page dynamic + 404 redesign
dd1bba2 feat(i18n): __I18N__ injection from uiStrings + aria-label l10n + __T dict
bfd62db feat(i18n): UI string dictionary 143 keys zh/en
```
(更早: 双语目录结构、XSS JSON-LD 转义修复、_redirects 等均已提交)

### 未提交(工作区 9 文件,+211/-81)—— **最重要的工作**
```
docs/config-reference.md         批1B/1C 文档同步
features.json5                   +122 行,批1B/1C 中文注释
scripts/build.js                 批1B/1C 少量修改(含 heroData ctaLabelEn 行1586)
scripts/lib/features-schema.js   +48 行,批1B/1C schema
templates/archive.ejs            批1C(heatmap/stats 微调)
templates/gallery.ejs            批1B(gallery gap/圆角)
templates/index.ejs               批1C(hero showDate)
templates/layout.ejs             批1B/1C 主要接线(+62/-xx)
templates/post.ejs               批1B/1C(+23/-xx)
```

---

## 3. 批1A(已提交)详情

**commit 6147c1e** — 8 模块 22 参数:
| 模块 | 新参数 |
|---|---|
| lightbox | showCaption / captionMaxLines / transitionDurationMs |
| search | debounceMs / showHistoryOnFocus / maxHistory |
| readingProgress | zIndex / showTip / progressColor |
| backToTop | zIndex / size |
| toc | titleText / titleTextEn / showTitle / maxWidthPx |
| codeBlock | maxHeightVh / headerHeight / fontSize |
| tts | highlightReading / highlightClass / skipSelectors |
| readingPanel | persistKey / showReset |

**重大发现**: readingProgress(#rp) 和 backToTop(#btt) 原本只有 HTML+CSS、**JS 逻辑完全缺失**。已补两个新 IIFE:
- readingProgress: scroll 节流更新宽度/tip/dot + clickToJump + showTip
- backToTop: scroll > showAfterPx 时显示

---

## 4. 批1B(完成未提交)详情

**8 模块 23 参数**:
| 模块 | 新参数 |
|---|---|
| themeToggle | persistKey('ss-theme') / toggleIconSwap / zIndex(100) |
| themeSchedule | checkIntervalMs(60000) / smoothTransition |
| imageLazy | loadingClass('img-loading') / errorClass('img-error') / eagerFirst(3) |
| series | showPrevLabel('上一篇') / showNextLabel('下一篇') / progressLabel('{index} / {total}') / sidebarTitle('系列') |
| related | showExcerpt(true) / excerptLength(80) / showCount(false) |
| share | useNativeShare(false) / copyFallback(true) |
| reward | showNote(true) / qrMaxWidth('180px') / closeText('关闭') |
| gallery | gap('12px') / showCaption(true) / borderRadius('8px') |

**接线点**:
- layout.ejs: 首屏脚本行4 / 启动行351 / 定时行352 / toggleDark 行355 / CSS 行41,66,164,171 / 懒加载行403 / 分享行469 / 系列侧栏行310,322
- post.ejs: 系列导航行146-149 / 相关行90-91 / 打赏行167-171
- gallery.ejs 行15;build.js computeRelatedArticles 行1111(补 excerpt);docs/config-reference.md

**验证记录**: schema OK;json5+validateFeatures 0 error;21 script 块 acorn 通过;build 无 ERROR;puppeteer 31/31(ss-theme 键/图标交替/z-index100/checkIntervalMs/eagerFirst/img-loading 类/系列导航/摘要≤81字/native share/打赏关闭文本/gap12px/圆角8px);npm test 67/67

---

## 5. 批1C(接线已完成,浏览器验证未做)详情

**8 模块 27 参数**:
| 模块 | 新参数 | 接线点(已确认) |
|---|---|---|
| motion | pageEnterDurationMs(240)/cardHoverScale(1.02)/linkUnderlineOffset('3px') | layout.ejs CSS |
| hero | showDate(false)/ctaLabelEn('View all posts')/heightVh(60)/backgroundImage('') | layout CSS 行16876-16928(heightVh/backgroundImage)+ index.ejs(showDate)+ build.js 行1586(ctaLabelEn) |
| heatmap | gap('3px')/borderRadius('3px')/cellSize('13px')/emptyColor | layout CSS 行55354+(cal-heat/cal-cell) |
| stats | cardColumns('auto-fit')/showSidebar(true)/labelAvgPerDay('日均') | layout CSS 行54547(stats-grid)+ layout.ejs 行89869(showSidebar)+ archive.ejs(labelAvgPerDay) |
| mobile | tocBreakpoint(768)/safeAreaBottom(true)/tapHighlight(false) | layout.ejs CSS |
| comments | placeholderText('评论加载中…')/loadDelayMs(300)/emptyText('暂无评论') | post.ejs |
| contactPopup | showIcon(true)/copySuccessText('已复制')/maxItems(4) | layout.ejs 行83880(图标)/行133088(maxItems)/行133882(copySuccessText) |
| prevNext | showThumbnail(false)/labelPosition('left')/scrollToTopOnClick(true) | layout.ejs 行149452(scrollToTopOnClick)+ post.ejs 行18223(labelPosition)/行18460(showThumbnail) |

**已完成验证**:
- build 成功: **en=62 页面 / zh=59 页面,0 ERROR**(用 `.tmp-scripts/run-build.js` 验证)
- dist acorn: dist/zh/index.html 5 blocks 0 fails;dist/en/index.html 5 blocks 0 fails;hello-world 7 blocks 0 fails;archive/gallery 0 fails

**未完成验证(下一步首要任务)**:
- 浏览器 puppeteer 验证 1C 参数实际生效
- serve 已启动(pid 23232,http://127.0.0.1:3224,已确认 200)

---

## 6. 下一步待办(按优先级)

### 6.1 浏览器验证 1C(立即)
serve 已在跑。验证项:
```
1. hero: 首页 .hero computed min-height = 60vh;无 .hero-date(showDate=false);en 页 CTA 文本 'View all posts'
2. heatmap: 归档页 .cal-heat gap=3px;.cal-cell border-radius=3px;width≈13px
3. stats: .stats-grid grid-template-columns 含 auto-fit;侧栏 stats widget 可见
4. contactPopup: 文章页弹层有图标;复制成功文本='已复制';items 截断≤4
5. prevNext: 文章页 .post-nav-link 无 img;labelPosition 默认 left(无 pos- 类)
6. motion: .page-enter animation-duration=240ms;卡片 hover transform scale(1.02)
7. mobile: 视口<768 时移动 TOC 逻辑;body/HTML tap-highlight-color 样式
8. comments: 文章页占位文本/延迟/空文本逻辑
```
验证脚本模板(项目根创建,注意 Chrome 路径与 127.0.0.1):
```js
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe',
    headless: 'new'
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://127.0.0.1:3224/zh/', { waitUntil: 'domcontentloaded' });
  const hero = await p.evaluate(() => {
    const h = document.querySelector('.hero');
    return h ? { minHeight: getComputedStyle(h).minHeight, hasDate: !!document.querySelector('.hero-date') } : null;
  });
  console.log('hero:', JSON.stringify(hero));
  await b.close();
})();
```

### 6.2 npm test + security-verify(1C 验证后)
```powershell
# 先杀 serve 再 build(避免锁 dist)
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
node scripts/build.js
npm test          # 期望 67/67
node scripts/security-verify.js   # 期望 [PASS]
```

### 6.3 提交批1B+1C(工作区混合,一次提交)
```powershell
git add -A
git commit -m "feat(ai): wire 47 new config params — batch 1B (themeToggle/schedule/imageLazy/series/related/share/reward/gallery) + 1C (motion/hero/heatmap/stats/mobile/comments/contactPopup/prevNext)"
```

### 6.4 批2:新增 5 个全新模块(未开始)
**用户要求: 每个模块 schema + features.json5 注释 + 接线 + 验证,全部生效。**

建议设计(实施前用 grill-me 与用户确认):

| 模块 | 建议参数 | 接线位置 |
|---|---|---|
| **scrollBehavior** | enabled, behavior('smooth'), block('start'), scrollPaddingTop('80px'), anchorHighlight(true), anchorHighlightDurationMs(1200), backToHashOnLoad(true) | layout.ejs CSS(html scroll-behavior/scroll-padding-top)+ JS(锚点点击高亮目标) |
| **toast** | enabled, position('top-center'), durationMs(2400), maxVisible(3), animation('fade-slide'), showClose(false), useForCopy(true), useForFavorite(true), useForShare(true) | layout.ejs 新 JS(全局 toast 函数)+ CSS;接入 copy/fav/share 现有逻辑 |
| **breadcrumb** | enabled, showHome(true), homeLabel('首页'), separator('/'), showOnPosts(true), showOnPages(true), showOnArchive(true), position('top') | post.ejs/page.ejs/archive.ejs 顶部 + CSS;数据可由 build.js 注入(或模板现算) |
| **pageTransition** | enabled, type('fade'), durationMs(180), outDurationMs(120), respectReducedMotion(true), excludeSelector('[data-no-transition]') | layout.ejs CSS + JS(pageshow/pageload 动画);注意与现 motion.pageEnterDurationMs 协调 |
| **pwa** | enabled(false 默认), manifestPath('/site.webmanifest'), themeColor, backgroundColor, display('standalone'), icons[], offlinePage, cacheName, precache[], skipWaiting(false) | build.js 生成 manifest + service worker 文件(注意 build 现有 `[SKIP] PWA generation disabled` 输出,说明有现成开关位);layout.ejs 注入 manifest link + SW 注册 |

实施顺序建议: scrollBehavior → toast → breadcrumb → pageTransition → pwa(复杂度递增)。
每完成一个: 验证 → 提交。

### 6.5 ESM 迁移(用户已确认方案,大工程)
**方案要点(已与用户确认)**:
- 全量迁移 layout.ejs 内联 IIFE 为 ES Module,**按功能拆分模块**
- 保留 window 全局注入(`__FEATURES__`/`__I18N__`/`__PRESETS__` 等由构建内联)
- 新建 `js/` 源目录 → 构建复制到 `dist/js/`(terser + cache-bust)
- 现代浏览器即可,无 nomodule 回退

**建议迁移步骤(分阶段,每阶段提交)**:
1. **阶段0 基建**: 建 js/ 目录 + js/main.js 入口;build.js 加"复制 js/ → dist/js/ + terser + cache-bust"步骤;模板改为 `<script type="module" src="<%= assetUrl('/js/main.js') %>"></script>`;保留首屏防闪烁内联脚本(必须内联)
2. **阶段1 独立模块**(无依赖): theme-toggle, toc, toc-scrollspy, reading-progress, back-to-top, lightbox → 每模块一个文件,export init 函数,main.js 调用
3. **阶段2 全局状态模块**: theme-presets, theme-schedule, i18n, search(依赖 __I18N__)
4. **阶段3 内容功能模块**: daily-quote, favorites, sidebar-drag, code-copy, code-block, prism-theme, cover, giscus, pagefind, mobile-nav, share, reward, series, related, reading-panel, tts, shortcuts, background, image-lazy, image-fallback, external-link, contact-popup, prev-next
5. **阶段4 清理**: 删除 layout.ejs 内联 IIFE;全量回归验证(所有功能浏览器验证);性能对比
**风险**: 模块间共享状态(如 __FEATURES__)、执行顺序(依赖 DOM 的模块需 DOMContentLoaded 后 init)、cache-bust 与模块 import 路径的哈希一致性(import 语句里的路径也要带 hash 或改用 import map)。
**建议**: 迁移前先用 writing-plans 写完整计划;每阶段 git 提交。

---

## 7. 环境与工具

| 项目 | 值 |
|---|---|
| 项目根 | `D:\administrator\Documents\project\S-ynapse` |
| Node | v26.7.0 |
| 构建 | `node scripts/build.js`(~14s) |
| 测试 | `npm test`(67 项 / 17 组) |
| 安全验证 | `node scripts/security-verify.js` |
| 本地服务 | `node scripts/build.js --serve --port 3224` → http://127.0.0.1:3224/zh/ |
| Chrome | `C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe` |
| puppeteer-core | 项目 node_modules(脚本放项目根或 .tmp-scripts,从项目根运行) |
| acorn | `require('D:/administrator/Documents/project/S-ynapse/node_modules/acorn')` |
| json5 | `require('json5')`(从项目根运行) |
| 临时脚本目录 | `.tmp-scripts/`(已 gitignore);另 `C:\Users\Administrator\AppData\Local\Temp\opencode\` |
| serve 重启 | `Get-Process node | Stop-Process -Force` → 重新启动 |

**现有 .tmp-scripts/ 脚本(可复用)**:
- `run-build.js` — Node spawnSync 跑 build 并统计 en/zh 页面数(避免 PS 管道干扰)
- `start-serve.js` — 后台启动 serve
- `verify-b1b.js` / `verify-b1c.js` / `verify-b1c-dist-acorn.js` — 批1B/1C 验证
- `check-b1c-wiring*.js` / `check-hero-sidebar.js` — 接线检查
- `probe-*.js` — 各种探查
- `verify-acorn.js` / `verify-ejs.js` / `verify-json5.js` / `verify-wiring.js` — 通用验证

**关键文件**:
- 模板主文件: `templates/layout.ejs`(152K,含全部内联 JS IIFE + CSS)
- 构建主文件: `scripts/build.js`(2566 行)
- Schema: `scripts/lib/features-schema.js`(DEFAULT_FEATURES,72 模块)
- 用户配置: `features.json5`(JSON5,带中文注释)
- 配置文档: `docs/config-reference.md`
- 测试: `scripts/build.test.js`
- 变更日志: `CHANGELOG.md`(最新 1.0.3 段)

---

## 8. 用户偏好与约束(必须遵守)

1. **每完成一步 git commit**(用户原话:"每完成一步，每搞完一个东西，每增加一个功能，都必须要写一下，那个 Git 一下，保存一下进度，防止到时候后期丢失")
2. **有问题必须问**(用 grill-me skill;配置类问题尤其)
3. **配置必须接线生效**,禁止只写 schema 不接线
4. 不推送远端、不创建 tag(除非明确要求)
5. 代码注释: **一律不加**(用户未要求);features.json5 必须写中文注释(参数作用/类型/可填值/推荐值)
6. 子代理提示词完全自包含(目标/约定/验证配方)
7. 分批实施,小步提交

---

## 9. 踩坑清单(已知,避免重复)

1. **PS 5.1 引号/中文/正则必炸**: 任何含引号、中文、`${}`、正则的 `node -e` 一律写 `.tmp-scripts/*.js` 文件执行
2. **禁止 PS Set-Content 写文件**(GBK 乱码),用 edit/write 工具
3. **acorn 不要直接验证 EJS 模板**(含 `<%= %>` 必然 FAIL),要验证 dist 渲染产物
4. **build 输出中文在 PS 重定向下变 UTF-16 乱码**,用 Node spawnSync 捕获(参考 run-build.js)
5. **serve 运行时会锁 dist**,rebuild 前先 `Get-Process node | Stop-Process -Force`
6. **puppeteer 必须用 127.0.0.1**(localhost 超时);必须 setViewport(1440 桌面/768 以下移动)
7. **minify-html 会去属性引号**(href=/zh/...),验证脚本匹配时注意
8. **IIFE 括号配平陷阱**: 历史上有多次 `})})});` 缺调用括号 `()` 导致函数定义不执行的 bug(scrollspy 案例)。改模板 JS 后必须 dist acorn + 浏览器实际行为双重验证
9. **dist 缺 en 目录假象**: 曾因 PS 管道干扰误判;用 run-build.js 方式验证真实状态
10. **XSS 转义**: JSON-LD 注入必须 `.replace(/</g,'\\u003c')`(EJS 模板里需双反斜杠)
11. **features.json5 是 JSON5**(单引号/注释),用 json5.parse 验证,不能 require
12. **每步提交前**: npm test + security-verify(至少改模板/build.js 后)

---

## 10. 建议新会话加载的 Skills

| Skill | 用途 |
|---|---|
| **grill-me** | 批2/ESM 前向用户确认细节(用户指定惯例) |
| **writing-plans** | ESM 迁移是大工程,先写完整计划 |
| **test-driven-development / tdd** | 接线修改的验证习惯 |
| **full-output-enforcement** | 大文件编辑防截断 |
| **handoff** | 会话结束时再次交接 |
| **godot-prompter 系列** | 与本项目无关(Node.js 项目,忽略) |

---

## 11. 快速启动命令(新会话复制即用)

```powershell
# 1. 检查状态
cd D:\administrator\Documents\project\S-ynapse
git log --oneline -5
git status --short

# 2. 验证当前工作区构建(先杀 serve)
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
node .tmp-scripts/run-build.js

# 3. 启动 serve 供浏览器验证
node .tmp-scripts/start-serve.js
# 等待 12s 后 http://127.0.0.1:3224/zh/

# 4. 跑测试
npm test
node scripts/security-verify.js

# 5. 提交批1B+1C
git add -A
git commit -m "feat(ai): wire 47 new config params — batch 1B + 1C"
```

---

*文档结束。如有疑问,优先向用户确认,不要自行揣测。*
