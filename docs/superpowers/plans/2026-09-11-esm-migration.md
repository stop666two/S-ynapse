# ESM 迁移实施计划

**目标**：将 `templates/layout.ejs` 中 ~40 个内联 IIFE（~150KB）迁移到 `js/` 源目录的 ESM 模块，构建输出 `dist/assets/js/`，浏览器以 `<script type="module">` 加载。

**架构**：
- 两级结构：`js/core/`（入口与共享运行时）+ `js/domains/`（按功能域拆分，与 features.json5 模块对应）
- 运行时配置：沿用 `window.__FEATURES__`/`__I18N__`/`__PRESETS__`/`__QUOTES__`；新增 `window.__SITE__`（site.pwa 等子集）、`window.__LANG__`、`window.__LANG_PREFIX__`
- 构建：`copyJsAssets()` 复制 `js/` → `dist/assets/js/`（保持相对 import 结构）；cache-bust 覆盖 `.js`
- 加载：`<script type="module" src="/assets/js/core/main.js">`；域模块用动态 `import()` 按 features 条件加载
- 全局兼容：`__T`/`__SB`/`__toast` 挂 window（阶段 1 前由内联定义，之后由 runtime.js 定义）；onclick 内联属性不受影响
- 无回退：仅现代浏览器（type=module 原生支持）

**约束**：CSP `script-src 'self'` 已允许同源脚本；不新增依赖（不用打包器，原生 ESM 多文件）；每阶段验证+提交；内联与 ESM 并存直到全部迁移完。

## 阶段

- [ ] **阶段 0 基建 + 试点**：`js/` 目录、构建复制、window 注入扩展、`main.js` 入口、迁移 favorites、验证
- [ ] **阶段 1 runtime**：`__T`/`__SB`/`__toast` 移入 `js/core/runtime.js` 并挂 window；移除内联定义
- [ ] **阶段 2 核心域**：themeToggle/themePresets/themeSchedule、mobileBottomNav、search（hotSearches/history）
- [ ] **阶段 3 阅读域**：toc/scrollspy、readingProgress、readDock、readMode、tts、lightbox
- [ ] **阶段 4 交互域 4a**：motion、scrollBehavior、pageTransition、backToTop、shortcuts、share、externalLink
- [ ] **阶段 4 交互域 4b**：contactPopup、comments、pwa、dailyQuote、sidebarDrag、heatmap/归档脚本
- [ ] **阶段 5 收尾**：清理 layout 残留内联、config-reference/CHANGELOG、全量回归

## 验证配方（每阶段）

1. `node .tmp-scripts/run-build.js`（exit=0, errors(0)）
2. 对应模块的 `verify-*.js`（经 `with-serve.js` 自启自停）
3. `npm test` + `node scripts/security-verify.js`
4. 提交（`feat(ai): esm migrate <域>`）
