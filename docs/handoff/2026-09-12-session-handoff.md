# S-ynapse 会话交接文档 — 2026-09-12（公告条防闪 / 加载动画+三阶段启动 / imageFit）

> 用途：用户关闭 OpenCode 前的临时交接。恢复会话时：先读本文件 + `AGENTS.md`，再按「§5 中断点」继续批次 1。
> 本文件为临时文档，全部完成后可删除。

---

## 1. 用户原始请求（原文保留）

- **m02268**：「我认为可以加一个加载动画加载页面资源以及防止一堆东西一次性全部启动导致滑动卡顿，以及那个最上面的那个欢迎什么什么的在切换和刷新的时候还是会短时间出现，推荐换一种方式加载。以及加入一个东西就是如果图片大小比展示区域大或者小两种情况该怎么办的配置项。以及细节继续观察。先考察细节，然后告诉我干什么，以及问我问题。启动grill-me」
- **m02280**：「可以暂停一下，写入临时文档里面，我准备关闭opencode了」
- **m02282**：「是写在项目文件夹里面」

## 2. 已锁定的决策（用户 8 问全选“推荐”项）

| # | 主题 | 决策 |
|---|------|------|
| 1 | 公告条防闪 | **双修**：修双重转义 + 反转为「默认隐藏，JS 确认未被关闭后才显示」 |
| 2 | 加载动画 | **全屏主题化 loader**：延迟 ~120ms 出现、最短显示 250ms、reduced-motion 跳过、失败兜底自动消失 |
| 3 | 启动调度 | **三阶段**：关键模块同步 → 交互类 idle → 重模块 dynamic import + yieldToMain |
| 4 | 图片适配 | 新建 **features.imageFit 四域**（正文/封面/画廊/灯箱） |
| 5 | 小图默认 | **不放大**（构建期 `--iw` 实现可配放大上限） |
| 6 | 大图默认 | **等比缩放到容器**（现状保持，开放最大高度配置） |
| 7 | 连带细节 | **审计+修复**：escapeAttr 双转义全量、画廊拉伸、封面裁切位置 |
| 8 | 双 agent | 已完成（结论见 §4） |

## 3. 考察结论（含证据，均已实测）

### 3.1 公告条闪现 — 根因锁定（**最重要的发现**）
- 逐帧采样（`.tmp-scripts/probe-boot-ann.js`，可复用）：导航闪 **8 帧**、刷新 **10 帧**、VT 导航 **21 帧**。
- **根因：`data-items` 属性双重转义**。`templates/layout.ejs` L517 写法为 `data-items="<%= escapeAttr(JSON.stringify(_anItems)) %>"`：`escapeAttr()` 转义一次，EJS `<%=` 又转义一次 → dist 中属性值呈 `&amp;quot;` 形式 → 浏览器 `JSON.parse` 失败 → `announcement.js` 中 `items` 变空数组 → 存/比哈希 = `hash("[]")`；而头部早检脚本（L5）与 `data-dismiss-hash=602217398` 用真实条目哈希 → **头部脚本永不命中** → 只能靠 DOMContentLoaded 兜底移除（8-21 帧闪现代价；关闭实际生效靠空数组哈希巧合一致）。
- 头部脚本本身执行正常（dist 可见 `localStorage.getItem('s-announce-dismissed')===`602217398`` 形式），只是值不匹配。

### 3.2 启动卡顿 — 实测
- `fcp 312ms / dcl 501ms / load 523ms / __APP_READY__ 529ms`；**longtasks = [238, 66]（共 304ms 阻塞，单任务最大 238ms）**。
- 现状：`js/core/main.js` 33 个静态 import + 全量同步 `init()`；`site.performance.scriptLoading='defer'`；无 loader；rIC 在 Safari 默认未启用（需 setTimeout 兜底）。

### 3.3 图片现状盘点
- 基线（`templates/layout.ejs` L83）：`img{max-width:100%;height:auto;border-radius:var(--r)}` → 小图不放大 ✓、大图缩到容器 ✓。
- L138 `.post-featured-image`：`width:100%;aspect-ratio:16/10;object-fit:cover`（裁切位置不可配）。
- L242 画廊 `.gallery-item img{width:100%}` → **小图被强制拉伸变形（确定缺陷）**。
- L241 灯箱：`max-width/min/max-height:82vh`（contain 式，小图不放大）✓。
- 无任何 imageFit 配置组。

### 3.4 escapeAttr 审计（已完成，结论如下，**修复尚未应用**）
- `scripts/build.js` L815-902 的 20 处均为**服务器端模板字符串**（唯一转义层，正确，勿动）。
- **仅在 EJS 中 `escapeAttr` 与 `<%=` 叠加**才是双重转义，需要修复的四处全在 `templates/layout.ejs`：
  - L2 `data-site-title="<%= escapeAttr(site.title) %>"`
  - L517 `data-items="<%= escapeAttr(JSON.stringify(_anItems)) %>"`
  - L553 导航社交 popup（`title/data-contact/data-title/data-body` 四属性）
  - L627 页脚社交 popup（同上四属性）
- 修复方式：**去掉 `escapeAttr`，直接用 `<%=`（单层正确转义）**；或改 `<%- escapeAttr(...) %>` 等效。修复后需 grep `data-site-title` 的消费方（可能 pwa/share）并点检 contact popup 显示。

## 4. 双 agent 调研结论（摘要）

- **Loader**：两派均反对「门控内容的全屏 loader」（伤 LCP/INP）。落地要点：默认隐藏、JS 显示；显示延迟 ~100ms；出现后 ≥300ms；CSS `animation ... forwards` 硬超时兜底（5s）；`role="status"` + `aria-busy`；reduced-motion 用静态形态。备选（激进派）：骨架+错峰渐入（60-90ms/项）。（用户已选全屏主题化 loader，按上述约束实现即可。）
- **调度**：三阶段 + `yieldToMain`（`scheduler.yield` 优先；Chrome 129+/FF 142+，**Safari 无 → `setTimeout(0)` + 双 rAF 兜底**）；50ms 分片上限；首次交互只「入队唤醒」不就地初始化（保 INP）；重模块 `dynamic import()`；测量用 `PerformanceObserver`（longtask/inp），可留 debug 开关，无需第三方库。
- **图片**：小图不放大 + **构建期注入自然宽 `--iw`** 实现放大上限（运行时零 JS）：`width:min(100%, calc(N * var(--iw)))`；注意 `attr()` 在 Safari 稳定版不可用，需构建期生成规则/属性；画廊列内**禁用 `width:100%`**（用 `--iw` 封顶 + `break-inside:avoid`）；封面 `object-fit/object-position` 配置化；sharp 已有构建期尺寸信息（media manifest）。
- 激进派补充（可选增强，未列入本批）：focal point 百分比（front-matter）+ dev-only 点选器；不引重库（auto-animate 3.2KB 与 VT 职责重叠，暂不考虑）。

## 5. 当前工作状态（中断点）

- **工作区干净**：最新提交 `4c4854c`（docs guard P4）；分支 `main`；不推送、不建 tag。
- **批次 1（公告条）尚未应用任何修复**——仅完成 recon（读了 `js/domains/announcement.js` 全文 35 行、`templates/layout.ejs` L1-14、escapeAttr 审计）。
- **批次 1 精确编辑清单（下一步照做）**：
  1. `templates/layout.ejs` L517：`data-items="<%= JSON.stringify(_anItems) %>"`（去 escapeAttr）
  2. `templates/layout.ejs` L5 head 脚本：反转——**未关闭时给 `document.documentElement` 加 `ann-on` 类**（关闭态继续用 `data-ann-dismissed` 仅供 --annH 收起）
  3. `templates/layout.ejs` 公告 CSS 块（grep `.announcement-bar{` 定位）：默认 `display:none`；`html.ann-on .announcement-bar{display:grid}`（现为 grid）；`--annH` 反转：默认 `0px`、`html.ann-on{--annH:34px}`（grep `--annH` 找到 `:root` 定义与 `html[data-ann-dismissed]` 规则，共约 5 处联动）
  4. L517 bar 后 fallback 内联脚本：同步反转（未关闭→加 `ann-on`；已关闭→保持隐藏）
  5. `js/domains/announcement.js`：`run()` 适配新逻辑（若未关闭且无类则补类）；关闭处理改为移除 `ann-on`（保留 `collapseAnnH()` 与 closing 动画）
  6. L2 / L553 / L627 双转义修复（§3.4）
  7. 新建 `.tmp-scripts/verify-ann-noflash.js`：用逐帧采样断言「0 帧闪现」（复用 probe-boot-ann.js 的 rAF 采样思路）；并**更新** `.tmp-scripts/verify-announcement2.js` 以匹配新逻辑
  8. 构建 + `npm test` + 全量回归（清单见 §8）+ 截图；文档（config-reference 3.76 增补“默认隐藏/JS 显示”说明 + CHANGELOG）+ feat/docs 双提交

## 6. 后续批次（方案已定，待用户恢复后实施）

### 批次 2：features.loading + features.boot（三阶段启动）
- `features.loading`（新模块，中文注释）：`enabled / mode:'overlay' / delayMs:120 / minShowMs:250 / maxShowMs:2000 / reducedMotion:'skip' / text:'' / ariaBusy:true`
- `templates/layout.ejs`：loader DOM（默认隐藏）+ CSS（主题色脉冲、`animation ... forwards` fail-safe、reduced-motion 静态）
- `features.boot`（新模块）：`enabled / idleTimeoutMs:800 / interactionWake:true / log:false`
- 新 `js/core/boot.js`：`yieldToMain()`（scheduler.yield → setTimeout+rAF 兜底）+ 三阶段队列；重构 `js/core/main.js`：关键模块同步 init、交互类 idle、重模块（`background / morphIcons / dailyQuote / reward / readingHistory / comments` 等）`dynamic import()`；完成后设置 `__APP_READY__` 并关闭 loader
- 验收指标：longtask 最大 ≤50ms（目标）、loader 在快加载（<120ms）时不可见、reduced-motion 无动画

### 批次 3：features.imageFit 四域 + 画廊修复 + 构建期 --iw
- `features.imageFit`（新模块）：
  - `content: { upscale:'never'|'cap'|'full', cap:1.5, maxHeightVh:0, align:'center' }`
  - `cover: { fit:'cover'|'contain'|'fill', position:'center'|'top'|'bottom'|'left'|'right'|'x% y%' }`
  - `gallery: { stretch:false, maxHeightPx:0 }`
  - `lightbox: { fit:'contain'|'actual' }`
- 构建期：渲染器 img 注入 `data-iw`（自然宽整数）；构建收集**唯一宽度**生成 CSS 规则块（`[data-iw="800"]{--iw:800px}`，因 Safari 不支持 `attr()`）——**先查 `scripts/lib/utils.js` SAFE_ATTRS（约 L123-128）是否放行 `data-iw`**（build.js L815-856 为 img 输出处）
- CSS：正文 `width:min(100%, calc(var(--if-cap,1) * var(--iw, 100%)))`；画廊 `.gallery-item img` 改 `width:min(100%, var(--iw,100%))` + 可选 maxHeight；封面 `object-fit/object-position` 由配置驱动
- 测试：新增 verify-imagefit.js（大图/小图/画廊/封面/灯箱五组断言）+ 全量回归

## 7. 环境与坑（务必遵守）

- 构建：`node .tmp-scripts/run-build.js`；验证：`node .tmp-scripts/verify-stage1.js <脚本...>`（自建 + serve 3224 + 跑 + kill）
- Chrome：`C:/Program Files/Google/Chrome/Application/chrome.exe`；puppeteer-core 为 devDep
- **清理脚本只能按端口 3224 / 自己 spawn 的 PID**——用户曾因脚本误杀 OpenCode 进程重启过一次
- PS 内联 `node -e` 含引号/正则/反引号必炸 → 一律写 `.tmp-scripts/*.js`
- 计数：`node .tmp-scripts/count-config3.js`（当前：guard 164 / features 744 / tuning 196 / ui-strings 456 / **总 2386**）
- 中文输出在 PS 显示乱码属正常，文件内容 UTF-8 无碍；读取用 read 工具
- guard 防护域刚交付（默认 soft 档：右键菜单+复制署名默认开启）：本地调试如需纯净环境用 `?guard=off`，测试防护用 `?guard=on`

## 8. 回归基线与脚本清单（.tmp-scripts/）

- 基线：**297+ 浏览器断言 + npm 70/70 + security PASS**，恢复后以此为回归标准
- 脚本：guard-p1..p4、verify-codeblocks、verify-announcement2、verify-math2、verify-lightbox3、verify-b1c-browser(26)、verify-articles(37)、verify-morph(21)、verify-cardfx(16)、verify-readsuite(10)、verify-nav-boost(17)、verify-golden(15)、verify-golden2(4)、verify-tuning(6)、verify-4b1(9)、verify-4b2(10)、verify-config-wiring(15)、**probe-boot-ann（逐帧采样器，批次 1 复用）**
- 历史 29 项升级中 **P2 批次可能遗留未确认**（A8 颗粒 / B6 PWA / E1 瀑布流 / C2 公告条 / A9 图标集）——恢复时与用户核对；其中公告条已由本批次覆盖

## 9. 遗留观察项

- `data-site-title` 消费方 grep（修复后点检）
- contact popup（导航/页脚）修复双转义后需目检弹窗标题与内容正常
- 用户明确「细节继续观察」——遇到新细节先报告再动手

## 10. Suggested Skills（下一会话建议加载）

- `diagnosing-bugs`（批次 1 属 bug 修复，先诊断后改）
- `full-output-enforcement`（配置块注释与实现无占位）
- `webapp-testing`（puppeteer 验证与截图目检）
- `handoff`（会话再次结束时）
- 按 AGENTS.md：功能类批次用 `implement`；涉及 AGENTS.md 才用 `agents-md-editing`
- 不需要：GodotPrompter 系列（与本项目无关）
