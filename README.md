# S-ynapse

> 思考的突触 — 极简、安全、高性能的 Cloudflare 静态博客系统

基于 Cloudflare 生态的静态博客生成器。Markdown 写作，JSON5 配置，一键部署到 Cloudflare Pages。

**项目仓库**：https://github.com/stop666two/S-ynapse

## 项目文档

点击对应的文档即可跳转阅读，每个文档的用途如下：

| 文档 | 用途 |
| --- | --- |
| [配置参考](docs/config-reference.md) | 全部 15 个配置文件（14 个站点配置 site/theme/tuning/navigation/sidebar/footer/security/features/ui-strings/content-policy/tag-aliases/friends/guard/compression + 工程内部参数 internals.json5）的逐字段权威说明：每个配置项的含义、可填值、推荐值与默认值，以及值域校验、环境变量、重定向/友链/标签别名示例 |
| [移动端真机点检清单](docs/mobile-checklist.md) | iOS Safari / Android Chrome 各 15 项发布前真机点检：安全区、软导航、TOC 抽屉、弹窗公告、CJK 字体、暗色、横屏、双击缩放、滚动性能、分享/TTS 权限等，含预期结果与问题记录表 |
| [发布流程（Release）](docs/runbook/release.md) | 完成标记 + 自动发布机制：RELEASE.json 字段与双重校验、`release:mark` 全流程（含同版本/预发布标记）与人工核验含义、双通道发布（Actions on tag / 本地 gh）、基础包语义（空站骨架 + 空站可构建 + 测试可跑）、骨架归档白名单与解压门禁、只保留最新版本的旧版自动清理、失败排障、Release 与站点部署的关系 |
| [变更日志](CHANGELOG.md) | 按版本号记录本项目的全部变更：安全修复、新增功能、配置项变化，遵循 Keep a Changelog 格式，每个条目注明涉及的源文件 |
| [增量构建设计](docs/incremental-build-design.md) | 增量构建（`--watch`）的架构设计文档：哈希指纹缓存、按页面拆分构建、默认跳过未变化源的完整方案 |

## 特性

**全配置驱动**
- 14 个 JSON5 站点配置文件（支持注释），另有 **`internals.json5` 工程内部参数**（端口/路径/缓存天数/审计上限/部署项目名/CI 版本；不参与站点配置项计数），**2600+ 可配置项**（实测 2895 项；口径：对象逐层展开、数组元素逐项计入且元素为对象时不再展开），逐字段中文注释（含可填值/推荐值/禁用值/注意事项）
- `features.json5` 功能总控域：**103 个模块、1051 个配置项**（同一口径递归统计），每项功能均可开/关/微调；`tuning.json5` UI 微调层（37 分类 / 274 项）
- 社交链接支持每项独立开关（github/twitter/weibo 等可选）
- 配置校验：JSON5 语法错误即终止构建，输出文件/行列/上下文/原因/修复提示；20+ 项值域校验
- 详细参考文档：`docs/config-reference.md`（15 章，逐字段权威参考）
- 配置周边门禁：`verify:config`（默认值/结构一致性）、`verify:config-refs`（零引用键）、`verify:config-dupes`（重复键）、`verify:config-comments`（逐键注释覆盖率）、`verify:config-docs`（15 文件键 vs 配置参考覆盖）、`verify:internals`（.nvmrc/wrangler assets/CI 版本与 internals 单源一致）、`verify:config-single-source`（819 个行为开关矩阵 `docs/config-switch-matrix.md` 零缺失 + 回退字面量零漂移；生成器 `npm run gen:config-matrix`）

**内容创作**
- Markdown 扩展：上标/下标（`X^2^` / `H~2~O`）、KaTeX 数学公式（`$`/`$$`）、Mermaid 图表、Wiki 双链（`[[标题]]`）、定义列表、任务列表
- 文章系列（front-matter `series`）、置顶（`pinned`）、标签别名归一
- 内容导入：`npm run import` 支持 Hexo / Hugo / WordPress XML
- 本地图片管线：WebP/AVIF + 多尺寸 `srcset` + 懒加载 + SVG 消毒；`media/`/`videos/`/`assets/` 三目录白黑名单内容策略

**阅读体验**
- 暗黑模式（跟随系统 / 手动切换，无闪烁）+ **深色定时切换**（`themeSchedule`，固定时段）
- **主题预设切换器**（9 套调色盘：Classic Blue / Cyber Purple / Forest Green / Sakura Pink / Editorial Gray / Midnight Black / Amber Coffee / Ocean Teal / Plum Wine，localStorage 持久化）
- **省流模式**（`features.saveDataMode`）：自动跟随系统 `navigator.connection.saveData`（含 change 变化）或阅读设置面板手动开关（localStorage 持久）；降级为禁动画/粒子、图片最小分辨率变体、更激进懒加载与系统字体栈，开关切换即时还原
- 全文搜索（Ctrl+K 快捷键，搜索标题 + 正文 + 标签，**键盘方向键导航 + 搜索历史**）
- **Giscus 评论**（基于 GitHub Discussions）、**内容级双语**（zh/en：文章分目录 + 全文翻译 + URL 语言前缀 + 界面语言化）
- 文章目录 TOC（侧边栏自动提取 h2-h4，移动端抽屉；**进度线 + URL 锚点 + 已读淡显**）
- 图片灯箱（键盘 / 触屏滑动 / 图库页联动；**_缩放 / 平移 / 旋转 / 双指**）
- 阅读设置面板（字号/行高/宽度滑杆）、阅读模式（一键隐藏侧边栏）
- 阅读进度条（点击跳转 + 百分比提示）+ 返回顶部 + **阅读侧栏**（进度环 / 回目录 / 回顶）
- TTS 朗读（倍速可调）、快捷键（`/` 搜索、`D` 主题、`J`/`K` 翻篇、`?` 帮助）
- 关联推荐（同标签/同分类）、CJK 中英文自动加细空格
- **代码高亮体系**（本地 Prism + `theme.codeHighlight.palette` 浅色/暗色两套 token 配色，随明暗自动切换；文章内 Mac 窗栏样条）
- **文章封面样式库**（渐变/条纹/圆点/气泡/网格，在线预览）

**站内体系**
- 归档热力图（按年 12 月色阶）+ 统计卡（文章/天数/字数/日均/标签/分类）
- 图库页 `/gallery/`（聚合所有文章图片，瀑布流 + 灯箱）
- 分享按钮（7 平台零依赖）、打赏弹窗、友情链接页、联系方式弹窗
- **每日一言**（侧栏，默认 100 条中英双语公版/原创引语逐条可核验出处，按日期固定一条 + 「换一句」/「复制」；数据文件 `data/quotes.json5`，可用 `features.dailyQuote.source` 更换；「换一句」可接入 **Hitokoto 一言 API**（`features.dailyQuote.api`，中文页点击时直连、失败/离线/英文页回退本地随机，构建期按开关裁剪 CSP `connect-src`））、**收藏**（纯前端 localStorage，`/favorites/`）
- RSS + JSON Feed、**sitemap 按类型拆分**（URL 超阈值自动分文件）、搜索索引、PWA、构建报告
- **侧栏拖拽重排**（桌面拖拽 + 移动端长按，localStorage 持久化）、**404 页美化**（插图 + 搜索 + 热门文章）
- **Pagefind 全文搜索**（`navigation.search.provider='pagefind'` 且 `features.pagefind.enabled` 时生效，离线索引；**构建在压缩与哈希之后自动生成索引到 `features.pagefind.indexPath`（默认 `/pagefind`，不参与 cache-bust）；未安装 `pagefind` 依赖时告警跳过（按需安装：`npm install -D --save-exact pagefind`）；serve/watch 模式同样生成，保证预览与生产一致**）

**安全加固**
- Markdown 内嵌 HTML 白名单消毒（XSS 防护，含 SVG 消毒）
- 外部链接安全警告弹窗，白名单/黑名单双轨控制
- CSP 内容安全策略自动生成（`security.json5` 单源同步 `_headers` 与 Worker 安全层）
- HTTP 安全头（HSTS, X-Frame-Options, Permissions-Policy 等）
- 速率限制 + 路径访问控制 + 维护模式（需 Workers，配置单源同步）
- 内置 `npm run verify:security` 集成安全回归（真实构建注入恶意文章断言）

**性能极致**
- 全静态 HTML，全球 CDN 加速
- HTML/CSS/JS 自动压缩（`@minify-html/node`），内容哈希缓存
- **构建产物压缩增强**（第 14 个配置 `compression.json5`，默认开）：CSS 同页 `<style>` 合并去重、JSON 去空白、`runtime` 引导脚本 Terser 压缩、JS 可选混淆（默认关）；压缩位于内容哈希之前，哈希即最终字节；vendor 与报告文件豁免；实测收益 HTML gzip −5.31%、JS gzip −10.2%、纯构建 4.9s
- **压缩无头门禁与自动回退**：压缩后以无头浏览器对比压缩/未压缩两态（DOM/采样样式/控制台/交互冒烟），失败自动回退基线产物并告警；`npm run verify:compression` 可独立复核；结果写入 `.cache/compression-verify/last.json` 并汇总到构建报告 `dist/build-report.html`
- 图片 WebP + AVIF + 多尺寸响应式；图片懒加载；本地 vendor 资产（Prism/Mermaid/KaTeX/字体）免 CDN

**开发者体验**
- 草稿预览：`npm run dev` 自动包含草稿文章
- 构建报告：每次构建只生成一份 `build-report.html`（元信息、14 步阶段耗时、产物体积、性能预算、压缩统计、缓存命中、告警与失败清单、页面清单，以及内容策略拦截清单）
- 单元测试：`npm test` 覆盖核心纯函数与 Worker 安全层（1013 项 / 149 组）；`npm run lint` 提供 ESLint 静态检查
- 增量构建设计文档：`docs/incremental-build-design.md`

---

## 快速开始

> [!IMPORTANT]
> **下载与安装（中文）**：`main` 分支可能包含**未完成或尚未验证**的改动。请优先从
> [Releases](https://github.com/stop666two/S-ynapse/releases) 下载已通过全套质量门禁与人工核验的版本包
> （`S-ynapse-<版本>.zip`，校验记录见包内 `RELEASE.json`；归档已通过「解压后 `npm ci --ignore-scripts && npm test && npm run build`」门禁）。
> 版本包是**空站骨架**：构建、测试、部署所需的全部代码、配置、示例页面（`pages/**`）与默认资源（`static/**`）齐备；
> 测试运行所需的最小文档集（`docs/config-reference.md`）随包分发，`articles/` 与 `media/` 为空目录（`.gitkeep` 标记），
> 放入自己的文章与图片即可构建；发布 tag 永不删除，仓库仅自动清理旧 Releases（只保留最新一个）。
> 从源码构建请以下载包为准，避免直接使用 main 的中间状态。
>
> **Downloads & installation (English)**: `main` may contain work-in-progress changes. Prefer the verified
> archive from [Releases](https://github.com/stop666two/S-ynapse/releases) (`S-ynapse-<version>.zip` with
> `RELEASE.json` provenance); it passes the "extract → `npm ci --ignore-scripts && npm test && npm run build`" gate.
> The archive is an **empty-site skeleton**: every file needed to build, test and deploy ships with it
> (sample pages under `pages/**`, default assets under `static/**`, and the minimal docs read by the test
> suite, `docs/config-reference.md`), while `articles/` and `media/` are empty placeholders kept via
> `.gitkeep` — add your own content and build. Release tags are never deleted; older GitHub Releases are pruned automatically (latest only).
>
> 发布流程、人工核验含义与排障见 **[docs/runbook/release.md](docs/runbook/release.md)**。

```bash
# 1. 安装依赖（自动配置 git hooks）
npm install

# 2. 构建站点
npm run build

# 3. 启动本地预览（构建后自动启动服务器）
npm run serve

# 访问 http://localhost:3000 即可预览
```

> [!NOTE]
> **Node 版本要求**：本项目要求 Node.js `^20.19.0 || ^22.13.0 || >=24`（`eslint` 10 与 `typescript` 的引擎下限，同时满足 `sharp` 0.35）；版本单源为根目录 `.nvmrc`（当前 24），CI 经 `node-version-file` 读取，`verify:internals` 守卫其与 `internals.ci.nodeVersion` 一致。
>
> **npm 12（及以上）本机部署注意**：npm 12 默认禁止依赖的 `postinstall` 脚本（如 `esbuild`、`workerd` 的二进制下载），会导致本机 `npx wrangler deploy` 失败或部分依赖不完整。受影响的本机操作：
> - 解决方案一（推荐）：经 `npm install --ignore-scripts` 后，再用 `npm rebuild --foreground-scripts esbuild workerd` 手动触发二进制下载；
> - 解决方案二：使用 Node 20/22 附带的 npm 10（CI 环境为 npm 10，无此问题）；
> - 构建站点（`npm run build`）本身不受影响，仅在本地执行 wrangler 部署命令时需要注意。

### Windows 快捷脚本

| 脚本 | 功能 |
|------|------|
| `build.bat` | 双击一键构建：探测 npm → 依赖缺失时 `npm install --no-audit --no-fund --prefer-offline` → `npm run build`；任一步失败均打印原因并 `pause`（退出码透传） |
| `serve.bat [端口]` | 本地预览：仅清理占用目标端口且处于 `LISTENING` 状态的进程（不误杀其它进程）；启动后由 `npm run serve` 自动构建（无重复预构建）；失败会 `pause` |

---

## 目录结构

```
S-ynapse/
├── articles/          # Markdown 文章（按语言分目录：zh/ 中文、en/ 英文，front-matter: title/slug/tags/categories/date/draft/pinned/series/featuredImage）
├── pages/             # 自定义页面 & 可复用内容块（博客底部公告、关于、隐私、条款等）
├── media/             # 图片资源（自动优化：WebP/AVIF/尺寸变体 + SVG 消毒）
├── videos/            # 视频资源（可选，按需创建；content-policy 排除制过滤后复制）
├── assets/            # 素材文件（可选，按需创建；PDF/文档/压缩包/音频/字体，content-policy 白名单）
├── static/            # 静态文件（直接复制到输出）
├── js/                # 前端 ESM 源码（core/ 入口与运行时 + domains/{core,features,guard}/ 领域模块；构建复制到 dist/assets/js/）
├── templates/         # EJS 模板
│   ├── layout.ejs     # 基础布局（CSS变量 + 暗黑模式 + 搜索 + 链接警告 + 灯箱）
│   ├── site-css.ejs   # 全站样式表（构建期注入 layout，压缩后随页面内联）
│   ├── index.ejs      # 首页（分页）
│   ├── post.ejs       # 文章页（TOC + 系列 + 分享 + 打赏 + 关联推荐 + 评论）
│   ├── archive.ejs    # 归档页（统计卡 + 热力图）
│   ├── tags.ejs       # 标签云
│   ├── tag.ejs        # 标签文章列表
│   ├── categories.ejs # 分类列表
│   ├── category.ejs   # 分类文章列表
│   ├── gallery.ejs    # 图库页（瀑布流聚合）
│   ├── links.ejs      # 友情链接页
│   ├── page.ejs       # 自定义页面
│   ├── search.ejs     # 搜索页
│   ├── favorites.ejs  # 收藏页（纯前端 localStorage）
│   └── 404.ejs        # 404 页
├── scripts/
│   ├── build.js       # 构建脚本（14 步管线）
│   ├── build.test.js  # 单元测试（主套件）
│   ├── robots.test.js # robots/sitemap 工具单测
│   ├── csp.test.js    # CSP 裁剪规则单测
│   ├── security-worker.test.js  # Worker 安全层单测 + 集成
│   ├── security-verify.js  # 安全集成验证（注入恶意文章→构建→语义断言）
│   ├── check-config-consistency.js # 配置一致性监守（默认值 vs 配置文件）
│   ├── check-internals.js # 工程内部参数守卫（.nvmrc / wrangler assets / CI 版本 / 写死形态）
│   ├── ci-env.js      # CI 环境导出（internals → $GITHUB_ENV）
│   ├── ci-checks.js   # CI 聚合检查器（跑完整套后统一失败，写 build-artifacts/ci-checks.*）
│   ├── deploy-pages.js # Pages 部署（项目名/目录读 internals，部署前 verify:internals）
│   ├── a11y-audit.js  # WCAG 无障碍审计（axe-core + Chrome）
│   ├── import.js      # 内容导入 CLI（hexo/hugo/wordpress）
│   ├── export.js      # 备份导出 CLI（配置 + 文章 + 媒体打包）
│   ├── audit-media.js # 媒体审计（--json / --duplicates）
│   ├── generate-og.js # 自动 OG 图生成（serve 模式跳过）
│   ├── generate-security-config.js # 从 security.json5 生成 Worker 配置
│   ├── generate-test-media.js      # 程序化生成测试图片
│   ├── init-project.js# 项目初始化（自动配置 git hooks/gitignore/gitattributes）
│   └── lib/
│       ├── utils.js           # 工具函数库（formatDate/safeSlug/stripHtml/CJK 空格等）
│       ├── content-policy.js  # 三目录内容策略判定（白名单/黑名单/SVG 消毒）
│       ├── features-schema.js # features 默认 schema 单一真源 + 校验
│       ├── theme-presets.js   # 9 套主题预设定义与校验
│       ├── config-error.js    # JSON5 错误格式化（文件/行列/上下文/提示）
│       ├── robots.js          # robots 逐语言 Sitemap/lastmod/编码纯函数
│       ├── csp.js             # CSP 指令按功能开关裁剪纯函数
│       ├── related.js         # 关联文章评分（同标签/同分类权重）
│       ├── feed-options.js    # JSON Feed 选项归一（jsonFeed.* 优先）
│       ├── perf-budget.js     # 页面体积/请求数预算检查
│       ├── site-defaults.js   # 站点/主题等默认值注册表（配置监守用）
│       ├── internals-defaults.js # internals 默认值与校验 Schema 注册表
│       ├── internals.js       # internals.json5 加载/深合并/校验
│       ├── chrome-path.js     # Chrome 探测单源（a11y/perf/mermaid 共用）
│       ├── output-dir.js      # 输出目录解析单源（--out > SYNAPSE_OUT_DIR > internals > dist）
│       ├── tuning-defaults.js # tuning 默认值注册表（配置监守用）
│       └── guard-defaults.js  # guard 默认值注册表（配置监守用）
├── workers/           # Cloudflare Worker 安全层
├── .github/workflows/ # CI/CD 自动部署与 Release（deploy.yml 含 AGENTS.md 检测 + npm audit 门禁；release.yml 含骨架归档、解压构建 + 测试门禁与旧版清理）
├── .githooks/         # Git hooks（pre-commit 保护 AGENTS.md）
├── docs/              # 设计文档（config-reference / incremental-build-design）
├── data/              # 默认站点数据（quotes.json5：100 条中英双语公版/原创引语，逐条可核验出处）
├── site.json5          # 站点配置（信息/SEO/RSS/JSON Feed/社交/构建开关）
├── theme.json5         # 主题配置（颜色/字体/布局/文章页脚）
├── features.json5     # 功能总控（103 模块/1051 项，可开关/微调，可选文件）
├── ui-strings.json5   # 界面文案词典（zh/en 双语词典，服务端 ui() + 运行时 __T()，可选）
├── tuning.json5       # UI 微调参数层（37 分类/274 项，注入 CSS 变量；行为参数运行时读取，可选）
├── guard.json5        # 防护与交互控制域（11 个模块/181 项：右键/复制/选择/快捷键/水印/检测/控制台/隐私帘/篡改监视/访问门槛，逐项注释，可选）
├── navigation.json5    # 导航配置
├── sidebar.json5       # 侧边栏配置（含 series/friends/stats/quote 组件）
├── footer.json5        # 页脚配置
├── security.json5      # 安全策略（CSP/限流/路径/头/robots/转向）
├── content-policy.json5 # 内容策略（media/videos/assets 白黑名单，可选）
├── tag-aliases.json5   # 标签别名映射（可选）
├── friends.json5       # 友情链接数据（可选）
├── internals.json5     # 工程内部参数（端口/路径/缓存天数/审计上限/部署项目名/CI 版本；非站点配置）
├── .nvmrc             # CI/本地 Node 版本（与 internals.ci.nodeVersion 单源一致）
├── .env.example       # 环境变量模板（CF_API_TOKEN / NODE_ENV / SITE_URL / CF_WEB_ANALYTICS_TOKEN）
├── .gitattributes     # Git 属性配置
├── eslint.config.js   # ESLint 10 扁平配置（js/scripts/workers 三层）
├── tsconfig.json      # TypeScript checkJs 配置（scripts/lib 渐进类型检查）
├── build.bat          # Windows 一键构建
├── serve.bat          # Windows 一键启动服务器
├── wrangler.toml      # Cloudflare Pages 部署配置
└── package.json       # 依赖管理
```

---

## 配置文件详解

所有配置文件使用 JSON5 格式，支持 `//` 注释、尾随逗号、无引号键名。语法错误会在构建时终止并**精确报告位置与原因**。

| 文件 | 职责 | 必填 |
|------|------|------|
| `site.json5` | 站点信息、SEO、RSS/JSON Feed、社交、构建开关 | ✅ |
| `theme.json5` | 颜色（亮/暗）、字体、布局微调、文章页脚说明栏 | ✅ |
| `features.json5` | 103 个功能模块的开关/参数（灯箱、进度条、快捷键、公式、分享、预设、定时、收藏、评论、继续阅读…） | 可选（缺失回退默认，功能保持） |
| `ui-strings.json5` | 界面文案词典（zh/en 双语，i18n 切换的文案来源） | 可选（缺失回退内置文案） |
| `tuning.json5` | UI 微调参数层（37 分类 / 274 项：排版/间距/圆角/动效/组件细节，注入 CSS 变量） | 可选 |
| `guard.json5` | 防护与交互控制域（11 个模块 / 181 项（口径：对象逐层展开、数组元素逐项计入）：自定义右键菜单、复制控制/署名、选择控制、快捷键拦截、水印、检测与控制台反制、窗口隐私帘、篡改监视、访问门槛、绕过通道等） | 可选（缺失时防护功能关闭） |
| `navigation.json5` | 菜单、导航栏、社交顺序、搜索 | ✅ |
| `sidebar.json5` | 侧栏组件序列（author/recent/tags/categories/archive/series/friends/stats/quote…） | ✅ |
| `footer.json5` | 页脚列、版权、备案、社交、Powered-by | ✅ |
| `security.json5` | CSP、安全头、限流、路径限制、robots | ✅ |
| `content-policy.json5` | media/videos/assets 三目录白黑名单（可选） | 可选 |
| `tag-aliases.json5` | 标签别名归一（可选） | 可选 |
| `friends.json5` | 友情链接（可选） | 可选 |

> 📖 **完整逐字段参考**：`docs/config-reference.md`（13 章：每个配置项的类型、默认值、取值、校验行为）。

### site.json5 — 站点核心信息（节选）

```json5
{
  title: "S-ynapse",              // 站点标题（浏览器标签栏）
  subtitle: "思考的突触",          // 副标题（首页顶部）
  description: "个人技术博客",      // 站点描述（SEO）
  author: "Your Name",             // 作者名称
  url: "https://synapse.dev",      // 站点根 URL（必填）
  postsPerPage: 10,                // 每页文章数

  rss: {
    enabled: true,
    path: "/feed.xml",
    fullContent: true,
    maxItems: 50,
    jsonFeed: { enabled: true }    // JSON Feed → /feed.json
  },

  seo: {
    ogImage: "/media/og-image.svg",
    canonicalURL: true,
    structuredData: { enabled: true, type: "BlogPosting" },
    titleTemplate: {               // SEO 标题模板（可含 {site}/{title}/{subtitle}）
      index: "{site} · {subtitle}",
      post: "{title} | {site}",
      default: "{title} | {site}"
    }
  },

  reward: {                        // 打赏（post.ejs 弹窗）
    enabled: false,
    wechat: { label: "微信", image: "/media/reward-wechat.png", url: "" },
    alipay: { label: "支付宝", image: "/media/reward-alipay.png", url: "" },
    custom: [],  // 其他方式数组 { label, image, url }
    note: "感谢支持！"
  },

  redirects: [],                   // 重定向 [{ from, to, permanent }]，支持 * 通配

  webAnalytics: { enabled: true, token: "" },  // CF Web Analytics（token 或环境变量）

  build: {                         // 30+ 构建开关
    cleanDist: true,
    minifyHTML: true, minifyCSS: true, minifyJS: true,
    optimizeMedia: true,
    avif: { enabled: false, quality: 50, effort: 6 },
    enableCacheBusting: true,
    relatedArticles: true,
    generateGallery: true,
    cjkSpacing: true,
    buildReport: true,
    forceContentWidth: true,       // 无侧栏页面强制与有侧栏同宽
    ...
  }
}
```

### features.json5 — 功能总控魔方

`features.json5` 是全部交互与内容功能的统一开关域：103 个模块、1051 个配置项，逐项中文注释。几例：

```json5
{
  lightbox: { enabled: true, zoomEnabled: true, panEnabled: true, rotateEnabled: true, pinchEnabled: true, zoomStep: 0.25, minSize: 60, closeButton: true, keyboardNavigate: true },
  math:     { enabled: true, version: "0.16.22", inlineDelimiters: ["$"], blockDelimiters: ["$$"], throwOnError: false },
  readingProgress: { enabled: true, articleOnly: true, clickToJump: true, showDot: true, tipDisplayMs: 500 },
  shortcuts: { search: "/", toggleTheme: "d", nextPost: "j", prevPost: "k", help: "?" },
  tts: { enabled: true, rate: 0.5, pitch: 1, volume: 1, voiceBy: "lang" },
  share: { enabled: true, order: ["weibo", "qq", "wechat", "x", "facebook", "mail", "copy"] },
  heatmap: { enabled: true, levels: 5, scaling: "auto", showLegend: true },
  ...
}
```

**要点**：
- 缺失 `features.json5` 文件 → 完全回退内建默认（与默认注册表一致），不报错
- 未知模块名 → 构建警告（防拼写错误）；非法值（如枚举外取值）→ 构建终止并定位
- `share.order` 等数组字段为**整体替换**语义（deepmerge 不会拼接），删掉某平台即从页面消失
- 模块与页面绑定：`enabled: false` 时对应元素零残留（不渲染 + 不加载对应资源；Prism/Mermaid/KaTeX/字体均为本地 vendor）

### security.json5 / content-policy.json5

`security.json5` 是**唯一安全配置源**：构建时生成 `_headers` + `workers/security-config.js`（Worker 运行时读取），CSP/限流/路径限制/安全头两边永远一致。`content-policy.json5` 则规定 `media/`（图片白名单 + SVG 消毒）、`videos/`（排除制 = 除可执行与渲染型文档外放行）、`assets/`（素材白名单）三目录的构建期过滤——被拦截文件不复制进 `dist/`（线上 404），并在构建报告中逐条列出原因。

---

## 社交链接配置

社交链接支持 **link**（跳转）和 **popup**（弹窗复制）两种类型：

| 类型 | 行为 | 必填字段 |
|------|------|----------|
| `link` | 点击跳转到 URL | `url` |
| `popup` | 弹窗显示联系方式，支持一键复制 | `value`, `popupTitle`, `popupContent` |

内置图标支持：`github` / `x` / `weibo` / `telegram` / `facebook` / `rss` / `email` / `phone` / `qq` / `qqgroup` / `wechat`，未匹配到的 key 使用通用地球图标。

在 `navigation.json5` 的 `socialInNav.order` 中控制显示顺序。社交图标按钮支持 **title 悬浮提示**。

---

## 文章格式

```markdown
---
title: 文章标题
slug: my-post                 # 可选，缺省取 title
tags: ["技术", "教程"]
categories: ["编程"]
description: "自定义描述"
featuredImage: "/media/image.jpg"   # 可选，无则自动生成 OG 图
date: 2026-07-13
draft: true                    # 设为 true 则在生产构建中跳过
pinned: true                   # 置顶（列表置前 + 徽标）
series: "示例系列"               # 系列名（侧栏系列组件 + 文章底部导航）
---

# 文章标题

**扩展语法**：
- 上标/下标：`X^2^`、`H~2~O`
- 行内公式：$E = mc^2$（KaTeX）
- 块级公式：$$ \int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi} $$
- 图表（mermaid 代码块）：
	```mermaid
	flowchart TD
	  A[开始] --> B[结束]
```
- Wiki 双链：`[[其他文章标题]]`、`[[slug|自定义文本]]`、`[[外链 https://...]]`，未知目标回退纯文本
```

**URL 生成规则**：slug > 文件名 title > 正文第一个一级标题；一个文件只允许一个一级标题。

**草稿机制**：`draft: true` 的文章在 `npm run build` 中被跳过，但在 `npm run dev` 中会包含。

**封面图**：未设置 `featuredImage` 的文章会在构建时根据标题自动生成封面/OG 图（默认 1200×630）。

---

## 构建管线

构建脚本执行 14 个阶段（阶段名与唯一构建报告 `dist/build-report.html` 的阶段耗时表一致）：

| # | 阶段 | 操作 |
|---|------|------|
| 1 | 配置加载与校验 | 读取 JSON5（14 个站点配置 + `internals.json5` 工程参数）→ 合并默认值 → 语法错误报文件/行列/原因并终止 → 20+ 项值域校验 + features 103 模块结构校验；`features.debug` 可输出配置摘要 |
| 2 | 内容预校验 | frontmatter 合法性、缺失媒体、重复/非法/保留 slug、未来日期；critical 问题一律阻断（`--allow-degraded` 仅豁免资源/数据类失败），发生在清理 `dist/` 之前 |
| 3 | 产物初始化与静态资产 | 清理并创建 `dist/`；`static/` 复制；videos/assets/媒体按 content-policy 过滤（SVG 消毒、可执行拦截），被拦文件 404 且列入构建报告 |
| 4 | 媒体优化 | sharp 生成 WebP/AVIF 与多尺寸响应式变体 + LQIP（`.cache/media` 增量；损坏媒体清单落盘 `.cache/broken-media.json`） |
| 5 | 文章处理与封面/图表 | Frontmatter 校验 → Markdown → Wiki 双链 → CJK 间距 → sanitize-html → TOC；自动封面（`.cache/covers`）；mermaid SSR（`.cache/mermaid`）；esbuild 打包与运行时引导、外置配置、搜索索引预计算 |
| 6 | 页面生成 | 首页分页、文章（系列/分享/打赏/关联/评论）、归档（统计+热力图）、标签、分类、图库、友链、搜索、自定义页、404（含根页语言跳转） |
| 7 | 字体/订阅源/站点地图 | CJK 字体子集化（`.cache/fonts`，失败降级系统字体）→ RSS/JSON Feed（`site.rss.jsonFeed.*` 优先，回退 `site.rss.*`）→ sitemap（超阈值按类型拆分 + 索引） |
| 8 | OG 图生成 | 独立进程 `generate-og.js`（仅生产构建；serve/watch 跳过；`.cache/og` 增量，统计写 `.cache/og/last-run.json`） |
| 9 | 搜索索引与提交 | 搜索引擎 ping（可选）→ 每语言内容寻址索引 `assets/search-index.<hash>.json`（`features.search.includeContent` 控制是否含正文） |
| 10 | 安全文件与重定向 | `_headers`（CSP + HSTS + 安全头，按功能开关裁剪）、`robots.txt`（逐语言 Sitemap 行）、`_redirects`、`workers/security-config.js`（自定义输出目录构建时跳过） |
| 11 | JS 资产与 PWA | 前端资产/vendor 拷贝（`--no-bundle` 时含 ESM 拷贝）、manifest + offline 页、SW 初版（缓存指纹后定稿） |
| 12 | 压缩增强（含无头验证） | 基线压缩（@minify-html / CleanCSS / Terser）→ `compression.json5` 增强（默认开；HTML 激进选项默认关、CSS 同页合并去重、JSON 去空白、runtime 压缩、可选混淆）→ 无头对比门禁（失败自动回退未压缩基线并告警，结果写 `.cache/compression-verify/last.json`） |
| 13 | 缓存指纹（cacheBust） | MD5 内容哈希重命名文件并同步 HTML/feed 引用（压缩与回退均在此之前完成，文件名哈希 = 最终字节）；Pagefind 索引（可选）在此后生成，不占独立编号 |
| 14 | 报告生成 | 唯一构建报告 `dist/build-report.html`（元信息/14 阶段耗时/产物体积/逐项性能预算/压缩统计与无头验证/缓存命中/告警与失败清单/页面清单；位于压缩与哈希之后，天然豁免） |

> **执行顺序说明**：运行日志按功能输出步骤编号（如 `[5/14]`、`[12/14]`），阶段名与构建报告的耗时表一一对应；PWA 分两段——manifest 与离线页在压缩前产出（保证压缩无头验证期间页面引用的端点可解析），SW 在缓存指纹之后定稿（壳预缓存清单必须引用压缩重命名后的最终文件名）。

**自定义页面**：`pages/` 目录下的 .md 文件在阶段 5 与 6 之间处理（`processCustomPages`），同目录内容也通过 `processPagesContent` 加载供模板嵌入（如文章底部公告栏）。**多语言**：`pages/{lang}/{file}.md` 覆盖默认文件（如 `pages/en/about.md` 提供英文标题与正文，slug 可显式声明；缺省时按标题生成，建议显式写英文 slug 避免中英路径混用）。

## 部署

### 方式一：Cloudflare Pages（推荐）

```bash
# 1. 构建站点
npm run build

# 2. 部署到 Pages（wrangler 4）
npx wrangler pages deploy dist --project-name=s-ynapse
```

### 方式二：Cloudflare Workers（带动态安全层）

```bash
# 1. 构建静态资源
npm run build

# 2. 从项目根目录部署 Worker（生产环境；配置文件含安全层与静态资源绑定）
npx wrangler deploy --config workers/wrangler.toml --env production
```

> **Worker 安全配置自动同步**：`npm run build` 会从 `security.json5`（唯一配置源）生成
> `workers/security-config.js`（自动生成文件，已加入 `.gitignore`，勿手改）。Worker
> 运行时读取该文件，实现边缘层与静态层 CSP/速率限制/路径限制/安全头完全一致，
> 修改安全设置只需编辑 `security.json5` 一处。

> **这是本项目的生产部署路径**：静态资产与安全层随同一次 `wrangler deploy` 发布（一个版本，可整体回滚）。
> CI 推送只执行 `wrangler pages deploy`（Pages），**不会更新生产 Worker**。
> 首次部署请配置日志隐私密钥：`npx wrangler secret put LOG_IP_SECRET --config workers/wrangler.toml --env production`；
> 部署后抽查与回滚步骤见 `docs/runbook/rollback.md`。

Worker 提供：速率限制、路径访问控制（如 `/admin/*` 仅允许特定 IP）、CSP 报告收集（`/csp-report` 端点）、HTTP 安全头注入、HTTPS 强制跳转、**维护模式**（环境变量 `MAINTENANCE=1` → 503 维护页，默认文案按 `Accept-Language` 选中/英，`MAINTENANCE_MESSAGE` 自定义覆盖）、**结构化日志**（JSON Lines：`ts`/`level`/`module`/`requestId`/`event`；`LOG_LEVEL`（默认 `info`）控制级别；每个响应携带 `X-Request-Id`（复用 CF-Ray 或生成 UUID）；IP 以短哈希关联，不落明文）。

### 方式三：GitHub Actions（CI/CD 自动部署）

项目已包含 `.github/workflows/deploy.yml`，推送 `main` 分支自动构建部署。CI 作业：
- `check-agents`：变更集中检测 AI 规则文件（AGENTS.md 及其变体），命中即阻断；
- `compat-node20`：Node 20.19.0（`engines` 下限，与 `internals.ci.compatNodeVersion` 一致）上运行 `npm test` + `verify:config` + `verify:config-refs` + `verify:config-single-source` + `verify:config-dupes` + `npm run verify:internals` + `npm run test:build` + `npm run build`，保证 LTS 可用性；
- `build`（Node 版本由 `.nvmrc` 单源控制，经 `node-version-file` 读取；`node scripts/ci-env.js` 导出 internals 环境）→ 单步 `node scripts/ci-checks.js`：**一次跑完整套检查且不提前中断**（lint、typecheck、test、test:coverage（`scripts/lib` 行覆盖率 ≥80%）、test:build、test:fuzz、test:malicious、verify:config 家族（config/refs/single-source/dupes/comments/docs 与 verify:internals）、verify:process-guards、verify:security、Chrome 依赖项 test:smoke/test:cov-web/verify:compression（未探测到浏览器时跳过并标注）、build、sbom；`audit`（依赖漏洞）与 `audit:a11y`（无障碍）为**建议项**——结果写入报告但不阻断），每项记录退出码/耗时/输出摘要，写入 `build-artifacts/ci-checks.{json,txt}`，末尾任一阻断项失败整体失败 → 始终上传 `ci-checks` 与 `test-artifacts`（`build-artifacts/**`，`always()`）→ Pages 部署（仅 `main`，调用 `npm run deploy:pages`，部署前自动跑 `verify:internals`）。
- **进程永不挂死（自动化兜底）**：自动化运行一律走 `node scripts/spawn.js [--max-ms N] -- <命令>`（超时/断链清理整棵进程树、stdin 置空）；仓库高风险入口统一接入 `scripts/lib/process-guard.js`（父进程死亡、绝对生命周期、信号兜底），`npm run verify:process-guards` 巡检并纳入 CI 聚合。详见 `docs/runbook/process-hygiene.md`。
- **无变化重复运行自动跳过**：`preflight` 作业调用 `scripts/ci-skip.js` 查询本工作流历史；当前 HEAD 与已运行序列一致且满足「连续阻断失败 2 次」或「连续完全无错无警告 5 次」时自动跳过（告警不计错也不计净，但重置失败连击）；`workflow_dispatch`、`CI_FORCE=1`、提交信息含 `[ci force]` 均强制运行。阈值与开关见 `internals.json5` 的 `ci.skip`（`docs/config-reference.md` 末节），聚合结论以提交状态 `ci/aggregate` 记录告警数。
- 夜间深度随机测试（`.github/workflows/nightly.yml`，每日 UTC 18:00 + 手动触发）：同一聚合器 `node scripts/ci-checks.js`，仅深度档不同（`FC_NUM_RUNS=2000`、`STRESS=1`、随机种子），上传 `nightly-test-artifacts`。

**配置步骤**：
1. 在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加 `CF_API_TOKEN`（如需部署）
2. 推送代码到 `main` 分支即可自动构建并部署

### 方式四：手动部署到任意静态托管

`npm run build` 生成的 `dist/` 目录可直接部署到任何静态文件服务器。

### 派生副本与回滚

- **多工作区定源**：本仓库是唯一事实源。若本机存在 `real-site/` 等派生副本（被 `.git/info/exclude` 排除、含独立 `.git`），任何修复只以本仓库为准；同步后必须用 `git diff --no-index --stat scripts/ real-site/scripts/` 与 `git diff --no-index --stat js/ real-site/js/` 核对差异归零，禁止只改副本或只改主仓库。
- **派生副本门禁**：派生副本含真实站点数据，配置项计数可与 canonical 文档声明不同；在派生副本内运行 `npm test` 时设 `SYNAPSE_DERIVED_COPY=1`，`scripts/config-count.test.js` 的精确计数断言会显式跳过并打印原因（跳过项计入 skipped），`verify:internals` 同样跳过 `deploy.yml` 一致性检查（派生副本的 CI 配置与部署目标由副本自己维护）。主仓库/CI 不设该变量，断言不弱化、行为不变。
- **发布回滚**：见 `docs/runbook/rollback.md`（**Worker 优先**：`wrangler rollback` 同时回退脚本与静态资产；Pages 为备用路径；含 `LOG_IP_SECRET` 与部署后抽查命令）。

---

## 交互功能

| 功能 | 操作方式 |
|------|----------|
| 暗黑模式切换 | 导航栏图标，跟随系统或手动，localStorage 持久化 |
| 搜索 | `Ctrl+K` 或点击图标，搜索标题 + 正文 + 标签 |
| 快捷键 | `/` 搜索、`D` 主题、`J`/`K` 上篇下篇、`?` 帮助面板、`Esc` 关闭弹层 |
| 图片灯箱 | 点击正文/图库图片；←→ 键切换、ESC 关闭、移动端左右滑动 |
| 代码复制 | 悬停代码块右上角「复制」按钮（语言标签替换为"复制"） |
| 阅读进度条 | 文章页顶部；点击跳转位置、悬停显示百分比 |
| 阅读设置 | 文章底部齿轮 → 字号/行高/宽度滑杆 + 重置（localStorage） |
| TTS 朗读 | 文章底部喇叭按钮，倍速跟随设置 |
| 阅读模式 | 文章底部按钮，隐藏侧边栏全宽阅读 |
| 返回顶部 | 右下角 ↑ 箭头（默认滚动 400px 后显示，阈值可配） |
| 外部链接警告 | 点击外部链接弹窗提示，白名单域名跳过 / 黑名单拦截（可改 warn/prohibit 模式） |
| 文章目录 | 侧边栏 h2-h4 自动提取；移动端左下角目录抽屉 |
| 系列导航 | 文章底部系列面板（上一集/下一集/进度）；卡片 + 侧栏系列徽标 |
| 分享 | 文章底部 7 平台按钮（微信/复制=写剪贴板并提示） |
| 打赏 | 文章底部按钮弹窗（二维码 / 外链，`site.reward` 配置） |
| 汇总图库 | `/gallery/` 瀑布流，点击图片进灯箱 |
| 收藏 | 卡片/文章星标按钮，localStorage 持久化，`/favorites/` 页管理 |
| 每日一言 | 侧栏 quote 组件（默认 100 条双语公版/原创引语按日期轮换，「换一句」+「复制」；可开 Hitokoto 一言 API，失败回退本地） |

---

## NPM 命令速查

| 命令 | 功能 |
|------|------|
| `npm run build` | 构建站点（输出到 `dist/`） |
| `npm run dev` | 监听模式，包含草稿（文件修改自动重建） |
| `npm run serve` | 构建 + 启动本地服务器（默认 3000 端口，`--port`/`--maintenance` 可用） |
| `npm start` | 同 `npm run serve` |
| `npm test` | 运行单元测试（1013 项 / 149 组；集成套件按生命周期自动跳过） |
| `npm run test:coverage` | `scripts/lib` 行覆盖率门禁（`--experimental-test-coverage --test-coverage-lines=80`；CI 阻断，当前实测 93.9%） |
| `npm run test:build` | 构建管线集成冒烟（`--out` 构建到临时目录，校验关键产物、唯一构建报告、CSP nonce 与压缩开关两态；CI 运行，不进 `npm test`） |
| `npm run test:fuzz` | 属性/随机测试（fast-check；`scripts/**/*.fuzz.test.js`；默认 100 次迭代、`FC_NUM_RUNS` 可调、`STRESS=1` 开海量用例；失败留档 `build-artifacts/fuzz-failures/`，`TEST_SEED` 复现） |
| `npm run test:malicious` | 恶意/畸形场景套件（`SYNAPSE_ROOT` 隔离夹具真实构建；10 类场景按 hard-fail/degrade 策略断言；`STRESS=1` 开海量档；CI 运行，不进 `npm test`） |
| `npm run test:smoke` | 浏览器冒烟（系统 Chrome 无头访问代表页：200/标题/DOM/零控制台错误；无 Chrome 跳过；`--build` 强制重建、`--out` 指定产物目录） |
| `npm run test:cov-web` | 无头 Web 覆盖率门禁（`js/**` 行/函数覆盖，阈值 `scripts/lib/web-coverage-thresholds.js`；输出 `build-artifacts/web-coverage/`；无 Chrome 跳过） |
| `npm run test:all` | 本地与 CI 同强度全套：`npm test` + `test:build` + `test:fuzz` + `test:malicious` + `test:smoke` + `test:cov-web` + `verify:internals` 串行 |
| `npm run verify:compression` | 压缩无头对比门禁（完整构建 + 压缩产物 vs 未压缩副本的 DOM/样式/控制台/交互断言；passed=0、failed=1、skipped=0；`--out`/`--chrome`/`--keep-baseline`/`--json` 可选） |
| `npm run sbom` | 生成 CycloneDX 1.5（ECMA-424）SBOM → `build-artifacts/sbom.cdx.json`（不入库；CI 上传为 `sbom-cyclonedx` artifact） |
| `npm run release:mark -- <major\|minor\|patch\|X.Y.Z\|X.Y.Z-预发布> --human-verified "<姓名>" --confirm <版本>` | 完成标记：顺序跑完全套质量门禁 → 同步 package.json/CHANGELOG/RELEASE.json → `chore(release)` 提交 + 附注 tag（默认不 push；`--dry-run` 仅演练；`--push --confirm-push` 才推送；支持同版本/预发布标记，如 `1.1.0-a1`） |
| `npm run release:archive -- --ref <tag\|HEAD>` | 按白名单生成 `release-artifacts/S-ynapse-<版本>.zip`（含前缀目录）：`articles/`、`media/` 只保留 `.gitkeep` 空骨架，测试所需最小文档集 `docs/config-reference.md` 随包；复核内容无越界、必需文件与测试齐全、RELEASE.json=package.json=tag 版本一致 |
| `npm run release:publish -- vX.Y.Z` | 本地备用发布通道（远端已有 tag 后复用双重校验并 `gh release create --latest`，成功后清理旧 Release；tag 永不删除；默认通道为 tag 触发 Actions 自动发布） |
| `npm run release:prune -- --keep vX.Y.Z` | 只保留最新 Release：删除其余 Release 页面（tag 永不删除；`--dry-run` 预览清单；CI/`release:publish` 已自动执行） |
| `npm run lint` | ESLint 静态检查（js/scripts/workers；CI 门禁） |
| `npm run audit` | 依赖漏洞扫描（固定官方 registry：本机 npm 镜像会阻断 audit 接口） |
| `npm run typecheck` | TypeScript checkJs 类型检查（scripts/lib；CI 门禁） |
| `npm run verify:security` | 集成安全回归（注入恶意文章 → 真实构建 → 语义断言） |
| `npm run verify:config` | 配置一致性监守（配置值与注册表默认值/结构） |
| `npm run verify:config-refs` | 零引用键扫描（配置有键、代码无消费的预留键） |
| `npm run verify:config-dupes` | 重复键扫描（同一对象内重复键，作用域感知；豁免名单 `scripts/config-duplicates-allowlist.json`） |
| `npm run verify:config-comments` | 逐键注释覆盖率门禁（15 个 JSON5；CI 阻断） |
| `npm run verify:config-docs` | 配置文档覆盖门禁（15 个 JSON5 的顶层键/模块键 vs `docs/config-reference.md`；脚本 `scripts/check-config-docs.js`） |
| `npm run verify:config-single-source` | 单一事实源守卫：行为开关矩阵（`docs/config-switch-matrix.md`，819 项）零缺失、回退字面量绑定零漂移、文档与生成结果一致（脚本 `scripts/check-config-single-source.js`） |
| `npm run gen:config-matrix` | 重新生成 `docs/config-switch-matrix.md`（改动配置消费点或测试后运行） |
| `npm run verify:internals` | 工程内部参数守卫（`.nvmrc`/`workers/wrangler.toml` assets 目录/CI 版本与 `internals.json5` 单源一致；关键写死形态抽样） |
| `node scripts/ci-checks.js` | CI 聚合检查（与 deploy.yml 同命令）：跑完整套门禁后统一失败，报告写入 `build-artifacts/ci-checks.{json,txt}`；`--fail-fast` 可改为首个失败即停 |
| `npm run perf:audit`（`--url` 可省略，默认 `internals.ports.perf`） | 可复现性能基线（Slow 4G + CPU 4x 节流 + 禁用缓存；`--runs`/`--out`/`--json`/`--chrome` 可选；Chrome 经 internals/CHROME_PATH/平台默认探测） |
| `npm run import -- --from hexo --source ./hexo-blog` | 内容导入（hexo/hugo/wordpress，`--dry-run` 预览） |
| `npm run init` | 重新初始化 git hooks / gitignore / gitattributes |
| `npm run deploy:pages` | 部署到 Cloudflare Pages（项目名/产物目录读 `internals.deploy`，部署前自动跑 `verify:internals`） |
| `npx wrangler deploy --config workers/wrangler.toml --env production` | 部署 Worker 安全层（含静态资源绑定） |

---

## 测试

```bash
npm test            # 1013 项 / 149 组（本机 1 项按环境跳过）
npm run test:all    # 本地与 CI 同强度：test + test:build + test:fuzz + test:malicious + test:smoke + test:cov-web + verify:internals 串行
npm run test:coverage  # scripts/lib 行覆盖率 ≥80%（Node 内置覆盖率，CI 阻断）
npm run lint        # ESLint 静态检查（js / scripts / workers）
npm run typecheck   # TypeScript checkJs（scripts/lib，渐进引入）
npm run audit:a11y  # WCAG 2.0/2.1/2.2 A+AA 全页无障碍审计：自动构建并自起 serve（端口自动取空闲），扫描 dist 全部 HTML（中英首页/文章/归档/标签/分类/搜索/画廊/系列/收藏/友链/404，排除内部构建报告），逐页 HTTP 2xx 校验，明暗双主题各跑一次 axe（wcag22aa），critical/serious/HTTP 失败即阻断；已有 serve 时用 `node scripts/a11y-audit.js <baseUrl>` 或 A11Y_BASE 复用；Chrome 路径用 CHROME_PATH 覆盖。真机点检见 docs/mobile-checklist.md
npm run verify:security   # 集成安全回归
```

### 随机 / 属性测试（test:fuzz）

- 属性测试位于 `scripts/**/*.fuzz.test.js`（默认不进 `npm test`，避免慢速随机用例混入单测门禁）；`npm run test:fuzz` 用 fast-check 跑默认 100 次迭代，`FC_NUM_RUNS` 调整次数，`STRESS=1` 打开超大/海量用例。
- 种子管理：未设置 `TEST_SEED` 时每次运行随机生成 32 位种子并打印（`[test-seed]`）；失败时自动把种子、counterexample 与重放命令写入 `build-artifacts/fuzz-failures/<test>-<UTC时间戳>.json`。
- 复现：`TEST_SEED=<种子> FC_NUM_RUNS=<次数> npm run test:fuzz`（PowerShell：`$env:TEST_SEED='<种子>'; npm run test:fuzz`）。修复后应从同一命令重放确认绿。
- 恶意/畸形载荷语料库与临时站点夹具（`scripts/lib/test-payloads.js`、`scripts/lib/test-site-builder.js`）供恶意场景套件使用；策略标记 `hard-fail`（必须拒绝/阻断）与 `degrade`（不崩溃 + 告警）。

### 恶意/畸形场景与失败策略（test:malicious）

- `npm run test:malicious`：在 `.tmp-test/` 生成隔离站点（`SYNAPSE_ROOT` 指向夹具，仓库 templates/static/js/node_modules 以目录联接复用），逐类断言构建器对恶意输入的处置；10 类场景覆盖：超长/海量、XSS 全字段注入、路径遍历与保留 slug、坏 JSON5/断裂配置、空站、编码异常（BOM/CRLF/非法 UTF-8/孤立代理）、损坏媒体、未来/非法日期与重复 slug、emoji/双向/组合字符、磁盘写失败与原子性。
- 失败策略二分：**安全类 hard-fail**（路径遍历、保留路由/OS 设备名、重复/非法 slug、坏配置、危险协议链接）必须非零退出并定位到 `file` 或 `file:line`，且预校验先于 `dist` 清理、既有产物逐字节不变；**资源类 degrade**（超长/海量、空站、编码异常、损坏媒体）构建成功、产物可用，告警与失败条目进入 `build-report.html` 的告警/失败清单区块。
- XSS 断言按产物语境执行：HTML 以引号感知 tokenizer 检查事件属性/危险协议/内联脚本可执行位置；RSS/sitemap 检查裸标签；JSON Feed/搜索索引检查可执行标签起始串；`<` 在 JSON 出口统一写为 JSON 等价的 `\u003c`（解析后值不变）。
- 随机载荷 × 策略断言位于 `scripts/lib/malicious.fuzz.test.js`（随 `test:fuzz` 运行）；确定性场景位于 `scripts/malicious.test.js`（`STRESS=1` 打开海量档，默认档总时长约 30 秒）。

### 浏览器冒烟与 Web 覆盖率（test:smoke / test:cov-web）

- `npm run test:smoke`：真实构建产物 + 系统 Chrome 无头访问代表页（首页/文章/搜索/标签/归档/404），断言 HTTP 200、非空标题、DOM 结构与零控制台错误；失败摘要写入 `build-artifacts/web-smoke/summary.txt`。
- `npm run test:cov-web`：以 `--no-bundle` + `--no-minify-js` + 压缩关闭构建到 `build-artifacts/web-coverage/site`（产物 URL 与 `js/**` 源码一一对应且保留源码行结构，CDP 偏移可精确映射），经 CDP 精确覆盖逐页累加，聚合 `js/**`（排除 vendor）行/函数覆盖率，输出 `build-artifacts/web-coverage/{summary.txt,coverage.json}`（含逐函数未覆盖明细）；阈值见 `scripts/lib/web-coverage-thresholds.js`（首测定档 55% / 55%），未达标或断言失败 exit 1。
- 两者无 Chrome 时打印 `[SKIP]` 后 exit 0（与 `verify:compression` 同一降级语义）；`test:all` 串行执行全部六个入口，本地与 CI（`deploy.yml`）命令集合完全一致；夜间深度档见 `nightly.yml`（`FC_NUM_RUNS=2000` + `STRESS=1` + 随机种子）。

下表按功能域列出主要套件（具体用例见对应 `scripts/**/*.test.js` 与 `scripts/lib/*.test.js`；权威总量以 `npm test` 汇总为准）：

| 功能域 | 主要套件 |
|--------|----------|
| 工具与文本 | formatDate / safeSlug / validateSlug / escapeAttr / escapeHtml / stripHtml / insertCjkSpacing / countWordsDetail / extractToc |
| 安全消毒 | sanitizeHtml（含媒体元素）/ sanitizeSvg / content-policy / hasUnsafeLinkScheme / copyOwnProperties / restrictMediaAttrs |
| 配置体系 | features-schema / theme-presets / config-split / config-consistency / config-comment-audit / check-config-docs / config-duplicates / internals / config-link-safety |
| 内容管线 | content-validate / preflight / publish-window / computeRelatedArticles / resolveJsonFeedOptions / buildSitemapUrls / encodeLoc / toSitemapLastmod / search-index / search-core |
| 构建与产物 | asset-cache / atomic-write / dist-hash / build-errors / build-report-html / incremental-build / css-merge / cjk-fonts / auto-cover / og-size / og-format / critical-css |
| 压缩 | compression-config / compression-pipeline / compression-verify / js-obfuscate / serve-compression |
| 安全与 Worker | CSP trimCspDirectives / workers/lib ip-utils / workers/lib rate-limit / security-worker（集成 + 配置解析）|
| 发布与运维 | release-mark / release-archive / release-manifest / release-validate / release-version / release-prune / sbom / process-guard / ci-skip / guard-bypass |
| 特色功能 | theme-lab / save-data / continue-reading / popup-notice-config / lightbox-core / bilingual-core / export-article / series-page / dailyQuote / i18n-residuals / mermaid-render / nav-match |

> `npm test` 共 **1013 项 / 149 组**（Node 内置 test runner；集成套件 `build-smoke` 与 `T4 恶意/畸形场景` 在 `npm test` 生命周期下自动跳过，分别由 `npm run test:build` / `npm run test:malicious` 运行）。

### SBOM（软件物料清单）

- **标准**：CycloneDX **1.5** JSON（ECMA-424）；`bomFormat/specVersion/serialNumber(urn:uuid)/version/metadata/components` 最小合法结构，根组件版本随 `package.json`（当前 `s-ynapse@1.2.1`，type `application`）。
- **依赖映射**：读取 `package-lock.json`（lockfileVersion 3）非根条目，逐条输出 `type:"library"` + `name` + `version` + `purl`（作用域包按 purl 规范将 `@` 编码为 `%40`）+ 唯一 `bom-ref`；`integrity`（sha512 base64）转为 `hashes[{alg:"SHA-512",content:<hex>}]`，无 integrity 则省略；按 `name/version` 稳定排序，重复同版本以 `#2` 后缀去重。
- **生成**：`npm run sbom` → `build-artifacts/sbom.cdx.json`（目录已加入 `.gitignore`，原子写入，不入库）；CI 在构建后生成并上传为 `sbom-cyclonedx` artifact（`if-no-files-found: error`）。

### 构建行为说明

- **失败即阻断**：内容预校验（重复 slug、非法日期、空标签/分类、缺失 `/media` 引用）在清理 `dist/` 之前报错并终止；其中 slug 身份类问题（非法/重复/保留路由/OS 设备名）为 **critical 错误，`--allow-degraded` 也不放行**，仅媒体引用缺失、损坏媒体、非法日期与空分类等资源/数据类失败可在降级预览模式继续；运行期失败（模板/feed/sitemap/媒体/OG/压缩等）会汇总打印并以非零退出码结束。本地预览可用 `npm run build -- --allow-degraded` 降级继续（退出码保持 0，critical 错误除外）。
- **定时发布**：`date` 晚于构建时间的文章视为已排期，自动排除页面、feed、sitemap 与搜索索引，并在构建日志中提示。
- **缓存策略**：`_headers` 分级缓存：`/assets/css/*`、`/assets/fonts/*`（CJK 子集分片）、打包产物 `/assets/js/*`（`app`/`deferred`/`shared`/`runtime` 内容哈希名）、`/assets/config.*.json` immutable 1 年；其余 `/assets/js|vendor/*` 1 小时 + `stale-while-revalidate`；`/media|og/*` 7 天 + SWR。可用 `site.build.cacheControl: false` 关闭。
- **搜索弱网**：索引请求 5 秒超时 + 一次重试，失败展示错误态与「重试」按钮；入口按钮在模块加载前点击不再报错。
- **Worker 运行时**：`CF-Connecting-IP` 缺失时按共享桶限流（fail-closed）；配置 `LOG_IP_SECRET` 后 IP 日志哈希改用 HMAC-SHA256；`pathRestrictions: []` / `skipPaths: []` 为显式语义，仅缺失字段才回退内置兜底。
- **配置校验语义**：`npm run verify:config` 校验 features/site 等的结构与死键（键存在性、类型）；值级自定义（站点文案、OG 开关等）列为「覆盖」信息项，不影响通过。
- **运行时配置外置**：全量配置（features/tuning/guard/presets/quotes/i18n 等）写入内容寻址的 `/assets/config.<hash>.json`（immutable 缓存）；页面仅内联 ≤2KB 降级子集。启动时异步加载，失败自动重试 1 次、3 秒超时后降级为内置最小子集（fail-open），弱网/离线仍可阅读（`window.__CONFIG_OK__` 标记状态）。
- **JS 打包与压缩**：esbuild 开启 `splitting`，产出内容哈希的 `app.<hash>.js`（首屏启动链）、`deferred.<hash>.js`（交互/重模块聚合，按需载入）与 `shared.<hash>.js` 公共 chunk（跨入口共享模块，由 ES 模块图自动加载）；`runtime.js` 引导脚本经 Terser 压缩后按最终字节哈希单发并同步全部 HTML 引用（压缩关闭时保留源哈希名）；`--no-bundle` 可回退原生 ESM 拷贝模式。
- **vendor 瘦身**：KaTeX 字体仅保留 woff2（654.9→254KB）；mermaid（3.5MB）改为页面 load 后 idle 拉取（仅图表页加载，零成本页不请求）；Prism 改为按页门控（仅含高亮代码块的页面引入，首页/列表零成本，实测首页 −82KB、请求 17→16）。
- **字体与预加载**：本地变量字体 3 个（Inter/Sora/Manrope，woff2 latin 子集）随字体栈自动生成 preload（含 fonts.css），`font-display` 可配；无冗余 preconnect。中文字体 Noto Sans SC 构建期按 dist 页面/配置 JSON 实际用字子集化并自托管（`site.build.cjkFonts`，首次需联网、缓存 `.cache/fonts/`、之后离线可复用；失败自动回退系统字体链，构建不失败）。
- **预算门禁**：`[budget]` 检查 5 项：单页 HTML gzip ≤45KB、页面 HTML raw 中位 ≤85KB、内联关键配置 ≤2KB、应用 JS gzip 合计 ≤75KB、单页静态请求 ≤12（HTML 两项已计入关键 CSS 内联增量；注册表默认 40/50KB，站点按实测上调，阈值见 `features.perfBudget`）；`warnOnly: false` 时超限终止构建。

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 模板引擎 | EJS 3.1 |
| Markdown | marked 12（+ supSub/mathGuard 扩展） |
| 数学公式 | KaTeX（按需注入） |
| 图表 | Mermaid 11（按需注入） |
| 图片处理 | sharp 0.35 |
| HTML 压缩 | @minify-html/node |
| CSS 压缩 | clean-css 5 |
| JS 压缩 | terser 5 |
| RSS/JSON Feed | feed 4 |
| 代码高亮 | Prism 1.30（本地 vendor，多语言按需拼接） |
| 字体 | Inter / Sora / Manrope（@fontsource latin woff2，本地 vendor）；中文 Noto Sans SC（构建期按用字子集化，本地自托管） |
| 前端模块 | 原生 ESM（js/core + js/domains/{core,features,guard}，无打包器） |
| 分析 | Cloudflare Web Analytics |
| 部署 | Cloudflare Pages / Workers |
| CI/CD | GitHub Actions |
| 测试 | Node.js built-in test runner |
| 静态检查 | ESLint 10（js / scripts / workers 三层） |
| 类型检查 | TypeScript 5.9 checkJs（scripts/lib，渐进引入） |

---

## License

MIT — 详见 [LICENSE](LICENSE)。

Copyright (c) 2026 stop666two
