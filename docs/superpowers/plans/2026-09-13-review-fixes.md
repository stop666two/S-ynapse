# S-ynapse 审查修复计划（2026-09-13）

> **状态：已完成并验证**（2026-09-13）。全部批次与用户追加项（公告增强/注释审查）已实施；提交链 `64dc2dd → 3bae616 → 518cc13 → f4df17e → 5cc9cb1 → 317e73f → 2ade962 → 71400ac`；验证：单测 100/100、安全回归 PASS、a11y 0 违规、浏览器断言 14+9+8+6+4（双态覆盖）。遗留技术债见 `docs/handoff/2026-09-13-session-handoff.md`。

> **执行者须知**：本计划由 2026-09-13 全项目审查产出的 5 个批次组成。按批次顺序执行，每批次结束运行验证并单独提交（`fix(ai):` 前缀）。禁止 push、禁止建 tag。所有源文件 UTF-8/LF。

## 目标

修复审查确认的 4 项 P0 安全问题、12 项前端缺陷、Worker/CI 加固项，并按运行时基线优化性能；Pagefind 半成品收尾。

## 全局约束

- 验证基线：`npm test`（70 项）全绿；`npm run verify:security` PASS；`npm run build` 成功；浏览器断言脚本（`.tmp-scripts/verify-*.js` 关键项）通过
- 每批次一个提交；提交信息格式 `fix(ai): ...`；涉及功能新增用 `feat(ai):`
- 不修改 AGENTS.md；不纳入 node_modules/dist 等产物
- 变更后必须真实运行验证（构建 + 浏览器），不能只看语法
- 计数口径（README/config-reference 中的 95 模块/782 项等）如因新增配置项变化，同步更新文档与计数

## 批次 1：安全 P0

### T1.1 消毒器迁移到 sanitize-html（pin 精确版本）

- 修改 `scripts/lib/utils.js`：保留 `sanitizeHtml(input)` API，内部改用 `sanitize-html`
- 配置映射：
  - `allowedTags` = 现 SAFE_TAGS（h1-h6/p/br/hr/blockquote/pre/code/em/strong/del/ins/sup/sub/small/kbd/s/abbr/mark/b/i/u/a/img/picture/source/ul/ol/li/dl/dt/dd/table/thead/tbody/tfoot/tr/th/td/div/span/details/summary/input/figure/figcaption/caption/colgroup/col/time/audio/video/track）
  - `nonTextTags` = DANGEROUS_TAGS 中可含子树的（script/style/iframe/object/embed/svg/math/template/form/noscript/textarea/select/button/canvas/applet/frameset）+ link/meta/base/frame
  - `disallowedTagsMode: 'escape'`（未知标签转义为文本，保持现有行为）
  - `allowedAttributes`：全局 `['class','id','title','lang','data-*','aria-*']` + 各标签白名单（a: href；img/source: src/srcset/sizes/loading/decoding/alt/width/height；video/audio/track: controls/preload/loop/muted/autoplay/playsinline/poster/kind/srclang/default/src；input: type/checked/disabled；td/th: colspan/rowspan；time: 由全局去掉 datetime 不加，保持现行为 parity）
  - `allowedSchemes`：保留默认 + 明确排除 `data:`/`javascript:`/`vbscript:`；`allowedSchemesAppliedToAttributes` 增加 `srcset`
  - `transformTags`：video/audio 的 `src`/`poster` 仅允许站内相对路径（`/` 开头或相对），含 `scheme://`、`//`、`\` 一律移除该属性
- 测试（`scripts/build.test.js`）：保留现有 14 项行为断言，新增 3 组绕过回归：
  1. `<a href="jav&#x61;script:alert(1)">` → 输出不含 `javascript`/`alert(1)` 可执行形态
  2. `<a title="x>y" href="javascript:alert(1)">` → href 被去
  3. `<img srcset=a"onerror="alert(1)>` → 输出无 `onerror` 属性
  4. 实体编码 SVG `<a href="&#106;avascript:...">`（T1.2 联动）
- 依赖：`npm install sanitize-html@<latest> --save-exact`；记录到 package.json；检查其依赖树（npmmirror 无 audit 接口，本地不做 npm audit，由 CI 兜底）

### T1.2 SVG 消毒实体绕过（`scripts/lib/content-policy.js`）

- `hasExecutable` 与 `href/src` 检查前先做实体解码（`&amp;`→`&`、数字实体 `&#x61;`/`&#106;`）并去除控制字符/空白，再做 `javascript:` 等 scheme 匹配
- 新增测试：`<a href="&#106;avascript:alert(1)">` → `safe:false`

### T1.3 slug 强校验（`scripts/build.js`）

- 文章：`build.js:1032` `attrs.slug || safeSlug(title)` → 显式 slug 也过统一校验函数：`validateSlug()` = 非空、无 `/\..<>:"'|?*`、无路径分隔与控制字符；不合法时构建终止并报文件名（不静默回退，避免 URL 悄变）
- 页面：`build.js:987`、`build.js:1503`（slugOverride）同样处理
- `_redirects` 生成处（`build.js:2288` 附近）：对 from/to 做空白与换行剥离
- sitemap `<loc>`（`build.js:2019-2034` 附近）：统一 XML 转义（`& < > " '`）
- 测试：新增 slug 校验单测（`../../x`、含 `"`/`<`、含空格/控制符 → 拒绝）

### T1.4 模板转义（`templates/layout.ejs`）

- L18 og:image：`article.slug` 改经 `escapeAttr`/`<%=` 单层转义，或改为拼接 `encodeURIComponent` 产物；不得裸拼属性
- 检查 canonical/og:url 等使用 `currentUrl` 的属性是否有同类裸拼（L28 附近），统一转义
- 构建后 grep dist：无 `"><script` 形态产物

### T1.5 build-report 转义（`scripts/build.js` 生成报告处，约 L2227）

- `b.path`、`b.reason` 经 `escapeHtml`；报告页加 `<meta name="robots" content="noindex">`

### T1.6 Worker 部署配置修正

- `workers/wrangler.toml`：补 `main = "security-worker.js"`、`[vars] ENVIRONMENT = "production"`（或部署脚本 `--env production` 且配置 env 段）
- `package.json` `deploy:worker` 与 README 部署命令保持可用且与配置一致
- 校验 `generate-security-config.js` 输出能被 `security-worker.js` 正常 import（检查生成流程后再构建）

### T1.7 集成回归强化（`scripts/security-verify.js`）

- MALICIOUS 文章增加：实体编码 javascript 链接、带引号属性 `>` 载荷、srcset 逃逸载荷、`slug: ../_escape` 情形（应构建失败或输出不逃逸，二选一按 T1.3 行为断言）

### T1.8 批次验证与提交

- `npm test`、`npm run verify:security`、`npm run build`（确认 dist 无载荷、无逃逸文件）
- 提交：`fix(ai): 安全 P0（消毒器迁移 sanitize-html/slug 强校验/报告转义/Worker 部署修正）`

## 批次 2：Pagefind 收尾

- 修正门控：`scripts/build.js:2130` `config.features.search.provider` → `config.navigation.search.provider`（真实来源，参见 `build.js:2098`），并尊重 `features.pagefind.enabled === false`
- 调用点缩进与 placement 修正（`build.js:2818` 附近，确保在 cache-bust 之前且 dist 已完成 HTML 输出）
- cache-bust 排除 `/pagefind/`（参考现有 `assets/`、`sw.js` 排除逻辑，定位 cacheBust 函数）
- 写入前清空旧 `dist/pagefind/`
- `mod.close()`：确认 pagefind 顶层是否导出 close（`node_modules/pagefind/types/index.d.ts`）；不存在则移除该 finally
- 文档对齐：README L55、`docs/config-reference.md` 3.53、`pages/about.md`——统一为「provider=pagefind 时构建自动生成索引；未安装 pagefind 时告警跳过」
- 验证：临时把 navigation 切 pagefind → 构建 → `dist/pagefind/` 生成；切回 local → 跳过。测试后恢复配置（不改提交内容）或使用探针脚本
- 提交：`fix(ai): Pagefind 收尾（门控修正/cache-bust 排除/文档对齐）`

## 批次 3：前端缺陷包（12 项）

1. `js/domains/search.js:114` 正则字符类补 `[\]\\` 或改 indexOf 切片；包 try/catch
2. Ctrl+K 冲突：`command-palette.js:159` 打开前检测搜索层已开（反之亦然），二选一优先
3. `reading-history.js:72` 加 `document.prerendering` 守卫；`access-gate.js:86` 同判
4. `toc.js:53-80` rAF 节流 + 缓存偏移 + scrollHeight 单次读取
5. `search.js:118-124` 预生成 lowercase 字段（配合批次 5 按需加载）
6. localStorage 守卫：`reading-mode.js`、`theme.js`、`reading.js`、`reading-panel.js`、`theme-schedule.js` 统一 try/catch 封装
7. `js/core/boot.js:128-146` 失败无条件 `console.error('[boot] 模块名', err)`
8. `code-block.js:53` catch 走 execCommand 回退或 toast
9. `search.js:48-52` 删除 PagefindUI 死代码；若 provider=pagefind 改为正确挂载（容器 + /pagefind/pagefind-ui.js + CSS）
10. `announcement.js:27` close 时 clearInterval
11. `lightbox.js:38,46` 合并 wheel 处理；删 `__lbTouch` 死代码
12. `morphicons.js` 失败后移除监听/置 failed 标志，防重试风暴
- 验证：关键项写/复用浏览器断言（搜索特殊字符、Ctrl+K 单开、代码复制、公告关闭后无残留 interval 可静态确认）
- 提交：`fix(ai): 前端缺陷包（搜索崩溃/Ctrl+K 冲突/存储守卫/节流清理等 12 项）`

## 批次 4：Worker/CI 加固

- `workers/security-worker.js`：
  - 实现 CIDR 匹配（IPv4/IPv6），用于 blacklist/whitelist；无法解析条目构建期告警（生成配置侧）
  - 限流清理：`blockedUntil > now` 时不得删除条目
  - 静态资源不计限流（默认跳过 `/assets/`、`/media/`、`/og/`、`/icons/`、`/pagefind/`；可配）
  - `/csp-report` 移至限流之后 + body 上限 + 只记录关键字段
  - 维护页 message 转义；ASSETS.fetch try/catch → 502 + 安全头；403/429 响应补安全头
  - Worker CSP 拼 report-uri；与 `_headers` 的 hardening 逻辑统一（复用 build 的最终 headers 生成，若成本高则最小同步 sts 差异）
- `.github/workflows/deploy.yml`：checkout `fetch-depth: 0`；AGENTS.md 检测用 `git diff --name-only ${{ github.event.before }} ${{ github.sha }}`（PR 用 base...head）；补 `permissions: contents: read`
- 验证：本地 node 手动测 CIDR 纯函数（若可抽出）或至少单测安全配置生成；构建 + verify:security
- 提交：`fix(ai): Worker/CI 加固（CIDR/限流修复/静态资源免计数/CI 门禁修复）`

## 性能基线（2026-09-13，本地 3224，无节流）

| 指标 | 首页 /zh/ | 文章 /zh/hello-world/ |
|---|---|---|
| LCP | 795ms（Load delay 459 + Render delay 327） | 467ms（Render delay 425） |
| FCP / DCL / load | 548 / 470 / 488 | - / 532 / 547 |
| CLS | 0.00 | 0.00 |
| HTML decoded | 235,967 B | 241,720 B |
| 脚本 decoded | 41 个 / 175,916 B | 43 个 / 456,084 B |
| CSS（link） | 107,211 B | 47,920 + 字体 151,916 B |
| 强制回流 | 195ms（navigation.js 188ms + reading.js 7ms） | 0 |
| 布局事件 | - | 242ms（803 节点全量） |
| 交互事件 | 无长任务；最大 64ms（Ctrl+K），输入 32-56ms | - |
| 其他发现 | LCP 图由 image-lazy.js 注入（fetchpriority 缺、非文档内可发现）；本地 serve 无压缩（生产 CF 有压缩，属本地偏差） | FontDisplay 提示 FCP 10ms |

优化优先级：① 首页 LCP 卡片图 eager/fetchpriority；② navigation.js 强制回流；③ 内联 CSS/搜索数据瘦身（236KB→）；④ 文章页 vendor 加载审视；⑤ FontDisplay 复核。

## 批次 5：性能优化（按基线执行）

- 以批次 0 的 trace 基线与优化后对比（LCP/长任务/首屏字节）
- 候选（按基线数据取舍）：
  1. `templates/layout.ejs` 内联 CSS（~121KB）外链化：构建期生成 `assets/css/site.[hash].css`，`<link rel="stylesheet">`；动态变量内联保留极小子集
  2. 搜索语料从每页内联改为 `/search-index.json` 按需 fetch（首次打开搜索时），保留旧路径回退
  3. toc/search 重计算消除（与批次 3 联动确认）
- 复测并记录 before/after 数字；不达标项记录为后续技术债
- 提交：`perf(ai): ...`（按实际内容）

## 性能复测（批次 5 后，同一环境复测）

| 指标 | 首页 /zh/ 基线→复测 | 文章 /zh/hello-world/ 基线→复测 |
|---|---|---|
| LCP | 795ms → **348ms**（Load delay 459→40） | 467 → 468ms（文字型 LCP，受主线程启动影响） |
| CLS | 0.00 → 0.03（单次位移 <0.1 良好，无归因） | 0.00 → 0.00 |
| HTML decoded | 235,967 → **198,739 B（-16%）** | 241,720 → **204,770 B（-15%）** |

已实施：搜索语料按需 fetch（浮层+独立搜索页）/ 首卡与封面 `fetchpriority=high` / search-index.json 媒体路径随 cache-bust 重写（修 404）。
未实施（技术债，需视觉回归）：layout.ejs 内联 CSS（约 121KB/页）外链化——单独专项再做。

## 回归与收尾

- 全量：`npm test`、`npm run verify:security`、`npm run build`、`npm run audit:a11y`（需 serve）、关键 `.tmp-scripts/verify-*.js`
- CHANGELOG.md 按 Keep a Changelog 增补（Fixed/Security/Changed）
- review skill 双轴终审 diff；handoff 文档
- 不 push、不 tag；如需推送由用户确认并提醒备份
