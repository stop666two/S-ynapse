# 内容级双语 (Content i18n) 实施计划 — 最终版

> 用户决策(已确认): ①界面文本全量字典化(99 行) ②默认语言自动检测浏览器 ③20 篇文章全部一次翻译英文 ④URL 用 /zh/ /en/ 前缀

**Goal:** S-ynapse 升级为内容级双语站:文章按语言存于 `articles/zh/`+`articles/en/`,URL `/zh/slug/`、`/en/slug/`,界面语言切换器切换界面文案+文章列表,根路径 `/` 302 到浏览器语言版本。

**Architecture:**
- 文章: `articles/zh/*.md` + `articles/en/*.md` → 文章对象带 `lang` 字段
- 每个语言一个完整"语言站点": `/zh/`、`/en/` 各生成 index/archive/tags/categories/search/RSS/sitemap/search-index 全套
- 入口 `/` (index.html) = 重定向页(navigator.language 检测 → /zh/ 或 /en/; 无匹配默认 zh); 同时服务端 _redirects `/ 302 /zh/` 兜底(Cloudflare 服务端重定向, JS 用于本地 serve)
- 界面文案: ui-strings.json5 扩为 双语言字典(zh/en 全键), 模板中 99 行中文全改 `<%= uiStr('key') %>` 服务端渲染 + `data-i18n` 客户端切换
- 语言切换= 页面内 i18n 切字典 + 列表 URL 跳语言版

**Tech Stack:** Node.js, EJS, marked, JSON5, 无新增依赖。

## Global Constraints

- 现有 20+ 中文文章移入 `articles/zh/`, 全部翻译成英文放入 `articles/en/`(同名文件)
- URL: `/zh/slug/` `/en/slug/`; 根 `/` → 302 `/zh/`(服务端)或浏览器检测
- 文章 frontmatter `lang` 字段从子目录推导(zh/en),frontmatter 无语言字段时优先
- 每语言独立 sitemap.xml / rss.xml / search-index.json
- 语言切换按钮 langBtn: 界面 i18n(现有 localStorage 机制)仅切界面;文章列表/首页跳对应语言前缀
- `npm test` (67 项) + `security-verify` 全绿;每完成一个任务立即 git commit
- 临时脚本放 `.tmp-scripts/`(已 gitignore)

---

## 阶段 1: 界面字典全量化 (ui-strings.json5 + 模板)

### Task 1.1: 字典全量扩展
**Files:**
- Modify: `ui-strings.json5` (根目录)

**Interfaces:**
- Produces: `zh.*` 与 `en.*` 全键对称(99+ 键);现 zh 顶层段改为与 en 对称

- [ ] Step 1: 审计现有键(已做): zh 段含 search/nav/sidebar/card/post/toolbar/archive/gallery/notFound/pagination; en 段存在但可能缺键
- [ ] Step 2: 为 404/archive/categories/category/favorites/gallery/index/layout/links/post/search/tag/tags 补全 zh+en 所有 99 行对应键(参考 .tmp-scripts/audit-ui-cjk.js 输出核对)
- [ ] Step 3: json5 解析验证: 写 .tmp-scripts/check-ui.js 遍历 zh 与 en 键集合完全一致
- [ ] Step 4: commit `feat(i18n): full UI string dictionary zh/en`

### Task 1.2: 模板引用字符串化
**Files:**
- Modify: 全部 15 模板 templates/*.ejs

**规则**:
- 静态中文(如 `L27 置顶`)→ `<%= uiStr('post.pinned') %>`(服务端)若确认页面不再切, 或 data-i18n
- 页面文本(archive 统计标签/分类词) → server 端 `uiStr()`
- 弹层/提示(复制代码/已复制/拖动以排序) → JS 用 `__UI('key')` 或 window.__I18N__
- 保持 `<%# %>` 注释不改

**Verification**: 重跑 audit-ui-cjk.js → 每个模板 CJK 行数应只有注释/文章内容; jsparse 每个模板 ejs.render 正常

- [ ] Step 5: 全模板替换 → build → 浏览器 127.0.0.1:3224 验 zh/en 切换 → commit

## 阶段 2: 文章目录与加载器

### Task 2.1: 目录移动
- [ ] git mv articles/*.md articles/zh/; mkdir articles/en
- [ ] commit

### Task 2.2: build.js 文章加载器
**Files:** scripts/build.js processArticles 区(约 980-1050)
- 扫描: 遍历 子目录 zh/en
- 文章对象: lang, url: `'/'+lang+'/'+slug+'/'`, langUrl
- [ ] build 验证 dist 出现 /zh/*.md href → commit

### Task 2.3: URL 前缀全局化
**Files:** build.js 所有 `url: '/' + s + '/'`; templates 用 article.url 的自动含前缀; wikiLookup/pagination/share 的绝对 URL(site.url + lang)
- [ ] commit

## 阶段 3: 语言站生成

### Task 3.1: 首页/归档/标签/分类/search 按语言拆分
- generatePages 按 lang 过滤 published → 生成 /zh/… /en/…
- 未取得语言匹配(站级数据)保持单套
- [ ] commit

### Task 3.2: sitemap / rss / search-index / robots 分语言
- [ ] commit

### Task 3.3: 根重定向
- 生成 index.html 重定向脚本(navigator.language);
- 按原文 20 篇文章的 slug 冲突(zh/en 同名) — 非冲突; 单语言 URL 全改
- _redirects: `/ 302 /zh/`
- [ ] commit

## 阶段 4: 翻译 20 篇英文

### Task 4.1: 翻译
- 用并行子代理(每个 4-5 篇)翻译 articles/zh/*.md → articles/en/*.md
- 保留 frontmatter, 只翻正文+title+description; featuredImage/cover 引用可复用(media/ 共享)
- [ ] commit

## 阶段 5: 测试+文档+版本

### Task 5.1: 更新 build.test.js 断言
- 64→72 模块? (模块数不变, 为 i18n 不改 features 数量; 但新增 page.lang/url 断言)
### Task 5.2: npm test + security-verify + 浏览器全验证
- 开关测试: 关闭 i18n 后界面回默认; 开 en 无文章时
### Task 5.3: README/config-reference 更新 + CHANGELOG 1.0.3 + 提交
