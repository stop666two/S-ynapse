# S-ynapse 会话交接文档 — 2026-09-13（全项目审查 → 5 批次修复 → 终审 → 双态验证）

> 用法：新会话先读本文件 + `AGENTS.md`。本会话全部提交在本地 `main`，**未推送远端、未建 tag**。
> 状态：工作区干净（仅本文件与计划文档在本提交中入库）。

---

## 1. 用户原始请求（原文保留）

- 「请阅读和检测整个项目。包括安全审查，性能优化，功能推荐，当然必须要想告诉我让我选择。」
- 「还有几个文档没看吗？」→「`docs/handoff` 这里面的必须读」（已全读 09-11/09-12 两份）
- 「注意没有我的允许不允许提交云端」
- 「开启和关闭的功能都要测试！！！」（本会话全部验证按「开/关双态」执行）
- 「公告条必须继续加强，可用设置多个以及多样式等等，继续扩充配置文件。以及有些注释不够详细。这些留着最后完成了现在的任务后再进行这些」（已作为追加项完成）
- 「在最后的最后完全更新所有文档然后打印时间启动电脑30秒后自动关机」「注意如果关机时间在14：50之前那么就不关机」
- 「必须保证没有然后遗留」
- 「违规！！！使用太长的命令！！！」（长命令须拆分，见 §6）「没有设置超时时间」（所有命令显式超时）
- 用户通过 question 工具确认：执行全部 5 个批次 + 先做真实运行时性能验证。

## 2. 提交链（本地 main）

| 提交 | 内容 |
|---|---|
| `64dc2dd` | Pagefind 收尾：门控改 `navigation.search.provider`、压缩后生成、清旧索引、`indexPath` 跟随、文档对齐 + 空构建中止守卫 |
| `3bae616` | 安全 P0：消毒器迁移 `sanitize-html@2.17.7`（三个绕过复现并封堵）、SVG 实体解码、slug 强校验、build-report/og 转义、Worker 部署配置修正（`main`+`[assets]`+`--env production`，dry-run 验证） |
| `518cc13` | 前端缺陷包 12 项 + Pagefind 0 页根因（minify 省略 `</head>` 致 Pagefind 解析器丢弃页面 → `keep_closing_tags: true`） |
| `f4df17e` | Worker/CI 加固：CIDR（IPv4/IPv6）、限流封禁误放修复、静态资源免限流、`/csp-report` 防护、双层头部统一（`applyHeaderHardening`）、CI 门禁修复（fetch-depth/diff 范围/permissions/audit+verify 纳入 PR）、18 项新测试 |
| `5cc9cb1` | 性能：搜索语料按需 fetch、首卡/封面 `fetchpriority=high`、search-index 媒体路径随 cache-bust 重写（修 404）。首页 LCP 795→348ms、HTML -16% |
| `317e73f` | 公告条增强：多条目 icon、`tone gradient`、`transition fade/slide`、`showProgress`、`pauseOnHover`、`showDot`、`newTab` |
| `2ade962` | 配置注释审查：补全 pwa/guards/atmosphere/giscus 等；标注 8 个未接线键与 3 处枚举不符 |
| `71400ac` | 终审修复：预渲染守卫联动、Pagefind 双层降级、CIDR 校验告警、slug 非法中止、`%2F` 折叠、GET/HEAD 限流边界、注释/文档校正 |

## 3. 验证证据（全部通过）

- `npm test`：**100/100**（含新增 IP/CIDR、限流、路径、Worker 集成、slug、消毒绕过等）
- `npm run verify:security`：**PASS**（恶意文章含实体编码/属性截断/srcset 逃逸载荷；Phase 2 断言非法 slug 中止构建；search-index featuredImage 存在性断言）
- `npm run audit:a11y`：checks=8，violations=0
- 浏览器断言（.tmp-scripts 中已按「无残留」删除）：主页/搜索/命令面板/复制/主题 14 项；运行时开关双态 9 项；**关态组合**（pagefind 禁用 + 公告关态键 + 预渲染守卫）8 项；Pagefind 开启态 6 项；公告多条/渐变/slide/进度 6 项；pagefind 关闭 + 搜索关闭 + 公告关闭 4 项
- 性能 trace：首页 LCP 795→**348ms**、CLS 0.03（<0.1，无归因）；文章 LCP 468ms、CLS 0
- `wrangler deploy --dry-run --config workers/wrangler.toml --env production`：bindings = ASSETS + ENVIRONMENT("production")

## 4. 关键技术决策

- 消毒器选 `sanitize-html`（精确锁 2.17.7）而非自研解析：安全边界不赌正则；未知标签前置转义保持原展示语义，危险标签走 `nonTextTags` 子树删除。
- Pagefind 0 页根因：minify-html 省略 `</head>`（合法）但 Pagefind 1.5.2 直接丢页 → 保留闭合标签（每页 +~20B）。
- 搜索语料按需化：`window.__SEARCH_INDEX_URL__` + 就绪标记 + 在途去重；浮层与独立搜索页共用；搜索结果图与 cache-bust 映射对齐。
- Worker/静态层头部单一来源：`applyHeaderHardening`（含 HSTS preload 保留，新增 `hardening.hstsPreload`）。
- 控制台热键：Ctrl+K 固定搜索；命令面板默认改 Ctrl+P，并双向互斥。

## 5. 遗留事项（如实交接）

1. ~~技术债：内联 CSS 外链化~~ **已解决（2026-09-18 会话，commit `b9e49ee`）**：`templates/layout.ejs` 的 122KB 内联 `<style>` 抽为 `templates/site-css.ejs`，构建期渲染一次 + CleanCSS(level 1) + 内容哈希输出 `dist/assets/css/site.<hash>.css`，layout 改 `<link rel="stylesheet">`。AB 截图回归（reduced-motion 冻结动画，light/dark×4 页 + 移动 2 张，共 10 对）像素差 **0.000%**；文章页 HTML gzip 51.7KB→29.5KB（-43%），CSS 22.3KB gzip 独立缓存。
2. ~~8 个未接线键~~ **已解决（2026-09-13 续会话，commit `0aec780`）**：接线 6 个（`search.openAnimation`、`favorites.position('meta')`、`series.defaultWidgetCount`、`backToTop.hotkey`、`shortcuts.ignoreInInputs`、`dailyQuote.source`），删除 2 个废弃键（`readingProgress.progressColor`、`readingPanel.storageKey`，同步 features-schema 与 config-reference）；开/关双态构建断言 + 浏览器断言全通过。
3. ~~favicon 缺失~~ **已解决（2026-09-18 会话，commit `e2c168d`）**：新增 `site.favicon` 配置（enabled/svg/png32/appleTouch，默认 `/icons/` 三件套）+ 节点网络图形资产（SVG + sharp 生成 32/180 PNG）；构建时存在性检测、缺失告警跳过、全缺失时 data-URI 兜底（消除 404）；三态验证（默认/兜底/关闭）+ HTTP 断言。注：`giscus` 的 features 键位多为冗余（真实配置在 `site.json5→comments.giscus`）。
4. **Pagefind 依赖**：provider=pagefind 时未安装 `pagefind` 会构建告警并跳过索引；前端已做降级，但建议部署前 `npm install -D pagefind` 并跑一次构建。
5. **npm audit 本机不可用**：npmmirror 无 audit 接口；CI 使用官方 registry 已在 PR 阶段执行（`--audit-level=high`）。
6. 主样式已外链（`b9e49ee`）；CSP `style-src 'unsafe-inline'` 仍因残留内联样式（`customCSS` 块/元素 style 属性）与内联脚本保留，去 unsafe-inline 需专项重设计。

## 6. 环境与踩坑（务必遵守）

- **长命令必须拆分**（用户点名违规）：≤5 个子命令/条，`&&`/`;` 串联不得 ≥6。
- **所有终端命令必须显式超时**（快速 15–30s；构建/测试 120–300s；预计 >300s 用后台+轮询）。
- 只按**自建 PID 文件**（`.tmp-scripts/serve.pid`）停进程；严禁 `Get-Process node | Stop-Process`（曾误杀 OpenCode）。
- 本机 `npm audit` 不可用（镜像）；`npm install` 会提示 esbuild/workerd 安装脚本被 allowScripts 拦截（wrangler dry-run 仍可用）。
- PowerShell 内联 `node -e` 含引号/正则必炸 → 用 here-string 管道（`@'...'@ | node`）或写 `.tmp-scripts/*.js`（本次已全部清理）。
- git 提示 `workers/lib/*.mjs` LF→CRLF（autocrlf 行为，仓库既有 JS 同样如此）。
- 2026-09-18 会话结束前：已停止 3224 serve（自建 PID）；`.tmp-scripts/` 按用户决策保守清理——删除 157 个历史截图/日志/一次性脚本，保留 81 个 `verify-*.js` 与助手（`run-build.js`/`with-serve.js`，文档引用保持有效）；本会话新增临时文件（含 shots/ 截图目录）均已删除，非白名单残留为 0。

## 7. 下一步建议

1. ~~决策 §5 的 8 个未接线键~~ 已完成（接线 6 + 删除 2，见 §5.2）。
2. ~~favicon 资产~~ 已完成（见 §5.3，`e2c168d`）。
3. ~~内联 CSS 外链化~~ 已完成（见 §5.1，`b9e49ee`）；如需进一步压缩可评估关键 CSS 内联 + 其余延迟加载（收益边际，需重新基线）。
4. 推送前询问用户备份（AGENTS 121/122）；不建 tag、不推远端除非用户明确要求。

## 8. 快速验证命令（新会话复制）

```powershell
npm test
npm run verify:security
npm run verify:config      # T0 配置一致性监守（阻塞项）
npm run audit:a11y          # 需先起 serve 3224
node .tmp-scripts/run-verify.js verify-announcement.js verify-search.js --timeout=90000   # 自启停服务 + 逐脚本超时 + 树杀（含孤儿 Chrome）
node .tmp-scripts/run-verify.js --all --timeout=120000   # 全量回归（79 个脚本）
```

## 9. 2026-09-18 会话增量（T1/T0/测试脚本优化）

- **T1 硬编码参数迁移（第 1 批，commit `4185be4`）**：13 个运行时硬编码参数进配置并接线（announcement.storageKey/removeDelayMs、toast.removeDelayMs、pwa.installDismissKey/updateToastMs、morphIcons.vendorPath、codeBlock.blobRevokeDelayMs、themeSchedule.smoothTransitionMs、motion.revealCleanupMs、guard.contextMenu.revokeDelayMs/translateUrl、guard.copyGuard.flashRemoveMs、guard.accessGate.focusDelayMs）；12 个模块去代码兜底；计数 2482/features 794/guard 168。
- **T1 第 2 批（已完成，commits `cc5ad43`/`788786c`/`f0fd74e`/`128ef20`）**：build 层去兜底（rss/sitemap/jsonFeed/pwa.serviceWorker/mediaQuality/pagefind/hero 改读注册表 + topTags 死字段清除 + collectTopTags 语义修复）；生成页派生（favicon PNG `sizes` 读 IHDR、SW `cacheName`、CSS 输出四键 `cssOutDir/cssFileBase/hashLength/hashAlgorithm`、build-report/offline/维护页取 theme，修复 serve 配置作用域 bug）；OG 生图配色/深色底/纸张底全取 theme.json5（缺失即报错）与 Worker `skipPaths` 去代码兜底；`build.js` 内联 defaults 抽为 `scripts/lib/site-defaults.js` 且 `verify:config` 扩展为 7 配置文件结构监守（首跑补齐 38 处注册表缺键；自由映射 `{}` 豁免；theme/security 记录豁免），全局 `arrayMerge=replace` 消除数组拼接；**新增键开/关双态验证 40/40 全绿**（含公告存储键/时延、toast、accessGate 启用+focusDelayMs+密码解锁、morphicons 失效降级、CSS 12 位 sha1 命名、sw.js cacheName）；README 计数 2482→2487。验证脚本：`.tmp-scripts/verify-config-dualstate.js`（含 finally 配置恢复与 40/40 断言）。
- **T2（已拍板豁免）**：结构/协议字面量（事件名/DOM 选择器/正则/schema.org/分享平台 API URL/matchMedia 查询串）与开发脚本本地默认值；T0（默认值注册表）保留但由 `verify:config` 监守。
- **配置文件注释补全（commit `1dcc888`）**：2132 个对象键全量审计，除 `ui-strings.json5`（i18n 文案表，键名即文档，已在文件头与 config-reference 标注策略）外 0 缺口；补齐 features/guard/site/theme/tag-aliases 逐字段注释；审计脚本保留于 `.tmp-scripts/audit-comments.js`（可重跑）。
- **测试脚本优化（commit 待提交/本次）**：新增 `.tmp-scripts/_harness.js`（看门狗 120s 可调、异常/退出自动关浏览器杀进程、readMode 容错）与 `.tmp-scripts/run-verify.js`（自启停静态服务+健康检查、逐脚本超时、taskkill /T 清子树、汇总退出码）；68 个 puppeteer 脚本一行切换 harness；67 处 BASE 环境变量化；11 个 mode 文件读者容错；verify-search 适配异步索引；实测评：announcement 8/8、favorites 8/8、toc ok、search 7/7、故意挂起脚本看门狗 45s 终止且无孤儿 Chrome/端口。
- **注意**：`.tmp-scripts/` 为 gitignore 临时目录（harness/runner/serve-static 与验证脚本；本会话一次性扫描/日志/备份产物已清理）；T1 第 2 批回滚：`git revert 128ef20 f0fd74e 788786c cc5ad43`（由新到旧），T1 第 1 批回滚：`git revert 4185be4`。
- **2026-09-18 移动端修复链（commits `a67e3bb`/`e4864b1`/`f3c41e2`/`cd5d5b6` + 待提交）**：Mermaid 多图并发串位（改 `__mmSeq` 串行）；灯箱按钮被 `.lb-stage` 覆盖（z-index+pointer-events+定点缩放公式重写）；移动端整页缩小（`.hero::before` 辉光撑宽 390→436 布局视口，`left/right:0` + 移动端隐藏头部社交区）；中英区分（i18n URL 前缀优先、切换路径拼接、disclaimer slug、4 英文页 + 301、页脚 `titleEn/htmlEn`、底栏 `bottomNav` 词条、表格横滚）；底栏 `href` 补 `langPrefix`、浮动控件层级重排（4/7.4/10.8/14.2rem + body 预留）、`.dock-ring` 去点击、小型链接点按扩展、`mobileBottomNav` label 配置键。回归：`verify-buttons` 44/44、`verify-mobile` 46/46、`verify-lightbox-ui` 14/14、`verify-mermaid-render` 20/20。仍未推送远端。
