# S-ynapse 全仓审查报告（只读）

## 基线

| 项 | 值 |
|---|---|
| 版本 | v1.2.1 |
| HEAD | `fb0bc11`（`main` 与 `origin/main` 一致） |
| 跟踪文件 | 429 |
| 工作区 | 仅 `.gitignore` 有本地改动（会话前既有，未纳入本次审查范围，未修改） |
| 审查日期 | 2026-11-13 |

## 范围

构建编排与纯函数库（`scripts/`）、前端运行时（`js/`）、边缘 Worker 与 CSP（`workers/`、`security.json5`）、配置单一事实源与门禁（`site.json5`、`features.json5`、`guard.json5`、`scripts/check-*.js`、`docs/config-switch-matrix.md`）、CI/发布流水线（`.github/workflows/`、`scripts/release-*.js`）、文档一致性（`docs/`）。

## 方法

源码逐处静态读证（`文件:行` + 代码摘录）＋ 纯函数单行复现（只 `require` 纯函数与读取配置，不落盘、不构建）＋ 门禁脚本自身逻辑核对。

## 严重度定义

| 级别 | 定义 |
|---|---|
| P1 | 安全绕过、生产可用性、数据丢失、发布资产丢失 |
| P2 | 明确功能缺陷或门禁失效 |
| P3 | 文档漂移或低影响边界 |

## 未覆盖项

- 真实浏览器性能与无障碍复测（本机未执行 `serve`/`dev`）。
- Cloudflare 线上探测（Pages 子域是否公开、Worker 实际路由未验证）。
- 依赖漏洞扫描（未执行 `npm audit`，与「不得跑 install/build」的只读约束一致）。

---

# §1 P1（8 条）

**R-01 [P1] `--out` / `SYNAPSE_OUT_DIR` 未校验，`setupDist` 递归删除目标目录**

- `证据`：`scripts/lib/output-dir.js:16-29` 只做 `path.resolve` 并统一返回 `custom: true`，无任何与源目录/根目录的重叠校验；`scripts/build/media.js:23-28` 在 `config.site.build.cleanDist` 为真时执行 `fs.rmSync(ctx.distDir, { recursive: true, force: true })`；`cleanDist` 默认 `true`（`scripts/lib/site-defaults.js:52`）；`scripts/build/context.js:112` 直接取该解析结果作为 `DIST_DIR`。解析优先级为 `--out` > `SYNAPSE_OUT_DIR` > `internals.paths.outDir` > 默认 `dist`（`output-dir.js:20-27`）。
- `事实与影响`：`--out .` 解析为仓库根，`--out articles` 解析为文章源目录，`SYNAPSE_OUT_DIR=$PWD` 同理；阶段 2 会递归删除该目录 → 删掉整个工作树（含 `.git`、`articles/`、`templates/`）或删掉全部文章源，不可恢复。输出目录与 `articles/ templates/ static/ js/ media/ videos/ pages/ assets/` 的重叠没有任何拦截。
- `复核`：见 §5 R-01，实测 `{ dir: 'D:\\administrator\\Documents\\project\\S-ynapse', custom: true }`。
- `修复方向（不实施）`：在 `resolveOutputDir` 或 `setupDist` 执行前拒绝等于根目录、根目录祖先、或与上述源目录任一重叠的路径，并以 `[FATAL]` 退出。

置信度：high

**R-02 [P1] 软导航进入搜索页后搜索页完全不可用**

- `证据`：`js/core/soft-nav.js:158` `curWrap.innerHTML = nextWrap.innerHTML;`（`innerHTML` 插入的 `<script>` 不执行）；搜索页初始化全部位于 `templates/search.ejs:11-51` 的内联 `<script>`，其中 `:39-41` 是**唯一**调用 `deferred.load('search-page')`（或 `--no-bundle` 下原生 `import()`）的位置；`js/core/deferred.js:6,37` 注册了 `search-page`，但 `js/core/main.js` 全文无 `search-page` 字样；页头搜索图标（`templates/layout.ejs:140`）是普通 `<a href="…search/">`，无 `data-no-soft-nav`；`<%- body %>` 位于 `.content-wrapper` 内（`templates/layout.ejs:170,185`）。
- `事实与影响`：点击页头搜索图标被软导航接管后，搜索页只剩静态提示：`#searchPageInput` 无监听、`?q=` 直达无效、pagefind 模式同样不初始化，`deferred` 注册的 `searchPageInit`（`js/domains/features/search-page.js:6`）没有任何在页入口可被触发。必须整页刷新才恢复。
- `复核`：`grep -rn "search-page" js/core/main.js` → 无命中；`grep -rn "search-page" js/core/deferred.js` → `:6,37`；`sed -n '11,51p' templates/search.ejs` 可见内联脚本及其唯一 `load('search-page')` 调用；`grep -n "search-toggle" templates/layout.ejs` → `:140` 无 `data-no-soft-nav`。
- `修复方向（不实施）`：交换后按 `#searchPageInput` 特征动态 `load('search-page')` 并初始化（把内联逻辑迁入模块），或在软导航中重放内容区脚本。

置信度：high

**R-03 [P1] 主题预设运行时注入的 `<style>` 无 CSP nonce，生产下换肤被整条拦截**

- `证据`：`js/domains/features/theme-presets.js:1` 创建 `style#ssPreset` 并 `sl.textContent = css`，全程不设置 `nonce`；`security.json5:66` 的 `style-src` 为 `["'self'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"]`，无 `'unsafe-inline'`，且 `:59-63` 注释明确「内联 `<style>` 一律以构建期 nonce 放行」；`scripts/build/security-files.js:114-124` 的 `applyCspNonce` 在构建期从 `script-src`/`style-src` 移除 `'unsafe-inline'` 并追加 `'nonce-…'`；仓库内唯一正确的写法是 `js/domains/core/seamless-nav.js:82` `s.nonce = nonceEl.nonce || …`。
- `事实与影响`：脚本创建的 `<style>` 需元素级 nonce 才被 `style-src-elem` 放行；生产环境点击调色板只写入 localStorage 与 `.active` 样式，颜色不变，`applyPreset(saved)` 的恢复路径同样失效。`js/domains/guard/copy-guard.js:13-15`、`js/domains/guard/selection-guard.js:16-18` 的动态样式同因失效。本地预览不注入 `_headers` CSP，故本地点检看不到。
- `复核`：`grep -rn "\.nonce" js/` → 仅 `js/domains/core/seamless-nav.js:82`；`grep -n "style-src" security.json5` → `:66` 无 `'unsafe-inline'`。
- `修复方向（不实施）`：插入前从 `document.querySelector('script[nonce]')` 取 nonce 赋给 `sl.nonce`（复用 `seamless-nav.js:82` 的做法），或把预设 `:root` 规则改为构建期输出。

置信度：medium-high（浏览器执行未复测；机制与配置注释一致）

**R-04 [P1] `deploy.yml` 把提交信息内插进 `run:`，可被外部贡献者注入命令**

- `证据`：`.github/workflows/deploy.yml:27-34` 的 `run: >-` 脚本中直接出现 `--commit-message "${{ github.event.head_commit.message }}"`（`:34`）；触发条件 `push: branches: [main]`（`:3-5`）；该 `preflight` job 持有 `actions: read`、`contents: read` 与 `GITHUB_TOKEN`（`:15-30`），并产出 `skip`/`reason` 输出供后续 job 的 `if:` 判定（`:18-20`、`:83`）。
- `事实与影响`：GitHub 表达式在交由 bash 解析前做纯文本替换；PR 以 squash/rebase 合入后，提交信息由 PR 标题/正文构成（贡献者可控），下一条 push 即在 `preflight` job 内执行其载荷，并可改写 `$GITHUB_OUTPUT` 的 `skip` 使 `build`/`deploy` 被跳过或放行。令牌为只读，但命令执行本身已越界。
- `复核`：`sed -n '27,35p' .github/workflows/deploy.yml` 可见 `:34` 的内插；`git log -1 --format=%B` 可见合入提交即 PR 标题/正文。
- `修复方向（不实施）`：提交信息经 `env:` 传入并在脚本内引用 `"$COMMIT_MESSAGE"`（`--head`/`--event` 同理）。

置信度：high

**R-05 [P1] 并发发布互删 Release（prune 为列举后删除，工作流无 `concurrency`）**

- `证据`：`.github/workflows/release.yml:186-190` 发布成功后执行 `node scripts/release-prune.js --keep "$GITHUB_REF_NAME"`；`scripts/release-prune.js:48-51` `selectObsoleteTags` 返回除 keep 外的全部 tag；`release.yml:16-17` 授予 `contents: write`；`.github/workflows/` 全部工作流均无 `concurrency:` 声明。
- `事实与影响`：两次 tag 推送（或同一多 ref push）并行时，A 创建→B 创建→A 清理删 B→B 清理删 A，最终零 Release 且两边全绿；刚发布的 zip、notes、SHA-256 一起丢失，tag 保留但需手工重建 Release。
- `复核`：见 §5「concurrency」实测 `无 concurrency`；`sed -n '186,190p' .github/workflows/release.yml`。
- `修复方向（不实施）`：workflow 级 `concurrency: { group: release, cancel-in-progress: false }`。

置信度：high

**R-06 [P1] 双发布面：CI 只发 Pages，Worker 专属控制全部失效；且 Worker 名文档与配置不一致**

- `证据`：`.github/workflows/deploy.yml:115-124` 在 `main` 上执行 `npm run deploy:pages`（缺 `CF_API_TOKEN` 时静默跳过）；`package.json:48` `deploy:pages` → `scripts/deploy-pages.js:46-51` → `wrangler pages deploy <workerAssetsDir> --project-name=<internals.deploy.pagesProject>`，`internals.json5:168` 为 `s-ynapse`；`workers/wrangler.toml:1` `name = "s-ynapse-security"`，无 `routes`/`custom_domain`，且 `[env.production]` 只设 `vars`、**不覆盖 `name`**，执行 `npm run deploy:worker`（`package.json:49`）实际部署到 `s-ynapse-security`；`real-site/workers/wrangler.toml:1-13` 才是 `name = "blog"` + `[env.production].name = "blog"`；`docs/architecture.md:15,147` 与 `docs/runbook/rollback.md` 均称生产 Worker 为 `blog` 且指示用 `workers/wrangler.toml --env production` 部署。
- `事实与影响`：同一份 `dist` 同时存在于 Pages 项目与 Worker 资产；限流、路径 403、维护模式、HTTP→HTTPS 只在 Worker 生效，Pages 主机名上全部缺失（`_headers` 仅覆盖 CSP/安全头）。另外按文档在根仓库执行 `wrangler deploy` 会指向 `s-ynapse-security` 而非文档所述 `blog`，运维按文档操作会部署到错误 Worker。
- `复核`：见 §5 R-06 读取的两份 `wrangler.toml`；`sed -n '115,124p' .github/workflows/deploy.yml`；`grep -n "blog" docs/architecture.md` → `:15,147`。
- `修复方向（不实施）`：二选一并写入 runbook——CI 停止发布 Pages（仅 Worker），或把 Pages 设为 preview-only 并关闭公开子域；用 `routes`/`custom_domain` 固化生产路由；统一 Worker 名单源（`[env.production].name` 与文档一致）。

置信度：high（配置事实）／ medium（Pages 子域是否公开，需线上核实）

**R-07 [P1] 外链 `featuredImage` 触发预校验错误并中止构建**

- `证据`：`scripts/lib/content-validate.js:232-237` 把 `attrs.featuredImage` 无条件塞进 `refs` 并调用 `mediaExists`；`:63` 只把 `/media/` 前缀视为站内媒体；`scripts/build.js:189-199` 预校验有任何错误且未 `--allow-degraded` 即 `abortBuild`。
- `事实与影响`：`featuredImage: https://cdn.example.com/a.png` 产生非 critical 的 `media` 错误 → 普通构建硬失败；而渲染侧（`buildCardImgAttrs` 回退 `src="<raw>"`）与 CSP（`security.json5:67-68` 的 `img-src https:`，注释写明「便于外链封面」）都按支持外链封面处理。三个模块对同一配置的预期不一致。
- `复核`：见 §5 R-07，实测返回一条 `stage:"media"`、`critical:false` 的错误。
- `修复方向（不实施）`：仅对站内 `/media/…` 引用做存在性校验，绝对/协议相对 URL 跳过。

置信度：high

**R-08 [P1] 限流内存上限 `maxTrackedEntries` 不生效：可无限增长且每请求全表扫描**

- `证据`：`workers/lib/rate-limit.mjs:23` `if (this.map.size > this.maxEntries) this.evict(now, windowMs);`；`evict()`（`:27-37`）只删除已解封或窗口内无命中的条目，无硬淘汰分支。
- `事实与影响`：同一窗口内出现大量不同源 IP 时 `evict` 一条都删不掉，`map.size` 无硬上限；此后每个请求都遍历整表，CPU 线性放大，单 colo 可触发 Worker 内存/CPU 限制（1102），而此时 `_headers` 层没有任何限流兜底。IPv6 `/64` 提供海量源地址。
- `复核`：见 §5 R-08，`maxEntries=3` 下插入 10 个源，实测 `size` 为 `10`（上限未生效）。
- `修复方向（不实施）`：evict 后仍超限则按最早命中/解封时间硬淘汰到上限内，并把全表扫描摊销。

置信度：high

---

# §2 P2（29 条）

**R-09 [P2] `pathRestrictions` 的 `/*`、`/admin*`、`/admin/**` 被静默忽略**

- `证据`：`workers/lib/ip-utils.mjs:144-145` 先 `replace(/\/\*$/, '')` 再 `normalizePath`，`base === '/'` 时 `continue`；`scripts/generate-security-config.js:119-132` 只校验非空字符串与 `/` 前缀，不告警。
- `事实与影响`：`/*` → base `'/'` 被跳过，不拦任何路径；`/admin*`、`/admin/**` 只剥一次 `/*`，无法匹配任何归一化路径。运维按通配语义写配置后线上零拦截，且无任何告警。
- `复核`：见 §5 R-09，实测 `/*` 与 `/admin/**` 均返回 `null`（未拦截），`/admin/*` 正常命中。
- `修复方向（不实施）`：显式支持 `/*`（视为全站），并对不支持的 `*` 形态给出构建期告警或报错。

置信度：high

**R-10 [P2] `security.csp.enabled: false` 在 Worker 侧不生效**

- `证据`：`scripts/build/security-files.js:132` 的 `_headers` 分支尊重 `enabled`；`scripts/generate-security-config.js:149-153` 只投影 `directives/reportOnly/reportUri`，不投影 `enabled`；`workers/security-worker.js:212-225` 只按 `directives` 拼头并在 `:360-361` 覆盖 `_headers` 的同名头。
- `事实与影响`：关闭 CSP 后 `_headers` 不再下发，但 Worker 仍下发完整 CSP——排障用应急开关失效。
- `复核`：见 §5 R-10，`csp.enabled:false` 输入下仍输出 `{"directives":{"default-src":["'self'"]},…}`。
- `修复方向（不实施）`：`enabled !== true` 时输出空 `directives`（Worker 对空对象已返回 `null`）。

置信度：high

**R-11 [P2] security 段缺键即 fail-open：默认值先合并，生成器兜底不可达**

- `证据`：`scripts/lib/site-defaults.js:157-164` 默认 `rateLimiting.enabled:false`、`pathRestrictions:[]`、`forceHttps:false`；`scripts/build/config.js:146` 先 `deepmerge` 默认值再交生成器；`scripts/generate-security-config.js:136,157` 按合并结果取值（`enabled: rl.enabled !== false`、`forceHttps: s.forceHttps === true`）。生成器内 `pathRestrictions` 的 fail-closed 兜底 `[{ path: '/admin/*' }]`（`:119-132` 的 else 分支）因默认值已填入 `[]`（`Array.isArray` 为真）而**永不可达**。`skipPaths` 缺键被写成 `[]`（`generate-security-config.js:148-150`），而 Worker 侧缺键语义是 `DEFAULT_SKIP_PATHS`（该常量定义在 `workers/security-worker.js:18`，不在 `workers/lib/security-fallbacks.js`）。
- `事实与影响`：删除 `rateLimiting.enabled` / `forceHttps` / `pathRestrictions` 后得到「限流关、不跳 HTTPS、无受限路径」的 Worker 配置且无告警；`skipPaths` 被写成 `[]` 表示「统计所有请求」，与 Worker 内置跳过静态资源的语义相反。fail-closed 仅在 `security-config.js` 整体缺失时成立。
- `复核`：见 §5 R-11，实测默认值 `false false []`；`grep -rn "DEFAULT_SKIP_PATHS" workers/` → 仅 `workers/security-worker.js:18,31,82`。
- `修复方向（不实施）`：`site-defaults` 的 security 段与 Worker 兜底同源同值，或用 `undefined` 判定缺键回落到 fail-closed 兜底。

置信度：high

**R-12 [P2] 被 gitignore 的 `workers/security-config.js` 可带夹具/旧 nonce 上线**

- `证据`：`.gitignore:81` 忽略该文件；`scripts/security-worker.test.js:119-130` 在 `before` 里直接覆写真实文件（`fs.writeFileSync(CONFIG_PATH, …)`），仅在 `after` 恢复；`package.json:49` `deploy:worker` 为 `wrangler deploy --config workers/wrangler.toml --env production`，不构建不校验；`workers/security-worker.js:66-71` 动态 import 该文件，缺失时退回无 nonce 的 `FALLBACK`。
- `事实与影响`：`npm test` 被 SIGINT/超时中断后工作区残留夹具（限流阈值 3、无 nonce 的 `script-src`）；随后 `npm run deploy:worker` 会把夹具推上生产 → 全站内联脚本/样式被 CSP 拦截且限流阈值错误。部署前无「`dist/_headers` nonce 与 Worker 配置一致」的断言。
- `复核`：`grep -n "security-config" .gitignore` → `:81`；`sed -n '119,130p' scripts/security-worker.test.js`；`grep -n "deploy:worker" package.json` → `:49`。
- `修复方向（不实施）`：测试改用独立路径/环境变量注入；`deploy:worker` 增加 nonce 一致性与文件存在断言。

置信度：high

**R-13 [P2] 增量构建复用页面时不会应用本轮 cacheBust 重命名，改动过的图片保持旧字节**

- `证据`：`scripts/build/minify.js:759-779` 只对「稳定名」建映射（`/media/x.webp → /media/x.<new>.webp`）并改写磁盘上的 HTML；`scripts/build/pages.js:610-642` 指纹命中（模板摘要 + `stableSerialize(data)`）即跳过写页；媒体产物使用稳定名（`scripts/build/media.js:211-231`）；页面数据不含媒体字节（`getMediaEntry` 在渲染期读取 manifest，`pages.js:42-48`）；增量仅在 watch 或显式 `--incremental` 启用（`scripts/lib/incremental.js:97-117`）。
- `事实与影响`：图片内容变化但尺寸不变时页面指纹不变 → 旧 HTML 保留 `/media/x.<old>.webp`，新映射键是稳定名，匹配不上；旧哈希文件仍在盘上，预览/增量产物持续显示旧图，新文件成为孤儿。全量构建不受影响。
- `复核`：静态读证（上述四处）。手工复现需 `npm run dev`，本次只读审查未执行。
- `修复方向（不实施）`：把 bust 映射摘要或媒体 manifest 摘要并入页面指纹；或对本轮复用页重放当前映射并清理旧哈希变体。

置信度：high

**R-14 [P2] CI 导出的 `SYNAPSE_OUT_DIR` 把标准构建判成「自定义输出」，`workers/security-config.js` 静默不生成**

- `证据`：`scripts/ci-env.js:16` 导出 `SYNAPSE_OUT_DIR=<root>/dist`；`scripts/lib/output-dir.js:22,28` 只要来自 env 即 `custom: true`；`scripts/build.js:354-357` 仅在 `!custom` 时写 Worker 配置；`.github/workflows/deploy.yml:95-96` 在 `build` job 内先执行 `node scripts/ci-env.js`。
- `事实与影响`：CI 的目录恰等于默认 `dist`，日志却打印「自定义输出目录构建：跳过 workers/security-config.js 写入」；由该环境构建后执行 `deploy:worker` 会得到无 nonce/旧 nonce 的 Worker 配置。与 R-12 叠加即为生产 CSP 失效路径。
- `复核`：见 §5 R-14，实测 `SYNAPSE_OUT_DIR=<root>/dist` 下返回 `custom: true`。
- `修复方向（不实施）`：按解析后的绝对路径是否等于 `<root>/dist`（或 internals 的 `workerAssetsDir`）判定 `custom`，而非「是否显式提供」。

置信度：high

**R-15 [P2] watch 模式：初始构建绕过 `building` 守卫，可与重建并发**

- `证据`：`scripts/build.js:498-510` `rebuild()` 内才置 `building = true`；`:532-534` 初始 `build()` 直接调用（`build().catch(…)`），未置位。
- `事实与影响`：首轮构建期间保存任一被监听文件即进入 `rebuild()`（`building === false`），同一进程并发跑两轮 build，共享 `BUILD_ERRORS`、`INCREMENTAL_CTX`、媒体闭包并写同一 `dist/` 与 `.build-cache.json`；产物可混合两版状态，缓存条目可能与最终 HTML 不一致，后续增量跳过错误页面。
- `复核`：读 `scripts/build.js:490-539`。手工复现需 `npm run dev`，未执行。
- `修复方向（不实施）`：初始构建也走 `rebuild()`，或在首轮 `await build()` 前置位并在同一尾部释放。

置信度：medium

**R-16 [P2] watch 不监听 `data/`，每日一言等数据改动不触发重建**

- `证据`：`scripts/build.js:512-522` 的 `watchPaths` 只含 `articles/ templates/ static/ media/ videos/ assets/ pages/` 与根级 `*.json`、`*.json5`；默认引语来源为 `data/quotes.json5`（`scripts/build/helpers.js:80`，`:71-110` 的读取链）。
- `事实与影响`：`npm run dev` 下编辑 `data/quotes.json5`（或自定义 `data/*.json5`）无任何重建/提示，需改动其他文件才生效。
- `复核`：`sed -n '512,522p' scripts/build.js`（无 `data` 项）；`grep -n "quotes" scripts/build/helpers.js` → `:80` 默认 `data/quotes.json5`。
- `修复方向（不实施）`：`watchPaths` 增加 `data/**/*`。

置信度：high

**R-17 [P2] 单张 OG 图失败使整个构建非零退出，与「continuing build」日志矛盾**

- `证据`：`scripts/build.js:342-345` 记录失败时未传 `{ fatal: false }`；`scripts/lib/build-errors.js:16-21` 默认 `fatal: true`；`scripts/generate-og.js:642` 任一封面失败即 `process.exitCode = 1`；同类资源降级路径 `scripts/build/media.js:240`、`scripts/build/minify.js:656` 都显式标非致命。
- `事实与影响`：`npm run build` 在 `dist/` 已完整生成后返回非零，CI 聚合门禁与部署因此拒绝发布一个仅缺一张 OG 的站点。
- `复核`：`sed -n '342,345p' scripts/build.js`；`sed -n '16,21p' scripts/lib/build-errors.js`；`sed -n '636,648p' scripts/generate-og.js`。
- `修复方向（不实施）`：OG 失败按非致命记录（或 `generate-og` 仅致命错误非零）。

置信度：medium-high

**R-18 [P2] 协议相对外链（`//evil.example`）绕过外链警告/黑名单/新标签策略**

- `证据`：`js/domains/core/external-link.js:74` 在 `new URL()` 与同源判断之前对 `h[0] == '/'` 直接 `return`；`scripts/lib/utils.js:254-260` 的 sanitize 允许 `allowProtocolRelative: true`，正文可产出 `href="//evil.example/x"`。
- `事实与影响`：`//host` 与 `/\host` 被当作站内链接，点击直接跳转，`site.externalLinkWarning` 的黑名单拦截与确认弹窗、`whitelistNewTab` 全部跳过；软导航因跨源回退整页跳转，无任何提示。实测 `new URL('//evil.example/x','https://site/').origin` 为 `https://evil.example`，即解析后确实是跨源。
- `复核`：见 §5 R-18；`sed -n '70,78p' js/domains/core/external-link.js`。
- `修复方向（不实施）`：先解析 `new URL(h, location.href)`，按 `u.origin !== location.origin` 分流；仅保留 `#`/`mailto:`/`javascript:` 的早退。

置信度：high

**R-19 [P2] 点击搜索结果时搜索浮层不关闭，内容在浮层后静默替换**

- `证据`：`js/domains/features/search.js:410-414` 仅在点击遮罩自身时关闭；结果项是普通 `<a class="search-result-item">`（`:266-268`），无 click 处理；`js/core/soft-nav.js:240-247` 在捕获阶段 `preventDefault()` 并调 `go()`；`#searchOverlay` 在 `templates/layout.ejs:148`，位于内容区之外。
- `事实与影响`：首次点击结果时 URL 与正文已切换，但浮层、结果列表、滚动位置原样保留，用户感知为「点了没反应」；再点同一结果因同路径才整页刷新。
- `复核`：`sed -n '405,418p' js/domains/features/search.js`；结果点击路径无 `closeSearch()` 调用。
- `修复方向（不实施）`：结果链接委托点击先 `closeSearch()`，或把关闭动作注册进 `__SOFTNAV_HOOKS__`。

置信度：high

**R-20 [P2] 软导航切换语言后 `<html lang>` 与内容区外文案仍是旧语言**

- `证据`：`js/domains/core/i18n.js` 的 `syncAfterSwap()` 只写 `data-lang` 与按钮文案，不调用 `apply()`、不写 `<html lang>`；`js/core/soft-nav.js:137-150` 的 `syncHead` 只同步 title/meta/link（实测确认：`document.title`、`name`/`property` meta、canonical/hreflang/feed/ld+json，无 `<html lang>`）；`js/domains/features/tts.js:32` 以 `document.documentElement.lang` 选音。
- `事实与影响`：文章页点「中/EN」后正文已换语言，但 `<html lang>` 未变 → 搜索浮层占位、`#navToggle`/`#lightbox`/`#kbdHintBtn` 的 aria/title、TTS 选音、读屏语音仍是旧语言。
- `复核`：`grep -rn "setAttribute('lang'" js` → 无命中；`sed -n '136,150p' js/core/soft-nav.js`。
- `修复方向（不实施）`：`syncAfterSwap` 内按目标文档更新 `<html lang>` 并调用 `apply()`。

置信度：high

**R-21 [P2] 移动端目录按钮/抽屉不随软导航重建**

- `证据`：`templates/layout.ejs:226` 的 `#mTocBtn`/`#mTocDrawer` 由首屏 `article.toc` 渲染，位于 `.content-wrapper`（`:170` 开，`:199` 闭）之外；`js/domains/core/toc.js:46-48` 在找不到 `.toc-sidebar-list` 时提前 return。
- `事实与影响`：文章页 → 首页软导航后浮动目录按钮仍在，点开是上一页章节、锚点失效；首页 → 文章页则完全没有按钮，移动端失去目录入口，直到整页刷新。
- `复核`：`grep -n "mTocBtn\|m-toc-btn" templates/layout.ejs templates/site-css.ejs`；`sed -n '44,49p' js/domains/core/toc.js`。
- `修复方向（不实施）`：由 hook 按当前内容区动态创建/移除该块，或将其移入内容区。

置信度：high

**R-22 [P2] 软导航后文章页「封面样式」选择器失效**

- `证据`：`js/domains/features/cover.js:1-8` 在 init 时一次性抓取 `.cover-strip`/`.post-featured-image`；`:37-45` 用 `strip.dataset.coverBound` 防重复，但只给当时那个节点绑 click；全文件无 `__SOFTNAV_HOOKS__`；`:47` 暴露 `window.__coverApplyDefault`，全仓无调用者。
- `事实与影响`：软导航进入文章页（或 A→B）后，封面缩略图点击无反应，`preferImage=false` 的默认样式也不应用到新文章。
- `复核`：`grep -n "__SOFTNAV_HOOKS__\|__coverApplyDefault" js/domains/features/cover.js` → 无 hook，仅 `:47` 定义。
- `修复方向（不实施）`：改文档级事件委托并每次重取节点，或注册 hook 重新执行 `applyDefault()`。

置信度：high

**R-23 [P2] `reading.js` 每次软导航都给常驻 `#rp`/`#btt` 重复绑定监听器**

- `证据`：`js/domains/core/reading.js:135-148` 对 `S.bar` 逐个 `addEventListener` 且无幂等标记；`:220-224` `init()` 先 `bind()` 又把 `bind` 推入 `__SOFTNAV_HOOKS__`（`:223`）；`#rp` 在 `templates/layout.ejs:102`，位于内容区之外。
- `事实与影响`：监听器随导航次数线性增长；`prefers-reduced-motion`/省流/关闭滚动动画时进度条方向键一步跳 N×步长（N = 导航次数），并持续泄漏。
- `复核`：`sed -n '132,148p' js/domains/core/reading.js`；`sed -n '218,225p' js/domains/core/reading.js`。
- `修复方向（不实施）`：常驻节点加 `data-bound` 幂等标记，`bind()` 只刷新引用与配置态。

置信度：high

**R-24 [P2] 搜索历史 localStorage 非数组值会让搜索永久只报错不出结果**

- `证据`：`js/domains/features/search.js:323-326` `getHistory()` 只 `try/catch` JSON 语法；`:332` 对返回值直接 `.filter`；`saveHistory(q)` 在渲染前调用（`:214`）。
- `事实与影响`：键值为合法 JSON 但非数组（对象/字符串/数字）时 `.filter` 抛 TypeError，异常穿出防抖搜索函数，结果区既不渲染也不显示错误；清空存储前该访客搜索一直不可用。同级模块（favorites/reading-history/continue-reading/read-position）均做了类型校验。
- `复核`：`sed -n '318,340p' js/domains/features/search.js`。浏览器复核需真实 `localStorage` 注入，本次未执行。
- `修复方向（不实施）`：`getHistory()` 用 `Array.isArray` 校验并按字符串元素过滤。

置信度：high

**R-25 [P2] 配置外置加载失败时阅读历史写入 `localStorage["undefined"]`**

- `证据`：`js/domains/features/reading-history.js:4` `var KEY = String(F.storageKey)` 无回退；降级子集只内联 `features.guards`（`scripts/lib/config-split.js:55-61`）；`js/core/runtime.js:18` 的 `applyCrit` 把 `__FEATURES__` 置为 `{features:{guards}}`。
- `事实与影响`：配置 404/超时后 `features.readingHistory` 为 `{}`，`enabled === false` 判定通过，`KEY` 变为 `"undefined"`；降级期间的历史写入无效键，恢复后「继续阅读」为空且脏键永久残留。
- `复核`：`sed -n '1,8p' js/domains/features/reading-history.js`；`sed -n '55,62p' scripts/lib/config-split.js`。
- `修复方向（不实施）`：`String(F.storageKey || 's-history')`，与 `continue-reading` 同源同键。

置信度：high

**R-26 [P2] 配置响应缓慢时无遮罩且关键交互最长僵死 `configTimeoutMs`（默认 3s）**

- `证据`：`js/core/boot.js:64-72` 先 `await window.__CONFIG_READY__`；`:102-124` 才创建加载遮罩；`templates/layout.ejs:97` 注入 `__CONFIG_TIMEOUT__`；`js/core/runtime.js:22` 的超时兜底是唯一出口；`boot-overlay` 只有 CSS，无静态标记。
- `事实与影响`：弱网/边缘抖动但未失败时，首屏已渲染，而主题、导航、i18n、TOC、软导航等关键队列全部排在 await 之后，遮罩也尚未创建；最长 3 秒内移动菜单、明暗切换、目录折叠、代码复制全部无响应且无任何加载提示。
- `复核`：`sed -n '64,110p' js/core/boot.js`；`grep -n "boot-overlay" templates/layout.ejs` → 仅 CSS 有样式。
- `修复方向（不实施）`：await 之前先输出静态遮罩或按注入默认值创建，配置就绪后再按 `features.loading` 调整。

置信度：high

**R-27 [P2] slug 校验大小写敏感：大写保留路由与仅大小写不同的重复 slug 均可通过**

- `证据`：`scripts/lib/content-validate.js:201` `RESERVED_ROUTE_SEGMENTS.includes(identity.slug)`（列表全小写）；`:213` 去重键为 `lang + '/' + slug` 原样；`scripts/lib/utils.js:90` 的 slug 规则允许 `A-Z`；页面按原样写入 `lang/slug/index.html`（`scripts/build/pages.js:801`），标签页在其后写 `lang/tags/index.html`（`:811`）。
- `事实与影响`：`slug: Tags` 通过校验，在 Windows/macOS 默认文件系统上与 `dist/<lang>/tags/` 同目录，标签页覆盖文章页；`Hello` 与 `hello` 也被当作两条文章，Windows 上互相覆盖。Linux CI 看不到，构建报告成功。
- `复核`：见 §5 R-27，`slug:'Tags'` + `Hello` + `hello` 三条输入实测返回 `[]`（零错误）。
- `修复方向（不实施）`：保留输出用原 slug，但保留路由比较与去重键统一 `toLowerCase()`。

置信度：high

**R-28 [P2] `sanitizeSvg` 漏检斜杠分隔事件属性与命名空间 `<script>`**

- `证据`：`scripts/lib/content-policy.js:133-136` 的检测与 `:142` 的删除都要求 `\s` 分隔；`:146` 之后返回 `safe: true` 原样内容；`scripts/build/media.js:109-115` 会把该 SVG 原样发布到 `/media/`，不再记 `svg-unsafe`。
- `事实与影响`：`<svg/onload=…>`、`<svg:script>` 不被识别，以同源顶层打开该 URL 时脚本可执行（`<img>` 嵌入不执行）。当前 CSP 的 nonce-only `script-src` 会拦内联处理程序，属纵深防御被绕过而非直接 CSP 逃逸。
- `复核`：见 §5 R-28，两种载荷实测均返回 `{"safe":true,...}`。
- `修复方向（不实施）`：事件属性检测允许 `/` 分隔；显式拒绝 `[a-z0-9]+:script`；补测试表。

置信度：high（行为）／ medium（可利用性）

**R-29 [P2] `contentPolicy.enabled: false` 时资产/视频/非 sharp 媒体被整体跳过而非原样复制**

- `证据`：`scripts/build/media.js:64-67` 在 `enabled === false` 时打印「Content policy disabled」并直接 `return { copied: 0, blocked: [] }`，而 `copyProtectedAssets`（`:90-121`）是 assets/videos/非 sharp 媒体的唯一拷贝路径；`scripts/lib/content-policy.js:77` 对关闭态返回 `rejected('content-policy-disabled')`；`content-policy.json5:15` 文档称「false 时三目录策略整体停用（内容照常复制，不做白黑名单判定）」。
- `事实与影响`：关闭策略后 `assets/`、`videos/`、`media/` 下 svg/gif/avif/bmp/ico/heic 等全部 404；只有 sharp 处理的位图仍出现在产物中。日志只说明策略关闭，不提示文件被跳过。
- `复核`：`sed -n '60,70p' scripts/build/media.js`；`sed -n '13,20p' content-policy.json5`。
- `修复方向（不实施）`：关闭态改为三目录原样复制，或让 `classifyFile` 在关闭态一律 `allowed: true`。

置信度：high

**R-30 [P2] `formatDate` 对 date-only 值用本地 getter，UTC 以西时区日期退一天**

- `证据`：`scripts/lib/utils.js:17` `d = new Date(rawStr)`（date-only 按 UTC 解析）；`:22-23` 用 `getFullYear/getMonth/getDate`（本地时区）；归档分组同源（`scripts/build/articles.js:331-332` 同样用本地 getter）。
- `事实与影响`：`TZ=America/New_York` 下 `formatDate('2026-07-19','YYYY-MM-DD')` 返回 `2026-07-18`；卡片、文章头、404 推荐、归档年份/月份在负时区构建机上全部偏移，产物随构建机时区变化。
- `复核`：见 §5 R-30，实测 `2026-07-18`。
- `修复方向（不实施）`：date-only 输入改用 UTC getter（或统一 UTC 基准）。

置信度：high

**R-31 [P2] 媒体变体解析器期望 `variants/` 布局，构建实际输出同目录 `-<width>` 命名**

- `证据`：`scripts/lib/content-validate.js:7` `VARIANT_RX = /(?:^|\/)variants\/(.+)-(\d+)\.(?:webp|avif|jpe?g|png)$/i`，`:67-72` 据此回映射；同一文件 `:9` 另有正确的 `OUTPUT_VARIANT_RX`，但只被 `createBrokenMediaMatcher`（`:108`）使用，`createMediaResolver` 未用；构建写 `media/<dir>/<name>-<width>.<ext>`（`scripts/build/media.js:211,222`）；测试固化了错误布局（`scripts/lib/content-validate.test.js:48-50`、`scripts/lib/paths.fuzz.test.js:230-232`）。
- `事实与影响`：手写引用 `/media/photo-640.webp`（真实产物路径）被判「missing media」并触发预校验失败；`/media/variants/photo-640.webp` 反而通过但永远 404。
- `复核`：见 §5 R-31，实测真实路径 `false`（判缺失）、`variants/` 路径 `true`（判存在）——两者与磁盘事实完全相反。
- `修复方向（不实施）`：让 `createMediaResolver` 复用同文件的 `OUTPUT_VARIANT_RX`（与 `createBrokenMediaMatcher` 同源），并同步两条测试。

置信度：high

**R-32 [P2] 搜索索引预计算的哈希 URL 与 cacheBust 的跳过集不一致**

- `证据`：`scripts/lib/search-index.js:112-127` 只跳过 `assets/`、`og/` 前缀、`node_modules/` 与已带哈希名（`HASHED_NAME_RE`，`:126`）；`scripts/build/minify.js:759` 还跳过 `og` 作为中间路径段、`assets` 中间段、SW 基名与 PWA 图标 basename（`:755-758`）。
- `事实与影响`：当 `featuredImage` 与 PWA 图标/SW 同名（或位于 `media/og/…`）时，索引写入 `/media/logo.<md5>.png`，但该文件从未被重命名、映射里也没有它，构建期改写无法修正 → 搜索结果缩略图 404。
- `复核`：对比 `sed -n '112,127p' scripts/lib/search-index.js` 与 `sed -n '755,762p' scripts/build/minify.js`。
- `修复方向（不实施）`：抽出一个「本轮会被重命名」的判定函数，两处共用。

置信度：medium

**R-33 [P2] 单一事实源门禁的证据由「文本里出现过」构成：marker 注释、同名 token、全文叶子名**

- `证据`：`scripts/lib/config-switch-inventory.js:189-206` 在任意 `*.test.js` 原始行上匹配 `// switch:`，不要求位于 `test()` 内、不要求断言；`:144-167` 建立索引时把注释/字符串一并切词；`:169-187` 只按叶子词打分匹配「既有引用」；`scripts/check-config-docs.js:26-42` 全部 `depth: 2`，`:107-108` 用 `moduleNameOf` 叶子名全文匹配；`scripts/config-refs-allowlist.json:12-25` 对 `site/theme/security/tuning/...` 整段前缀豁免；`scripts/check-config-refs.js:111` 跳过 `GENERIC_KEYS` 与长度 < 4 的键。
- `事实与影响`：`docs/config-switch-matrix.md` 第 19 行 `features.anchorStabilize.enabled` 的证据指向 `scripts/auto-cover.test.js:22`，而该行实际是 `// switch: features.listCover.autoGenerate.enabled, …` 的 marker（第 14 行 `contentPolicy.enabled` 同样引用 `:22`）。因此「全部开关均有覆盖」由门禁自证：新增开关只要叶子名常见或在任意测试文件写一行注释即通过；字符串类配置键在六项门禁中没有任何一项负责其接线。
- `复核`：见 §5 R-33（`sed -n '13,21p' docs/config-switch-matrix.md` 与 `sed -n '18,26p' scripts/auto-cover.test.js` 对照）；`grep -n "GENERIC_KEYS" -A14 scripts/check-config-refs.js`。
- `修复方向（不实施）`：证据匹配限定在 `test()` 回调内含断言的窗口、剔除注释/字符串；docs 按文件章节 + 完整键路径匹配；前缀豁免改为逐键登记。

置信度：high

**R-34 [P2] `check-internals` 用子串判断 deploy.yml，`|| true` / `continue-on-error` 可让聚合门禁静默失效**

- `证据`：`scripts/check-internals.js:88-93` 只做 `deployYml.includes('node scripts/ci-checks.js')` 与 `includes('ci-checks')`，不解析 step 的 `run`/`if`/`continue-on-error`；被检查的聚合步骤在 `.github/workflows/deploy.yml:97-100`。
- `事实与影响`：把聚合步骤改成 `run: node scripts/ci-checks.js || true` 或加 `continue-on-error: true` 后 `verify:internals` 仍 PASS，而 lint/typecheck/测试/配置门禁/安全验证/构建全部不再阻断，后续部署步骤照常执行；这是单一事实源体系唯一的外部锚点。
- `复核`：`sed -n '78,94p' scripts/check-internals.js`；`sed -n '97,101p' .github/workflows/deploy.yml`。
- `修复方向（不实施）`：解析 workflow（如 `js-yaml`）或做精确文本断言，断言该 step 的 `run` 恰为命令且无 `continue-on-error`/`if`。

置信度：high

**R-35 [P2] `release:publish` 复用已存在的 zip 时跳过白名单与版本一致性校验**

- `证据`：`scripts/release-publish.js:78-81` 若 `release-artifacts/S-ynapse-<version>.zip` 已存在则直接使用；`validateReleaseState` 只校验 RELEASE.json（`:65-76`），zip 内容断言 `assertVersionConsistency`/`assertArchiveContents` 分别只在 `resolveVersion`（`scripts/release-archive.js:82`）与 `:151` 内被调用，二者仅在 `archiveRelease()`（`:134`）路径可达。
- `事实与影响`：早先 `--ref HEAD` 产出的 zip 或手工放入的同名文件会被当作受审计的发布附件上传；模块头与 README 声称复用的归档已通过白名单校验，实际未校验条目构成与版本一致。
- `复核`：`sed -n '74,84p' scripts/release-publish.js`；`grep -n "assertArchiveContents" scripts/release-archive.js`（唯一调用点在 `archiveRelease` 内）。
- `修复方向（不实施）`：复用分支也执行条目解析 + 白名单 + 版本断言，或始终重新归档。

置信度：high

**R-36 [P2] `release:mark` 把自跳过的压缩门禁记为已通过**

- `证据`：`scripts/release-mark.js:173-187` 只按退出码判定（`if (result.status !== 0) throw`）；`scripts/verify-compression.js:81-83` 在 `status === 'skipped'` 时 `process.exit(0)`；`scripts/lib/release-notes.js:105-108` 无条件输出 `✅`。
- `事实与影响`：无 Chrome 的机器上压缩对比门禁自跳过，`RELEASE.json.checks['verify-compression']` 仍写 `true`，发布说明无条件打勾；CI 的 gates 步骤同样走跳过分支。发布物声明了一个从未执行的验证。
- `复核`：`sed -n '76,88p' scripts/verify-compression.js`；`sed -n '171,188p' scripts/release-mark.js`。
- `修复方向（不实施）`：跳过时记录 `false`（或读取 `.cache/compression-verify/cli-last.json` 的 status）并让门禁失败/标注 skipped。

置信度：high

**R-37 [P2] `release-notes.yml` 不校验 RELEASE.json，却生成「12 项门禁全部通过」的正文**

- `证据`：`.github/workflows/release-notes.yml:44-56` 仅 `gh release view`、下载 zip、`node scripts/release-notes.js`、`gh release edit`；`validateReleaseState` 全仓只被 `release-publish.js` 及其自身 CLI/测试调用；`scripts/lib/release-notes.js:105-108` 逐项无条件 `✅`、`:185` 输出「发布门禁（12 项全部通过）」（`RELEASE_GATES` 共 12 项，`scripts/lib/release-version.js:14-27`）。
- `事实与影响`：手动补更可对任意 tag（status 非 verified、checks 含 false、未经过发布流水线）重写公开说明，正文仍宣称全绿。
- `复核`：`sed -n '44,58p' .github/workflows/release-notes.yml`；`sed -n '100,110p' scripts/lib/release-notes.js`。
- `修复方向（不实施）`：edit 前调用 `validateReleaseState`，并按 `state.checks` 渲染门禁。

置信度：high

---

# §3 P3（7 条）

**R-38 [P3] nightly 作业超时（120min）短于聚合器最坏预算（23 项 × 600s ≈ 230min）**

- `证据`：`.github/workflows/nightly.yml:43` `timeout-minutes: 120`；`scripts/ci-checks.js:29` `CHECK_TIMEOUT_MS = 600000`、`:62-89` 共 23 项；`.github/workflows/deploy.yml:81-88` 的 `build` job 无 `timeout-minutes`。
- `事实与影响`：慢夜会被平台杀掉，报告写入与 `ci/aggregate` 状态均不执行，`if: always()` 工件也来不及上传，恰好丢失该设计要保留的种子与重放信息。
- `复核`：`sed -n '39,46p' .github/workflows/nightly.yml`；`grep -c "name: '" scripts/ci-checks.js`。
- `修复方向（不实施）`：nightly 超时提到 ≥260min（或降低夜间单项超时），并给 `build` job 显式超时。

置信度：high（算术/控制流）

**R-39 [P3] 所有 `uses:` 锁到可变大版本标签（含 `contents: write` 的发布 job）**

- `证据`：`.github/workflows/*.yml` 全部 `@v4`（`deploy.yml:22,23,39,63,64,89,90,103,110`；`nightly.yml:26,27,48,49,64`；`release-notes.yml:26,31`；`release.yml:24,28,39,43,85,89,95,107,109,113,161,165,170`），无 40 位 SHA 锁定；`release.yml:16-17` 与 `release-notes.yml:18-19` 为 `contents: write`。
- `事实与影响`：上游重指 `v4` 即可在能创建/删除 Release 的 job 内执行第三方代码；仓库对 npm 依赖全部精确锁版本，action 是唯一可变上游引用。
- `复核`：`grep -rn "uses: " .github/workflows | grep -v "@[0-9a-f]\{40\}"` 无 SHA 锁定项。
- `修复方向（不实施）`：锁到 commit SHA（尾部注释版本），由 Dependabot 升级。

置信度：high

**R-40 [P3] compression 排除模式 `**` 与尾随 `/**/` 静默不匹配**

- `证据`：`scripts/lib/compression-config.js:228-230` 先吞掉尾随 `/` 再追加，使裸 `**` 变成 `^(?:/.*)?$`，`assets/**/` 变成 `^assets/(?:.*/)?$`。
- `事实与影响`：`isExcluded('a/b.js',['**'])` 与 `isExcluded('assets/vendor/x.js',['assets/**/'])` 均返回 false，配置看似生效却未排除，压缩仍处理用户想豁免的文件。
- `复核`：见 §5 R-40，实测 `false false`。
- `修复方向（不实施）`：裸 `**` 按 `.*` 处理，尾随 `/**/` 归一化为 `/**`。

置信度：high

**R-41 [P3] 外链警告弹窗用 `innerHTML` 拼接配置文案，与「按纯文本渲染」文档相反**

- `证据`：`js/domains/core/external-link.js:87,100,111` 用 `b.innerHTML = msg + …`（仅 URL 经 `escH`）；`site.json5:1099` 写明消息「不可填 HTML 标签（按纯文本渲染）」。
- `事实与影响`：站点所有者粘贴 HTML 会在同源内被渲染，破坏文档契约；无攻击者可控路径（配置由作者提供）。
- `复核`：`sed -n '84,112p' js/domains/core/external-link.js`。
- `修复方向（不实施）`：文案用 `textContent` 节点拼装，仅 URL 用受控标记。

置信度：high

**R-42 [P3] accessGate 文档漂移：项数 12 vs 14；「永久解锁」实际受 `rememberHours` 限制**

- `证据`：`docs/config-reference.md:1349` 称「accessGate（12 项…」并称 `unlockCodes[]`（`?key=` 永久解锁本机）；`guard.json5:720` 标「14 项」并有 14 个叶子键（`:726-775`）；`js/domains/guard/access-gate.js:20-23` 的 `storeUnlock` 用 `rememberHours` 计算过期时间，`:134` 对 `?key=` 同样调用 `storeUnlock()`；`guard.json5:737` 注释称「推荐 72（0 = 关闭浏览器即失效）」，而代码在 `0` 时给出 `exp = Date.now()`（立即过期）。
- `事实与影响`：按文档配置「永久解锁」或引用 12 项的审计结论都会与实现不符；`rememberHours:0` 的「关闭浏览器即失效」语义与「立即过期」不一致。
- `复核`：`grep -n "12 项\|永久解锁" docs/config-reference.md`；`grep -n "14 项" guard.json5`；`sed -n '18,26p' js/domains/guard/access-gate.js`。
- `修复方向（不实施）`：确定解锁码语义（永久或 TTL），同步 `guard.json5` 注释、配置参考与项数口径。

置信度：high

**R-43 [P3] `core.bypass.localhost` 对 IPv6 回环失效，文档称支持 `::1`**

- `证据`：`js/domains/guard/bypass.js:44-47` 比较 `h === '::1'`；调用方传 `location.hostname`（`js/domains/guard/core.js:22`）；`docs/config-reference.md:1335` 称 `localhost/127.0.0.1/::1` 自动关闭全部防护。
- `事实与影响`：`http://[::1]:port` 下 `bypass.localhost=true` 不生效，与文档承诺不符；默认关闭，生产不受影响。
- `复核`：见 §5 R-43，`new URL('http://[::1]/').hostname` 实测为 `[::1]`（带方括号），永不等于 `'::1'`。
- `修复方向（不实施）`：比较前去除 `[]`，或同时匹配 `[::1]`；补测试。

置信度：high

**R-44 [P3] 架构文档模块计数与实际不符**

- `证据`：`docs/architecture.md:29` 称 `scripts/lib/*.js` 为 76 个文件；`git ls-files 'scripts/lib/*.js'` 实测 78。
- `事实与影响`：目录职责表的规模口径失真，影响后续审计与交接引用。
- `复核`：见 §5 R-44，实测 `78`。
- `修复方向（不实施）`：把 76 更新为 78，并说明是否含测试/子目录口径。

置信度：high

---

# §4 已核对不成立（避免重复审查）

以下曾被怀疑但经读证否决，不列为问题：

| 项 | 结论 | 依据 |
|---|---|---|
| 路径归一化绕过 | 不成立 | `workers/lib/ip-utils.mjs:113-135` 三轮 `decodeURIComponent` + 反斜杠替换 + 重复斜杠折叠 + 点段折叠 + 小写，`/ADMIN/x`、`/%61dmin/x`、`/admin/./x` 均命中 `/admin/*` |
| HTTPS 跳转开放重定向 | 不成立 | `workers/security-worker.js:273-277` 只把 `url.protocol` 改为 `https:`，主机取自请求 URL 本身 |
| 响应头注入 | 不成立 | `scripts/generate-security-config.js:49,55-65` 对头名做 token 正则、对头值拒绝 CR/LF/NUL，`_headers` 与 Worker 共用同一校验 |
| CIDR/IP 解析 | 不成立（fail-closed） | `workers/lib/ip-utils.mjs:91-106` 非法 IP、非法前缀（越界/非整数）、版本不一致、空列表均返回 false；解析器对畸形输入返回 `null` |
| 发布归档越界 | 不成立 | `scripts/lib/release-manifest.js` 默认拒未知路径，`assertArchiveContents` 复核中央目录，未见穿越或凭据 |
| 前端 HTML sink 总览 | 不成立 | `innerHTML` 站点均只输出静态串或对数据字段转义；`js/` 无入站 `postMessage` 监听（仅 `pwa.js:53` 发送 `SKIP_WAITING`）；外部 `window.open` 均带 `noopener`；`templates/` 无内联 `on*=` 属性 |
| pre-commit 钩子可被 `--no-verify` 绕过 | 已缓解 | `check-agents` 在 push 与 PR 两条 CI 路径上都有兜底（`deploy.yml:36-56`） |

---

# §5 附录：复现命令与实测输出

以下命令均为只读（仅 `require` 纯函数 / 读取配置 / 读取工作流文本），在仓库根执行。

```text
# R-01
$ node -e "console.log(require('./scripts/lib/output-dir').resolveOutputDir(['--out','.'], process.cwd()))"
{
  dir: 'D:\\administrator\\Documents\\project\\S-ynapse',
  custom: true
}

# R-07
$ node -e "const{preflightArticles}=require('./scripts/lib/content-validate');console.log(JSON.stringify(preflightArticles([{file:'a.md',lang:'en',attrs:{title:'A',featuredImage:'https://cdn.example.com/a.png'},body:''}],{mediaExists:()=>false}).errors))"
[{"stage":"media","file":"a.md","message":"a.md: references missing media \"https://cdn.example.com/a.png\"","critical":false}]

# R-27（大写保留路由 + 仅大小写不同的重复 slug）
$ node -e "const{preflightArticles}=require('./scripts/lib/content-validate');console.log(JSON.stringify(preflightArticles([{file:'a.md',lang:'en',attrs:{title:'T',slug:'Tags'},body:''},{file:'b.md',lang:'en',attrs:{title:'U',slug:'Hello'},body:''},{file:'c.md',lang:'en',attrs:{title:'V',slug:'hello'},body:''}],{mediaExists:()=>true}).errors))"
[]

# R-08（maxEntries=3，插入 10 个不同源）
$ node --input-type=module -e "import {RateLimiter} from './workers/lib/rate-limit.mjs'; const l=new RateLimiter(3); for(let i=0;i<10;i++)l.check('ip'+i,{maxRequests:100,windowMs:60000,blockDuration:300000}); console.log(l.size)"
10

# R-09
$ node --input-type=module -e "import {isPathBlocked} from './workers/lib/ip-utils.mjs'; console.log(isPathBlocked('/zh/',[{path:'/*'}]), isPathBlocked('/admin/x',[{path:'/admin/**'}]), JSON.stringify(isPathBlocked('/admin/x',[{path:'/admin/*'}])))"
null null {"path":"/admin/*"}

# R-10（csp.enabled:false）
$ node -e "const{extractWorkerSecurity}=require('./scripts/generate-security-config');console.log(JSON.stringify(extractWorkerSecurity({csp:{enabled:false,directives:{'default-src':[\"'self'\"]}}},{},{}).csp))"
{"directives":{"default-src":["'self'"]},"reportOnly":false,"reportUri":"/csp-report"}

# R-11
$ node -e "const{DEFAULT_CONFIG}=require('./scripts/lib/site-defaults');console.log(DEFAULT_CONFIG.security.rateLimiting.enabled, DEFAULT_CONFIG.security.forceHttps, JSON.stringify(DEFAULT_CONFIG.security.pathRestrictions))"
false false []

# R-14（SYNAPSE_OUT_DIR 恰等于默认 dist）
$ node -e "process.env.SYNAPSE_OUT_DIR=require('path').join(process.cwd(),'dist');console.log(require('./scripts/lib/output-dir').resolveOutputDir([], process.cwd()))"
{
  dir: 'D:\\administrator\\Documents\\project\\S-ynapse\\dist',
  custom: true
}

# R-18（协议相对 URL 的真实源）
$ node -e "console.log(new URL('//evil.example/x','https://site/').origin)"
https://evil.example

# R-28
$ node -e "const{sanitizeSvg}=require('./scripts/lib/content-policy');console.log(JSON.stringify(sanitizeSvg('<svg/onload=\"alert(1)\"><rect/></svg>')), JSON.stringify(sanitizeSvg('<svg:script>alert(1)</svg:script>')))"
{"safe":true,"content":"<svg/onload=\"alert(1)\"><rect/></svg>"} {"safe":true,"content":"<svg:script>alert(1)</svg:script>"}

# R-30（负时区构建机）
$ TZ=America/New_York node -e "console.log(require('./scripts/lib/utils').formatDate('2026-07-19','YYYY-MM-DD'))"
2026-07-18

# R-31（真实产物路径 vs variants/ 布局）
$ node -e "const{createMediaResolver}=require('./scripts/lib/content-validate');const r=createMediaResolver(['photo.jpg']);console.log(r('/media/photo-640.webp'), r('/media/variants/photo-640.webp'))"
false true

# R-40
$ node -e "const{isExcluded}=require('./scripts/lib/compression-config');console.log(isExcluded('a/b.js',['**']), isExcluded('assets/vendor/x.js',['assets/**/']))"
false false

# R-43
$ node -e "console.log(new URL('http://[::1]/').hostname)"
[::1]

# R-44
$ git ls-files 'scripts/lib/*.js' | wc -l
78

# R-05（工作流并发保护缺失）
$ grep -rn "concurrency" .github/workflows || echo "无 concurrency"
无 concurrency
```

静态读证命令（R-02/R-03/R-04/R-06/R-12/R-16/R-33/R-34 等）已在各条「复核」行内给出，均为 `sed`/`grep`/`cat` 级只读操作。

## 审查结论

- 阻断项（P1）8 条：R-01（输出目录误删源树）、R-02（软导航后搜索页不可用）、R-03（生产 CSP 拦截换肤）、R-04（工作流命令注入）、R-05（并发发布互删 Release）、R-06（双发布面 + Worker 名不一致）、R-07（外链封面构建失败）、R-08（限流上限失效）。
- 所有 44 条均经复核确认，无条目被证伪而移入 §4；§4 的 7 项为审查中主动排除的候选。
- 本次为只读审查，未修改任何源码、配置、测试或工作流。
