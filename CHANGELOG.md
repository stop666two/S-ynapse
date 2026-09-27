# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **每日一言扩充（数据层）**：新增 `data/quotes.json5`——**100 条**中英双语引语（中文 60 / 西方 40），逐条真实出处（《论语》《道德经》《庄子》《孟子》唐诗宋词、《菜根谭》、莎士比亚/培根/梭罗/爱默生/王尔德/马可·奥勒留等公版经典与 1611 钦定版《圣经》），中文经典的英译由本项目提供并在 `sourceEn` 标注；附 6 条本项目原创。标签固定 9 类枚举（哲思/励志/自然/时间/读书/自由/智慧/幽默/情感），严禁来源不明的网络误传名句。`features.dailyQuote.source='builtin'` 现在优先读取 `dataFile`（默认 `data/quotes.json5`，缺失/加载失败告警并回退代码内置最小集 5 条）；`count` 语义改为「注入池大小」——**0=全部（新默认）**，>0 按稳定顺序取前 N（兼容旧配置 `count: 7`）。新增单测 `scripts/daily-quote.test.js`（14 例：条数/标签枚举与分布/字段非空/text 唯一/中西比例/译文标注、日期稳定、换一句不重复、语言回退链、count 语义、回退告警链、schema 默认值）。
- **每日一言交互（用户可感知）**：侧栏 widget 新增「换一句」（随机下一条、保证不与当前相同、不写存储、键盘可达）与「复制」（剪贴板 API + `textarea` 回退，成功后按钮短暂提示并弹 toast，中英双语 `aria-label`）；文案与数据源配置键 `refreshLabel(En)`/`copyLabel(En)`/`copiedLabel(En)`/`dataFile` 接入 `features.json5`、`features-schema.js`、`docs/config-reference.md`（§3.48 重写 + 新增 §14 `data/quotes.json5` 数据章节）；样式入 `templates/site-css.ejs`（兼容 `card`/`plain`，减少动效安全）；软导航经 `__SOFTNAV_HOOKS__` 重绑并保持已选条目。自收尾 runner `.tmp-scripts/run-daily-quote.js`（端口 3335）**27 断言全绿**：两处展示（首页侧栏 + 文章页文末 DOM 次序）、日期固定、换一句/键盘、复制拦截断言与 toast、en 页英文与英文按钮、暗色对比、减少动效、软导航后可用、0 控制台错误、端口释放。
- **Release 归档纳入 data/**：`scripts/lib/release-manifest.js` 白名单新增 `data/**` 与必需文件 `data/quotes.json5`（默认数据属于可体验功能），`scripts/release-manifest.test.js` 增加包含性断言，`docs/runbook/release.md` §6 清单同步。
- **每日一言接入 Hitokoto 一言 API（方案 A）**：`features.dailyQuote.api` 新增 7 键（`enabled` 默认 true / `endpoint 'https://v1.hitokoto.cn/'` / `categories ['d','i','k']` / `maxLength 0` / `timeoutMs 5000` / `minIntervalMs 1000` / `attributionText '来源：一言'`），中文页且在线时点击「换一句」优先请求 API：成功渲染 `hitokoto` + `from_who` 署名（空回退 `from`）+ 来源署名小字；失败/超时/非 2xx/JSON 畸形/字段非法/离线/英文页一律静默回退本地随机（不弹错）；请求中按钮 pending（`aria-busy`）禁用、完成即恢复；`minIntervalMs` 节流点击间隔。构建期 `connect-src` 按 `api.enabled` 二态自动保留/裁剪 `https://v1.hitokoto.cn`（`scripts/lib/csp.js` 新增 `hitokotoNeeded` 上下文，`_headers` 与 Worker 配置共用同一裁剪函数）；新增 API 纯函数单测（URL 组装/响应归一化/决策矩阵/节流，与 CSP 二态、配置计数守卫同步）与自收尾 runner `.tmp-scripts/run-daily-quote-api.js`（端口 3336，请求拦截模拟成功/超时/500/畸形 JSON 四态，20 断言全绿、0 控制台错误）；`docs/config-reference.md` §3.48 与 `SECURITY.md` 同步隐私与 CSP 说明。

## [1.1.0-a2] - 2026-09-27

### Changed

- **Release 统一以 Latest 发布**：CI（`.github/workflows/release.yml`）与本地 `release:publish` 创建 Release 时固定 `--latest`，不再按预发布版本加 `--prerelease`——SemVer 预发布版本名（如 `1.1.0-a1`）同样在下载页置顶；`release:mark` 的预发布提示同步为「以 Latest 发布」。历史误标可用 `gh release edit vX.Y.Z --prerelease=false --latest` 修正（见 `docs/runbook/release.md` §4.2/§8）。
- **旧 tag 清理范围扩展**：`release-prune` 在删除旧 Release（`--cleanup-tag`）后，继续删除远端其余 `v*` tag（`git push origin :refs/tags/<tag>`），覆盖没有 Release 的残留 tag；固定「先 Release 后 tag」顺序，`--keep` 与非 `v*` tag 受保护，`--dry-run` 打印两阶段清单，远端列表失败在删除前中止。新增纯函数 `selectObsoleteRemoteTags` / `planRemoteTagDeletions`，`release-prune.test.js` 扩至 13 例覆盖选择/顺序/失败路径。

## [1.1.0-a1] - 2026-09-27

### Added

- **基础包骨架化（空站发布）**：发布归档重新定位为「可完整体验 README 全部功能的最基本骨架」——`scripts/lib/release-manifest.js` 引入骨架目录概念，归档内 `articles/**` 与 `media/**` 只保留 `.gitkeep` 空目录标记（示例文章与演示媒体被 pathspec 过滤，`assertArchiveContents` 兜底拒绝非标记条目并给出「骨架目录只允许 .gitkeep」专项错误），示例页面 `pages/**` 与默认资源 `static/**` 照常分发；`scripts/release-archive.js` 输出骨架目录/测试随包统计，`--out` 支持目录目标；0 文章时 `npm run build` 仍产出 `dist/index.html`、`dist/report.txt`、`dist/zh/search-index.json`，解压后 `npm test` 全绿。
- **解压可构建门禁（buildability）**：`.github/workflows/release.yml` 在 publish 前新增独立作业——下载归档 → 解压 → `npm ci --ignore-scripts` → `npm test` → `npm run build` → 断言 `dist/index.html`、`dist/report.txt`、`dist/zh/search-index.json`；任一环节失败即整个 release 失败、不创建 Release。
- **预发布版本标记支持**：`release:mark` 接受显式 SemVer 预发布版本（如 `1.1.0-a1`，允许与当前正式版同核心版本），package.json/lock 同步、CHANGELOG 段名 `[1.1.0-a1] - 日期`、tag 为 `v1.1.0-a1`；CI 与本地 `release:publish` 自动加 `--prerelease`。
- **只保留最新版本（旧版清理）**：`npm run release:prune -- --keep <tag>` 删除其余 GitHub Release 及其远端 tag（`--cleanup-tag`，`--dry-run` 预览）；CI publish 最后一步与本地 `release:publish` 成功后自动执行，历史 Release（含已发布的正式版）随新版本发布自动下线。

### Changed

- **发布文档与下载说明对齐骨架语义**：`docs/runbook/release.md` 增补基础包语义（空站骨架 + 空站可构建 + 测试可跑 + 配置默认初始态）、buildability 的 `npm test` 步骤、骨架白名单与旧版清理示例；README 双语下载提示改为「空站骨架」表述，说明 `articles/`、`media/` 为空目录、放入自有内容即可构建。
- **空站兼容测试夹具**：在无 `docs/`、`CHANGELOG.md`、`.git` 的解压包环境中，文档覆盖（`check-config-docs`、`config-count`）、发布 dry-run（`release-mark`）、真实仓库态（`release-version`）与端到端归档/版本读取（`release-archive`）用例显式跳过并声明原因；源码仓库与 CI 门禁仍全量执行，断言不弱化。
- **配置默认化核对**：`site.json5` 社交链接 GitHub 项由维护者主页改为占位示例（`https://github.com/your-username`）；14 个 JSON5 逐项复核无个人/真实数据残留（其余为 `example.com`、示例备案号与占位账号）。

### Fixed

- **release 测试消除仓库状态依赖（CI 门禁红修复）**：`scripts/release-mark.test.js` 改为临时夹具仓库（复制被测脚本与其 `lib/` 依赖，配固定 `package.json`/`package-lock.json`/含 `[Unreleased]` 的 CHANGELOG fixture），不再读取真实仓库的 `[Unreleased]` 段——发布归段后该段不存在，原实现导致 5 个用例 `match(...)` 空值连环失败、`compat-node20` 与 Release 门禁同时红、首轮 `v1.1.0-a1` 未能发布；修复后 11/11 用例在「有/无 `[Unreleased]`」两态均通过，主仓零写入（夹具自动清理）。

- **本地启动脚本不再自动 `npm ci`（依赖卡死事故修复）**：`build.bat` / `serve.bat` 在缺少构建产物时原先无条件 `call npm ci 2>nul`（清空重装，曾因网络卡死 2 小时并留下残缺 `node_modules`：sharp 缺 `detect-libc`、Inter 字体包半解压导致页面 404/OG 失败）；现改为 `:ensure_deps` 子程序——仅当 `node_modules\sharp\package.json` 缺失时才执行 `npm install --no-audit --no-fund --prefer-offline`（增量修复、不整包重装），失败即停止并给出手动指引；两脚本实测通过（`build.bat` 无人值守 exit 0；`serve.bat` 起服/端口监听与释放正常）。

- **一言分类参数格式修复（真实网络验证发现）**：`buildApiUrl` 原先用 `|` 连接分类（`?c=d|i|k`），实测 Hitokoto API 返回 400（逗号形式同样 400）；改为**重复 `c=` 参数**（`?c=d&c=i&c=k`，实测 200）。真实浏览器端到端 runner `.tmp-scripts/run-daily-quote-live.js` 验证通过：200 响应、页面文本与响应体一致、「来源：一言」可见、0 控制台错误、端口释放；单测期望同步更新。

- **空站压缩验证 softNav 冒烟误判**：`scripts/lib/compression-verify.js` 在首页无文章卡片（空站骨架）时 softNav 判为「不适用」并跳过该断言，有文章或返回值缺失目标信息（异常兜底）时仍要求 softNav 通过；新增 3 例单测锁定两态（空站跳过、有目标/异常仍判失败）。

## [1.1.0] - 2026-09-27

### Added

- **完成标记 + 自动发布 Release 机制（版本 tag + RELEASE.json 双重校验）**：
  - **完成标记**：根 `RELEASE.json`（`schemaVersion/version/status/humanVerifiedBy/verifiedAt/commit/checks`，初始 `unverified` 默认拒绝发布）；`npm run release:mark -- <major|minor|patch|X.Y.Z> --human-verified "<姓名>" --confirm <版本>`（`scripts/release-mark.js`）依次执行工作区干净校验 → 11 项前置门禁（`RELEASE_GATES` 单一来源）→ 人工核验参数校验 → `npm version --no-git-tag-version` 同步 package.json/lock → CHANGELOG `[Unreleased]` 归入 `[X.Y.Z] - 日期` 并补版本链接 → 生成 verified 标记（checks 全 true、commit=被核验提交=tag 父提交，单提交不 amend）→ `chore(release): vX.Y.Z` 提交 → 附注 tag；默认不 push（`--push` 需 `--confirm-push` 二次确认）；`--dry-run` 仅演练计划、不写文件。
  - **双重校验**：`scripts/lib/release-validate.js → validateReleaseState`（status/version/tag/commit/checks/verifiedAt/schemaVersion 逐条报错，commit 以 `git rev-parse <tag>^{commit}^` 比对）；CI validate 作业以 `node scripts/lib/release-validate.js --tag` 读取 tag 指向提交内的标记，未完成或字段不匹配即失败、不建 Release。
  - **白名单归档**：`scripts/lib/release-manifest.js` 为包含/排除清单唯一来源（`js`/`scripts`（含测试）/`templates`/`workers`、根全部 `*.json5` 与 8 个根文件；`docs`/`.github`/`real-site`/内容目录等一律排除）；`npm run release:archive -- --ref <tag|HEAD>` 用 `git archive` + pathspec 生成 `S-ynapse-<version>.zip`（含前缀目录），解析 zip 中央目录逐条 `assertArchiveContents` 复核并断言必需文件/目录齐全。
  - **双通道发布**：`.github/workflows/release.yml`（仅 `on push tags v*`；validate → 11 项门禁 → `gh release create --verify-tag` 附 zip）为默认通道；备用本地通道 `npm run release:publish -- vX.Y.Z`（远端 tag 存在性检查 + 同一套校验 + `gh`）。`deploy.yml` 触发条件已限定 `branches: [main]`，tag 推送不会误触发站点部署。
  - **文档与测试**：新增 `docs/runbook/release.md`（字段表/人工核验含义/双通道/排障/与部署关系），README 快速开始双语下载提示 + NPM 命令表 + 文档索引，`docs/architecture.md` 新增 §9.1；新增 36 例单测（白名单矩阵、路径归一化与越界断言、版本计算、CHANGELOG 变换、状态校验正反例、单提交发布 git 语义回归 [commit=tag 父提交]、真实 `git archive HEAD` 归档 ⊆ 白名单、`--dry-run` 端到端不写文件）；实测 `npm test` 693/693（117 suites）、`npm run lint` / `npm run typecheck` 0 错、`verify:config` / `verify:config-refs` / `verify:config-comments` / `verify:config-docs` 全 PASS，`release:mark --dry-run` 与归档校验端到端通过（未 push、未打 tag、未建 Release）。

- **审计残余三拍板项收口（mermaid 客户端选项透传 / 水印断点单一来源 / 触觉与存储键开放）**：
  - **mermaid 客户端选项透传**：新增 `features.mermaid.clientOptions`（默认快照 = 历史硬编码：`securityLevel 'strict'`、`flowchart.htmlLabels false`、`flowchart.curve 'basis'`、`class/state.htmlLabels false`、`themeVariables.edgeLabelBackground 'transparent'`）；客户端渲染初始化时与内建动态默认（`startOnLoad`/`theme`/`fontFamily`/`useMaxWidth`）深合并（配置优先），未知键原样透传（mermaid 自校验），类型与内建默认不符的键忽略并输出含键路径的 `console.warn`。canonical：`scripts/lib/feature-wiring.js → mermaidClientDefaults / mergeMermaidClientOptions`；`templates/layout.ejs` 内联脚本镜像同一语义；SSR（`mode='build'`）不受影响。
  - **水印移动端断点单一来源**：`js/domains/guard/watermark.js` 由硬编码 `768px` 改读 `tuning.layout.mobileBreakpoint`（guard 关键队列在 `__CONFIG_READY__` 之后执行，成功路径 `__TUNING__` 已就绪；配置外置加载失败的降级路径回退 768 = 历史行为）。canonical `watermarkMobileBreakpointPx` + 源码无硬编码断点断言。
  - **开放配置 4 键（默认值 = 历史行为，逐键注释 + schema/guard 注册表/文档同步）**：`features.lightbox.positionStorageKey('s-lb-pos')`（实际键 = 前缀 + `:` + 路径名）、`features.sidebarDrag.hapticMs(10)`、`guard.contextMenu.hapticMs(10)`（0 = 禁用震动，非负整数，非法回退 10）、`guard.devtoolsDetect.reloadStorageKey('s-dt-reload')`（空值回退历史键）。按实际消费模块落位：`navigator.vibrate(10)` 两处分别在 guard 右键菜单与 sidebarDrag，`s-dt-reload` 消费点为 devtoolsDetect。canonical `hapticDurationMs / storageKeyOr`。
  - **文档与计数**：`docs/config-reference.md` §3.1/§3.18/§3.43/§11 补字段与接线说明；README 计数同步（features 97/944、guard 11/179、全仓 2728，`scripts/config-count.test.js` 锁定）。
  - **测试与验证**：`scripts/config-wiring.test.js` 新增 6 组用例（默认=现状、覆盖生效+未知键透传、非法类型忽略告警、断点单一来源+源码断言、0 禁用语义、JSON5/schema/注册表一致）；浏览器 runner `.tmp-scripts/run-audit-leftovers.js`（端口 3334，父死/空闲/寿命看门狗 + 端口释放校验，`--features-override mermaid.mode=client` 构建真实客户端渲染产物）**17 PASS / 0 FAIL**（client 默认渲染 SVG、`curve='linear'` 覆盖后 path.d 与默认不同、`securityLevel=123` 告警且回退 strict 仍渲染、watermark 视口 900 显示 / 700 隐藏的默认 768 断点、`mobileBreakpoint='640px'` 覆盖后 700 显示）；`npm test` 657/657（117 suites）、`npm run test:build` 3/3、`npm run lint`/`npm run typecheck` 0 错、`verify:config`/`verify:config-refs`/`verify:config-comments`/`verify:config-docs` 全 PASS；默认 `--out` 真实构建成功（mermaid SSR 12 rendered / 24 cached / 0 failed）。

- **隐藏开关收敛与重复默认去重（JSON5 单一事实源）**：
  - **A 类接入 21 键（默认值 = 历史行为，逐键中文注释 + schema/注册表/文档同步）**：`features.lightbox.swipeThresholdPx(50)/swipeCloseThresholdPx(80)/mouseSwipeThresholdPx(80)/dblClickZoomLevel(2)/clickTolerancePx(6)`（灯箱手势阈值）、`features.readingProgress.keyboardStep(0.05)/minRestorePx(160)/maxStoredPositions(80)/saveThrottleMs(400)`（进度条键盘步进与阅读位置记忆）、`features.readDock.hideBelowPx(80)/directionDeltaPx(12)`（阅读坞滚动显隐阈值）、`features.externalLink.copyFeedbackMs(1500)`、`features.hotSearches.maxWords(50)`、`features.morphIcons.idleTimeoutMs(3000)`、`features.softNavigation.cacheMaxEntries(16)`、`features.readingHistory.maxStored(50)`、`features.readMode.storageKey('readingMode')`，以及 `tuning.search.indexTimeoutMs(5000)/indexRetry(1)/errorText('')/errorTextEn('')`（后两者原为「代码可读、配置不可见」的隐藏键，现注册表+文档可见）。canonical 纯函数与单测：`scripts/lib/feature-wiring.js` 新增 `lightboxGestureConfig`/`readingRestoreConfig`/`readDockScrollConfig`/`externalLinkCopyConfig`/`hotSearchesConfig`/`morphIconsConfig`/`softNavCacheConfig`/`readingHistoryConfig`/`readModeConfig`/`commandPaletteConfig`/`searchIndexConfig`/`searchLoadErrorText`（12 组用例覆盖默认态=历史行为/覆盖生效/非法回退）。
  - **B 类去重 6 组**：`features.readMode.persist` 从「有键无消费」接通（false=仅当次会话并清理旧值），存储键两处硬编码收敛为 `storageKey` 单一来源；`features.commandPalette` 代码回退值由 `maxResults=8`/`hotkey='k'` 修正为与 JSON5/schema 一致的 `10`/`'ctrl+shift+p'`（degrade 模式取值漂移修复）；`seamless-nav.js` 补齐 `s-view-transition`/`s-speculation` 存储键回退（配置缺省时不再写 `undefined` 键）；`templates/layout.ejs` mermaid 复制反馈时长由硬编码 1500ms 改读 `features.codeCopy.buttonTimeout`；`features.mermaid.version` 由旧值 `11.4.1` 更正为安装版本 `11.17.2`（核实为信息性键、零消费；构建期 SSR/缓存键/客户端 vendor 均读 `package.json` 安装版本），新增测试锁定二者一致。
  - **计数口径守卫**：新增 `scripts/lib/config-count.js` + `scripts/config-count.test.js`（对象逐层展开、数组元素逐项计入且元素为对象时不再展开），实测 features 97 模块/936 项、tuning 37 分类/273 项、guard 11 模块/177 项、全仓 2718 项；README（含目录树与 guard 旧值 176→177 修正）与 `docs/config-reference.md` §10 计数同步，测试直接解析文档断言一致，杜绝再次漂移。
  - **审计报告**：新增 `docs/config-hidden-switches-audit.md`（A/B/C 三类逐项清单：位置→现值→分类→处置→默认行为，C 类 25 项附保留理由）。
  - **验证**：`scripts/config-wiring.test.js` 新增 12 组用例、`scripts/config-count.test.js` 4 组；浏览器 runner `.tmp-scripts/run-hidden-switches.js`（端口 3333，看门狗 + 端口释放校验）三组代表性开关两态 **20 PASS / 0 FAIL**（readMode.persist/storageKey、hotSearches.maxWords、tuning.search.errorText；默认态=历史行为）；`npm test` 651/651、`npm run test:build` 3/3、lint/typecheck 0 错、四条 config verify 全 PASS，`--out` 真实构建成功。

- **guard 绕过通道全配置化与可开关（2026-09-27）**：
  - **新增 `guard.json5 → core.bypass` 键**（默认值 = 历史行为，逐字段注释）：`enabled`（绕过通道总开关，false 时 URL/localStorage/localhost/解锁码全部无效）、`urlParam`（是否允许 `?guard=off/on`）、`localStorage`（是否允许 `s-guards-off=1` 持久关闭）、`cleanUrl`（判定后是否 `history.replaceState` 清洗 `?guard` 与 accessGate `?key`；false 时保留参数、判定结果不变）、`accessGateKey`（是否允许 accessGate 的 `?key=` 解锁码绕过访问门槛）；原 `localhost`/`queryParam`/`storageFlag` 保留并收敛为唯一来源。
  - **单一事实源**：新增浏览器纯函数模块 `js/domains/guard/bypass.js`（内置默认注册表 + `normalizeGuardBypass` / `resolveGuardBypass` / `isAccessGateKeyAllowed` / `stripGuardParams`）；`core.js` 与 `access-gate.js` 删除硬编码默认（自定义参数名正则转义、`'key'` 清洗名、`::1`、空串回退语义），全部改读配置，配置缺失时回退与历史一致的内置默认；新增可观测标记 `window.__GUARD_BYPASS__`（判定原因：`url-off`/`url-on`/`storage`/`localhost`/`disabled`/`none`）。
  - **测试**：`scripts/guard-bypass.test.js` 25 例（默认/非法值回退、三通道判定矩阵、通道优先级、URL 清洗、三处默认值一致性）；浏览器 runner `.tmp-scripts/run-guard-bypass.js`（端口 3332，父死/空闲看门狗 + 端口释放校验）10 场景 35 断言全绿（`?guard=off/on`、localStorage 通道、以及 `urlParam`/`localStorage`/`localhost`/`cleanUrl`/`enabled` 五个配置变体，真实右键菜单探针 + 地址栏断言 + 0 控制台错误）。
  - **门禁接线**：`npm run verify:config-docs`（`scripts/check-config-docs.js`，14 个 JSON5 键覆盖 vs `docs/config-reference.md`）接入 `package.json` 与 CI（`deploy.yml` 紧随 `verify:config-comments`）。
  - **文档**：`docs/config-reference.md` §11 补 `core.bypass` 字段表与 §3.77 绕过通道说明；README guard 项数同步。
- **压缩收口与验收实测（压缩 C8，2026-09-27）**：
  - **缺陷修复**：`templates/site-css.ejs:206` 悬垂逗号（`…transition:transform var(--td)},.cal-cell:hover{…}`）使 `.cal-cell:hover` 规则被浏览器整条丢弃；模板已修复，`scripts/build-smoke.test.js` 增加「产物 CSS 与页面内联样式不含 `},.`」及「`site.*.css` 含 `.cal-cell:hover`」断言（修复前产物命中为红、修复后为绿）。
  - **HTML 三态对照**（84 个压缩目标 HTML，增强关闭 / 现状 / `html.aggressive=true`）：raw 4,216,646 / 4,211,024 / 4,172,647B，gzip 989,179 / 988,339 / 983,698B；aggressive 相对现状 gzip 仅 −0.46%（相对关闭 −0.55%），C5 门禁 6 页 PASS 但收益不显著，`html.aggressive` 默认保持 false。HTML gzip −10% 目标未达（现状 −5.3% 口径含基线压缩；结构性原因：页面 gzip 的约 78% 是正文与结构内容，minify-html 只能作用于标记层）。
  - **runtime 引导脚本 Terser 压缩（`js.minify` 增强步骤）**：`runtime.<hash>.js` 以 `module:false`、不改顶层标识符压缩，按最终字节 md5-10 改名并同步全部 HTML 引用（84 页）；实测 raw 3,748→2,845B（−24.1%）、gzip 1,789→1,339B（−25.2%）。
  - **esbuild `splitting`**：app/deferred 共享模块抽为 `shared.<hash>.js` 公共 chunk（12 个，由 ES 模块图自动加载，HTML 仍只引用 app/deferred/runtime，无需 modulepreload）；app+deferred+shared+runtime 合计 gzip 60,238→54,077B（−10.2%），首屏 app gzip 26,999→17,458B（−35.3%），本地 `/zh/` JS 传输 61.1→48.0KB。
  - **C5 门禁适配**：DOM 归一化白名单覆盖 runtime 改名；新增 `bootstrapAssertions`，runtime 压缩或混淆任一开启时断言 `__T`/`__SB` 与 deferred 动态加载。
  - **时长口径（暖缓存，各 2 次中位）**：验证开 18.07s / 验证关 4.94s（验证净约 13s；构成 servers 0.2s、browser 0.4s、静态对比 2.8s、运行时控制台 4.4s、交互 3.7s、清理 0.6s；两态断言已并行、持久 profile 已复用，未发现不改验证语义的低风险提速项）。
  - **门禁与 runner**：`npm test` 581/581（106 suites）、`npm run test:build` 3/3、`npm run lint`/`npm run typecheck` 0 错、`verify:config`/`verify:config-refs`/`verify:compression` PASS；`.tmp-scripts/run-c4.js` 18 PASS / 0 FAIL、`run-softnav.js` ALL PASS（23 项）、`run-search-entry.js` ALL PASS（9 项）。
  - **JS gzip −20% 目标未达**：splitting + runtime 压缩后合计 −10.2%；叠加成熟工具剩余空间（esbuild 产物二次 Terser 约 −4.5%，C6 基准）约 −14%，差距来自业务代码本身（无死代码/功能可裁）；「接受现状或代码级裁剪」列为用户决策项。
- **WASM 压缩器替换评估（压缩 C6，2026-09-27）**：新增 `docs/wasm-eval.md`——在默认态 `--out` 构建产物上基准 CSS（clean-css 5.3.3 vs lightningcss 1.33.0）与 JS（terser 5.49.0 vs oxc-minify 0.151.0），每工具每文件预热 1 次后计时 3 次取中位，输出 raw/gzip-9/耗时与相对现状节省率。结果：CSS 合计 gzip 仅再省 0.18%（lightningcss 耗时约为 CleanCSS 的 1/10）；JS 合计 gzip 再省 3.85%（oxc 耗时约为 Terser 的 1/34，但输出体积略大 0.76%）。关键发现：① `templates/site-css.ejs:206` 存在悬垂逗号（`…var(--td)},.cal-cell:hover{…}`），浏览器同样丢弃该 `:hover` 规则，lightningcss 严格解析如实报错、CleanCSS/Terser 不校验选择器故放过；② `runtime.*.js` 为未压缩源码（两工具均可再省约 24-25%）；③ 两者均为 Rust 原生 NAPI 二进制（非 WASM），许可证 lightningcss MPL-2.0 / oxc MIT。结论：暂不切换生产（收益有限、严格解析需配套修复、当前规模无耗时瓶颈），并给出 4 条重新评估触发条件；评估工具隔离安装于 `.cache/wasm-eval/tools`，`package.json`/`package-lock.json` 零改动。
- **构建摘要 `dist/report.txt`（压缩 C7，2026-09-27）**：
  - **纯渲染库**：新增 `scripts/lib/build-report-text.js`（固定段落：阶段耗时 / 压缩统计 / 无头验证 / 告警 / 预算与目标；缺失字段一律「未记录/未运行/（无）」容错；`scripts/build-report-text.test.js` 15 例覆盖段渲染、缺失容错、失败+回退/跳过分支与格式化边界）。
  - **压缩统计采集**：`scripts/build/minify.js` 在压缩阶段前后各做一次分类快照（HTML/CSS/JS/JSON 的 raw/gzip/内容哈希），差分产出变更/新增/移除/跳过/豁免计数与前后体积，随 `minifyAll` 返回；`minifyAll` 无头验证是否运行以 `verificationRan` 上报。
  - **构建接线**：`scripts/build.js` 新增阶段计时（配置/预校验/页面/媒体/OG/压缩增强/cacheBust/PWA/报告/其它），报告阶段调用 `writeBuildReportText`（`scripts/build/report.js`；验证摘要仅在本轮实际运行时读取 `.cache/compression-verify/last.json`，`checkPerfBudget` 改为返回预算结果供摘要复用）。
  - **产物护栏**：`scripts/lib/dist-hash.js` 默认忽略项新增 `report.txt`（与 `build-report.html`/`og/` 同为非确定性产物），`scripts/dist-hash.test.js` 同步。
  - **集成断言**：`scripts/build-smoke.test.js` 断言两态（增强开/关）均产出 `report.txt`、含固定段标（头部、`[阶段耗时]`、`[压缩统计]`、`[无头验证]`、`[告警]`、`[预算与目标]`）且关闭态标注「压缩增强: 关闭」。
  - **文档**：README 命令表补 `verify:compression`、测试计数按实测更新（581 项 / 106 组）、构建管线第 14 步与特性清单补 report.txt；`docs/config-reference.md` compression 章节补 report.txt 摘要内容与产物护栏说明；`docs/architecture.md` 产物列表与报告门禁补 report.txt。
  - **门禁与实录**：`npm test` 581/581（106 suites）、`npm run test:build` 3/3、`npm run lint`/`npm run typecheck` 0 错、`verify:config`/`verify:config-refs` PASS；`.cache/c7-check` 默认态全流程构建 exit 0，report.txt 实录阶段耗时、压缩统计（HTML 84 页 raw 4.42→4.01MB / gzip 1014.5→960.6KB）、无头验证 PASS（6 页）与 perfBudget/压缩目标对照。
- **压缩无头对比门禁与失败自动回退（压缩 C5，2026-09-27）**：
  - **门禁**：增强阶段前把将被增强触及的 dist 文本产物（HTML/CSS/JS/JSON）快照到 `.cache/compression-baseline/`；增强完成后、cacheBust 之前启动两个本地静态服务（压缩产物 / 基线叠加层，端口系统分配且互异，子进程注入 `SYNAPSE_SERVE_PARENT_PID`/`SYNAPSE_SERVE_IDLE_MS`/`SYNAPSE_SERVE_MAX_MS` 看门狗），系统 Chrome（`puppeteer-core`）逐页断言 6 页集（`/zh/`、`/en/`、首页发现的文章、`/zh/search/`、`/zh/archive/`、`/zh/404.html`）：静态页（关 JS 隔离运行时注入）DOM 归一化结构一致（白名单仅内联 `<style>` 剔除、nonce 归一化、app/deferred 哈希归一化）、可见元素前 80 个计算样式一致、两态 0 控制台错误（唯一过滤 favicon 噪声）、压缩态软导航/搜索/主题交互冒烟；混淆开启时追加 `__T`/`__SB` 与 deferred 动态加载断言。验证先于 cacheBust，回退后参与内容哈希的即回退产物（「哈希=最终字节」不破）。
  - **跳过**：Chrome 探测/启动失败 → `[WARN]` + 结果标注 `skipped`，构建照常成功；`SYNAPSE_COMPRESSION_VERIFY=off` 可显式关闭（冒烟构建已使用）。
  - **回退**：失败且 `fallbackOnFailure=true` → 基线快照覆写 dist（含删除混淆重命名等增强新增产物）→ `[WARN]` + 非阻断记录（`compression-verify`，退出码保持 0）+ 逐字节复核（不一致升级为阻断）；`false` → 保留压缩产物并阻断。构建失败收集器新增 `fatal:false` 非阻断条目语义与 `[WARNINGS]` 尾部输出。
  - **独立门禁命令**：`scripts/verify-compression.js` + `npm run verify:compression`（passed=0 / failed=1 / skipped=0；支持 `--out`/`--chrome`/`--keep-baseline`/`--json`）；CI `deploy.yml` 在 Chrome 可用时条件执行。
  - **修复（C2 遗留）**：`--compression-override`（及 compression 配置）改为惰性加载并在 `build()` 的 try 内显式触发；watch 模式初始构建失败不再退出监听（初始 `build()` 补齐 catch），缺失覆盖文件的探针验证进程存活。
  - **加速与隔离**：静态对比页关闭 JavaScript；逐页两态并行采样；项目内持久 Chrome profile `.cache/chrome-verify-profile`（跳过首次导航初始化、避免临时 profile 清理等待，`browser.close` 超时兜底强杀）；`--no-proxy-server` 规避 Windows WPAD 首次导航拖慢；报告新增 `phaseDurationsMs`。
  - **测试与实测**：`scripts/compression-verify.test.js` 51 例（快照/恢复/孤儿清理/逐字节复核/白名单归一化/环境开关/端口解析与释放/页面发现/静态服务解析）；`npm test` 566/566（102 suites）、`npm run test:build` 3/3、lint/typecheck/verify:config/verify:config-refs 全绿；runner `.tmp-scripts/run-c5.js` 23 PASS / 0 FAIL（端口 3331 自收尾）：默认态 `npm run verify:compression` PASS（6 页、端口释放、验证约 7–14s）；人为破坏注入 → 验证 failed → 回退 110 文件、逐字节复核一致、构建 exit 0；关闭态不产出验证结果；看门狗空闲自退与覆盖缺失 watch 探针通过。
- **构建产物压缩配置层与压缩增强步骤（`compression.json5`，第 14 个配置文件）**：
  - **配置层**：`scripts/lib/compression-config.js`（默认值注册表、深合并、类型/枚举/`exclude` 校验、glob 豁免判定、`compressionActive`）与 `scripts/lib/compression-steps.js`（增强计划装配、HTML 选项装配、JSON 去空白纯函数）；`verify:config` 结构监守与 `verify:config-refs` 引用扫描纳入 compression.json5。
  - **加载与注入**：构建期由 `scripts/build/context.js` 注入压缩配置；加载/覆盖校验错误 → 告警 + 记录构建失败 + 降级内置默认值（不中止构建）；`--serve`/`--watch` 自动关闭增强步骤（本地调试所见与基线一致）；`--compression-override <path>`（JSON5 深合并、仍过 `validateCompression`、不写仓库配置文件）供隔离第二态构建。
  - **增强步骤**（位于 cacheBust 之前；基线 minify-html/CleanCSS/Terser 恒定行为不变，默认态 HTML 产物与基线逐字段一致）：① `html.aggressive=true` 叠加真实 minify-html 激进选项（省略可选闭合标签/属性引号折叠等，默认 false）；② `json.enabled` 时扫描 dist `*.json` 去空白——跳过已紧凑单行、`assets/config.<hash>.json`（内容寻址且写入时已紧凑）与 `exclude` 命中项，单文件失败只告警并保留原文件；CSS 合并去重与 JS 混淆为 C3/C4 预留接口（当前 `[WARN]` 不执行）。
  - **测试与文档**：新增 `scripts/compression-pipeline.test.js`（24 例）；`scripts/build-smoke.test.js` 增加压缩关闭态第二态构建断言（vendor 与 `node_modules` 源逐字节一致、HTML nonce 归一化后逐字节一致、feed.json 开关真实生效且语义等价）；`docs/config-reference.md` 补「基线 vs 增强」语义、serve/watch 与 config JSON 跳过说明；README 与架构文档配置计数 13 → 14。
  - **门禁**：`npm test` 497/497（87 suites）、`npm run test:build` 3/3、`npm run lint` 0 错、`npm run typecheck` 0 错、`verify:config` / `verify:config-refs` PASS；双态隔离构建体积对照：默认态 raw −3.7KB / gzip −80B（全部来自 2 份 feed.json 去空白；vendor/HTML/JS/CSS 字节不变）。
- **CSS 同页合并去重与 JS 可选混淆（压缩 C3/C4，2026-09-27）**：
  - **C3 CSS 合并去重**：新增纯函数库 `scripts/lib/css-merge.js`——`mergeStyleBlocks` 按样式源顺序合并同组（nonce+media 一致）内联 `<style>`，跨外链 stylesheet/SVG/`<noscript>` 不合并（层叠顺序可证明不变），合并块保留 nonce/media、丢弃 `id` 等非必要属性；`dedupeCss`/`dedupeStyleBlocks` 只做两类安全去重（同规则内同属性同 `!important` 状态保留最后一条、相邻完全重复规则保留前一条），非相邻重复、`@keyframes` 内部与 at-rule 结构不动；解析异常跳过该文件并告警（不阻断）。默认态构建实测：84 页中 80 页合并（合并 style 块 ×96）、去重声明 ×13（含 1 个外链 CSS），节省 5.8KB；另有数学页因 KaTeX 外链截断保持两块（顺序安全的必然结果）。`scripts/css-merge.test.js` 36 例。
  - **C4 JS 可选混淆**：新增 `javascript-obfuscator` 5.8.0（devDependency 精确版本，仅 `js.obfuscate.enabled=true` 时惰性加载）；preset low/medium/high 映射到真实选项（显式关闭 stringArray/controlFlowFlattening 等默认项，`renameGlobals/renameProperties=false` 保护 ESM 导出与 DOM 键），固定 `seed` 可复现。目标白名单 = 本轮 esbuild `app.*.js`/`deferred.*.js`（build.js 活值注入）；`runtime.*.js` 因参与内容哈希引用排除、vendor/源码拷贝/增量残留永不命中；混淆后按最终字节 md5 重命名并同步改写全部 HTML 引用（84 页），维持「文件名哈希=最终字节」。本机实测（medium + seed=20260927）：app+deferred raw 189.6→253.3KB（+33.6%）、gzip 60.2→96.3KB（+59.9%），构建 4.75→7.46s，本地首页 load 中位 180→327ms；同 seed 复跑逐字节确定。`scripts/js-obfuscate.test.js` 13 例。
  - **无头验证（runner `.tmp-scripts/run-c4.js`，端口 3330，自收尾 + 端口释放校验）**：17 PASS / 0 FAIL——混淆态 `/zh/` 0 控制台错误、`__T/__SB` 引导可用、deferred 动态 import 导出完整（load/has 与注册表查询）、软导航点击文章无整页刷新（window 标记保留、URL 与标题更新）、主题切换可用、文件名哈希核对与 runtime 未混淆、同 seed 复跑确定性、双态体积与加载中位对照。
  - **门禁**：`npm test` 545/545（93 suites）、`npm run test:build` 3/3、`npm run lint` 0 错、`npm run typecheck` 0 错、`verify:config` / `verify:config-refs` PASS。
- **`--theme-override <path>` 构建参数**：与 `--features-override` 同模式（JSON5 深合并、数组替换语义、仍过 `validateConfig` 的 theme 校验；不写仓库配置文件），供隔离验证/预览构建生成第二态主题（如 `theme.darkMode.iconStyle=single`）；新增单测 `scripts/theme-override.test.js`（5 例，含 CLI 解析与缺失/解析错误路径）。
- **隔离夹具验证收口（runner `.tmp-scripts/run-w6.js`，28 PASS / 0 FAIL；夹具与覆盖文件运行时生成、不入库）**：`pinned.sortRule=normal` 真实排序（夹具含「置顶但较旧」与「未置顶但最新」）；未知双链 `unknownMode=link/hide` 构建期 SSR 产物 + HTTP 端到端；`--theme-override` 第二态 `iconStyle=single` 单图标；增量构建逐页证据（冷缓存全量 → 无变更全部跳过且 HTML mtime 不变 → 改单页 `pages/about.md` rebuilt=1、指纹仅目标页变化 → 改一篇文章仅该语言耦合页、另一语言跳过 → `--full` 强制全量重写）；端口 3329 三次串行复用并在关闭后校验释放。
- **第七轮配置接线（W5 收尾波，2026-09-27）**：全部「⚠ 未接线（预留）」键收口（`features.json5` 标记清零），新增未接线静态守卫——
  - **增量构建（`incrementalBuild`）**：`enabled/watch/skipUnchanged/fullFlag/fingerprintHash` 全部接线。页面指纹 = `relPath + 模板目录摘要 + 页面数据稳定序列化`（对象键排序、跳过函数、CSP nonce 归一化）经所选算法（sha1/sha256/md5）散列，写入 `.build-cache.json → pages`；指纹一致且产物存在时跳过重新渲染并复用现有产物（日志 `[incremental] skipped N page(s), rebuilt M page(s)`）。触发：`--watch`（`watch=true`）或显式 `--incremental`；`--full`（或自定义 `fullFlag`）强制全量；增量模式在内存中暂时关闭 `cleanDist`（不写回配置），普通 `npm run build` 保持全量清理。删除内容后建议 `--full` 清理残留产物。新增纯函数库 `scripts/lib/incremental.js`（单测 8 例）。
  - **云统计（`analytics`）**：`injectAt`（`body`/`head`，非法回退 body）、`emitBeacon`（false = 脚本仍加载但不输出 `data-cf-beacon` JSON）、`siteTag` 接线；token 优先级 **`siteTag`（非空）> `site.webAnalytics.token` > 环境变量 `CF_WEB_ANALYTICS_TOKEN`**（`scripts/build/config.js`）；`features.analytics.enabled=false` 直接关闭注入。新增 `analyticsConfig`/`buildAnalyticsTag`（纯函数，含 `</script>` 转义）。
  - **重定向（`redirects`）**：`generatePagesFile=false` 不产出 `_redirects`；`applyInServe=false` 仅本地 serve 不应用（部署文件照常生成）；`invalidRule` 两策略接线——`abort`（默认）= 非法规则记录构建失败（构建非零退出，`--allow-degraded` 可降级）、`warn-only` = 仅 `[WARN]` 跳过；`enabled` 归一为 site.json5 自定义规则开关。新增纯函数库 `scripts/lib/redirect-rules.js`（单测两策略）。
  - **维护模式（`maintenance`）**：`setRetryAfter=false` 时维护响应不输出 `Retry-After`；`retryAfter`（秒，非法回退 3600）为响应值。构建期经 `generate-security-config.js` 写入 `workers/security-config.js` 供 Worker 读取，本地 serve 直接消费同一配置（两处行为同源）。
  - **构建性能告警（`performance.warning*`）**：构建收尾按 `warningJsKb`/`warningHtmlKb`/`warningImageKb`/`warningBuildMs` 输出 `[WARN]`（仅提示不阻断；与 `features.perfBudget` 门禁职责区分）。`warningImageKb` 只扫 `dist/media` 用户图片（OG 产物不计），最多列 10 条。新增纯函数 `performanceWarnings`。
  - **构建调试（`debug`）**：`verbose=true` 输出阶段耗时（`[DEBUG] …（+Nms）`）与增量逐页跳过明细；`listPages=true` 构建末输出渲染页面清单；`dumpConfig=true` 输出解析合并配置摘要（token/secret 等敏感字段只显示是否已设置，绝不输出明文）。默认全关，不影响正常输出。
  - **热力图色表（`heatmap.scaling/palette`）**：`scaling=fixed` 且 `palette` 长度 ≥ `levels` 时以固定色表替代 color-mix 自动色阶（取前 levels 项）；不足/`auto` 回退自动色阶并对前者输出 `[WARN]`。新增纯函数 `resolveHeatmapPalette`。
  - **TTS 首启预热**：`js/domains/features/tts.js` 模块级缓存语音列表并监听 `voiceschanged` 刷新——Chromium 首启（`getVoices()` 首调为空）首次点击朗读即可命中配置的语音策略。
  - **`readingProgress.topOffset`**（静态扫描新发现）：接线为 `.reading-progress` 的 `top` 偏移（需含单位，`0` 贴顶）。
  - **未接线静态守卫**：新增 `scripts/check-config-refs.js`（`npm run verify:config-refs`，CI 紧随 `verify:config`）——13 个 JSON5 提取 2448 叶子键 × 141 源码文件按「键名零引用」扫描；允许名单 `scripts/config-refs-allowlist.json`（数据/展示层整段整体注入；features 仅登记动态拼接的 `stats.label*En`）。当前为空（exit 0）。
  - 新增单测：`scripts/incremental-build.test.js`（8 例）、`scripts/config-wiring.test.js` 扩至 69 例、`scripts/security-worker.test.js` 维护关闭态；runner `.tmp-scripts/run-w5.js` 42 PASS（4 态隔离构建 + serve 两态 + TTS 浏览器断言）。
- **第六轮配置接线（W4，2026-09-27）**：灯箱/返回顶部/朗读/打赏/热力图/统计/移动端/联系弹窗组「未接线」键全部真实可控或作为重复键删除——
  - 灯箱（`lightbox`）：`maxWidthVw` 构建期归一为 CSS 变量 `--lightbox-maxWidthVw`（专键 > 兼容旧键 `imageFit.lightbox.maxWidthPct` > 92）；`openDurationMs`/`switchDurationMs` 接线为打开/切换透明度补间（WAAPI；专键 > 通用 `transitionDurationMs` > 220；0=瞬时；`prefers-reduced-motion: reduce` 不播放）。
  - 返回顶部（`backToTop`）：`scrollDurationMs` 接线为 rAF + easeOutCubic 自定义滚动（`behavior:'instant'` 逐帧步进，避免与 CSS `scroll-behavior:smooth` 二次平滑打架；用户滚轮/触摸中断；`smoothScroll=false`/`__SB()==='auto'`/减少动效为瞬时；点击与快捷键共用；`readDock` 顶部按钮同源）；`htmlAnchorFallback=true` 输出 `<noscript>` 锚点链接（`href="#top"`，无 JS 可返回顶部，JS 可用时由 `#btt` 接管）。
  - 朗读（`tts`）：`preferDefaultVoice`（命中语音按 `localService`/`default` 评分取最高；false=平台顺序首个；无命中回退浏览器默认）、`voiceBy`（`lang`=voice.lang 匹配；`name`=voice.name 含语言显示名匹配，无命中回退 lang）、`highlightParagraph`（逐段 utterance 朗读 + 当前段落 `highlightClass` 高亮，停止/切段清理，无 boundary 事件也可靠）。
  - 打赏（`reward`）：`closeByBtn`/`closeByOverlay`/`closeByEsc` 三个关闭路径独立门控（默认 true=现行为）。
  - 热力图（`heatmap`）：`levels`（2~7 钳制）生成 `l1..lN` 色阶（levels=5 逐字保持历史色阶）、`showLegend`、`legendLow(En)`/`legendHigh(En)`（链 `*En` > 中文 > `ui-strings.archive.legendLow/High` 新增双语）、`tooltipFormat(En)`（`{year}/{month}/{count}` 占位，空回退内置）、`showMonthNumbers`；图例示色层级随 levels 自适应。
  - 统计（`stats`）：`showArchiveCards` 显隐统计卡网格；`labelPosts(En)/labelDays(En)/labelWords(En)/labelAvg(En)/labelAvgPerDay/labelTags(En)/labelCategories(En)` 标签文案链（`*En` > 中文 > `ui-strings.archive.stat*`；日均卡 `labelAvgPerDay > labelAvg > statAvg`）；`linkArchive` 卡片跳转目标（非空渲染为链接，空=纯文本卡）。
  - 移动端（`mobile`）：`searchFullscreen=false` 时移动端搜索非全屏（透明遮罩 + 头部下方下拉面板）；`buttonStackGap` 接线 CSS 变量 `--mobile-buttonStackGap`（目录按钮底距 = `tuning.mobileToc.btnMobileBottom - 3.4rem + 本键`）；`touchFallback=true` 触屏设备点击/聚焦显形 hover-only 控件（新增 `js/domains/features/touch-fallback.js`，`html[data-touch-fallback]` + `.touch-reveal`；CSS 随配置门控输出）；`codeScrollHint=true` 超宽代码块显示「可横向滚动」提示（`ui-strings.toolbar.codeScrollHint` 新增双语，首次横滚自动隐藏，减少动效安全，CSS 随配置门控输出）。
  - 联系弹窗（`contactPopup`）：`popupWidth` 构建期写入弹窗 `max-width`；`copyText(En)` 接线为值块复制按钮的 `title`/`aria-label`（值块补 `role=button` + `tabindex=0`，Enter/Space 可复制；链 `*En` > 中文 > `ui-strings.common.copy`）；`showAllItems=false` 超过 2 条折叠为「更多」展开器（`ui-strings.common.more` / `toolbar.collapseAll`）。
  - 新增纯函数 `lightboxConfig` / `backToTopConfig` / `ttsConfig` / `pickTtsVoice` / `ttsLanguageNames` / `rewardCloseConfig` / `heatmapLevelCount` / `heatmapConfig` / `heatmapBucketLevel` / `heatmapPalette` / `heatmapLegendLevels` / `heatmapLegendText` / `heatmapTooltip` / `statsConfig` / `statsLabel` / `mobileConfig` / `contactPopupConfig` / `contactCopyText`（`scripts/lib/feature-wiring.js`）；`scripts/config-wiring.test.js` 单测由 40 例扩至 53 例。
- **第五轮配置接线（W3，2026-09-27）**：数学/上下标/Mermaid/系列/相关推荐/字数/图库/图片尺寸组「未接线」键全部真实可控或作为无实现重复键删除——
  - 数学（`math`）：`autoDetect`（true 默认 = 解析配置定界符并保护数学段；false = 不自动解析，仅渲染 ` ```math ` 围栏块 → 构建期 `.math-block[data-tex]` 容器 + 客户端 KaTeX 渲染）、`inlineDelimiters`/`blockDelimiters`（数组、去空去重、正则转义；构建期 mathGuard 与客户端 auto-render 共用同一份配置）、`mathml`（true = KaTeX output `htmlAndMathml`，false = `html`）。KaTeX 按需加载 canonical `mathNeeded`（单 `$` 保持历史不单独触发口径；自定义定界符成对出现即触发）。
  - 上下标（`supSub`）：`supMarker`/`subMarker`（≥1 字符参数化，正则元字符按字面量）、`skipInsideMath`（true 默认 = 数学段内不处理；false = 段内也转换）、`preserveUnmatched`（false = 剥离孤立标记；`~~` 重复标记保留给删除线等语法）。
  - Mermaid：`autoDetect=false` = 构建期不 SSR、保留围栏回退客户端（仍仅识别显式 ` ```mermaid ` 标注）；`followTheme=false` = 仅明色单份 SVG（**同时修复单主题产物在暗色模式下被 CSS 隐藏的既有缺陷**）；`copyAfterRender=true` = SSR 图附「复制图表代码」按钮（原始源码经 `data-mm-code` 保留在产物中，事件委托 + `navigator.clipboard`，CSP 合规，zh/en 文案）；`errorTextEn` = en 站渲染失败占位（SSR pending 块 `data-mm-error` + 客户端兜底常量，空回退中文）。
  - 系列（`series`）：`showBadge`（卡片徽标显隐）、`badgeFormat(En)`（`{name}` 模板，优先于 `ui-strings.card.series`）、`panelTitle(En)`（面板标题 `{total}`，优先于 `ui-strings.post.seriesLabel`）、`showPosition`（面板进度文本与进度条显隐）、`sidebarWidget`（侧栏系列 widget 显隐）。
  - 相关推荐：`related.excludeCurrent=false` 允许自引用（默认 true 排除，历史行为）。
  - 字数（`wordCount`）：`onCards`、`textFormat(En)`/`readTimeFormat(En)`（模板链 `*En` > 中文 > ui-strings 词典）、`countCjkChars`/`countDigits`（统计口径参数化 `countWordsDetail(text, options)`：CJK 逐字 / 纯数字 token 开关；口径仅影响展示，阅读时长计算仍用完整口径）。
  - 图库：`gallery.collectFeatured=false` 仅收集正文图片（默认 true 收集封面 + 正文，按 src 去重）。
  - 图片：`imageLazy.preserveAspectRatio=false` 构建期不输出 width/height（markdown 正文与 pages 卡片/头图/图库/缩略图两条出图路径统一受控）。
  - 基础设施：构建 CLI 新增 `--features-override <file>`（隔离第二态构建/预览的 features 深合并覆盖，仍过 `validateFeatures`；不修改仓库配置，供 runner/回归验证使用）。
  - 新增纯函数 `supSubConfig` / `supSubMatchers` / `matchSupSub` / `transformSupSubText` / `transformSupSubInMathRaw` / `mathConfig` / `buildMathGuardPatterns` / `hasCustomMathDelimiters` / `mathNeeded` / `mermaidConfig` / `mermaidErrorText` / `seriesConfig` / `seriesBadgeText` / `seriesPanelTitle` / `relatedConfig` / `wordCountConfig` / `wordCountText` / `readTimeText` / `galleryCollectFeatured` / `imagePreserveAspectRatio`（`scripts/lib/feature-wiring.js`）；`scripts/config-wiring.test.js` 单测由 26 例扩至 40 例（含 markdown 集成与 collector 集成）。
- **缺陷修复：文章页阅读时长双显示（用户可感知）**：`post-reading-time`（readingTime.labelAfter）与 meta 内独立 `分钟阅读` 曾同时渲染两处；现按 `features.wordCount.readTimeFormat(En)` 单一来源渲染（显式置空时回退 `readingTime.labelBefore/labelAfter(En)`，再回退词典），每页仅一处。
- **第四轮配置接线（W2，2026-09-27）**：搜索/外链/双链/Hero 组「未接线」键全部真实可控或作为重复键删除——
  - 检索（浮层搜索与 /search 页统一语义）：`search.weightTitle/weightExcerpt/weightContent`（得分 = 字段权重 × 命中出现次数；权重 0 = 该字段不参与匹配与计分；按总分降序、同分保持日期倒序索引原序）、`search.matchTags/matchCategories`（标签/分类命中参与入选、计 0 分；默认 true → 结果集为历史行为的超集）、`search.showCount`（结果计数显隐，false 时浮层结果区与 /search 页均不显示；文案 `ui-strings.search.foundCount` 双语 `{count}` 占位）、`search.emptyHint/emptyHintEn`（无结果文案链首位 + 空输入浮层提示；默认空串 = 沿用 `noResultText`，保持历史输出）。
  - 外链：`externalLink.whitelistNewTab`（true = 白名单外链 `target=_blank + noopener/noreferrer` 等效，事件委托对动态插入链接同样生效）、`externalLink.copyButtonText/copyButtonTextEn`（外链提醒浮层新增「复制链接」按钮：点击复制目标 URL 并短暂显示「已复制」；文案链 config(En→中文) > `ui-strings.toolbar.copyLink`（新增双语）> 内置）。
  - 双链（构建期）：`wikiLinks.unknownMode`（`text` 默认降级纯文本 / `link` 站内搜索链接 `/{lang}/search/?q=<encodeURIComponent(目标)>` / `hide` 整体移除）、`unknownSuffix`（仅未知目标追加）、`caseInsensitive`（false = 原始标题精确匹配；新增 `titlesExact` 查表）、`allowCustomLabel`（false = 忽略 `|` 后文本）、`enabled=false` 跳过解析。
  - Hero：`hero.searchPlaceholder/searchPlaceholderEn` 构建期 SSR 生效（hero 键 > `ui-strings.toolbar.searchPlaceholder(En)`，空串回退 ui-strings）。
  - 新增纯函数 `normalizeSearchConfig` / `searchEmptyText` / `rankSearchEntries` / `wikiLinkConfig` / `heroSearchPlaceholder`（`scripts/lib/feature-wiring.js`），`scripts/config-wiring.test.js` 单测由 17 例扩至 26 例。
- **缺陷修复：浮层搜索连续查询旧结果残留（用户可感知）**：`doSearchNow` 结果分支渲染前未清空 `#searchResults`，连续查询会叠加旧结果节点；现每次渲染前清空并重置键盘高亮索引（runner 对 W1 旧构建复现 4 条残留、新构建回归 1 条）。
- **第三轮配置接线（W1，15 项，2026-09-27）**：全部「未接线（预留）」键真实可控或作为重复键删除——
  - 主题：`theme.darkMode.rememberChoice`（false=偏好仅存 sessionStorage）、`theme.darkMode.iconStyle`（`sun-moon`/`single`/`switch` 三种按钮形态）、`theme.darkMode.transitionAll`（true=切换加 `.theme-switching`，false=瞬时）；运行时经外置配置 `window.__THEME__.darkMode` 读取。
  - 导航/阅读：`mobileBottomNav.onlyMobile`（false=桌面端也显示底部导航）、`readMode.focusOnlyContent`（false=阅读模式保留侧栏）、`toc.defaultOpenLevel`（0=全折叠；N≥1 展开到 minLevel+N-1 级，默认 2 → h4 初始折叠）。
  - 检索/文案：`searchHighlight.markClass`（`<mark>` 附加类名，空=不附加）、`shortcuts.showHelpHint`（页脚 `?` 提示按钮，可键盘聚焦，点击开关帮助面板；文案 `ui-strings.toolbar.shortcutHint` 双语）、`pinned.badgeText(_En)/badgeStyle(pill|corner|none)/sortRule(pinned-first|normal)`（构建期排序与模板徽标）、`autoSummary.stripMarkdown`（frontmatter excerpt 剥离 Markdown 标记）、`pagefind.integrate`（false=回退内置搜索链路，构建期同时产出 search-index.json）。
  - 媒体/动效：`motion.revealStaggerMax`（错峰总附加延迟上限，单项 delay=min(revealDelayMs, 剩余预算)）、`dailyQuote.widgetStyle`（`card` 默认/`plain`）、`favorites.listIcon`（/favorites 列表项图标）、`cover.defaultPattern/preferImage`（默认样式选择与「图片优先」；封面样式选择器此前无运行时，本轮补齐 `js/domains/features/cover.js`）、`listCover.showOnArchive`（标签归档列表封面显隐）。
  - 新增纯函数库 `scripts/lib/feature-wiring.js`（归一化/排序比较器/错峰预算/纯文本化等，供构建期与单测复用）与门禁单测 `scripts/config-wiring.test.js`（17 例）。
- **热门搜索（用户可感知）**：`features.hotSearches.top/showInDropdown/showClear` 全部接线——搜索词按本地词频（`s-hotSearches:hot`，最多 50 词）累计，搜索下拉展示「热门搜索」分组（按词频降序取 `top` 条）+「最近搜索」；`showClear` 提供清空按钮（原生 button + aria-label，键盘可操作）；文案新增 `ui-strings.search.hot/clear/clearHot` 双语。配置文件键：`hotSearches.top`（默认 5，展示条数）/ `showInDropdown`（默认 true）/ `showClear`（默认 true）；完整中文注释与 schema/defaults/docs 同步。
- **阅读进度气泡与无障碍（用户可感知）**：`features.readingProgress.tipDisplayMs`（默认 500ms）接线——点击跳转后百分比气泡停留该时长，悬停/聚焦期间常显；`ariaAnnounce`（默认 true）接线——进度条实时输出 `aria-valuenow`（`role=progressbar` 已有）；进度条新增 `tabindex=0` 与键盘操作（←/→ 步进 5%、Home/End 首尾，点击坐标跳转不受影响；`prefers-reduced-motion` 下由 `window.__SB()` 自动降级）。
- **第二轮配置接线批（W2）**：`readingTime.showInMeta`（默认 true，false 同时隐藏两处元信息阅读时长）、`toc.minLevel/maxLevel`（构建期 TOC 提取，收敛 2–4 级并经单测）、`toc.highlightActive`、`mobileToc.overlayClose/lockScroll/autoClose`（含 Esc/外点关闭与滚动恢复）、`readDock.showProgressRing/showTocButton/showTopButton`（全 false 时整坞不渲染）、`externalLink.showFullUrl/openInNewTab`、`themePresets.showInNavbar/previewOnHover`（SSR 门控与 title 输出）、`themeSchedule.applyInstantly`、`dailyQuote.quoteColor`、`share.copiedShowMs/popupWidth/popupHeight/wechatText(_En)`（微信复制按 `{title}/{url}` 模板）、`tts.volume`、`comments.loadContainer`、`darkImageFilter.applyImages`、`shortcuts.helpTitle(_En)/showHelpTable`、`ogImage.useCover/gradientForNoCover`、`search.highlightMatches/closeOnOverlay/focusOnOpen`、`searchHighlight.enabled` 门控、`mobileToc.maxHeightVh/borderRadius`（改为读取 features，消除 CSS 硬编码）、`readingTime` 元信息防重复/`hotSearches` 词频（见上）。
- **tuning 设计尺寸迁移第二批（W1，32 项）**：search（overlayPadding 12vh/1rem/2rem、modalPadding、modalMaxHeight 78vh、closeBtnSize 36px）、reading（dockRight 1.35rem、dockBtnSize 40px、dockRightTablet 1rem、dockBottomTablet 6.4rem、gearBottom 14.6rem、gearMobileBottom 10.8rem、panelBottom 13.2rem、panelWidth 280px、dockMobileBottom 14.2rem）、mobileToc（btnBottom 6rem、btnRight 2rem、btnMobileBottom 7.4rem、btnMaxWidth 340px、labelMaxWidth 9.5rem）、ui（errorSvgMaxWidth 460px、errorSuggestMaxWidth 560px、errorCodeFontSize 7rem）、lightbox（btnSize 44px、btnOffset 14px）、toast（maxWidth 420px、radius 999px、offsetBottom 2rem）、pagination（btnMinWidth/btnHeight 40px）、backToTop.hiddenOffset 20px、commandPalette.listMaxHeight 420px、code.windowDotSize 11px、layout.articlePadding 2rem。全部默认值与迁移前逐字一致，模板以 `var(--分类-键, 原值)` 消费；`scripts/lib/tuning-defaults.js` 与 `docs/config-reference.md` 同步。

- **无封面文章自动生成封面（用户验收反馈）**：`features.listCover` 新增 `autoGenerate{enabled,width,height,format,backgroundStyle,showSiteName,showCategory}`——文章 frontmatter 无 `featuredImage` 时，构建期以主题色（`theme.colors.primary/secondary` + `darkMode.colors.text`）用 SVG 渲染标题（中文全角按 1 字宽、英文按单词自动换行，最多 3 行、溢出省略号）+ 站点名 + 可选分类/系列角标，经 sharp 输出到 `dist/og/cover-<slug>.<hash8>.<ext>`（hash = 标题 + 站点名 + 主题色 + 样式版本 + 宽高格式 + 样式开关；内容寻址命名，`/og/*` 已有 `_headers` 7 天缓存规则且被 sitemap/cache-bust 忽略，未新增任何规则），缓存 `.cache/covers/`（命中直接拷入 dist，二次构建不重渲染；标题/样式变更自动换新文件名并清理旧缓存，失败轮次保守不清理）；**显式 `featuredImage` 始终优先、行为不变**；`enabled:false`、主题色缺失或单篇失败回退 `fallback`（`pattern`/`none`），失败仅告警不阻断构建。列表卡片（首页 + 标签页）与文章页头图均输出 `width`/`height` 构建期定尺寸（防 CLS）。新增 `scripts/lib/auto-cover.js`（纯函数）+ `scripts/build/auto-cover.js`（构建接线，`dist/og` 根层与 `generate-og` 的 `og/<lang>/` 清理互不误伤）+ 25 项单测（换行估算/配置归一/颜色解析/hash 稳定性与失效/SVG 转义）+ 隔离集成 runner `.tmp-scripts/run-auto-cover.js`（21 断言：模块夹具生成/缓存命中/显式封面不覆盖/hash 失效与缓存清理/jpeg 扩展名 + 真实构建产物引用与尺寸断言/二次构建 made 0）+ 浏览器实测 runner `.tmp-scripts/run-auto-cover-live.js`（端口 3319：卡片与头图请求 200、图片解码、0 控制台错误、端口释放）— `features.json5` + `scripts/lib/features-schema.js` + `scripts/lib/auto-cover.js` + `scripts/build/auto-cover.js` + `scripts/build/context.js` + `scripts/build.js` + `scripts/build/pages.js` + `templates/index.ejs` + `templates/tag.ejs` + `templates/post.ejs` + `docs/config-reference.md`。**残余验收补记（2026-09-26，无新增代码改动）**：real-site 生产副本构建实测 12 断言（S-TextPaste 卡片与文章页头图引用 `/og/cover-s-textpaste.<hash8>.webp`、`verify:config` 走 schema 默认值通过、临时同步 scripts/templates 后原样还原且 git 状态指纹不变）；主仓视觉抽检 19 断言（无头 Chrome 用 getBBox 实测标题不溢出、站点名不重叠、标题色对比度 10.94:1 / 4.72:1，显式 featuredImage 文章仍走 `/media/` 且无对应自动封面，截图 4 张）；showCategory 夹具 16 断言（角标文本/几何/卡片截图）；40 篇封面压测（800×420）：冷构建 13.47s made 40、热构建 3.32s reused 40，failed 0，512MB 堆上限内正常结束，无进程/临时文件残留（runner：`.tmp-scripts/run-{realsite-cover,cover-visual,showcategory-visual,cover-stress}.js`）

- **OG 图尺寸自适应 + 列表封面门控（用户需求）**：`features.ogImage` 新增 `autoSize{enabled,maxDimension}`、`coverFit`（`cover|contain|fill`）、`overlay{enabled,wrap}`；`width/height` 改为可空——留空（null）时按站点文章封面自动定尺寸：仅 1 张封面 → 用该图尺寸；多张 → 取面积最大者；0 张 → 1200×630；长边超 `maxDimension`（默认 2560）等比缩小；显式填写 width+height 时始终优先（示例注释保留在配置内，真实环境留空）。封面文件变更（含同尺寸替换）纳入 OG 缓存键防陈旧。同时接线 `features.listCover`：`enabled` 真正控制首页卡片媒体区显隐，`fallback: 'pattern'|'none'` 决定无封面文章显示渐变占位块或纯文字卡片（原 `listCover.fallback` 与 `has-cover-pattern` 为死键/死类）。新增 `scripts/lib/og-size.js` 纯函数 + 11 项单测、隔离站点集成 runner（单图/多图/超限/显式/缓存失效 9 断言全过）— `scripts/generate-og.js` + `scripts/lib/og-size.js` + `features.json5` + `scripts/lib/features-schema.js` + `templates/index.ejs` + `scripts/build/pages.js` + `docs/config-reference.md`

- **全页 WCAG 2.2 AA 门禁 + 移动端真机点检清单（可访问性与移动端批次）**：`npm run audit:a11y` 升级为全页审计——页面集合从 dist 全量派生（84 页：中英首页/文章/归档/标签/分类/搜索/画廊/系列/收藏/友链 + 404，排除 build-report.html），逐页 HTTP 2xx 校验，axe 标签含 `wcag22aa`，明暗双主题各跑一次，输出页数/失败数/impact 分级/规则聚合/节点样例，critical+serious+HTTP 失败阻断（moderate/minor 仅报告）；审计前冻结动画与过渡并强制 reveal 终态（axe 官方稳定化做法），消除页面淡入/卡片入场中间态 opacity<1 导致的成片虚假对比度违规；无外部地址时自行构建 + 在空闲端口起 serve（父进程/空闲双看门狗 + taskkill 整树兜底 + 端口释放校验），已有 serve 可经参数或 `A11Y_BASE` 复用。新增 `docs/mobile-checklist.md`（iOS Safari / Android Chrome 各 15 项真机点检：安全区、软导航、TOC 抽屉、弹窗公告、CJK 字体、暗色、横屏、双击缩放、滚动性能、分享/TTS 权限等，含预期结果与问题记录表）；本地移动端模拟 runner（`.tmp-scripts/run-mobile.js`，12 代表页 × 375×812/768×1024，182 项断言全过）— `scripts/a11y-audit.js` + `docs/mobile-checklist.md` + `README.md`

- **覆盖率门禁与 CycloneDX SBOM（工程化批次）**：新增 `npm run test:coverage`（Node 内置覆盖率 + `--test-coverage-include="scripts/lib/**"` + `--test-coverage-lines=80`，CI 在 `npm test` 后阻断执行；补 9 项用例覆盖 mermaid 假浏览器渲染/超时重建/Chrome 探测/数字实体，`mermaid-render.js` 行覆盖 76.32%→97.85%，`scripts/lib` 27 文件全部 ≥80%、总量 95.48%→98.23%）；新增 `npm run sbom`（`scripts/sbom.js`：读取 `package-lock.json` v3 手写最小合法 CycloneDX 1.5 JSON——根组件 `s-ynapse@1.0.2`、381 个依赖组件（purl 作用域包按规范 `%40` 编码、SHA-512 integrity 转十六进制哈希、同版本 `#2` 去重、按名稳定排序、原子写入 `build-artifacts/sbom.cdx.json` 且不入库），14 项单测；CI 构建后生成并上传 `sbom-cyclonedx` artifact（`if-no-files-found: error`）；测试 290→313 项全通过 — `package.json` + `scripts/lib/mermaid-render.js` + `scripts/mermaid-render.test.js` + `scripts/sbom.js` + `scripts/sbom.test.js` + `.github/workflows/deploy.yml` + `.gitignore` + `README.md`

- **中文字体构建期子集化（Noto Sans SC，反馈批次二·三）**：新增 `site.build.cjkFonts` 配置（`enabled:true` / `family:'Noto Sans SC'` / `weights:[400,700]` / `fetchTimeoutMs:15000`）。构建后期扫描 dist 全部 HTML 与产出 JSON 的实际用字（正文 + `<title>`/meta + 内联及外部化运行时配置），仅下载命中的 Google Fonts woff2 分片并自托管到 `dist/assets/fonts/noto-sans-sc/`，生成 `dist/assets/css/cjk-fonts.css`（保留 `unicode-range`、`font-display:swap`），HTML 引用自动带内容哈希查询串；字体缓存于 `.cache/fonts/`（`chunk-list.json` 7 天 TTL + 按 URL 哈希命名的 woff2，不入库），首次联网后离线可复用；出网请求超时（默认 15s）+ 1 次退避重试，断网/超时/解析失败自动跳过并 `console.warn`，半套产物即时清理、HTML 引用剥离，页面回退系统字体链（`CJK_FALLBACK` 首位加入 `'Noto Sans SC'`），构建不失败；`/assets/fonts/*` 纳入 `_headers` 1 年 immutable。新增单测 23 项（range 解析/交集/用字收集/HTML 文本抽取/@font-face 解析与生成/超时/离线降级/热缓存复用/JSON 配置用字）与冒烟双态断言（有网络：CSS 存在且 zh 页引用、字体文件 ≥1；降级：构建成功且无引用），本地 runner `.tmp-scripts/run-cjk-fonts.js`（zh/en 字形与请求 200、0 控制台错误，降级输出 SKIP）→ `scripts/lib/cjk-fonts.js` + `scripts/build/cjk-fonts.js` + `scripts/{cjk-fonts.test,build-smoke.test}.js` + `scripts/build/{context,config,pages,security-files}.js` + `templates/layout.ejs` + `site.json5` + `scripts/lib/site-defaults.js` + `docs/{config-reference,architecture}.md`

- **Mermaid 构建期渲染（SSR，反馈批次二·三）**：`features.mermaid` 新增 `mode`（`build` 默认 / `client` 回退）、`darkMode`（明暗双主题，CSS 切换零闪烁）、`chromePath`（空 = 自动探测：`CHROME_PATH` > Windows 默认安装路径 > Linux/macOS 的 `google-chrome`/`chromium`）。文章内 ```mermaid 块在构建时经 puppeteer-core 一次性批量渲染为双主题内联 `<svg>`（本地注入 `node_modules/mermaid`，不联网；单条 10s 超时；`.cache/mermaid` 按「版本+主题+源码」哈希缓存且不入库），页面不再请求 3.49MB vendor；输出替换前经 `sanitizeSvg` 消毒，并为 SVG 内 `<style>` 注入构建期 CSP nonce；渲染失败/无 Chrome 的条目逐条标记 `data-mm-pending` 并自动回退现有客户端渲染（`hasMermaid` 门控收敛为「有待渲染块」），`mode:'client'` 完全保持旧行为。新增单测 22 项（缓存键/块提取/替换与 sanitize 回退/Chrome 探测/无 Chrome 降级与缓存命中）、冒烟断言（内联 SVG + 页面零 vendor 请求 + 无 Chrome 双态回退）与本地 runner `.tmp-scripts/run-mermaid-ssr.js`（图表可见/暗色切换/0 vendor 请求/0 控制台错误，无 Chrome 输出 SKIP） — `features.json5` + `scripts/lib/features-schema.js` + `scripts/lib/mermaid-render.js` + `scripts/build/mermaid.js` + `scripts/build/context.js` + `scripts/build.js` + `templates/{layout,site-css}.ejs` + `scripts/{mermaid-render.test,build-smoke.test}.js` + `docs/{config-reference,architecture}.md` + `README.md`

- **弹窗公告（用户需求）**：新增 `features.popupNotice` 配置块（标题/正文/图片/二维码/按钮组/关闭方式/频率记忆/自定义配色）与运行时 `js/domains/popup-notice.js`（焦点陷阱、Esc/遮罩/×/按钮关闭、内容哈希 + 会话/每天频率记忆、reduced-motion 适配），接入 idle 队列与 deferred chunk；构建期校验 `scripts/lib/popup-notice-config.js` + 单测 10 项 — `features.json5` + `scripts/lib/features-schema.js` + `templates/site-css.ejs` + `docs/config-reference.md`
- **软导航（无刷新跳转，用户需求）**：新增 `features.softNavigation` 配置块与 `js/core/soft-nav.js`：拦截站内同语言链接，经「悬停预取 + fetch + DOMParser 交换 `.content-wrapper` + 同步 head 元信息 + pushState/popstate」替代整页刷新；同文档 View Transitions 提供过渡；页面级模块（TOC/阅读进度/返回顶部/代码块/TTS/收藏/评论/阅读历史/打赏/命令面板）通过 `__SOFTNAV_HOOKS__` 在交换后重绑；任何异常自动回退 `location.href` 整页跳转；「页面加速」面板新增页内开关（默认开、带记忆）— `js/core/soft-nav.js` + `js/core/main.js` + `templates/layout.ejs` + `templates/site-css.ejs` + `features.json5` + `scripts/lib/features-schema.js`
- **配置层英文文案补齐（审计遗留 i18n）**：`features.json5` 新增 60 个 `*En` 字段（search/codeBlock/externalLink/shortcuts/readingTime/codeCopy/readMode/readingPanel/mermaid/series/related/pinned/wordCount/share/reward/gallery/heatmap/stats/prevNext/maintenance/comments/contactPopup/hero/dailyQuote/favorites/subscribe），friends.json5 补 `descriptionEn`/`applyNoteEn`/`nameEn`/`descEn`，navigation/sidebar/site/tuning 补 `placeholderEn`/`bioEn`/`buttonTextEn`/`htmlEn`/`popupTitleEn`/`popupContentEn`/`noteEn`/`labelEn`/`emptyTextEn`；**空 = 回退中文**。构建期模板按 `lang` 取 `*En`，运行时模块（search/share/code-block/comments/contact-popup/favorites）按 `data-lang` 取 `*En`；顺带修复面包屑 `nav.favorites/gallery` 与 `post.series` 等 en 词典缺键、`favorites.ejs` 句中硬编码中文 — `features.json5` + `friends.json5` + `navigation.json5` + `sidebar.json5` + `site.json5` + `tuning.json5` + `scripts/lib/features-schema.js` + `scripts/lib/site-defaults.js` + `scripts/lib/tuning-defaults.js` + `templates/{post,layout,links,gallery,favorites,archive}.ejs` + `js/domains/{features,core}/*` + `ui-strings.json5` + `docs/config-reference.md`

### Performance

- **LCP 分相采集与治理（反馈批次三 T5）**：`scripts/perf-audit.js` 采集升级——① LCP 元素（tag/id/class/文本摘要/图片 URL/尺寸）；② LCP 分相（TTFB / 资源加载延迟 / 资源加载时长 / 渲染延迟；图片取命中的 `PerformanceResourceTiming` 条目计算，规避 Chrome LCP 条目 `startTime` 等于渲染时间的口径陷阱）；③ render-blocking 资源清单（`renderBlockingStatus === 'blocking'`）；④ 首屏请求清单（`startTime ≤ FCP`）。CLI/控制台/JSON 兼容保留并扩展 Markdown 章节。`scripts/build/serve.js` 按 `Accept-Encoding` 对文本类 MIME 做 gzip（`node:zlib`；`Vary: Accept-Encoding`；二进制透传、未声明原样、304 语义不变），并支持 `startServer(config, { port })` 注入端口与返回 server 实例，使本地测量贴近生产边缘压缩；新增 `scripts/serve-compression.test.js` 4 项单测。
- **首屏渲染延迟治理 `features.lcpOptimize`**：三项开关（schema 默认 false，站点配置启用）：`revealExemptFirstPaint`（首页首卡与文章头图 CSS 豁免 JS 门控的 `.motion-reveal`/`.js-img` 初始隐藏态）、`asyncCjkFontCss`（`cjk-fonts.css` 以 `media="print"` 低优先加载 + nonce 内联脚本 load 后翻回 `media="all"`，兼容 CSP、管线失败自动空转）、`skipLatinFontPreloadOnCjk`（zh 页不再 preload 48KB 拉丁字体，仍由 `@font-face` 按需拉取）。本地 gzip serve + Slow4G + 4× CPU 同会话 A/B：/zh/ 5 次中位 LCP 2056→1852ms、FCP 2032→1820ms、TBT 1018→92ms；/en/ 3 次中位 LCP 1928→1768ms；/zh/long-stress/ 3 次中位 LCP 4236→2988ms（渲染延迟 3751→2547ms）。前后对照、分相与首屏/阻塞清单见 `docs/perf-baseline-local-lcp.md`（runner：`.tmp-scripts/run-perf-lcp.js`，自收尾 + 端口释放校验）— `scripts/perf-audit.js` + `scripts/build/serve.js` + `scripts/serve-compression.test.js` + `templates/layout.ejs` + `templates/site-css.ejs` + `features.json5` + `scripts/lib/features-schema.js` + `scripts/build.test.js` + `docs/config-reference.md` + `docs/perf-baseline-local-lcp.md`

- **下折叠 content-visibility 治理（T5 遗留，A/B 实测结论：不启用）**：新增 `features.lcpOptimize.contentVisibility` 开关（schema 默认 `false`，站点保持 `false`）——开启时构建期输出条件 CSS，对文章页正文直接子块（代码块 `pre` / `table` / Mermaid `.mermaid` / `picture`）应用 `content-visibility:auto` + `contain-intrinsic-size:auto <估算>`（`auto` 记忆上次渲染尺寸）。同会话 A/B（本地 gzip serve + Slow4G + 4× CPU + 禁缓存，每页 3 次中位）：长文页 LCP 3576→2420ms、FCP 3044→2232ms、渲染延迟 3155→1989ms、TBT 572→464ms（首页 1792→1764ms，无实质差异，符合预期）——收益显著。**滚动稳定性套件否决启用**：冷锚点直达 `#结语`（`/zh/long-stress/#结语`）CLS 0.3845→0.6791、页面估算总高 14983px vs 真实收敛 13510px（误差约 1.5k px）、落点偏移（top 480px）；预热后滚动扫描 CLS 增量 0.0656→0.2821；TOC 高亮/返回顶部/软导航进出四项均通过。按验收标准「CLS 恶化或锚点/滚动异常则不启用」保持默认关闭（与 OFF 基线一致；OFF 基线自身存在图片懒加载固有 CLS 0.38，已在报告注明）。回退即保持/置 `false`（条件 CSS 不输出）。实测数据与套件明细：`.tmp-scripts/out/cv-ab-summary.md`、`cv-suite-{true,false}.json`（runner `.tmp-scripts/run-cv-ab.js`，自收尾 + 端口释放校验）— `features.json5` + `scripts/lib/features-schema.js` + `templates/site-css.ejs` + `docs/config-reference.md`

### Changed

- **guard 绕过通道注释语义修正与注册表同步（2026-09-27）**：`core.bypass.queryParam` 注释由「为空则禁用该通道」（与实现不符——空串实际回退默认 `'guard'`）修正为「空串回退默认，禁用请用 `urlParam:false`」；`storageFlag` 补「空字符串 = 关闭该通道」；`scripts/lib/guard-defaults.js` 结构注册表与 `guard.json5` 同步 5 个新键（`verify:config` 结构监守覆盖）。默认行为不变。
- **14 个 JSON5 配置文件注释完备 + 机械守卫（配置侧收口）**：
  - 注释补齐：全部 14 个文件补「消费方（代码位置）/文档（`docs/config-reference.md` 对应章节）」文件头；`footer.poweredBy`、`site.build.cjkFonts` 子键、`guard.copy.attribution/watermark/consoleGuard/privacyCurtain` 的 `*En` 回退语义等此前缺注释键逐键补齐；页脚/导航/侧栏/友链的 `*En`「空 = 回退中文」统一标注；清理已删除键的残留引用（`features.backToTop.rightOffset/bottomOffset`、`themeToggle` 重复键、`codeCopy.includeWindowBar`、`listCover.aspectRatio`、`mobileBottomNav.useSafeArea`、`features.feed` 迁移映射）与日期/轮次标记；**仅改注释**，14 个文件解析值经 `json5.parse` 深比较与改动前对象等价。
  - 新增守卫 `npm run verify:config-comments`（`scripts/check-config-comments.js` + 核心 `scripts/lib/config-comment-audit.js` + 13 例单测，含真实 14 文件零违规集成断言）：文件头块注释；对象键须有同行/紧邻前置/同缩进分组注释；数组元素按数据行跳过（宿主键仍受检查）；`ui-strings.json5`/`tag-aliases.json5` 按「模块级注释」口径（脚本内显式策略声明）；违规输出 `文件:行:键` 并以非零码退出；CI `deploy.yml` 在 `verify:config-refs` 后新增同名步骤。
  - 门禁实录：`npm test` 611/611（111 suites）、`npm run lint`/`npm run typecheck` 0 错、`verify:config`（97 模块一致）/`verify:config-refs`（零未接线）/`verify:config-comments`（14 文件 / 2496 键 / 0 违规）全 PASS。
- **第七轮配置闭环（W5）语义/默认值变更**：
  - `features.redirects.enabled` 默认值 `false`→`true`：原默认与历史实现漂移（`_redirects` 一直应用 `site.json5` 自定义规则）；现 `enabled` 作为自定义规则开关（false 时仍保留框架语言/别名规则），默认行为与历史一致。JSON5 注释/schema/文档同步。
  - `features.perfBudget.jsKb` 55→**60**：实测 `assets/js` 全量 gzip 58.8KB（app 26.4 + deferred 30.7 + runtime 1.7；deferred 为按需懒加载 chunk，首屏实际加载约 28KB）。按实测口径调整上限并保留 `warnOnly=true`；后续治理方向：跨模块工具去重、deferred 分包边界复核、预算分层口径评估（达标后回调 55）。`scripts/lib/perf-budget.js` 兜底默认值同步。
  - `features.performance` 组键从「未接线」变为构建收尾 `[WARN]`（不阻断）；`debug` 组键变为可选构建调试输出（默认全关，正常输出不变）。
  - 增量构建启用时（`--watch`/`--incremental`）在内存中关闭 `cleanDist` 以复用产物（不写回配置文件）；普通构建行为不变。
- **第六轮配置闭环（W4）语义/默认值变更**：
  - `mobile.buttonStackGap` 默认值 `4rem`→`3.4rem`：原默认与历史实现不符（实际堆叠步进 3.4rem，m-toc 底距 7.4rem），按「视觉不变」原则修正；新实现 m-toc 底距 = `tuning.mobileToc.btnMobileBottom(7.4rem) - 3.4rem + buttonStackGap`，默认渲染不变。
  - `contactPopup.popupWidth` 默认值 `360px`→`400px`：原默认从未生效（模板恒 `max-width:400px`），按「视觉不变」原则对齐实现并接线。
  - 灯箱打开/切换新增可见补间（默认 180/120ms 淡入）：此前打开/切换无可感知过渡（`display` 切换不受 transition 作用），本轮按 `openDurationMs`/`switchDurationMs` 接线；减少动效下仍为瞬时。
  - 返回顶部点击/快捷键由原生 `scrollTo({behavior:smooth})` 改为 rAF 自定义缓动（默认 450ms）；`smoothScroll=false` 现在对点击路径同样即时生效（此前仅 hotkey 消费），语义统一。
  - 归档统计卡在 `linkArchive` 非空（默认 `/archive/`）时渲染为 `<a class="stats-card">`（此前恒纯文本；空串关闭跳转）；样式等价（无下划线、色继承），归档页自身为同页链接。
  - 归档热力图图例首项由 `archive.count` 原始模板串 `{count} 文章` 改为 `archive.textArticle`（文章 / articles）；`legendLow/High` 默认值（少/多）与 UI 词典同值，默认输出除缺陷修复外不变。
  - 触屏设备（`touchFallback=true` 默认）新增 hover-only 控件替代交互与超宽代码块横滚提示（`codeScrollHint=true` 默认）——移动端新增可见提示 UI（首次横滚后自动隐藏）。
  - `scripts/bundle.test.js` deferred 注册表键数断言 23→24（新增 touch-fallback）。
- **第五轮配置闭环（W3）语义变更**：
  - 系列卡片徽标默认文案由 ui-strings 的「系列」改为 `features.series.badgeFormat` 默认模板「系列 · {name}」（带系列名）；系列导航面板新增可见标题（`panelTitle` 默认「本系列共 {total} 篇」）。
  - 文章页阅读时长默认显示由「N 分钟」变为「N 分钟阅读」（单一来源模板默认值与卡片一致；见上方缺陷修复）。
  - `supSub.skipInsideMath` 默认值 false→true、`wordCount.countDigits` 默认值 false→true：均为口径修正（与代码既有行为一致），默认输出不变；两键在 features.json5/schema/文档同步。
  - Mermaid `followTheme=false` 或 `darkMode=false` 的单主题产物在暗色模式下不再被隐藏（`data-theme-pair="light"` 显式保持可见）。
  - 构建 CLI 新增 `--features-override` 参数（默认路径不受影响）。
- **第四轮配置闭环（W2）语义变更**：浮层搜索排序由「索引原序（日期倒序）」改为「加权总分降序（默认标题 5 / 摘要 2 / 正文 1）」；`/search` 页排序由固定 `10/3/3/5/4` 改为同一 config 权重语义（标签/分类改为仅参与入选、计 0 分），两处检索行为统一；`matchTags/matchCategories` 默认 true 使标签/分类命中进入结果集（**超集**，行为变化）；结果计数文案由 `N 个结果`（`ui-strings.search.foundText`）改为 `找到 N 个结果`（`ui-strings.search.foundCount`）；`hero.searchPlaceholderEn` 默认文案由 ui-strings 的 `Search posts...` 切换为 features 值 `Search posts…`（en 首页占位仅省略号字符差异）；`search.emptyHint/emptyHintEn` 默认由 `输入关键词开始搜索` / `Type a keyword to search` 改为空串（= 沿用 `noResultText`，浮层无结果默认输出不变）；外链提醒浮层新增「复制链接」按钮（默认 `复制`/`Copy`）。
- **无结果文案优先级调整（W2）**：`features.search` 键现在优先于 `tuning.search`（`emptyHint(En) > noResultText(En) > tuning.search.emptyText(En) > i18n 兜底`；此前 `tuning.search.emptyText(En)` 优先于 `noResultText(En)`）；两者默认文案同值，默认渲染不变。
- **第三轮配置闭环（2026-09-27 W1）语义/来源变更**：`themeToggle.defaultTheme/rememberChoice/iconStyle/transitionAll` 唯一来源迁移至 `theme.json5 → darkMode.*`（原键删除，`themeToggle` 仅保留 `enabled/persistKey/toggleIconSwap/zIndex`）；`listCover.showOnArchive` 由未接线转为生效（标签归档列表 `/tags/<tag>/` 封面显隐，默认 true=现行为；/archive/ 年表页保持纯文字列表）；`dailyQuote.widgetStyle` 取值语义改为 `card`（默认，等同旧值 `sidebar`）/`plain`；`motion.revealStaggerMax` 默认值由 80 调整为 500（仅在 `revealDelayMs>0` 时产生错峰，默认 `revealDelayMs=0` 行为不变）；`searchHighlight.markClass` 默认由 `'search-hit'` 调整为 `''`（代码此前恒输出裸 `<mark>`，默认行为不变）。
- **未接线预留键全量标注（W2）**：对 features.json5 中机器扫描确认无消费方的 142 个叶子键逐键加 `⚠ 未接线（预留）：<原因/替代> ` 注释，并在 `docs/config-reference.md` 新增「3.0 未接线键总表」（43 个模块分组，状态/原因/替代来源）；本轮接线 20+ 键后剩余 135 个预留键全部可审计，不再存在「看起来能调、实际无效且无标注」的键。
- **跨文件语义重复清理（W3）**：`features.themeToggle.animationMs`（250）与 `theme.animation.transitionDuration`（0.25s）语义重叠、实际生效后者，已删除前者（features.json5/schema/config-reference 同步）；其余重复项结论见 `docs/config-audit-2026-09-27.md`（backToTop 偏移与 tuning 同义、lightbox.maxWidthVw 与 imageFit.lightbox.maxWidthPct 同义、contactPopup.popupWidth 360px 与模板 400px 漂移等，已在 JSON5 标注）。
- **文档同步**：`docs/config-reference.md` §3.2/3.4/3.9/3.10/3.23/3.42/3.86/3.90/10 更新为接线后语义与新 tuning 分类（37 分类 / 269 项）。

- **dark-toggle 按钮级悬停微动效（残余验证批次）**：`.dark-toggle:hover` 新增 `transform:scale(1.06)`（按钮本身缩放，不触碰 svg 内部，morphicon 主题变形不受影响；`:active` 仍走既有 `--motion-buttonPressScale`），`prefers-reduced-motion:reduce` 下取消。无头实测 13 断言：悬停 computed transform=`matrix(1.06,...)`、移开回 `none`、morphicons 接管下点击 path 发生 morph、reduce 下悬停保持 `none` 且主题切换正常、0 控制台错误，截图 3 张 — `templates/site-css.ejs` + runner `.tmp-scripts/run-dark-toggle-hover.js`

- **header 图标按钮悬停微动效统一（用户验收反馈）**：此前仅 `dark-toggle`（主题切换旋转）与 `nav-link` 系列有悬停动效，`search-toggle`/`nav-boost-btn`/`nav-toggle` 悬停无反馈。现 `search-toggle`、`nav-boost-btn` 的 svg 与 `nav-link` 系列共用 `--icons-hoverLift` 上浮过渡；`nav-toggle` 汉堡图标（morphicons 接管后的 svg，或未启用 morphicons 时的三条 span）同样轻量上浮；统一在 `prefers-reduced-motion:reduce` 下 `transform:none`；`dark-toggle` 主题切换 morphicon 动画保持不变 — `templates/site-css.ejs` + 巡检 runner `.tmp-scripts/run-nav-detail.js`

- **测试入口自举（Node 20 兼容）**：`npm test` / `npm run test:coverage` 改由 `scripts/run-tests.js` 枚举 `scripts/*.test.js` 后调用内置 test runner，消除对 Node 21+ 内部 glob 展开与 shell 展开的依赖（Windows + Node 20 可用）；CI 新增 `compat-node20` 任务（Node 20.19.0 上跑 `npm test` + `verify:config` + `test:build` + `build`） — `scripts/run-tests.js`、`package.json`、`.github/workflows/deploy.yml`
- **开发服务器看门狗（防孤儿进程）**：`scripts/build/serve.js` 支持 `SYNAPSE_SERVE_PARENT_PID`（父进程退出后 5 秒内自退）与 `SYNAPSE_SERVE_IDLE_MS`（空闲超时自退）环境变量，并处理 SIGINT/SIGTERM；所有 `.tmp-scripts` 工具脚本自动继承；新增 `node .tmp-scripts/kill-orphans.js` 兜底清理 — `scripts/build/serve.js`
- **构建管线拆分（反馈批次二·二.1）**：`scripts/build.js` 从 3416 行拆为 **265 行编排器 + `scripts/build/` 工厂模块**（config/markdown/articles/collectors/pages/helpers/report/render/feeds/security-files/assets/minify/media/serve/cache/context），每步 dist 哈希等价（173 文件）并以 `npm run test:build` 守护 — `scripts/build/*`
- **软导航接管站内跳转**：`softNavigation` 默认开启时 `page-transition.js` 不再拦截点击（避免双重过渡）；`command-palette` 导航项/操作项改为打开时实时采集，消除软导航后的过期数据；卡顿探针定位「点击 336–410ms 长任务」根因为文档级导航本身（4× CPU 下），软导航从链路上消除该冻结 — `js/domains/page-transition.js` + `js/domains/command-palette.js`
- **构建失败语义收紧（审计 T1）**：新增 `scripts/lib/build-errors.js` 收集器与构建前只读预校验（重复 slug/非法日期/空标签/缺失 `/media`）；feed/sitemap/模板/媒体/OG/压缩等运行期失败不再静默，构建尾部汇总并以非零退出码结束；`--allow-degraded` 支持本地降级预览 — `scripts/build.js` + `scripts/lib/build-errors.js` + `scripts/lib/content-validate.js` + 单测 27 项
- **定时发布（审计 F-11）**：`date` 晚于构建时间的文章排除页面/feed/sitemap/搜索索引并在日志提示 — `scripts/lib/publish-window.js` + 单测 5 项
- **缓存头分级（审计 P-5）**：`/assets/css/*` immutable 1 年；`/assets/js|vendor/*` 1 小时 + `stale-while-revalidate`；`/media|og/*` 7 天 + SWR；`site.build.cacheControl: false` 可关闭 — `scripts/build.js`
- **搜索弱网韧性（审计 L-1/L-2）**：索引请求 5 秒超时 + 一次重试、错误态与重试按钮、入口按钮存在性守卫 — `js/domains/search.js` + `templates/index.ejs` + `templates/layout.ejs`
- **文档计数与安全声明（审计 F-14/O-5）**：测试计数更新为 180 项/38 组；新增 `SECURITY.md`（accessGate 软防护声明、LOG_IP_SECRET、限流边界）

### Fixed

- **CSS 合并配平误判安全页面导致 `verify:security`/CI 红（压缩 C9，2026-09-27）**：`scripts/lib/css-merge.js` 的标签配平检查原以正则全量计数（`<script\b` 等）对照令牌匹配数，安全夹具页面 `<title>` 的 RCDATA 惰性文本（`</script><script>` 字面）以及属性值/注释/JS 字符串中的标签字面会被误计为真实标签，真实页面被误判「不平衡」并抛错（CI run 36286368788）；现改为上下文感知扫描（对齐浏览器分词：注释、`title`/`textarea` RCDATA、`script`/`style` rawtext 内容与带引号属性值中的 `<` 不再计为标签），真实缺失闭合标签/开闭计数不平衡仍保守抛错。同时 `scripts/build/minify.js` 中 CSS 合并/去重的单文件解析异常不再调用 `recordBuildFailure('compression')`（原行为使构建 exit 1，与该步骤「跳过 + 告警」的设计语义矛盾），改为告警 + 跳过计数与原因汇总，写入 `dist/report.txt` 压缩统计段（`scripts/lib/build-report-text.js` 扩展 `cssSkips` 字段，缺失容错）。回归测试：`scripts/css-merge.test.js` 42 例（+6 配平边界）、`scripts/compression-pipeline.test.js` 跳过路径断言（不进入失败账本、原文件保留）、`scripts/build-report-text.test.js` 17 例（+2 跳过明细渲染/容错）；85 个 dist 页面新旧实现输出逐字节等价。
- **增量构建被后续阶段抵消（`cacheBust` 非幂等，构建正确性）**：增量模式不清空 dist，上一轮已内容寻址的文件再次进入扫描时被重复追加哈希并连锁改写全部 HTML 引用（每次构建全量重写、文件名哈希层层累积）。现按「文件名已带本轮内容哈希」跳过；新增回归测试 `scripts/cache-bust.test.js`（3 例：首轮改名、二次幂等、内容变化单层新哈希）。
- **增量指纹数据泄漏（改 `pages/*.md` 使全部页面失效）**：`customPages` 曾被整体注入 `baseData`（无任何模板消费点），且 `pagesContent` 以完整对象进入每页数据（实际仅 `templates/post.ejs` 文章页脚按 `theme.articleFooter.source` 取用）。现移除 `baseData.customPages` 注入、`pagesContent` 仅投影文章页脚所需单键——改单页只重建该页（runner 断言 rebuilt=1、mtime 与页面指纹仅目标页变化），全量产物与修复前逐字节等价。
- **归档热力图图例显示字面 `{count} 文章`（用户可感知，W4 顺带修复）**：图例首项误用 `ui-strings archive.count`（`{count} 文章` 模板串）未做替换；现改用 `archive.textArticle`（文章 / articles）；见 `templates/archive.ejs`。
- **返回顶部动画被 CSS 平滑二次接管（W4 实现中自检发现）**：`html{scroll-behavior:smooth}` 下 rAF 每帧 `window.scrollTo(0,y)` 会被浏览器再平滑一次导致动画失效/交错；改用 `behavior:'instant'` 逐帧定位（旧浏览器回退）。

- **导航高亮构建期 SSR + 运行时脱离 motion 开关（残余验证批次）**：此前高亮只在 `motion.js` 启动时按 `location.pathname` 计算，`features.motion.enabled=false` 或 `reducedMotion:'off'` 时无高亮、JS 不可用时同样缺失。现构建期由 `scripts/lib/nav-match.js`（与运行时逐字同源的 `navPath`/`isNavActive`）按页面 `currentUrl` + 菜单算出唯一激活项，`templates/layout.ejs` 对匹配 `.nav-link` 直接输出 `nav-active` + `aria-current="page"`（首页精确、栏目精确、子路径前缀，文章页不误高亮）；运行时判定抽为独立关键模块 `js/domains/core/nav-state.js`（`motion.js` 只保留动效），motion 关闭或 JS 不可用时高亮仍正确，软导航/前进后退仍随动；指示器改为复用 SSR 模板节点（消除此前重复创建的第二枚 `span.nav-indicator`）。验收：`npm test` 374/374（新增 `scripts/nav-match.test.js` 9 项 + build-smoke SSR 断言）、`test:build`/`lint`/`typecheck`/`verify:config` 全绿；新 runner 27 断言（4 页 SSR grep + 请求拦截注入 motion=off 后软导航高亮/指示器仍随动 + URL 直达 + 0 控制台错误 + 端口释放），旧 `run-nav-detail.js` 37 断言无回归 — `scripts/lib/nav-match.js` + `scripts/nav-match.test.js` + `scripts/build/render.js` + `scripts/build-smoke.test.js` + `templates/layout.ejs` + `js/domains/core/nav-state.js` + `js/domains/core/motion.js` + `js/core/main.js` + `docs/config-reference.md`

- **顶部导航高亮软导航失联 + 滑动指示器（用户验收反馈）**：首屏 `nav-active` 原由 `motion.js` 在启动时一次性按 `location.pathname` 计算，软导航只交换 `.content-wrapper`，标签栏高亮停留在旧页（需再点一次标签触发整页刷新才更新，且无过渡）。现抽成可重入 `syncNav()`（重算 `nav-active` 与 `aria-current="page"` 并清理旧项），在初始化、`__SOFTNAV_HOOKS__`（每次内容交换完成）、`popstate`（前进/后退）三处触发；桌面端在 `#mainNav` 内新增 `span.nav-indicator` 浅色 pill，按当前激活链接相对导航容器定位，`transform`+`width` 用 `--td/--te` 过渡，`ResizeObserver` + `window resize` + `document.fonts.ready` 后重算，移动端（≤导航断点，导航折叠）隐藏，`prefers-reduced-motion:reduce` 取消位移动画直接切换；指示器为纯增强——JS 失效时 `.nav-active` 颜色/底纹高亮不变（仅在指示器激活时由 `.nav-indicator.on~.nav-list` 让位背景避免叠加）。实测 runner `.tmp-scripts/run-nav-detail.js`（端口 3320，37 断言全过：首屏对齐、软导航/后退随动、无整页刷新、移动端隐藏、0 控制台错误、端口释放）— `js/domains/core/motion.js` + `templates/layout.ejs` + `templates/site-css.ejs`

- **header 图标按钮原生悬浮提示恢复（用户验收反馈）**：`nav-toggle`/`search-toggle`/`nav-boost-btn`/`dark-toggle`/`lang-btn`/`back-to-top`、文章页 `reader-gear`、`m-toc-btn`、`m-toc-close`/`lb-close`/`search-close` 此前只有 `aria-label`，鼠标悬停无原生 title 提示；现统一补 `title` + `data-i18n-title` 并保持中英随语言；i18n 运行时新增 `data-i18n-title` 支持（与 `data-i18n-aria` 同路径，切换语言同步更新 title）。巡检断言中英页 title 与词典一致（英文页不为中文回退）— `templates/layout.ejs` + `templates/post.ejs` + `js/domains/core/i18n.js`

- **图片构建期定尺寸 + 锚点落点稳定（CLS 治理）**：正文（含 `<picture>`）/头图/卡片/画廊图片构建期输出 `width`/`height`（manifest 原图元数据，渲染前预留宽高比），修复「图片未预留高度导致布局偏移与锚点落点漂移」；新增 `features.anchorStabilize`（`enabled`/`settleMs`/`maxTrackMs`，默认开）在整页 hash 直达后按 `load` + `ResizeObserver` 校正落点、跟踪至布局静默，用户输入即停（`html.anchor-stabilizing{overflow-anchor:none}` 防止滚动锚定反向推走落点）。实测（本地 gzip serve + Slow4G + 4× CPU，3 次中位）：冷锚点 CLS 0.5367→0.0011、滚动扫描增量 0.0240→0.0002、落点 1587→146px（最终误差 9.9px，校正瞬间即达理想位，其后极晚布局回移约 10px，页面总高 13983px 不可感知）；TOC 高亮/返回顶部/软导航不受影响；构建 smoke 新增图片尺寸与锚点断言 — `scripts/build/markdown.js` + `scripts/build/pages.js` + `js/domains/core/anchor-stabilize.js` + `js/core/main.js` + `templates/{post,gallery,site-css}.ejs` + `features.json5` + `scripts/build.test.js` + `scripts/build-smoke.test.js`

- **serve 看门狗绝对时限（防任务取消遗留孤儿）**：在父进程监督之外新增 `SYNAPSE_SERVE_MAX_MS` 绝对寿命上限，到时无条件退出——兜底「父进程 PID 被复用」与「监督脚本本身被中断（如任务取消）」两类监督失效场景；`.tmp-scripts` 25 个带服务脚本统一注入 30 分钟上限；实测 2 秒上限自动退出且端口释放，看门狗用例 3/3 通过 — `scripts/build/serve.js`

- **搜索页计数服务端本地化（残余清理）**：搜索页结果计数原先用运行时 `__T` 两次拼接键值，英文页因字典时序回退为中文、且 `foundCount` 的 `{count}` 占位符直接可见；现改为服务端 `ui('search.foundCount')` 模板串 + `{count}` 替换，中英渲染均为成句文案 — `templates/search.ejs`

- **根 404 语言自适应（残余清理）**：`_redirects` 不再把 `/404.html` 全局 302 到 `/zh/404.html`；根 404 由构建期注入语言自适应脚本（en 访客跳 `/en/404.html`，尊重 `s-ss-lang` 语言锁），中文访客保持在根 404 不重定向；构建 smoke 新增两条产物断言 — `scripts/build.js` + `scripts/build/security-files.js` + `scripts/build-smoke.test.js`

- **英文页站点级文案与 404/guard 残余 i18n（反馈批次三 T4）**：`site.json5` 补 `descriptionEn`（meta/OG/JSON-LD/Feed）、`languageEn`、`seo.metaKeywordsEn`、`authorProfile.bio/bioEn` 演示数据，`scripts/build/pages.js` 新增 `localizeSite()` 按页面语言取用（未配置 `*En` 的站点行为不变）；修复英文页侧栏「最近文章」日期显示 `2026年9月10日`（`layout.ejs` 的 `toLocaleDateString(site.language)` 现随语言取 `languageEn`，空则 `en-US`）；404 页 notFound 五处静态中文改为服务端 `ui()` 按语言渲染（`data-i18n` 运行时兜底不变）；guard 锁屏标题/正文/关闭按钮改走 `ui-strings.json5`（`guard.json5` 对应键留空，显式填写仍优先覆盖），`guard/core.js` 的 `t()` 按页面语言优先取 `__I18N__.en.guard`（右键菜单等 guard 提示在英文页同步生效）；新增 10 项单测与产物/运行时 runner（`.tmp-scripts/run-t4-i18n.js`，端口 3313 自收尾）— `site.json5` + `scripts/lib/site-defaults.js` + `scripts/build/pages.js` + `templates/404.ejs` + `ui-strings.json5` + `guard.json5` + `js/domains/guard/{core,devtools-detect}.js` + `scripts/i18n-residuals.test.js` + `docs/config-reference.md`

- **搜索入口在软导航后失效修复（用户反馈）**：首页 hero「搜索文章」、404 页搜索按钮、侧栏搜索框回车原先由 search 模块一次性绑定到具体节点——软导航替换内容区后节点被换新，入口静默失效（点按无反应）；且模块加载完成前点击同样无响应。现改为 `js/core/main.js` 关键路径的**文档级事件委托**（`click` 捕获 `.hero-search`/`#errSearchBtn`、`keydown` 捕获 `.widget-search-input` 回车），并对加载前点击以占位 `openSearch` 排队、search 模块就绪后自动补开 — `js/core/main.js` + `js/domains/features/search.js` + 回归 runner `.tmp-scripts/run-search-entry.js`（9/9：加载前排队补开/无刷新/首访/软导航返回/404/侧栏回车/0 控制台错误）

- **全页 a11y 实测修复三处（可访问性与移动端批次）**：① 主按钮背景 `#4a90d9` 配白字仅 3.34:1 → `#2563eb`（5.17:1，`theme.json5` + `site-defaults.js`）；② 暗色系列导航徽标白字配 `#7caeff` 仅 2.24:1 → 暗色改用 `var(--color-bg)` 深色文字（7.95:1）；③ 宽 KaTeX 行间公式（nowrap 内容宽于容器）在 375px 视口撑破页面 → `.post-content .katex-display{overflow-x:auto;overflow-y:hidden;max-width:100%}`，长文压力页 scrollWidth 426→375 — `theme.json5` + `scripts/lib/site-defaults.js` + `templates/site-css.ejs`

- **公告条关闭记忆按语言独立（用户反馈）**：`announcement.storageKey` 升级为按语言区分的 JSON 对象存储（`{"zh":hash,"en":hash}`，旧版单值访问时自动迁移），修复「关闭英文公告后中文公告复现、中文公告不显示」的跨语言互相覆盖问题 — `templates/layout.ejs` + `js/domains/announcement.js`

- **配置注册补齐与文档同步**：`site.build.cacheControl` 纳入 `scripts/lib/site-defaults.js` 注册表与 `site.json5`（含完整注释）——此前该键会被 `verify:config` 判为死键；`features.ogImage.cacheDir` / `features.incrementalBuild.cacheDir` 注释标注为预留未接线（实际为 `.cache/og` / `.build-cache.json`）；`docs/config-reference.md` 修正 `blobRevokeDelayMs` 默认值为 1000，README 补充 `verify:config` 值覆盖语义。

- **speculationrules 动态脚本携带 nonce**：`seamless-nav.js` 动态创建的推测规则脚本继承页面 CSP nonce，修复 nonce 化后 Chrome 报 `'inline-speculation-rules'` CSP 违规（推测规则被拦截）的问题 — `js/domains/seamless-nav.js`

- **安全验证夹具去演示依赖（真实站点适配）**：`security-verify.js` 夹具 `<img>` 改用 `/assets/sec-verify-placeholder.png`，不再引用可能被清理的演示媒体，避免无演示媒体的真实站点下 `verify:security` 被内容预校验误报中断 — `scripts/security-verify.js`

- **配置一致性检查允许值覆盖（真实站点适配）**：`verify:config` 的 features 比对改为结构/死键/类型判定，值级自定义（公告文案、OG 封面开关等）列为信息项不再误判 FAIL；新增 `scripts/lib/config-consistency.js` + 单测 7 项 — `scripts/check-config-consistency.js` + `scripts/config-consistency.test.js`

- **Worker 路径归一化加固（审计 SEC-2）**：解码循环 + 点段折叠，阻断 `%2e%2e`/双重编码绕过 — `workers/lib/ip-utils.mjs` + 单测
- **空数组配置语义（审计 SEC-6）**：`pathRestrictions: []` / `skipPaths: []` 显式生效，仅缺失字段回退内置兜底；文档与代码一致 — `workers/security-worker.js` + `scripts/generate-security-config.js` + `security.json5` + 单测 3 项
- **安全头注入校验（审计 SEC-7）**：头名限 RFC 7230 token、值禁 CR/LF/NUL，非法配置构建期报错 — `scripts/generate-security-config.js` + 单测 4 项
- **限流 fail-closed 与日志 HMAC（审计 SEC-3/SEC-8）**：`CF-Connecting-IP` 缺失时共享桶计数；`LOG_IP_SECRET` 配置后使用 HMAC-SHA256 — `workers/security-worker.js` + `.env.example` + 单测 1 项

- **重复 Cache-Control 合并缺陷（S3 线上验证）**：Cloudflare 会把同一路径的所有匹配规则合并为逗号连接的单个 `Cache-Control`，原「`app/deferred/runtime.*.js` 专用规则 + `/assets/js/*` 兜底」叠加为非法双 `max-age`；改为按模式二选一：打包模式 `/assets/js/*` 整目录 immutable（该目录仅存哈希产物），`--no-bundle` 回退模式仍为 1 小时 + SWR — `scripts/build/security-files.js` + 冒烟断言 1 项

### Security

- **移除模板内联样式属性并收紧 CSP `style-src-attr`（反馈批次三 T3）**：模板 11 个文件约 42 处静态 `style="..."` 全部消除——重复样式归并为工具类（`.empty-state`/`.empty-hero`/`.btn-muted`/`.post-actions`/`.search-page-input` 等，含搜索页 JS 动态拼串）；配置驱动值改为构建期非ce `<style>` 规则（主题预设色板、公告进度时长、文末卡片配色、系列进度宽度、社交头像尺寸、logo 宽度、卡片分类色相）或 runtime CSSOM（`data-vt` → `view-transition-name`，软导航后经 `__SOFTNAV_HOOKS__` 重扫，新增 `js/domains/core/vt-names.js`）；`display:none` 改为 `hidden` 属性 + JS `el.hidden` 切换（外链提醒/联系弹窗）；Mermaid SSR 的 SVG 内联 `style` 与 `font-style` 表现属性统一搬入追加的 `#id#id` 高优先级规则（无 `!important`，mermaid 自身 `!important` 规则优先关系不变）；构建报告页同行内样式改类。`security.json5` 删除 `style-src-attr ['unsafe-inline']`（属性语境按 CSP3 回退到同样拒绝内联的 `style-src`），Worker FALLBACK 同步删除；回归断言扩展至构建产物全 HTML 无元素 `style` 属性（`npm run test:build`）与 `verify:security` 全量扫描；无头验证 6 代表页 0 CSP 违规、0 控制台错误，共享元素过渡/预设色板/灯箱/联系弹窗行为不变 — `templates/*.ejs` + `scripts/build/report.js` + `scripts/lib/mermaid-render.js` + `js/domains/core/{vt-names.js,external-link.js,main.js}` + `js/domains/features/{contact-popup.js,morphicons.js}` + `security.json5` + `workers/security-worker.js` + `scripts/{build-smoke.test,security-verify}.js` + `docs/{config-reference,architecture}.md` + `SECURITY.md`

### Added

- **预算门禁收紧（T1.7）**：`features.perfBudget` 由 3 项扩为 5 项：`htmlKb 70→28`、新增 `htmlRawKb 50`（页面 raw 中位）与 `inlineConfigKb 2`（内联关键配置）、`jsKb 90→55`、`requests 18→12`；实测全绿（21.9 / 35.8 / 0.3 / 47.7 / 8）— `scripts/lib/perf-budget.js` + `scripts/build.js` + `features.json5` + 单测 2 项

- **Prism 按页门控（T1.3 偏差项）**：`theme.externalAssets.scripts` 中的默认 Prism 仅在含高亮代码块的页面注入（`hasHighlightableCode` 纯函数，mermaid-only 块不计；inline `<code>` 不计）；首页/列表/归档等零成本页不再加载 82KB vendor，实测首页请求 17→16、总传输 −82KB、TBT 中位 515→424ms — `scripts/lib/utils.js` + `scripts/build.js` + `templates/layout.ejs` + 单测 5 项 + 冒烟 2 断言

- **字体 preload 复核与哈希 JS 缓存升级（优化 1.4/1.5）**：确认并保留 4 个 preload（fonts.css + Inter/Sora/Manrope woff2，随字体栈自动生成，无冗余 preconnect）；`_headers` 打包模式下发 `/assets/js/*` immutable 1 年（该目录仅存哈希产物），`--no-bundle` 回退仍为 1 小时 + SWR；交付层核对 HTML gzip 21.9KB — `scripts/build/security-files.js` + `README.md`

- **vendor 瘦身（优化 1.3）**：KaTeX 字体仅保留 woff2（654.9→254KB，删除 woff/ttf 回退格式）；mermaid（3.5MB）由 `defer` 改为页面 `load` 后 `requestIdleCallback` 拉取（仅图表页加载，零成本页 0 请求）；Prism 维持 8 语言子集；冒烟新增 KaTeX 字体纯净断言，本地 runner 新增「零成本页不加载 mermaid / 图表页渲染 5 个 SVG」双态断言 — `scripts/build.js` + `templates/layout.ejs` + `scripts/build-smoke.test.js`

- **esbuild 两段 chunk 打包（优化 1.2）**：`scripts/lib/bundle.js` 以 esbuild 0.28.1 产出内容哈希的 `app.<hash>.js`（首屏启动链）与 `deferred.<hash>.js`（21 个交互/重模块聚合，运行时按需载入），`runtime.js` 引导脚本内容哈希单发；`--no-bundle` 回退原生 ESM；新增 5 项单测与冒烟断言（chunk 存在/HTML 引用/raw 源码不拷贝）；JS gzip 全站 49.6→46.0KB — `scripts/lib/bundle.js` + `js/core/main.js` + `js/core/deferred.js` + `scripts/build.js` + `templates/layout.ejs`

- **运行时配置外置与 fail-open 降级（优化 1.1）**：全量运行时配置拆为内容寻址的 `/assets/config.<sha1 前10>.json`（immutable）；HTML 仅内联 ≤2KB 降级子集（guard 开关 + PWA 注册），单页 HTML raw 71.5KB → 42.8KB；启动异步加载（重试 1 次 / 3s 超时），失败时降级继续可用（`__CONFIG_OK__=false`）；新增 `scripts/lib/config-split.js` + 11 项单测，`boot.js` 等待配置就绪后调度，`runtime.js` 承载引导 — `scripts/build.js` + `templates/layout.ejs` + `js/core/*`

- **dist 产物归一化哈希护栏（重构 T0.5）**：新增 `scripts/lib/dist-hash.js`（nonce/CRLF 归一化、`build-report.html` 与 `og/` 忽略、SHA-256 清单与差异比较）与 `scripts/dist-hash-guard.js` CLI（`snapshot`/`diff`；等价 exit 0、有差异 exit 1、参数错误 exit 2），用于 build.js 机械拆分前后的产物等价验证（跨构建随机 nonce 不再误报）；新增 16 项单测 — `scripts/lib/dist-hash.js` + `scripts/dist-hash-guard.js` + `scripts/dist-hash.test.js`
- **可复现性能基线（优化 T0）**：新增 `npm run perf:audit`（`scripts/perf-audit.js`）——固定 Slow 4G（下行 1.6 Mbps / 上行 750 kbps / RTT 150ms）+ CPU 4x + 禁用缓存的冷加载采样，采集 LCP / CLS / 交互最大时长（INP 代理）/ 长任务总时长（TBT 代理）/ HTML 传输字节 / 总传输字节 / 请求数，支持 `--runs`（默认 3）取中位数、`--out` 输出 Markdown 基线与 `--json` 结构化结果、`--chrome`/`CHROME_PATH` 指定浏览器；生产站基线记录于 `docs/perf-baseline.md` — `scripts/perf-audit.js` + `package.json` + `docs/perf-baseline.md` + `README.md`
- **Worker 结构化日志与请求 ID**：Worker 输出 JSON Lines 日志（`ts`/`level`（RFC 5424 严重度映射）/`module`/`requestId`/`event`），`LOG_LEVEL`（`off`/`error`/`warn`/`info`/`debug`，默认 `info`）控制级别；每请求复用 `CF-Ray` 或生成 UUID 作为 `requestId`，并以 `X-Request-Id` 响应头回传；IP 以 SHA-256 短哈希关联（不落明文）；维护/限流/黑名单/路径拦截/CSP 报告/502 等路径全部接入 — `workers/security-worker.js` + `scripts/security-worker.test.js` + `README.md` + `docs/config-reference.md` + `.env.example`
- **性能实测与优化（Slow 4G + 4x CPU 冷加载）**：首页 LCP 3056ms → 868ms（首页/标签卡片图改用媒体管线 640/1024/1600 多尺寸 `srcset`，浏览器选 640 变体）；长文页主题切换 INP 760ms → 88ms（Mermaid 重渲染改 `requestIdleCallback` 调度、`setTimeout 60ms` 兜底，避免阻塞输入响应）；本地字体 3 个 `@font-face` CSS 合并为单一 `fonts.css`（减少 2 个阻塞请求）。方法：Chrome DevTools MCP（`Slow 4G` + CPU 4x、忽略缓存）。留存观察：首屏偶发 CLS≈0.14（两次测量未复现、归因未定）；本地 dev server TTFB 方差较大（10–660ms），指标以多次取样为准 — `scripts/build.js` + `templates/layout.ejs` + `templates/index.ejs` + `templates/tag.ejs`
- **externalAssets 支持 SRI 透传**：`theme.json5` 的 `externalAssets.styles/scripts` 元素新增对象形态 `{ href/src, integrity?, crossorigin? }`（字符串形态不变），构建按需输出 `integrity`/`crossorigin` 属性；CSP 域名裁剪同步支持对象形态（`scripts/lib/csp.js`）；文档同步 `docs/config-reference.md` — `templates/layout.ejs` + `theme.json5` + `scripts/lib/csp.js` + `scripts/csp.test.js`
- **OG 图输出格式可选 JPEG**：`features.ogImage.format`（`png` 默认 / `jpeg`，`jpg` 同义）+ `jpegQuality`（默认 82，越界回退），`og:image`/`twitter:image`/JSON-LD image 与产物扩展名、旧格式清理均随格式联动；新增纯函数与 7 项单测 — `scripts/lib/og-format.js` + `scripts/og-format.test.js` + `scripts/generate-og.js` + `templates/layout.ejs` + `features.json5` + `scripts/lib/features-schema.js`
- **构建产物原子写**：新增 `scripts/lib/atomic-write.js`（临时文件 + rename；Windows EPERM/EBUSY 退避重试一次；失败清理临时文件且不产生半截文件）；`scripts/build.js` 全部 27 处产物写入与 OG 图生成（临时文件 + commit）接入；新增 8 项单测 — `scripts/lib/atomic-write.js` + `scripts/atomic-write.test.js` + `scripts/build.js` + `scripts/generate-og.js`

### Security

- **CSP nonce 化（审计 SEC-1）**：构建期为全部可执行内联脚本注入一次性 nonce，`_headers` 与 Worker 同步下发 `'nonce-…'`；15 处模板内联事件属性改为 `addEventListener`（导航/主题/预设/搜索/联系弹窗/返回顶部/KaTeX/Mermaid 等），`script-src` 移除 `'unsafe-inline'`（`style-src` 暂保留并注明原因）；根语言重定向与 PWA 离线页内联脚本同步加 nonce — `scripts/build.js` + `security.json5` + `templates/*.ejs` + `js/domains/*` + `SECURITY.md`

- **依赖安全升级（dev 链）**：`puppeteer-core` 24.16.0 → 25.12.0，消除经 `@puppeteer/browsers` 传递的 `extract-zip` 高危通告（符号链接路径穿越 / 任意文件写入）；仅影响本地无障碍审计工具链，生产构建不依赖该包；修复后 CI `npm audit --audit-level=high` 门禁可正常通过 — `package.json`针对审计发现的构建/安全/防护/前端问题逐项修复，每条独立提交并逐项验证（构建、单测、浏览器探针、无障碍审计）。分类明细见下方 Added/Changed/Fixed/Removed。
- **guard 安全默认调整**：`hotkeyGuard` 的 `ctrlU/ctrlS/ctrlP` 改为按需开启（默认放行）；`devtoolsDetect` 的 `reload` 增加每会话熔断（避免尺寸误报导致无限刷新）；`tamperWatch` 上报增加超时/节流/去除查询串 — `guard.json5` + `js/domains/guard/*`

- 保持全部既有安全修复。

### Added

- **ESLint 静态检查门禁**：新增 `eslint.config.js`（ESLint 9 flat config；js/scripts/workers 三层各自声明浏览器/Node/Worker 全局）与 `npm run lint`，CI `build` job 增加 Lint 步骤（devDependencies 增补 `eslint`/`@eslint/js`/`globals`，精确锁定） — `eslint.config.js` + `package.json` + `.github/workflows/deploy.yml`
- **meta CSP 开关**：`security.csp.metaEnabled`（默认 `false`；开启场景=无响应头环境如 `file://`、不读 `_headers` 的托管、CDN 剥离响应头；默认关闭原因=Pages `_headers`/Worker 已下发 CSP，避免重复传输与策略交集） — `security.json5` + `templates/layout.ejs` + `docs/config-reference.md`
- **CSP 自动裁剪**：`security.csp.autoTrim`（默认 `true`）按功能开关裁剪 giscus/jsdelivr/Google Fonts 域名，未启用功能的域名不再预置；新增纯函数与 7 项单测 — `scripts/lib/csp.js` + `scripts/csp.test.js` + `scripts/build.js` + `scripts/generate-security-config.js` + `security.json5`
- **robots 逐语言 Sitemap**：多语言站点按 `site.languages` 输出多个 `Sitemap:` 行（修复根 sitemap 404）；`lastmod` 改 ISO 8601（非法省略）、`loc` 经 RFC 3986 编码、标签 URL 去重；新增 12 项单测 — `scripts/lib/robots.js` + `scripts/robots.test.js` + `scripts/build.js`
- **SITE_URL 环境变量**：构建读取 `SITE_URL` 覆盖 `site.url`（CI 预览/多域名部署） — `scripts/build.js` + `.env.example`

- **MIT 许可证**：新增根目录 `LICENSE` 文件（Copyright © 2026 stop666two，与 README 既有声明一致）与 `package.json` `license: "MIT"` 字段（GitHub 此前无法识别仓库许可证）；README 许可章节补充指向 `LICENSE` — `LICENSE` + `package.json` + `README.md`

- **站点图标（favicon）**：新增 `site.favicon` 配置（`enabled`/`svg`/`png32`/`appleTouch`，默认 `/icons/` 三件套）；构建时逐个检测文件存在性——存在则注入 `<link>`（并参与 cache-bust 内容哈希），缺失则告警跳过，三项全缺失时注入内置 data-URI SVG 兜底（消除 `/favicon` 404）；随附节点网络图形资产（SVG + sharp 生成 32/180 PNG，预设蓝 #2563eb）；三态验证（默认/缺失兜底/关闭）+ HTTP 断言 — `site.json5` + `scripts/build.js` + `templates/layout.ejs` + `static/icons/` + `docs/config-reference.md`
- **公告条增强**：`items[]` 逐条支持 `icon` 前缀徽标与独立跳转；`pauseOnHover`（悬停/按住同时暂停轮播与进度条）；`transition 'fade'|'slide'` 切换动画；`tone` 新增 `'gradient'` 强渐变；`showProgress` 轮播剩余时间进度条（仅多条轮播渲染，切换时重启，reduced-motion 隐藏）；`showDot` 圆点开关；`newTab` 外链打开方式（站内始终当前窗口）；全部键位带完整注释并同步 features-schema 默认值与枚举；双态浏览器验证 6 项（多条/渐变/slide/图标/进度/轮播/暂停/关闭） — `features.json5` + `templates/layout.ejs` + `js/domains/announcement.js` + `scripts/lib/features-schema.js` + `docs/config-reference.md`- **图片适配四域（`features.imageFit`）**：`content`（不放大/放大上限/铺满 + vh 限高 + 对齐）· `cover`（cover/contain/fill + 九宫格或百分比焦点）· `gallery`（默认不拉伸小图，修复旧版变形）· `lightbox`（contain/actual）；运行时零 JS：构建期注入 `data-iw` + cap 模式宽度规则 + `--if-*` 变量；13 项浏览器断言双模式验证（默认/tuned 翻转） + 截图目检 — `features.json5` + `scripts/build.js` + `templates/layout.ejs` + `scripts/lib/utils.js`
- **加载遮罩**（`features.loading`）：启动慢于延迟阈值时显示主题化全屏遮罩，延迟出现/最短显示/硬超时兜底三保险 + `prefers-reduced-motion` 可跳过 + 无 JS 不渲染；文案复用 `ui-strings.common.loading` 双语 — `js/core/boot.js` + `templates/layout.ejs`
- **三阶段启动调度**（`features.boot`）：仅 14 个关键模块静态初始化；17 个交互类模块改动态导入、按 40ms 空闲切片加载；粒子背景/打赏最后；首交互（点击/按键/触摸/滚轮）可唤醒剩余批次。实测启动后长任务 **0 个**（原 238ms+66ms 两个阻塞长任务消除），启动时间线写入 `window.__BOOT__` 供验证 — `js/core/main.js` + `js/core/boot.js`
- 启动期间 `<body aria-busy>` 无障碍提示（可关）；代码高亮的纯文本块补全改为空闲分片执行（消除 93ms DCL 长任务） — `js/core/boot.js` + `templates/layout.ejs`
- **启动/图片配置扩充（20 项）**：`features.loading` +6（`spinner`/`spinnerStyle` 轨道或单环/`showTitle` 站点名/`overlayColor` 主色/`fadeMs`/`zIndex`）· `features.boot` +4（`budgetMs` 时间片/`heavyMode` 重模块时机/`idleFallbackMs`/`interactionEvents` 唤醒事件表）· `features.imageFit` +5（`cover.maxHeightVh`/`cover.aspect`/`cover.applyToCards`/`lightbox.maxWidthPct`/`lightbox.maxHeightVh`）；`tuning.loading` +2（`ringSize`/`titleSize`）；15 项浏览器断言（翻转 tuned 模式）全绿 — `features.json5` + `scripts/lib/features-schema.js` + `js/core/boot.js` + `templates/layout.ejs` + `tuning.json5`
- **防护与交互控制 P4（G7 篡改监视 + G10 访问门槛）**：`guard.json5` 新增两节（均**默认关闭**）：**tamperWatch**（动态 `<script>`/`<iframe>` 注入监视与可选移除、内联事件属性监视、`fetch`/XHR/`eval` 原型替换周期比较、关键 DOM 节点缺失检测、CSP 违规提示；可选 `reportEndpoint` 手动上报（默认关闭，隐私模式仅上报事件类型））· **accessGate**（路径前缀级的 SHA-256 密码门槛（`crypto.subtle` 校验 + 会话记忆 `rememberHours`）、`?key=` 解锁码、每日访问限次（`toast`/`lock`））。两节均显著标注“页面级防护可被绕过”的诚实边界；`features.guards` 增加两总控位；13 项浏览器断言（门槛显示/错误/真密码解锁/重载记忆/解锁码/限次锁定、脚本注入与节点缺失提示、默认关反例）+ 门槛界面截图验收 — `guard.json5` + `features.json5` + `js/domains/guard/{tamper-watch,access-gate}.js` + `templates/layout.ejs` + `ui-strings.json5`
- **防护与交互控制 P3（G5 DevTools 检测 + G6 控制台反制 + G9 窗口隐私帘）**：`guard.json5` 新增三节（均**默认关闭**）：**devtoolsDetect**（停靠尺寸差/`debugger` 计时两种检定，`action` 可选 `notice`（提示）/`blurPage`（模糊）/`lockOverlay`（全屏锁屏，自带关闭键）/`reload`；命中派发 `guard:devtools` 事件供联动）· **consoleGuard**（控制台站方留言/周期清屏/对页面脚本伪装 console 方法/`console.log` 访问陷阱/自身日志隐藏，含与检测联动的 `clearOnDetect`）· **privacyCurtain**（窗口失焦与切标签时静态遮罩帘（`backdrop-filter` 模糊+文案），恢复带去抖延迟；PrintScreen 仅检测提示）。三模块均全程中文注释并显著标注“检测≠阻止、威慑级”的诚实边界；`features.guards` 增加三总控位；11 项浏览器断言（检测提示/锁屏与关闭、控制台静音、隐私帘显隐、默认关反例）+ 锁屏/隐私帘截图验收 — `guard.json5` + `features.json5` + `js/domains/guard/{devtools-detect,console-guard,privacy-curtain}.js` + `templates/layout.ejs` + `ui-strings.json5`
- **防护与交互控制 P2（G3 选择控制 + G4 快捷键拦截 + G8 水印）**：`guard.json5` 新增三节（均**默认关闭**，soft 档下显式 `enabled:true` 即启用，strict 档随档生效）：**selectionGuard**（`mode content|strict`，`user-select` + `selectstart` 双保险，代码/输入框/白名单豁免，保留 Ctrl+A 与 Shift 方向键的无障碍优先默认）· **hotkeyGuard**（F12 / Ctrl+Shift+I|J|C / Ctrl+U|S|P，macOS 自动 Cmd；PrintScreen 仅检测提示；`custom[]` 自定义组合；输入框豁免与提示去重）· **watermark**（fixed/tiled/diagonal 三版式，`{site}{date}{time}{id}` 占位符，`identity` 仅本地短哈希无指纹，透明度/旋转/间距/打印隐藏/灯箱显示/移动端开关/漂移动画全可配，`pointer-events:none` 不挡交互）。`features.guards` 增加三模块总控位（默认允许）；客户端新增 3 个懒加载模块；20 项浏览器断言（含默认关反例）+ 对角/固定角水印截图验收 — `guard.json5` + `features.json5` + `js/domains/guard/{selection-guard,hotkey-guard,watermark}.js` + `templates/layout.ejs` + `ui-strings.json5`
- **防护与交互控制 P1（G1 自定义右键菜单 + G2 复制控制 + G11 总控）**：新增 `features.guards` 总控（`preset: off|soft|strict`，默认 soft）与第 13 个配置文件 `guard.json5`（60 字段逐项中文注释：作用/类型/可填值/不可填值原因/推荐值/注意）。soft 档默认启用：**自定义右键菜单**（文字选择/链接/图片/代码块/空白场景自适应；内置复制/复制链接/新窗口/搜索选中/翻译/返回顶部/切换主题/打印/复制代码/复制源码/下载，`viewSource`/`inspect` 默认关；支持自定义项与 `guard:menu-action` 事件、触屏长按、Esc/滚动/失焦/外点关闭、键盘导航、输入框豁免）与**复制署名**（`attribution` 模式追加 `—— 原文：{title}\n{url}`，`minChars` 防打扰、代码块与可编辑区始终放行；另有 `weakBlock`/`block` 拦截模式）。绕过通道：`?guard=on|off` > `localStorage['s-guards-off']` > localhost；`tuning.guard` 6 项视觉值；客户端懒加载（未启用模块零开销）— `guard.json5` + `features.json5` + `templates/layout.ejs` + `js/domains/guard/{core,context-menu,copy-guard}.js`
- **构建产物压缩增强**：`dist/assets/js` Terser 压缩（106KB→77KB，注释清零）、HTML 内联脚本压缩（69KB→64KB）、内联样式 CleanCSS 压缩（104KB→101KB，注释清零）、search-index/manifest/speculation-rules/cache-bust 清单 JSON 紧凑输出；vendor 保持上游压缩产物不重复处理（构建提速） — `scripts/build.js`
- **图表尺寸自定义**：`features.mermaid.size`——全局默认宽高（`width`/`height`，支持 px/%/vw/vh/rem）+ `min/max` 钳制 + `fit` 适配策略（`scroll` 不缩放横向滚动（默认，解决时序图被缩小后线条挤压） / `scale` 旧行为）；单图覆盖语法：代码块语言标记后追加 `w=`/`h=`（如 ` ```mermaid w=900 h=520 `），非法值自动忽略 — `scripts/build.js` + `templates/layout.ejs`
- **公告条升级（C2 增强）**：`features.announcement` 支持**多条轮播**（`items[{text,textEn,url}]` + `rotateMs`，悬停暂停/减少动效降级）、**视觉风格**（`tone: accent|solid|minimal`，含左侧圆点与圆形关闭键）、`tuning.announcement` 字号/字距微调；布局改为 grid 叠层稳定居中 — `templates/layout.ejs` + `js/domains/announcement.js`
- **侧栏部件图标（A9）**：`sidebar.json5` 每个部件支持 `icon` 字段（内置 16 枚线性图标: clock/folder/tags/archive/collection/chart/quote/image/link/info/book/search/rss/download/home），8 个默认部件已配图标 — `templates/layout.ejs`
- **公告条（C2）**：`features.announcement`（`text`/`textEn`/`url`/`dismissible`）——顶部固定公告条，`--annH` 统一偏移固定头部/移动菜单/粘性目录/内容；关闭按文本哈希记忆 — `templates/layout.ejs` + `js/domains/announcement.js`
- **灯箱手势增强（E1）**：`features.lightbox.swipeClose` 下拉滑动关闭（放大状态下不触发）；鼠标拖拽左右翻页（非缩放态） — `js/domains/lightbox.js`
- **PWA 商业化增强（B6）**：`features.pwa.offlinePage` 生成离线兜底页（断网访问未缓存页面→双语提示+重试按钮，SW 预缓存并导航回退）；`features.pwa.installPrompt` 安装引导（beforeinstallprompt 浮动按钮，可关闭并记忆） — `scripts/build.js` + `js/domains/pwa.js`
- **氛围开关（A8）**：`features.atmosphere`（`grain`/`glow`）——颗粒纹理与 Hero 光晕的页面级开关（视觉参数仍在 `tuning.texture`/`tuning.glow`） — `templates/layout.ejs`
- **打印样式（D2）**：`features.printStyle`——打印/PDF 导出优化：隐藏交互元素、白底黑字、正文外链展开为 `文字 (URL)`、代码块/图表避免跨页断裂 — `templates/layout.ejs`
- **多语言增强（D3）**：`features.hreflang.xDefault`（x-default 替代声明，指向默认语言）+ `features.i18n.translationNotice`（文章页翻译互链胶囊：另一语言存在同 slug 文章时自动显示，文案 `post.translationNotice` 双语可配）— `templates/post.ejs` + `templates/layout.ejs`
- **主题预设扩展（E4）**：新增 3 套调色盘——`amber-coffee`(琥珀咖啡) / `ocean-teal`(海沫青) / `plum-wine`(梅子酒)，每套含明亮+暗色各 13 色，全部通过 WCAG AA 对比度测试；预设切换器与 `theme.json5` 注释同步 — `scripts/lib/theme-presets.js`
- **继续阅读（E3）**：`features.readingHistory`——本地阅读历史（文章页自动记录，首页展示最近阅读 + 相对时间 + 清除按钮；纯 localStorage，无服务端） — `js/domains/reading-history.js` + `templates/index.ejs`
- **作者卡（C5）**：`features.authorCard` + `site.authorProfile`——关于页作者卡（头像/简介/技能标签/竖向时间线/社交矩阵胶囊）；数据全配置化、未填项自动隐藏、资料全空时不渲染 — `templates/page.ejs`
- **赞助增强（C3）**：`features.reward.links[]`——打赏弹窗底部赞助平台胶囊链接（GitHub Sponsors / Ko-fi / 爱发电 等），每项 `{label,url}`，新窗口 `noopener` — `templates/post.ejs`
- **订阅组件（C1）**：`features.subscribe`——页脚「订阅与更新」条：RSS（`{lang}/feed.xml`）+ JSON Feed + 可选外部邮件订阅表单（`newsletterUrl`，如 Buttondown/Substack，`newTab` 控制）；`subscribe` 界面文案双语；**顺带修复 `<head>` RSS alternate 双斜杠 bug（`/zh//feed.xml` → `/zh/feed.xml`）** — `templates/layout.ejs`
- **命令面板（B3）**：`features.commandPalette`——Ctrl/Cmd+K 呼出，整合页面导航、快捷操作（切换主题/回到顶部/打开搜索/我的收藏）与文章搜索（懒加载索引）；原生 `<dialog>`（焦点圈定/top-layer/Esc 关闭）、键盘上下选择 + Enter 执行、IME 组合期防误触；`tuning.commandPalette` 可调宽度/位置/背板 — `js/domains/command-palette.js`
- **滚动进度条（A4）**：`features.scrollIndicator`（`height`/`gradient`/`respectReducedMotion`）——顶部固定 hairline 进度条，基于原生 scroll-driven 动画（`animation-timeline: scroll(root)`），零 JS、零主线程开销；不支持自动隐藏（渐进增强） — `templates/layout.ejs`
- **共享元素过渡（A3）**：`viewTransition.shared`——列表卡片封面/标题与文章页封面/标题通过 `view-transition-name` 形变衔接（首页/标签页 → 文章）；顺带修复文章页封面 `class` 属性跨行断裂导致 `.post-featured-image` 样式从未生效的历史问题 — `templates/index.ejs` + `templates/tag.ejs` + `templates/post.ejs`
- **性能预算门禁（D4）**：`features.perfBudget`（`htmlKb`/`jsKb`/`requests`/`warnOnly`）——构建收尾统计单页 HTML gzip 最大值、应用 JS 全量 gzip 合计与单页静态请求数，输出 `[budget]` 报告；`warnOnly:false` 超限即终止构建（严格门禁，实测 exit 1） — `scripts/lib/perf-budget.js` + `scripts/build.js`
- **无障碍审计与修复（D1）**：`npm run audit:a11y`——axe-core 对 8 组页面（中英 × 明暗）执行 WCAG 2.0/2.1 A+AA 扫描，0 critical/serious 门禁；修复 nocover 卡片链接 `aria-hidden` 却可聚焦（补 `tabindex="-1"`）与归档热力图空格文字对比度（`--color-ts`） — `scripts/a11y-audit.js`
- **杂志排版（A6）**：`features.magazine`——首字下沉（`dropCap`：衬线展示字体 + 主题色，中英文均生效）、图片出血（`figureBleed`：独立成段图片向两侧出血，≤1100px 自动回退）、表格悬停高亮（`tableHover`）、h2 自动编号（`headingNumbers`，默认关）；视觉值经 `tuning.magazine` 6 项可调 — `templates/post.ejs` + `templates/layout.ejs` + `tuning.json5`
- **SEO/分享增强（C4）**：`schemaRich` 扩展 6 开关（`authorUrl`/`wordCount`/`timeRequired`/`keywords`/`articleSection`/`image`）——Article JSON-LD 增加作者主页、字数、预计阅读时长（`PT{n}M`）、关键词、栏目与封面图；`site.seo` 新增 `ogImageAlt`/`articleTimes`/`twitterLabels`——输出 `og:image:alt`、`article:published_time`/`article:modified_time`（ISO 格式）、`twitter:image` 与分享卡片读数标签（阅读时长/字数，双语） — `templates/layout.ejs` + `site.json5` + `features.json5`：`features.ogImageStyle` 接入构建期 OG 图生成——模板（`template`：aurora/mesh/grid/paper/duotone 五种，默认 aurora）、配色（`palette theme|hash`——hash 按分类名哈希取色、同分类同色，默认 theme）、分类角标（`showCategory`）；`site.seo.ogImage` 的 width/height/fontScale 实际生效（默认 1200×630/0.75）；无封面文章与有封面文章分别走模板底/封面合成两条路径 — `scripts/generate-og.js` + `features.json5` + `scripts/lib/features-schema.js`
- **卡片视觉增强（A2）**：`features.cardFx`（coverOverlay 封面底部渐变遮罩 / categoryChip 分类色标——按分类名哈希取色经 `--cat-h` 驱动 / readTimeBadge 阅读时长徽章 / hoverShine 悬停光泽扫过）；作用于首页与标签页文章卡片；悬停光泽尊重 reduced-motion — `templates/index.ejs` + `templates/tag.ejs` + `templates/layout.ejs` + `features.json5` + `scripts/lib/features-schema.js`
- **阅读套件（B2）**：TOC 二级分组折叠（`toc.groupCollapse`，箭头收起/展开三级项）；移动端目录胶囊按钮升级为"当前章节名 + 阅读进度百分比"（`mobileToc.showCurrent`）；阅读位置记忆（`readingProgress.rememberPosition` + `rememberPositionMaxAgeHours`，同文章回访恢复滚动位置，哈希导航与前进/后退自动跳过） — `js/domains/toc.js` + `js/domains/read-position.js` + `templates/layout.ejs` + `features.json5`
- **预渲染增强（B1）**：`speculation.delivery` 三态（`inline` 默认/`header`/`both`）——`header` 模式构建 `speculation-rules.json` 并经 `_headers` 以 `Speculation-Rules` 响应头 + `application/speculationrules+json` MIME 下发（Cloudflare Speed Brain 检测到自有规则会礼让，避免双重投机；该模式下页内开关自动隐藏） — `scripts/build.js` + `js/domains/seamless-nav.js` + `features.json5`
- **图片管线增强（A5/B5）**：构建期 LQIP 模糊占位（内联 `data-lqip`，运行时经 imageLazy 应用到图片背景，同时加入 sanitize 属性白名单）、AVIF 变体默认开启（effort 5）、srcset sizes 默认改为 `(max-width:768px) 100vw, 768px`、文章首图 `<link rel=preload as=image fetchpriority=high>`（`site.performance.preloadFeaturedImage`，可关） — `scripts/build.js` + `js/domains/image-lazy.js` + `scripts/lib/utils.js` + `site.json5` + `features.json5`
- **变量字体（A7）**：Inter/Sora/Manrope 改用 `@fontsource-variable` 单文件（100–900 字重插值，OFL 开源），仅 latin 子集 vendor；首屏字体请求从 ~15 个静态 woff2 降至 3 个，字重过渡更顺滑 — `scripts/build.js` + `package.json`
- **无缝切页（原生两件套）**：跨文档 `@view-transition` 过渡动画（fade/slide、可调时长、reduce-motion 轻量版、不支持浏览器自动回退旧淡出并抑制双重动画）+ Speculation Rules 预取/预渲染（prefetch/prerender/both、eagerness 档位、选择器与查询串排除）；导航栏新增闪电图标双开关（过渡动画 / 预取预渲染，localStorage 记忆、不支持自动置灰）；预渲染期间统计信标与 SW 注册经 `document.prerendering` 守门延后；CSP 增加 `'inline-speculation-rules'` — `js/domains/seamless-nav.js` + `templates/layout.ejs` + `security.json5` + `workers/security-worker.js` + `features.json5`
- **morphicons 配置扩展**：`preload`(interaction/idle/immediate 加载策略)、`perIcon`(单图标弹簧覆盖,预设名或 `{stiffness,damping}`);`tuning.morphicons` 扩至 4 项(+轻量版弹簧 reducedStiffness/reducedDamping) — `features.json5` + `tuning.json5` + `js/domains/morphicons.js`
- **图标变形动画(morphicons)**：状态切换类图标弹簧物理变形——主题 sun↔moon、复制 copy→check、收藏空心↔实心、朗读扬声器↔停止、移动端汉堡↔X；本地 vendor 懒加载(首次悬停/触摸/聚焦才下载,~7.5KB gzip)、尊重系统 reduce-motion、`tuning.morphicons` 可调弹簧刚度/阻尼、逐图标开关(`features.morphIcons.icons.*`)、关闭即完全回退静态实现 — `js/domains/morphicons.js` + `features.json5` + `tuning.json5` + `scripts/build.js`
- **双语验收文章集**：zh/en 各 8 篇可发布文章 + 各 1 篇草稿，覆盖站内/外跳转、wiki 链接与锚点、Mermaid×5 与 KaTeX、12 种代码块、系列 3 篇前后篇导航、超长压力文（13 个二级章节）、图片画廊与灯箱、置顶与草稿排除 — `articles/{zh,en}/`
- **代码块与图标增强**：行号列(Prism line-numbers 本地插件,纯文本块也可用;`tuning.code.lineNumberColor/lineNumberOpacity`)、终端语言标签(bash/sh/zsh/fish→`$ lang`；powershell→`PS> powershell`；console→`> console`)、diff 增删行着色(`tuning.code.diffAddMix/diffDelMix`)、代码块悬停描边+阴面(`tuning.code.hoverBorderMix/hoverShadowMix/hoverBgMix`)、内联代码精修(`tuning.code.inlineRadius/inlineHairlineMix`)、复制全部按钮、复制/下载图标描边绘制动画(`icon-draw`)、图标体系(描边统一 1.75/`tuning.icons.strokeWidth`、hover 上移、主题切换旋转)、导航菜单内置图标表(NAV_ICONS 10 枚:home/archive/tags/info/book/link/folder/search/rss/download)

- **内容级双语(i18n)**:`articles/zh/` 与 `articles/en/` 双目录;19 篇文章全文翻译为英文(`scripts/build.js` 按语言扫描,文章对象带 `lang`/`langPrefix`);URL 全站语言前缀化 `/zh/slug/`、`/en/slug/`;根路径 `/` 输出中文首页 + 内置语言检测脚本(`navigator.language` 命中 en 时跳 `/en/`,localStorage `s-ss-lang` 记忆)— `templates/layout.ejs` + `scripts/build.js`
- **全站页面语言化**:首页分页、文章、归档、标签、分类、搜索、收藏、图库、友链、404 每语言一套,`generatePages` 按 `site.languages`(默认 `['zh','en']`)循环生成;`navigation.json`/`footer.json`/`sidebar.json` 新增 `labelEn`/`titleEn` 字段,`site.json` 新增 `titleEn`/`subtitleEn`/`hero.titleEn`/`hero.subtitleEn` — `scripts/build.js` `localizeNav`/`localizeFooter`/`localizeSidebar` 函数
- **SEO 分语言**:`<html lang>`(en 时 `en-US`)、`og:locale`、`og:url`(当前语言 URL)、`og:image`(`/og/{lang}/{slug}.png` 分语言目录)、`hreflang` 交替链接(自动补全 i18n.languages + 当前语言)— `templates/layout.ejs`
- **RSS/JSON Feed/sitemap/search-index 分语言**:`/zh/feed.xml` + `/en/feed.xml`、`/zh/feed.json` + `/en/feed.json`、`/zh/sitemap.xml` + `/en/sitemap.xml`、`/zh/search-index.json` + `/en/search-index.json`(条目带 `lang` 字段)— `scripts/build.js`
- **根路径重定向规则**:`dist/_redirects` 始终生成,含 `/ /zh/ 302`(首语言非 en 时)与根别名重定向(`/search-index.json`、`/feed.xml`、`/manifest.json`、`/404.html`、`/site.webmanifest` → `/zh/{alias}` 302);根 `404.html` 从 zh 版复制 — `scripts/build.js`
- **en 首页构建期英化**:`ui()` 服务端函数按 `lang` 绑定 `ui-strings.json5` 英文词典,导航/页脚/侧栏/主题预设/卡片元信息(字数/阅读时长)/搜索占位/复制提示/外部链接弹层全英化;运行时 `__T()` 继续处理动态文本 — `templates/layout.ejs` + `templates/index.ejs` + `templates/post.ejs` + `templates/category.ejs` + `templates/tag.ejs`
- **功能参数化(69 参数全量接线)**:`features.json5` 新增 69 个可配置参数并全部接线生效(motion/hero/heatmap/stats/mobile/comments/contactPopup/prevNext/imageLazy/themeToggle/themeSchedule/series/related/share/reward/gallery 等模块);`scripts/lib/features-schema.js` 同步默认值与枚举校验(labelPosition 等) — `scripts/build.js` + `templates/*.ejs`
- **scrollBehavior 模块**:统一接管全站平滑滚动——`features.scrollBehavior`(enabled/behavior/anchorOffset/respectReducedMotion);锚点偏移参数化(原硬编码 `calc(var(--hh) + 18px)`);修复桌面端硬编码 `scroll-behavior:smooth` 覆盖 reduced-motion 保护的问题;JS 滚动调用统一经 `__SB()` 读取配置 — `templates/layout.ejs` + `features.json5`
- **toast 模块**:统一轻提示系统——`features.toast`(enabled/position/durationMs/maxVisible) + `window.__toast(msg,{type,duration})` API(内置 info/success/warning/error 四类,容器 role=status);分享复制与联系复制迁移到统一 toast;移除三处旧内联提示元素/CSS(fav-toast/share-copied/contact-popup-copied) — `templates/layout.ejs` + `templates/post.ejs` + `features.json5`
- **breadcrumb 模块**:可见面包屑导航——`features.breadcrumb`(enabled/separator/showHome/showCurrent);所有页面渲染(首页/404 除外),文章页 首页 › 分类 › 标题,列表页与自定义页自动层级 — `templates/layout.ejs` + `features.json5`
- **pageTransition 模块**:页面切换过渡——`features.pageTransition`(enabled/type/durationMs/outDurationMs/respectReducedMotion/excludeSelector);内链点击淡出 → 导航 → 新页入场(slide/fade 两型);外链/新窗口/hash/下载链接与 `[data-no-transition]` 元素不拦截 — `templates/layout.ejs` + `features.json5`
- **pwa 模块**:PWA 运行时——`features.pwa`(enabled/registerSW/updatePrompt/offlineNotice);注册 service worker、SW 更新 toast 提示、离线/恢复 toast 提示(复用统一 toast);新增 `ui-strings` pwa 双语文案 — `templates/layout.ejs` + `ui-strings.json5` + `features.json5`
- **ESM 模块化架构**:`templates/layout.ejs` 内联脚本(~150KB/40 个 IIFE)迁移至 `js/core/`(入口+共享运行时)与 `js/domains/`(28 个按功能域拆分的 ESM 模块);构建复制到 `dist/assets/js/`,`<script type="module">` 动态加载;新增 `window.__APP_READY__` 就绪标志;保留 theme 引导等必要同步内联 — `js/` + `scripts/build.js` + `templates/layout.ejs`
- **tuning.json5 UI 微调参数层**:新增独立配置文件(29 分类/216 项,逐项中文注释),构建注入为 `:root` CSS 变量(`--{分类}-{参数}`);86 项已直接绑定 CSS 规则(改 tuning 即生效,优先于 theme/features 默认值),值全部对齐现有视觉;其余为 features 重叠项或保留项 — `tuning.json5` + `templates/layout.ejs`
- **配置扩展接线(71 项)**:`site.performance`(15 项:preconnect/preload 字体/图片 decoding+sizes/脚本加载策略/minify 回退/构建报告)、`sidebar.options`(10 项)、`footer.options`(8 项)、`navigation.navbarOptions`(9 项)、`theme.appearance`(12 项:选区/滚动条/焦点环/代码块/引用/表格/分隔线/图注)、`security.hardening`(8 项:HSTS/Referrer-Policy/Permissions-Policy/XSS/CORS)全部接线生效 — `templates/layout.ejs` + `scripts/build.js`
- **tuning 行为参数接线**:新增 `window.__TUNING__` 运行时注入;search(历史条数/热词数/去抖/最少字数/结果上限/摘要长度/空结果文案)、toc(滚动高亮偏移/默认折叠)、tts(语速/音调)、dailyQuote(作者显示/每日刷新)、readingPanel(字号/行距步进)经运行时优先读取;新增 TOC/侧栏粘性定位(`--toc-stickyTop`/`--sidebar-stickyTop`)与导航图标尺寸(`--header-iconSize`)绑定 — `templates/layout.ejs` + `templates/post.ejs` + `js/domains/*` + `tuning.json5`
- **视觉质感系统(批次A)**:多层级柔和阴影(`theme.json` 新增 `tiers` 档位数值表,shadow 四档含暗色变体)、全局噪点纹理(`tuning.texture`:baseFrequency/双模式透明度)、Hero 径向光晕(`tuning.glow`)、导航滚动收缩(收缩高度/触发阈值/发丝线强度入 `tuning.header`)、表面高光/描边(`theme.json` `surfaceHighlight`,20 处表面统一应用) — `theme.json` + `tuning.json5` + `templates/layout.ejs` + `js/domains/navigation.js`
- **代码块配色体系**:`theme.json` `codeHighlight.palette`(浅色 GitHub / 暗色 One Dark 两套 token 配色,随主题自动切换);代码块背景明暗分模式(6 预设同步,暗色块与页面底色区分);Prism token 本地着色(零外部主题依赖) — `theme.json` + `scripts/lib/theme-presets.js` + `templates/layout.ejs`
- **Mermaid 图表主题联动**:切换明暗时图表自动重绘(保存源码 → 重初始化 → 重渲染);容器背景跟随代码块配色 — `templates/layout.ejs`
- **卡片与列表视觉(批次B)**:封面悬停缩放(`tuning.card.imageHoverScale`)、栅格间距/摘要行数接线、分类卡悬停分层阴影+上浮;修复卡片宽高比被固定值覆盖(`tuning.card.imageAspect` 现生效) — `tuning.json5` + `templates/layout.ejs`
- **微交互(批次C)**:统一弹簧曲线(`tuning.motion.transitionTiming` → `--te`)、按钮按压缩放(`buttonPressScale`,13 类按钮/开关/分页/移动导航)、滚动渐入错峰(`staggerDelayMs`,批内递增延迟、上限 8 级);`revealThreshold/revealOnce` 接线生效;motion.js 数值统一 tuning 优先/features 回退 — `js/domains/motion.js` + `tuning.json5` + `theme.json` + `features.json5`
- **阅读页视觉(批次D)**:引用块主色渐变底纹(`reading.quoteTint`)、正文图片圆角阴影+悬停放大(`reading.imageHoverScale`)、h2 前置主色竖线(`h2AccentWidth/Height/Color`)、阅读模式宽度(`readingMaxWidth`);进度条全参数接线(`barHeight/useGradient/gradientStart/gradientEnd/dotSize/showDot`) — `templates/layout.ejs` + `tuning.json5`
- **字体分层（Sora + Manrope）**:`theme.fontSystem.displayStack='sora'`（h1/hero/Logo 展示层）与 `headingStack='manrope'`（h2-h6/卡片/部件标题）；`resolveFontSystem` 支持任意 FONT_STACKS 枚举并自动加载对应 Google Fonts；统一中英文回退链（PingFang/HarmonyOS/雅黑 UI） — `scripts/build.js` + `theme.json` + `templates/layout.ejs`
- **首页粒子增强**:`features.background.particles` count 55→72 / opacity 0.6→0.7 — `features.json5`
- **前端资产本地化（去 CDN 依赖）**:Prism（多语言拼接）/Mermaid/KaTeX（含字体）/Inter·Sora·Manrope（latin 子集）全部由构建从 `node_modules` 复制到 `assets/vendor/` 同源加载;修复 `externalAssets.styles` 从未渲染为样式表导致字体从未真正加载的潜伏缺陷;新增依赖 `prismjs`/`mermaid`/`katex`/`@fontsource/*`（锁定版本,npmmirror 安装) — `scripts/build.js` + `templates/layout.ejs` + `theme.json` + `package.json`
- **首页视觉强化（Hero/Bento/色彩）**:Hero 标题渐变装饰条、CTA 主色→强调色渐变按钮、标签悬停提亮;首篇文章 Bento 大卡（1.618fr 图文分栏,移动端回退单列) — `templates/index.ejs` + `templates/layout.ejs` + `tuning.json5`
- **中英区分扩展（文案与元数据全链路）**：新增 `logoTextEn`/`bioEn` 与组件标题、搜索占位的英文取值，`site.descriptionEn` 站点描述，head 元数据与 Feed 标题按页面语言输出（英文页不再混排中文） — `site.json5` + `templates/layout.ejs` + `scripts/build.js` + `scripts/lib/site-defaults.js` + `docs/config-reference.md`
- **OG 图 `showUrl` 开关**：可关闭 OG 图右下角的站点 URL（`features.ogImageStyle.showUrl`） — `features.json5` + `scripts/generate-og.js` + `scripts/lib/features-schema.js` + `docs/config-reference.md`

### Changed

- **命令面板默认热键 `Ctrl+P` → `Ctrl+Shift+P`**（归还打印快捷键；支持 `ctrl+shift+x` 组合语法与旧单键写法） — `features.json5` + `js/domains/command-palette.js` + `scripts/lib/features-schema.js` + `docs/config-reference.md`
- **依赖升级（精确锁定）**：`mermaid` 11.4.1→11.17.2、`prismjs` 1.29.0→1.30.0、`wrangler` 4.129.0→4.138.0；`pagefind` 移出 devDependencies（按需安装） — `package.json`
- **KaTeX 字体瘦身**：仅拷贝 woff2/woff 并清理历史 ttf（构建体积约 -390KB） — `scripts/build.js`
- **`X-XSS-Protection` 改为 `0`**（OWASP 已弃用该头） — `security.json5` + `workers/security-worker.js`
- **JSON Feed 选项归位**：`site.rss.jsonFeed.fullContent/maxItems/path` 优先消费（修复死键；feed.json 恢复摘要模式） — `scripts/lib/feed-options.js` + `scripts/build.js` + `templates/layout.ejs`
- **关联推荐与阅读时长接线**：`features.related.*`（topN/同标签/同分类权重/最低分）与 `features.readingTime.wordsPerMinuteCJK/Latin` 真实生效 — `scripts/lib/related.js` + `scripts/lib/utils.js` + `scripts/build.js`
- **PWA 关闭时不再生成根 `manifest.json`/`site.webmanifest` 别名**（消除死重定向） — `scripts/build.js`
- **文档计数口径统一**：features 800 项 / guard 171 项（对象逐层展开、数组元素逐项计入）/ 13 个配置文件 2522 项 / 测试 180 项 38 组 / tuning 32 分类 — `README.md` + `docs/config-reference.md`
- **构建日志补全 `[14/14]`** — `scripts/build.js`

- **配置一致性 CI 监守（T0）**：新增 `npm run verify:config`（`scripts/check-config-consistency.js`）并接入 CI 阻塞步骤：逐项比对 features.json5 ↔ features-schema 默认值（配置文件为唯一事实来源，schema 额外键允许、空数组视为内容占位豁免）；首次运行修复 9 处历史不一致（copyAllButton、speculation.delivery、hero.heightVh、background.particles.count/opacity、commandPalette.hotkey、announcement.text/textEn 等） — `scripts/check-config-consistency.js` + `package.json` + `.github/workflows/deploy.yml` + `scripts/lib/features-schema.js`
- **硬编码参数去除（T1 迁移，第 1 批）**：13 处运行时硬编码参数迁入配置并全部接线——`announcement.storageKey`/`removeDelayMs`、`toast.removeDelayMs`、`pwa.installDismissKey`/`updateToastMs`、`morphIcons.vendorPath`、`codeBlock.blobRevokeDelayMs`、`themeSchedule.smoothTransitionMs`、`motion.revealCleanupMs`、`guard.contextMenu.revokeDelayMs`/`translateUrl`、`guard.copyGuard.flashRemoveMs`、`guard.accessGate.focusDelayMs`；移除 12 个运行时模块的代码侧字面量兜底（存储键/路径/时长改读配置，默认值单一来源为 schema/配置文件）；README 计数 2469→2482（features 785→794）；单测 100 通过，既有浏览器验证脚本全绿（announcement 8/8、favorites 8/8、search 7/7、theme 5/5） — `js/domains/`(12 文件) + `templates/layout.ejs` + `features.json5` + `scripts/lib/features-schema.js` + `guard.json5` + `README.md` + `docs/config-reference.md`
- **文档计数刷新**：README 配置项计数校正（13 文件总项 2455→2469；features 785 项；tuning 32/204、guard 164 不变）——按既有叶子键递归口径重算，含本会话新增 favicon 4 键与公告增强 5 键、删除 2 个废弃键 — `README.md`
- **硬编码参数去除（T1 迁移，第 2 批）+ 配置结构监守扩展**：build.js 内联 defaults 抽为 `scripts/lib/site-defaults.js`（构建合并基底 + 监守注册表）；`verify:config` 新增 7 个配置文件结构监守（键必须存在于注册表、类型一致、值可覆盖；theme/security 按豁免策略记录），首跑发现并补齐 38 处注册表缺口（site.hero/reward/performance/webAnalytics/authorProfile/languages/customBodyStart·End/externalLinkWarning 文案/seo.titleTemplate、navigation.navbar+navbarOptions、sidebar.options、footer.columns/options/beian/customHtml、contentPolicy 扩展名表、friends.labels、social.items 与 pwa.manifest 自由映射豁免）；清除媒体管线残留内联兜底（mediaResponsiveSizes/Formats/avif，以及 avif effort 代码 6→注册表 5 的不一致）并改用全局 `arrayMerge=replace` 消除数组默认值拼接风险；OG 生图配色/深色底/纸张底全取 theme.json5（缺失即报错退出）、Worker `skipPaths` 移除代码兜底（security.json5 唯一来源）；新增 `site.build.cssOutDir/cssFileBase/hashLength/hashAlgorithm`、`site.pwa.cacheName`，favicon PNG `sizes` 改为按文件 IHDR 实际尺寸派生；新增键开/关双态构建+浏览器断言 **40/40 全绿**（公告存储键与移除时延、toast 时延、accessGate 启用+focusDelayMs+密码解锁、morphicons 失效降级、CSS 输出目录/12 位 sha1 命名、sw.js cacheName）；README 计数 2482→2487（site +5） — `scripts/lib/site-defaults.js` + `scripts/check-config-consistency.js` + `scripts/build.js` + `scripts/generate-og.js` + `scripts/generate-security-config.js` + `site.json5` + `templates/layout.ejs` + `README.md` + `docs/config-reference.md`
- **配置文件注释补全与文档同步**：features/guard/site/theme/tag-aliases 逐字段补齐注释（分组尾键、调色板色值语义、社交/打赏子字段、giscus 占位键、guard 动作映射/DevTools 键位/密码组等），`ui-strings.json5` 标注「键名即文档」策略（i18n 文案表不逐键注释）；审计脚本口径 2132 个对象键，除 ui-strings 外 **0 缺口**；config-reference 新增注释约定说明 — `features.json5` + `guard.json5` + `site.json5` + `theme.json5` + `tag-aliases.json5` + `ui-strings.json5` + `docs/config-reference.md`
- **内联 CSS 外链化（性能）**：`templates/layout.ejs` 的 122KB 内联 `<style>` 抽为 `templates/site-css.ejs`，构建期渲染一次并经 CleanCSS(level 1) 压缩、按内容哈希命名输出 `dist/assets/css/site.<hash>.css`（可跨页缓存、变更自动失效）；layout 改为 `<link rel="stylesheet">`。reduced-motion 冻结动画的 AB 截图回归（light/dark × 4 页 + 移动端 2 页，共 10 对）**像素差 0.000%**；实测文章页 HTML gzip 51.7KB→29.5KB（-43%），CSS 22.3KB gzip 独立缓存 — `templates/layout.ejs` + `templates/site-css.ejs` + `scripts/build.js` + `docs/config-reference.md`
- **配置键接线与清理（审查遗留项闭环）**：`backToTop.hotkey`（非输入框且无修饰键时按键回顶）、`search.openAnimation`（`fade`/`slide` 弹层动画，尊重系统减少动效）、`favorites.position 'meta'`（收藏按钮渲染到标题下元信息行，新增 `.fav-btn-meta` 样式）、`series.defaultWidgetCount`（侧栏系列 widget 按数截断）、`shortcuts.ignoreInInputs false`（输入框内也触发快捷键）、`dailyQuote.source`（支持自定义 `.json`/`.json5`，加载失败回退内置并告警）；删除废弃重复键 `readingProgress.progressColor`、`readingPanel.storageKey`。开/关双态均通过构建断言与浏览器断言（收藏 meta 点击、热键回顶与输入框豁免、系列截断、自定义引语与回退） — `features.json5` + `scripts/lib/features-schema.js` + `templates/layout.ejs` + `templates/post.ejs` + `js/domains/reading.js` + `js/domains/shortcuts.js` + `scripts/build.js` + `docs/config-reference.md`
- **reduce-motion 不再一刀切停播**：`motion` / `pageTransition` / `morphIcons` 统一新增 `reducedMotion: 'light'|'off'|'full'`（默认 `light`）——系统"减少动态效果"下改为播放更短、幅度更小的轻量版动画；`off`=旧行为（直接关闭/不拦截），`full`=始终完整播放；旧布尔字段 `respectReducedMotion` 自动兼容映射（true→light / false→full） — `js/domains/motion.js` + `js/domains/page-transition.js` + `js/domains/morphicons.js` + `templates/layout.ejs`
- **文档全量刷新**:README 更新为当前实现（12 个配置文件 / 1600+ 配置项（实测 1625）/ features 77 模块 608 项 / tuning 25 分类 164 项 / 测试 68 项 17 组 / 本地 vendor 资产 / `js/` ESM 目录 / 移除 SRI 与代码主题切换器过期表述 / 修正 forceContentWidth 注释 / 技术栈补 Prism·字体·原生 ESM）；config-reference 模块数校正(38/54→77) — README.md + docs/config-reference.md
- **演示内容清空**:删除全部 39 篇演示文章（zh 19 + en 20,git 历史可恢复）,仓库以空内容启动;空站构建验证通过（空状态首页/空 feed/无 sitemap 条目/0 搜索索引/无残留异常标记） — articles/
- **配置文件统一 `.json5`（破坏性变更）**:`site`/`theme`/`navigation`/`sidebar`/`footer`/`security`/`content-policy`/`tag-aliases`/`friends` 9 个配置由 `.json` 重命名为 `.json5`;不再兼容 `.json`（检测到旧文件时输出重命名提示,旧文件不会被读取）;全部脚本/文档/示例/主题文章引用已同步(118+10 处) — 仓库根目录 + `scripts/` + `docs/` + `articles/`
- **site.json5 全字段注释与死配置清理**:每个字段标注(作用/类型/可填值/不可填值/推荐/注意);`performance` 段由 15 键精简为 8 键（移除 5 个与 `build.*` 重复的提升开关,以及未实现的 `lazyLoadRootMargin`/`criticalCSS`）;`fontDisplay` 正式接线(@font-face 生成,非法值回退 swap);`features.imageLazy` 移除无实现的 `mode`/`loadMargin`(改用原生 loading=lazy);补齐缺失的 `build.generateGallery`;删除重复 `subtitleEn` — `site.json5` + `scripts/build.js` + `features.json5` + `scripts/lib/features-schema.js` + `docs/config-reference.md`
- **theme.json5 全字段注释与接线**:每字段按模板标注;新增 glass.rgb/glass.darkAlpha 声明并接线暗色毛玻璃透明度(--glass-a-d);补 card.showWordCount;修正文档过期默认值(secondary/accent/containerWidth);删除 build.js 中已迁至 features 域的死默认值 theme.customCSS;文档第 2 章补 7 行新键 + 新增 3.60 customCSS 章节 — theme.json5 + templates/layout.ejs + scripts/build.js + docs/config-reference.md
- **navigation/sidebar/footer 三文件全字段注释与接线**:导航新增 logoText(正式生效)/logoImage/logoWidth 图片 Logo 支持,移除死键(algolia 配置/userMenu/navbar.sticky/transparent/mobileCollapse);侧栏 tags 新增 sortBy/minCount 接线、newsletter 组件补全渲染(provider/mailchimpAction/buttonText/placeholder,构建探针验证),移除死键(sidebar sticky/stickyOffset/scrollFollow/mobile 块/recent.excludeDrafts/categories.hierarchy/author.social);页脚移除死键(fromYear/layout/social.iconSize 重复项);三文件逐字段注释(作用/类型/可填/不可填/推荐/注意) — navigation.json5 + sidebar.json5 + footer.json5 + templates/layout.ejs
- **security/content-policy 两文件全字段注释与死键清理**:security.json5 移除 4 个无实现的死块(sri/securityLogging/contentFilter/uploadSecurity)与 hardening 中 2 个死键(限流统一由 rateLimiting 段单一控制),明确 hardening 为 headers 覆盖层;content-policy.json5 逐字段注释;build.js 同步删除 4 个死默认值 — security.json5 + content-policy.json5 + scripts/build.js + docs/config-reference.md
- **tag-aliases/friends 两文件全字段注释**:tag-aliases 补充匹配规则说明(精确+小写回退);friends 新增 labels 多语言标题配置并接线,修正示例字段(desc);文档第 9 章同步修正 — tag-aliases.json5 + friends.json5 + docs/config-reference.md
- **features/tuning/ui-strings 头部规范补全**:三文件补充「作用/加载/校验规则/覆盖链/边界提示」规范头(features 增加 schema 校验与数组替换语义;tuning 增加双生效方式与「待实现」约定;ui-strings 增加回退链与占位符说明) — features.json5 + tuning.json5 + ui-strings.json5
- **tuning 10 项「待实现」全部接线**:typography.leadSize(文章首段导语)、comments.avatarSize/width/borderRadius/dividerShow(评论区标记头像与宽度/iframe 圆角/分隔线)、pagination.maxVisible(分页窗口省略:新增 buildPaginationItems,首尾+当前窗口+省略号;字符串参数自动解析)、reward.popupRadius(打赏弹窗)、tags.cloudMinSize/MaxSize(标签云字号按热度梯度 calc 插值)、series.progressHeight(系列进度条元素,含宽度百分比);移除全部「待实现」标注,文档同步 — tuning.json5 + templates/{layout,post,index}.ejs + scripts/build.js

- **主题预设 `theme-presets.js`**:6 套预设新增 `labelEn` 字段(Classic Blue/Midnight Black/Forest Green/Sakura Pink/Editorial Gray/Cyber Purple)
- **`site.json`**:新增 `languages: ['zh','en']`、`titleEn`、`subtitleEn`、`hero.titleEn`、`hero.subtitleEn`、`externalLinkWarning.titleEn/messageEn/confirmTextEn/cancelTextEn`
- **OG 图管线**:`scripts/generate-og.js` 按语言目录输出 `dist/og/{lang}/{slug}.png`,`usedSlugs` 按语言独立去重(zh/en 同 slug 不再冲突);移除 build.js 内联 SVG OG 管线
- **侧栏/页脚/导航配置**:全部 widget/链接/菜单项支持 `titleEn`/`labelEn`
- **旧参数清理(不兼容变更)**:`themeToggle.persistKey` 取代硬编码 localStorage 键 `theme`(默认 `ss-theme`);`themeSchedule.checkIntervalMs`(毫秒)取代 `tickMinutes`(分钟);`stats.showSidebar` 取代 `stats.sidebarWidgetDefault`;`prevNext.scrollToTopOnClick` 取代 `prevNext.scrollToTop`;`mobile.tocBreakpoint` 取代 `mobileToc.breakpoint`;`contactPopup.copySuccessText` 取代 `contactPopup.copiedText`;`series.prevLabel`/`nextLabel` 取代 `showPrevLabel`/`showNextLabel`;`motion.pageEnterDurationMs` 由 `pageTransition.durationMs` 取代 — `features.json5` + `scripts/lib/features-schema.js`
- **theme.json**:移除 `animation.scrollBehavior`(由 `features.scrollBehavior` 接管)与死配置 `animation.pageTransition`(由 `features.pageTransition` 接管),不兼容变更 — `theme.json`
- **档位数值表外置**:`rounding/shadowLevel/borderStyle/density` 的具体数值从 `scripts/build.js` 内联常量迁移至 `theme.json` 的 `tiers`(四组档位,完整注释);`build.js` 仅保留解析逻辑 — `theme.json` + `scripts/build.js`
- **prismTheme 模块精简**:移除未实现的主题切换器子键(themes/defaultTheme/remember/storageKey/windowBar),仅保留 `enabled` 作为代码高亮配色总开关(配色见 `codeHighlight.palette`),消除多开关 — `features.json5` + `scripts/lib/features-schema.js`
- **theme.json 清理**:移除被 `tiers.shadow` 取代的 `shadow` 段与死键 `codeHighlight.theme/highlightLines` — `theme.json`
- **tuning 收尾（单一入口 + 保留项接线）**:删除与 features/site/theme 重复的 57 个键（toast/gallery/heatmap/footer/sidebar/archive/lightbox 整组 + 分散键），消除多开关；接线 18 项保留项（typography quote/caption/meta/small/tiny、hero.ctaRadius、radius.image/badge、search.inputHeight、stats.hoverLiftPx、pagination.activeScale、breadcrumb.currentWeight、tags.hoverScale、share.iconSize、prevNext.titleLines、contactPopup.iconSize/valueFontSize、comments.marginTop）；10 项无实现目标的键在注释标注「待实现」 — `tuning.json5` + `templates/layout.ejs`
- `package-lock.json` 同步 `package.json` 的 `license: "MIT"` 元数据 — `package-lock.json`
- **工具链升级（审计跟进）**：`engines.node` 提升为 `^20.19.0 || ^22.13.0 || >=24`；ESLint 9.39.5（已 EOL）升级 10.11.0 + `@eslint/js` 10.0.1；新增 `npm run typecheck`（TypeScript 5.9.3 checkJs，先覆盖 `scripts/lib`，配 `@types/node` 20.19.43）并纳入 CI 门禁；README 同步 — `package.json` + `tsconfig.json` + `.github/workflows/deploy.yml` + `README.md`

### Fixed

- **窄桌面窗口头部布局修复**：769–1200px 窗口宽度下站点标题/副标题换行、副标题竖排、导航溢出遮挡、语言按钮越界——品牌区改单行省略号收缩（标题/副标题 `white-space:nowrap` + `text-overflow:ellipsis`）、`.header-inner` 增加 `gap`/`min-width`；分级响应：≤1200px 隐藏导航社交图标、≤1100px 收紧导航内边距、≤960px 隐藏加速/预设入口并缩小品牌字号；768px 及以下移动端行为不变（多宽度断言：1280/1200/1100/1024/960/900/860/820/800/769 零溢出、标题副标题单行、语言按钮在容器内，中英双语均验证） — `templates/site-css.ejs`
- **`npm run audit` 快捷脚本**：固定 `--registry=https://registry.npmjs.org`（本机 npm 镜像会阻断 audit 接口） — `package.json` + `README.md`
- **PWA manifest 图标 404**：启用 PWA 时构建会从 `site.favicon.svg` 自动生成 `icons/icon-192.png` 与 `icon-512.png`，并逐条校验 manifest 图标存在性（缺失自动剔除并告警），修复启用后 manifest 引用不存在文件导致的 404 与安装能力降级 — `scripts/build.js` + `site.json5` + `docs/config-reference.md`
- **sitemap 时间格式/编码/去重**：`lastmod` 由 `Date.toString()` 改 ISO 8601；中文标签路径经 RFC 3986 编码；标签 URL 重复去重 — `scripts/lib/robots.js` + `scripts/build.js`
- **OG 图安全与清理**：草稿文章不再生成/保留（自动清理陈旧产物）；封面路径穿越防护；serve/watch 与生产行为一致 — `scripts/generate-og.js` + `scripts/build.js`
- **前端健壮性 6 项**：畸形外链 URL、sidebar 选择器注入、guard `decodeURIComponent`、theme-presets 存储被禁、搜索历史转义、favicon 缓存失效 — `js/domains/*` + `scripts/build.js`
- **无障碍 3 项**：回顶滚动尊重 reduced-motion（`__SB()`）、PWA 安装按钮键盘可达、内联脚本移至 `<meta charset>` 之后 — `js/domains/*` + `templates/layout.ejs`
- **页面过渡**：bfcache 返回/导航中止时清理 `page-leaving`（含兜底计时器） — `js/domains/page-transition.js`
- **safeSlug** 兜底改内容哈希（消除 `Math.random` 非确定性） — `scripts/lib/utils.js`
- **搜索索引** `features.search.includeContent` 键修复（原读不存在的 `fullContent`） — `scripts/build.js`
- **双轴审查回归修复**：命令面板 `hotkey:''` 真正关闭监听；CSP 统计域名按 webAnalytics token 条件裁剪（+1 项单测）；meta CSP 与响应头共用裁剪结果；`SITE_URL` 去尾斜杠；CI Lint 步骤前移；OG 清理在生成失败时跳过；分享复制 clipboard 失败降级到 execCommand；访问门槛遮罩补 `aria-hidden` 并在解锁后归还焦点；PWA 安装按钮关闭控件改兄弟节点（消除嵌套交互控件，WCAG 2.2 AA）；`guard-defaults` 热键默认值与 `guard.json5` 同步；`hotSearches.top/showInDropdown/showClear` 标注为预留未接线 — 多文件
- **遗留（技术债，未在本轮实施）**：OG 图 PNG→JPEG 体积优化（涉及社交卡片格式兼容评估）

- **移动端底栏链接缺语言前缀 + 按钮全量审计（用户报告）**：底部导航 `href` 原为无前缀硬编码（`/`、`/archive/`、`/search/`），在 `/en/` 页点击会跳回中文站；改为按 `langPrefix` 生成（`/en/archive/`、`/en/search/` 等），主题按钮 `window.toggleDark()` 正常。同时修复浮动控件层级：`read-dock` 与移动端 TOC 按钮重叠、`.back-to-top` 钻入底栏——移动端重排 `bottom`（4 / 7.4 / 10.8 / 14.2rem）并给 `body` 预留底栏高度；`.dock-ring` 加 `pointer-events:none`（原覆盖进度按钮）。小型文字链接（面包屑/卡片元信息/标签/页脚）增加 4×6px 隐形点按扩展（WCAG 2.5.8），`mobileBottomNav` 新增 `labelHome`/`labelArchive`/`labelSearch`/`labelTheme`/`labelTop` 配置键（空=走 ui-strings `bottomNav.*`）。新增 `verify-buttons.js`：10 页交互元素命中/尺寸/链接可达 + 底栏中英功能 + 头部控件断言 44/44，移动端 46/46、灯箱 14/14 — `templates/layout.ejs` + `templates/site-css.ejs` + `features.json5` + `scripts/lib/features-schema.js` + `docs/config-reference.md`：① `i18n.js` 运行时改为 **URL 前缀优先**（此前 localStorage 旧偏好会覆盖页面语言，导致 /zh/ 被刷成英文文案等混排）；② 语言切换路径拼接修复（原 `/en/x/` 切中文得到 `/zhx/`，现正确 `/zh/x/`）；③ `pages/disclaimer` 补英文 slug（原中文标题直接当 slug，中英共用），旧 `/zh|en/公告/` 加 301 重定向；④ 新增 `pages/en/{about,privacy,terms,disclaimer}.md` 英文页；⑤ 页脚列渲染从未读取配置的 `titleEn`/`labelEn`，且 html 无英文位——补 `htmlEn` 字段与英文文案；⑥ 移动端底栏标签改走 ui-strings（新增 `bottomNav` 中英词条，并补 `toolbar.mobileNav` aria），EN 页头/底栏/页脚中文混杂清零；⑦ 移动端表格改为可横向滚动（EN 文章表格溢出 437→390）。回归：`verify-mobile` 46/46（含 EN 页无中文混杂、语言切换往返路径保持子路径）、灯箱 14/14。另：跨文档 View-Transition 在快速连续导航/视口变化时 Chrome 抛 `InvalidStateError` 属浏览器噪声，测试已过滤 — `js/domains/i18n.js` + `templates/layout.ejs` + `templates/site-css.ejs` + `ui-strings.json5` + `footer.json5` + `pages/*` + `site.json5` + `README.md` + `docs/config-reference.md`
- **移动端首页整页缩小/横向滚动与触控尺寸（用户报告）**：hero 辉光伪元素 `.hero::before` 的 `left/right:-15%` 在 390px 下把内容宽度撑到 436px，Chrome 据此缩小布局视口（innerWidth 436、innerHeight 944），首页出现横向滚动且所有 UI 被整体缩小；修复：移动端 `.hero::before{left:0;right:0}` 收进容器；同时 ≤768px 隐藏头部社交/加速/预设按钮（此前隐藏规则因级联顺序被后面的基础规则覆盖、从未生效）、导航间距收紧、语言按钮 ≥36px、公告关闭按钮触控面 40×33；新增 `verify-mobile.js` 22 项回归（4 页无横向溢出/汉堡菜单开合/移动端点图开灯箱与关闭/桌面端不回归）。字体 preload 警告经项目自带服务器实测 0 复现（属外部静态服务器 MIME/缓存/节流环境差异；正确 MIME 为 `font/woff2`） — `templates/site-css.ejs`
- **灯箱（lightbox）按钮无法点击与交互逻辑修复（用户报告）**：全屏 `.lb-stage` 在 DOM 中位于 `lbClose`/`lbPrev` 之后且无 z-index，将其覆盖导致真实鼠标点击无效（`elementFromPoint` 命中 stage）；修复：交互控件统一 `z-index:6`，说明条/计数 `pointer-events:none`（说明条上滚轮也可缩放）；重写双击/滚轮「指向光标缩放」平移公式（原公式 3 倍偏移）并在旋转态跳过重定心；背景关闭改为「图片区域外且非拖拽（位移≤6px）才关闭」，拖拽导航不再误触关闭；打开时焦点移至关闭按钮、补齐空节点防御。新增回归 `verify-lightbox-ui.js` 14/14（真实鼠标点全按钮） + 既有 `verify-lightbox3` 9/9、`verify-lightbox-gestures` 5/5 — `js/domains/lightbox.js` + `templates/site-css.ejs`
- **Mermaid 多图并发渲染串位（严重）**：一次文章含多张图表时，并发调用 `mermaid.run()` 导致渲染结果相互污染——状态图样式元素缺失 viewBox 而空白/坍塌遮挡正文，甘特图被饼图覆盖而不显示（用户报告）；改为 `__mmSeq` 串行逐个渲染（首次渲染与主题切换两条路径均修复），并同步将演示文章甘特图加 `axisFormat %m-%d` + `tickInterval 1week` 消除日刻度标签重叠 — `templates/layout.ejs` + `articles/zh/diagrams-math.md` + `articles/en/diagrams-math.md`（回归脚本 `.tmp-scripts/verify-mermaid-render.js`：首屏+主题切换各 10 项断言 20/20）
- 图库页说明文案 `{count}` 占位符未替换且句子重复（模板误用 `gallery.desc` 两次）：改为「共 N 张图片 · 站内图片集，点击查看大图。」单句组合 — `templates/gallery.ejs`
- 公告条「关闭后刷新/切页仍闪现」根因修复：`data-items` 属性双重转义（`escapeAttr` 与 EJS `<%=` 叠加）导致浏览器 `JSON.parse` 失败、关闭哈希与内容哈希错位、`<head>` 首帧早检脚本永不命中；现改为单层转义，并**反转为「默认隐藏，`<head>` 早检确认未关闭后才显示」**（关闭态刷新/导航实测零可见帧；禁用 JS 时公告不显示，属预期设计） — `templates/layout.ejs` + `js/domains/announcement.js`
- 联系弹窗（导航/页脚）与 `data-site-title`/`data-article-title` 属性双重转义：`escapeAttr` 与 EJS 转义叠加导致属性值失真（呈现 `&amp;quot;` 形态），统一为单层 EJS 转义 — `templates/layout.ejs`
- 构建压缩管线顺序错误：`minifyAll` 原先跑在资源拷贝**之前**，导致 `dist/assets/js` 从未被 Terser 压缩（注释/空白原样上线）；已重排为「拷贝 → PWA → 压缩 → cache-bust」，并让 cache-bust 排除 `assets/` 与 `sw.js`（避免破坏 ESM 相对导入与 Service Worker 固定路径） — `scripts/build.js`
- 内联 CSS 注释/空白残留（minify-html 对超大 `<style>` 静默跳过）：新增 CleanCSS(level 1) 内联样式专用压缩 pass（保留 `@property`/`:has`/`color-mix` 等现代语法） — `scripts/build.js`
- 公告条在渐进渲染下仍可能闪现一帧：新增 `<head>` 早检脚本（构建期预计算内容哈希），首帧前即置 `data-ann-dismissed` 并由 CSS 隐藏（`html[data-ann-dismissed] .announcement-bar{display:none}`） — `templates/layout.ejs`
- Mermaid 图表标签使用内置 trebuchet 字体并带半透明白色底（文字挤压/白边/排版异常）：`initialize` 注入站点字体、`edgeLabelBackground` 透明、flowchart/class/state 关闭 htmlLabels，渲染移至 `document.fonts.ready` 之后；CSS 兜底标签背景透明 + 宽图表横向滚动 — `templates/layout.ejs`
- 数学公式发虚：reveal 动画残留 `will-change` 致文本长期驻留合成层，`.motion-reveal.in` 改 `will-change:auto` — `templates/layout.ejs`
- 灯箱计数器与图片说明重叠：计数器移至顶部居中；旋转拆分为左转/右转两个按钮；重置按钮原用 × 图标与关闭混淆，改为“适配视图”图标；工具/导航/关闭按钮统一为 `--lightbox-btnSize`（44px，移动端 38px） — `templates/layout.ejs` + `js/domains/lightbox.js`
- 公告条关闭无动画：增加滑出动画（`@property --annH` 注册属性过渡，固定头部/内容偏移同步上移；`prefers-reduced-motion` 直接收起） — `templates/layout.ejs` + `js/domains/announcement.js`
- 公告条已关闭状态在刷新/跳页时短暂闪现：EJS 预计算内容哈希 + 条后内联脚本在解析期即移除并置 `data-ann-dismissed` 属性（首帧无过渡、头部零抖动） — `templates/layout.ejs`
- 标题锚点 `#` 与 H2 主色竖线重叠：锚点改为右对齐定宽框（`left:-1.8em;width:1.65em;text-align:right`），与竖线保持 6px 间隙 — `templates/layout.ejs`
- 公告条关闭后头部无法上移：关闭（及加载时已记忆关闭）时将 `--annH` 收起为 `0px`，固定头部/移动菜单/粘性目录即刻回位 — `js/domains/announcement.js`
- 标题字体 Sora 全站失效：`:root` 中 `--ff-mono` 用转义输出（`<%=`）导致字体栈里的单引号被 HTML 实体化为 `&#39;`，其携带的分号截断 CSS 声明链并连带吞掉 `--ff-d`（Sora 栈）；改为原始输出（`<%-`）后 `--ff-mono`/`--ff-d` 均正确生成，h1 计算字体恢复 Sora、等宽字体恢复 Fira Code — `templates/layout.ejs`
- 公告条文本不可见（绝对定位导致视口零宽裁切）：改为 `display:grid` 叠层，宽度随内容自适应 — `templates/layout.ejs`
- 代码窗口栏按钮与语言标签重叠：`.code-actions` 恢复文档流（`position:static`）且语言标签 `margin-right:auto` — `templates/layout.ejs`
- 长行代码横向滚动条过淡难看：正文 `pre` 定制滚动条（thumb 文字色 38%→悬停 62%、9px、圆角、Firefox `scrollbar-color`） — `templates/layout.ejs`
- 共享元素封面过渡卡顿: 文章封面统一 `aspect-ratio: card.imageAspect`(16/10) 消除形变; 首页 Bento 大卡(21/10)不参与封面形变(标题仍共享) — `templates/layout.ejs` + `templates/index.ejs`
- features 模块计数同步为 91; README/config-reference 计数修正(91 模块/723 项)（该计数已过时，当前计数见本节后续条目）

- **canonical 全站指向根路径（SEO）**：`<link rel="canonical">` 此前对所有页面均输出站点根（模板引用了不存在的 `page.url`），现改用 `currentUrl`（文章/分页/归档/标签等各自 URL），并规整 `site.url` 尾部斜杠 — `templates/layout.ejs`
- **Pagefind 索引生成失效修复**：门控误读不存在的 `features.search.provider` 导致函数恒不执行；改读 `navigation.search.provider === 'pagefind'`，并在压缩/哈希**之后**生成（不参与 cache-bust、写前清空旧索引、输出目录跟随 `features.pagefind.indexPath`）；`navigation.json5` 新增并注释 `search.provider` 键（`local`/`pagefind`），README/config-reference 同步 — `scripts/build.js` + `navigation.json5` + `README.md` + `docs/config-reference.md`
- **空构建防护**：页面渲染整体失败（`dist/` 无任何 HTML）时立即中止构建并提示检查模板语法/变量，避免静默产出空站 — `scripts/build.js`
- **HTML 消毒器安全加固**：旧正则实现存在三个已复现绕过（实体编码 scheme `jav&#x61;script:`、属性值内含 `>` 截断、未引号属性逃逸 `srcset=a"onerror=…`）；改用 `sanitize-html@2.17.7`（精确锁定）按标签/属性白名单解析式消毒，未知标签预转义保持原展示语义，媒体 `src/poster` 仍限站内；单元测试 +5（含三个绕过回归），集成安全回归新增三组载荷 — `scripts/lib/utils.js` + `scripts/build.test.js` + `scripts/security-verify.js` + `package.json`
- **SVG 消毒实体绕过修复**：`sanitizeSvg` 检查前先做实体解码（数字/十六进制/常用命名实体）并剔除控制符，封堵 `&#106;avascript:`、`java\tscript:`、编码外部引用等绕过 — `scripts/lib/content-policy.js` + `scripts/build.test.js`
- **front-matter `slug` 强校验**：显式 slug 此前绕过 `safeSlug`，可致路径遍历写出 `dist/` 之外、`"><script>` 注入 og:image 属性、污染 `_redirects`；现统一经 `validateSlug`（拒绝分隔符/`..`/HTML 与系统保留字符，超长拒绝），文章不合法即跳过并报错、自定义页不合法即中止；sitemap `<loc>` 统一 XML 转义、`_redirects` 条目清洗空白与控制符 — `scripts/build.js` + `scripts/lib/utils.js` + `templates/layout.ejs`
- **构建报告与 og:image 转义**：被拦截文件名/原因经 HTML 转义、报告页加 `noindex`；og:image 属性值经 `escapeAttr` 单层转义 — `scripts/build.js` + `templates/layout.ejs`
- **Worker 安全层部署配置修复**：`workers/wrangler.toml` 此前无 `main` 入口且用旧 Workers Sites 配置（`env.ASSETS` 实为不存在），实际不可部署；现补 `main = "security-worker.js"`、改为 `[assets]`（`binding = "ASSETS"`、`run_worker_first = true`），部署脚本加 `--env production`（ENVIRONMENT 生效），README 同步；`wrangler deploy --dry-run` 验证通过（bindings: ASSETS + ENVIRONMENT） — `workers/wrangler.toml` + `package.json` + `README.md`
- **前端 12 项缺陷修复**：搜索特殊字符 `[`/`\` 致 RegExp 崩溃与空态重复渲染（转义修正 + 单空态）；Ctrl+K 搜索与命令面板双开（面板默认热键改 Ctrl+P，保留「搜索启用时让位」兜底）；PagefindUI 死代码聚焦即 404（改 provider='pagefind' 时正确挂载 `#pfWrap` 并隐藏本地输入）；toc 滚动改 rAF 节流 + 读写分离；搜索小写语料预计算；reading-history/access-gate 增加预渲染守卫；5 处 localStorage 未防护（含内联主题脚本两处，存储被禁用时页面可完整启动）；boot 失败无条件 console.error；代码块「复制全部」在 `copyAllButton=true` 时的 ReferenceError 与无回退（execCommand 回退 + toast）；公告条关闭未清理 setInterval；lightbox 双 wheel 监听致 Ctrl+滚轮双倍缩放（合并单监听）+ 死代码清理；morphicons 加载失败重试风暴 — `js/core/boot.js` + `js/domains/*` + `templates/layout.ejs`
- **Pagefind 索引 0 页根因修复**：minify-html 省略 `</head>` 虽合法，但 Pagefind 1.5.2 解析器会丢弃此类页面（已用 API/CLI/极简页二分复现）；现 minify 保留闭合标签（每页约 +20B），索引恢复 84 页 / zh-cn + en-us — `scripts/build.js`
- **Pagefind 生成不再跳过 serve/watch**：serve 启动会清空 dist 且跳过生成导致预览必 404；现所有模式一致生成 — `scripts/build.js` + `README.md` + `docs/config-reference.md`
- **命令面板默认热键 k → p**：Ctrl+K 固定保留给全站搜索；若手动改回 k 且搜索启用，面板自动让位 — `features.json5` + `js/domains/command-palette.js`
- **Worker 边缘安全层加固**：IP 黑白名单与路径 `allowedIPs` 支持 IPv4/IPv6 CIDR（含 `::ffff:` 映射、`%xx` 解码与大小写归一）；修复限流「封禁条目在清理时被提前删除导致提前解封」；静态资源前缀默认免限流（避免正常浏览误触 429）；`/csp-report` 移至限流之后并加 16KB 载荷上限、日志只记关键字段；维护页消息 HTML 转义；ASSETS 获取失败返回 502 且所有早期响应（403/429/503/502）补齐安全头；Worker CSP 补 `report-uri` — `workers/security-worker.js` + `workers/lib/ip-utils.mjs` + `workers/lib/rate-limit.mjs` + `workers/package.json`
- **Worker 与 `_headers` 头部统一**：新增共享 `applyHeaderHardening`（构建期生成 `_headers` 与 Worker 配置同源调用），修复 hardening 覆盖 HSTS 时丢失 `preload` 的问题；新增 `hardening.hstsPreload`；`rateLimiting.skipPaths` 与 `pathRestrictions.requireAuth/allowedIPs` 全量透传 Worker — `scripts/generate-security-config.js` + `scripts/build.js` + `security.json5` + `docs/config-reference.md`
- **CI 门禁修复**：AGENTS.md 检查因 `fetch-depth:1` 导致 diff 恒空而失效（现 `fetch-depth: 0` + 按事件计算范围：PR base...head / push before..sha / 首次推送空树回退）；`npm audit` 与 `verify:security` 纳入所有 PR 构建；补 `permissions: contents: read` — `.github/workflows/deploy.yml`
- **Worker/CIDR 测试补充**：新增 18 项单元 + 集成测试（IP/CIDR 解析、限流封禁持久、静态资源跳过、路径归一、报告上限、维护转义、错误兜底、头部一致性） — `scripts/security-worker.test.js`
- **性能优化（本地 trace 实测）**：搜索语料由每页内联改为按需 fetch `/…/search-index.json`（浮层搜索与独立搜索页共用缓存与就绪标记，首开无感预取）；首页首卡与文章封面输出 `fetchpriority="high"`（首卡 `loading="eager"`）；cache-bust 同步重写 search-index.json 内媒体路径（修复搜索结果缩略图 404）。首页 LCP 795→348ms、HTML 236→199KB（-16%）；文章页 HTML 242→205KB、CLS 0 — `templates/layout.ejs` + `templates/index.ejs` + `templates/post.ejs` + `templates/search.ejs` + `js/domains/search.js` + `scripts/build.js`
- **终审（review 双轴）修复批次**：预渲染守卫补 `prerenderingchange` 联动（阅读历史/访问门槛不再因 speculation 预渲染漏记或漏计）；Pagefind 加载失败/禁用时浮层回退本地输入、独立搜索页接入 pagefind 并双层降级；Worker 静态资源免限流仅限 GET/HEAD；路径匹配解码后折叠重复斜杠（封 `%2F` 绕过）；slug 非法改为中止构建（不再静默丢弃文章）；CIDR 无效条目构建期告警并剔除；Ctrl+K 与命令面板双向互斥；search-index 媒体路径重写纳入安全回归断言 — `js/domains/search.js` + `js/domains/guard/access-gate.js` + `js/domains/reading-history.js` + `js/domains/command-palette.js` + `templates/search.ejs` + `workers/**` + `scripts/build.js` + `scripts/generate-security-config.js` + `scripts/security-verify.js`
- **遗留（技术债，未在本轮实施）**：`templates/layout.ejs` 每页内联约 121KB CSS 的外链化——需配合视觉回归专项评估，见交接文档

- **自动摘要混入源码**：摘要从正文 HTML 提取时未剔除代码块/mermaid 图表源/LaTeX，卡片、meta、RSS 与搜索摘要出现"莫名其妙代码"；现先剥离 `<pre>` 块、标题锚点 `#`、实体化标签与公式再截断 — `scripts/build.js`
- **侧栏与聚合数据未按语言/草稿过滤**：`recentPosts`/归档/`seriesList`/图库/`siteStats` 在语言域重算；标签与分类聚合、系列、相关文章剔除草稿并限定同语言，修复中文页侧栏混入英文文章与草稿分类泄露 — `scripts/build.js`
- **`sanitizeHtml` 剥离 `decoding` 属性**:性能配置注入的 `img decoding=async` 被净化白名单丢弃;白名单补 `decoding` 并附回归测试 — `scripts/lib/utils.js` + `scripts/build.test.js`
- **代码块语言标签修复**:普通代码块重复标签（死类 `has-windowbar` → 实际 `code-window` 排除）与窗口栏标签门控 `showLanguageTag`;Mermaid 块不再被误加窗口栏/重复标签 — `templates/layout.ejs` + `js/domains/code-block.js`
- **`externalAssets.styles` 从未渲染**:该配置仅被 preload 引用、未输出 `<link rel=stylesheet>`,导致外部字体样式从未生效;现已渲染并清空遗留 Google Fonts 链接 — `templates/layout.ejs` + `theme.json`
- **字体样式预加载**:`site.performance.preloadFonts` 现同时预加载本地 vendor 字体样式（原先仅匹配 Google Fonts) — `templates/layout.ejs`
- **代码块窗口栏背景**:修复 `--color-surface-2` 未定义回退深色导致浅色模式窗口栏发黑;改为跟随代码块背景,复制/展开按钮改用 `color-mix` 自适应明暗 — `templates/layout.ejs`
- **表格斑马纹硬编码**:改接 `theme.appearance.tableStripeBg`(`--ap-str`,原为双模式硬编码 rgba,且该配置项此前完全未生效) — `templates/layout.ejs`
- **阅读进度条梯度死键**:`features.readingProgress.progressColor` 不存在导致永远回退;改用 `gradientStart/gradientEnd`(与文档一致),删除 tuning 重复键 `reading.progressColor`;进度圆点 `dotSize/showDot` 接线(原固定 10px 常显) — `templates/layout.ejs` + `tuning.json5`
- **统一过渡曲线死配置**:`--te` 原为硬编码曲线,`theme.animation.transitionTiming` 与 `features.motion.ease` 均未生效;统一为 tuning → theme 两级读取并删除重复键 — `templates/layout.ejs` + `theme.json` + `features.json5` + `scripts/lib/features-schema.js`
- **侧栏独立滚动条**:`.sidebar` 的 sticky/max-height/overflow 组合导致主页右侧出现第二条滚动条(内容 2179px vs 视口 804px);恢复自然流式布局,全页仅保留主滚动条 — `templates/layout.ejs`
- **Mermaid 图表旁文字外泄**:图表块被执行顺序绕过跳过逻辑而误加代码窗口栏(含 "mermaid" 语言标签),`data-language` 亦触发 `pre::before` 标签;代码块模块增加前置三重识别(`data-language`/`div.mermaid`/`code.language-mermaid`),Mermaid 转换时移除 `data-language` 并清理误加窗口栏 — `js/domains/code-block.js` + `templates/layout.ejs`
- **TOC 滚动高亮(scrollspy)失效**:`templates/layout.ejs` 中 tocScrollSpy IIFE 结尾 `})})});` 缺少 IIFE 调用括号 `()`,导致函数只定义从未调用、进度线与当前章节高亮永不生效;修复为 `})})})();`
- **RSS 重复生成**:移除 build.js 中第二个无语言循环的旧版 `generateRSS`,避免覆盖语言版 feed
- **根路径 404**:`/search-index.json`、`/manifest.json` 等根别名路径由 500 修复为 302 重定向至语言版本
- **contactPopup en 页复制提示显示中文**:`copySuccessText` 默认值遮蔽 `__T` 双语回退;现默认留空,回退内置词典 `toolbar.copyDoneToast`(en: Copied to clipboard) — `templates/layout.ejs`
- **评论占位一次性检查**:giscus/Disqus 慢载入(超过 loadDelayMs)时占位永久显示「暂无评论」;改用 MutationObserver 持续监听,组件出现即清空占位,超时才显示 `emptyText` — `templates/post.ejs`
- **hero.backgroundImage CSS 转义错误**:HTML 转义(`&`→`&amp;`)注入 CSS `url()` 导致含查询参数的 URL 加载失败;改为 JSON 字符串化 + `<` 过滤 — `templates/layout.ejs`
- **hero 标题回退缺失**:语言首页未配置 `hero.title` 时回退 `site.title`(根页已有此逻辑,语言页缺失) — `scripts/build.js`
- **无封面卡片仅显示标题首字**:改为显示完整标题并适配多行样式 — `templates/index.ejs` + `templates/layout.ejs`
- **motion 卡片悬停缩放被 reveal 覆盖**:`.motion-reveal.in{transform:none}` 同权重且更晚,导致卡片入场后 hover scale 失效;提升选择器权重 — `templates/layout.ejs`
- **主题预设切换后 CTA 按钮颜色不跟随**:`applyPreset()` 未同步 `--bpb`(构建期按钮主色变量,默认取 secondary);现随预设 secondary 同步更新 — `templates/layout.ejs`
- **JSON-LD 面包屑缺分类层且 URL 错误**:结构化数据读取不存在的 `article.category` 字段导致缺分类层级,且链接格式为 `/category/{名称}/`(实际路由为 `/categories/{slug}/`);改用 `article.categories[0]` + 分类 slug 查找并补语言前缀 — `templates/layout.ejs`
- **PWA SW 安装失败(manifest 被重定向)**:`_redirects` 将根 `/manifest.json` 302 到不存在的 `/zh/manifest.json`,导致 `cache.addAll` 失败、service worker 安装失败;PWA 开启时不再生成该重定向 — `scripts/build.js`
- **收藏功能半成品补全**:`favBtn` 无任何 JS 逻辑(点击无反应、favToast 从未调用);现实现收藏/取消(按钮状态 + aria-pressed + 统一 toast)、localStorage 持久化、收藏页列表渲染与移除、空状态;en 页按钮文案经 `ui()` 词典 — `templates/layout.ejs` + `templates/post.ejs`
- **客户端 `__T` 语言回退**:i18n 运行时模块关闭时 `data-lang` 未设置,导致 en 页客户端文案回退中文;现回退服务端渲染的 `<html lang>` — `templates/layout.ejs`
- **OG 生成对齐构建与头部防挤压**：OG 文件 slug 与构建产物对齐、`dist/og` 免 cache-bust、固定头部防挤压与副标题截断、404 页配置修正 — `scripts/generate-og.js` + `scripts/build.js` + `templates/layout.ejs` + `templates/site-css.ejs` + `features.json5`
- **侧栏作者字母徽章水平居中**：`.widget-author-badge` 补充自动外边距 — `templates/site-css.ejs`
- **忽略规则整理**：本地数据副本与构建/环境产物排除规则调整（后续收敛为仅本地生效的排除文件，避免仓库暴露部署细节） — `.gitignore`
- **PWA 关闭时残留死重定向**：`/manifest.json`、`/site.webmanifest` 两类别名此前在 PWA 关闭时仍 302 到不存在的文件；现两类别名彻底不再生成（PWA 开启时 manifest 为根目录实文件，无需别名） — `scripts/build.js`

### Removed

- `features.feed` 模块（9 键：`rssEnabled/rssPath/rssFullContent/rssMaxItems/jsonFeedPath/jsonFeedFullContent/jsonFeedMaxItems/injectHeadLinks/injectFooterLink`，第七轮，重复/未接线模块；订阅唯一来源为 `site.json5 → rss`）。**迁移**：`rssEnabled→site.rss.enabled`、`rssPath→site.rss.path`、`rssFullContent→site.rss.fullContent`、`rssMaxItems→site.rss.maxItems`、`jsonFeed*→site.rss.jsonFeed.*`、`injectHeadLinks→site.rss.injectHeadLinks`（新增键，默认 true）、`injectFooterLink→features.subscribe.enabled + subscribe.rss`；映射表另见 `docs/config-reference.md` §3.29。删除无行为变化（原默认值与 site.rss 默认一致）。
- `features.backToTop.rightOffset` / `features.backToTop.bottomOffset`（第六轮，语义重复；返回顶部定位唯一来源 `tuning.json5 → backToTop.offsetSide/offsetBottom`，模板经 `var(--backToTop-offsetSide/offsetBottom, 2rem)` 消费。**迁移**：位置请改 tuning 同名键；原 features 默认值 `2rem`/`2rem` 与 tuning 同值，删除无行为变化）。
- `features.gallery.incrementalByDefault`（第五轮，未接线；当前实现无图库增量清单缓存，该键无任何消费点与可观察差异。**迁移**：无需操作，删除无行为变化；未来实现增量构建时按 `docs/incremental-build-design.md` 新方案恢复）。
- `features.search.placeholder` / `features.search.placeholderEn`（第四轮，语义重复；搜索框占位唯一来源 `navigation.json5 → search.placeholder/placeholderEn`（空回退 `ui-strings.search.placeholder`），模板 SSR 直接消费且实测生效。**迁移**：把值搬入 `navigation.json5` 同名键；默认 `搜索文章...` / `Search posts...` 行为不变）。
- `features.search.pinyinFuzzy`（第四轮，未接线且零依赖无法实现真正 CJK→拼音映射，不得以子序列模糊冒名拼音。**迁移**：如需拼音检索，先引入拼音库并在 `features.search` 重新立项；当前检索仅支持子串匹配）。
- `features.linkBehavior` 整个模块（`matchMode` / `skipInternal` / `mailtoMode` / `lateTargeted`，第四轮，从未接线且与 `features.externalLink` 语义重叠或与现状相悖，整体删除、无行为变化；**迁移**：外链行为改 `features.externalLink`，逐键裁决见 `docs/config-reference.md` §3.36）。
- `features.themeToggle.defaultTheme` / `rememberChoice` / `iconStyle` / `transitionAll`（第三轮，语义重复；唯一来源 `theme.json5 → darkMode.default/rememberChoice/iconStyle/transitionAll`。**迁移**：将这 4 个键的值原样写入 `theme.json5` 的 `darkMode` 同名键即可；`rememberChoice`/`iconStyle`/`transitionAll` 为新增键，缺省即旧行为）。
- `features.codeCopy.includeWindowBar`（第三轮，语义重复；代码窗栏唯一来源 `features.codeBlock.windowBar`（`js/domains/core/code-block.js` 消费）。**迁移**：使用 `includeWindowBar` 的站点改在 `codeBlock.windowBar` 配置，默认 true 行为不变）。
- `features.listCover.aspectRatio`（第三轮，语义重复；封面宽高比唯一来源 `tuning.json5 → card.imageAspect`（CSS 变量 `--card-imageAspect`）。**迁移**：改 `tuning.card.imageAspect`，默认 `16/10` 行为不变）。
- `features.mobileBottomNav.useSafeArea`（第三轮，语义重复；安全区唯一来源 `features.mobile.safeAreaBottom`。**迁移**：改 `mobile.safeAreaBottom`，默认 true 行为不变）。
- `features.themeToggle.animationMs`（未接线、语义重复；主题切换过渡统一由 `theme.animation.transitionDuration` → `tuning.motion.transitionDuration` 控制）。

- **`pagefind` 依赖**（约 55MB，本地搜索默认 `local`）；按需恢复：`npm install -D --save-exact pagefind` — `package.json`

### 验证与门禁

- **残余验证收口**：`npm test` 457/457（82 suites；新增 `scripts/theme-override.test.js` 5 例、`scripts/cache-bust.test.js` 3 例）、`npm run lint` 0 错、`npm run typecheck` 0 错；隔离夹具 runner `.tmp-scripts/run-w6.js` 28 PASS / 0 FAIL（pinned 3 / 双链 3 / theme-override 4 / 增量 9 / SSR HTTP 3 / 默认态与端口释放 6），端口 3329 全释放；全量构建产物与基线 200 文件归一化哈希等价（注释净化与两处修复均不改变正常构建产物）。
- **残余说明**：`npm run verify:config-refs` 零未接线（`features.json5` 无剩余未接线键）；增量构建已知边界——修改一篇文章会重建该语言全部页面（文章列表参与每页指纹），按模板数据投影/步骤级增量见 `docs/incremental-build-design.md` 远期方案；JS 预算 60KB（超限仅告警）。
- **第六轮（W4）**：`npm test` 432/432（82 suites；`scripts/config-wiring.test.js` 由 40 例扩至 53 例，`scripts/bundle.test.js` deferred 键数 23→24）、`npm run test:build` 2/2、`npm run lint` 0 错、`npm run typecheck` 0 错、`npm run verify:config` PASS（98 模块一致）。
- **第六轮（W4）**：3 个隔离构建全部成功：默认 `.tmp-scripts/out/w4-build`、alt（灯箱 0 时长/70vw、返回顶部 0 时长+锚点回退、TTS name+段落高亮、打赏全禁用、非全屏搜索+gap 1rem+触屏关+横滚提示关、弹窗 320px+折叠、统计卡关）、archive（levels=3/无图例/无月份数字/自定义 tooltip/统计卡自定义文案+空跳转）；`--features-override` 未污染仓库配置；预算告警与基线同级（HTML 单页 gzip 最大 34.0KB、JS 合计 58.7KB，`perfBudget.warnOnly=true` 非阻断，W4 新增运行时约 +1.5KB）。
- **第六轮（W4）**：无头 runner `.tmp-scripts/run-w4.js`（端口 3328，3 台静态服务器逐个启停 + 自收尾看门狗 + 端口释放校验）：**95 断言全绿**（静态 34：统计卡文案链/热力层级与图例/tooltip/宽度变量/门控 CSS/锚点回退；浏览器 61：灯箱 92vw/70vw 与 180/120ms/0ms/减少动效、返回顶部 450ms 动画中态与 0ms/reduce 瞬时、TTS 两策略语音选择与段落高亮切段/清理、打赏三路径开关两态、联系弹窗 400/320px 与折叠/展开/copyTextEn、移动端触屏回退/非全屏搜索/堆叠步进/横滚提示与自动隐藏/无控制台错误），0 失败。
- **第五轮（W3）**：`npm test` 419/419（82 suites；`scripts/config-wiring.test.js` 由 26 例扩至 40 例）、`npm run test:build` 2/2、`npm run lint` 0 错、`npm run typecheck` 0 错、`npm run verify:config` PASS（98 模块一致）。
- **第五轮（W3）**：4 个隔离构建全部成功：默认 `.tmp-scripts/out/w3-build`（3.6s、81 页，预算告警与基线同级、`perfBudget.warnOnly=true` 非阻断）、alt（系列/字数/相关/图库/图片尺寸/数学/supSub 第二态）、mermaid-alt（`followTheme=false` + `copyAfterRender=true`）、nomermaid（`autoDetect=false`）；`--features-override` 未污染仓库配置。
- **第五轮（W3）**：无头 runner `.tmp-scripts/run-w3.js`（端口 3327，4 台静态服务器逐个启停 + 自收尾看门狗 + 端口释放校验）：**41 断言全绿**（默认/alt 静态 24、mermaid 两态 9、浏览器运行时 7：KaTeX 渲染/mathml 节点/autoDetect=false 无渲染/复制按钮剪贴板=源码/followTheme=false 暗色可见/客户端回退 SVG、生命周期 1），0 失败。
- **第四轮（W2）**：`npm test` 405/405（82 suites；`scripts/config-wiring.test.js` 由 17 例扩至 26 例，`scripts/build.test.js` 模块计数 99→98 同步）、`npm run test:build` 2/2、`npm run lint` 0 错、`npm run typecheck` 0 错、`npm run verify:config` PASS（98 模块一致）。
- **第四轮（W2）**：构建 `.tmp-scripts/out/w2-build` 成功（3.8s、81 页，OG 复用 16/失败 0，search-index 8+8；预算告警与 W1 基线同级，`perfBudget.warnOnly=true` 非阻断）。
- **第四轮（W2）**：无头 runner `.tmp-scripts/run-w2.js`（端口 3326，自收尾看门狗 + 端口释放校验）：**34 断言全绿**（浮层加权/计数/回归/空结果链 5、hero 2、配置拦截变体 12、/search 页 4、externalLink 5、静态/bundle/SSR 4、门禁 1），0 控制台错误；对 W1 旧构建复现「重复查询旧结果残留」等未接线差异 15 项（复现记录见提交说明与 `.tmp-scripts/repro` 日志）。
- **第三轮（W1）**：`npm test` 396/396（82 suites，含新增 `scripts/config-wiring.test.js` 17 例）、`npm run test:build` 2/2、`npm run lint` 0 错、`npm run typecheck` 0 错、`npm run verify:config` PASS（99 模块一致）。
- **第三轮（W1）**：构建 `.tmp-scripts/out/w1-build` 成功（3.6s，81 页）；预算告警与基线持平（HTML 单页 gzip 最大 33.7KB / JS 合计 56.4KB，`perfBudget.warnOnly=true` 非阻断）。
- **第三轮（W1）**：无头 runner `.tmp-scripts/run-w1.js`：**37 断言全绿**（theme 7 / mobileBottomNav 3 / shortcuts 1 / searchHighlight 2 / pagefind 2 / dailyQuote 1 / motion 2 / toc 3 / readMode 2 / cover 3 / favorites 2 / pinned 2 / listCover 1 / SSR+bundle 4 / 门禁 1，另含配置拦截变体：toc=1/0、cover.preferImage=false），0 控制台错误，父死/空闲看门狗与端口 3325 释放校验通过；截图 3 张存 `.tmp-scripts/out/w1-*.png`。
- `npm test` 379/379、`npm run test:build` 2/2、`npm run lint` 0 错、`npm run typecheck` 0 错、`npm run verify:config` PASS（第二轮记录）。
- 构建 `.tmp-scripts/out/round2-build`（6.9s）：产物页面 gzip 对比 audit-build 中位 −5B、超 28KB 预算页数 2→2 持平；assets/js gzip 55.4KB→56.7KB（+1.3KB，超 55KB 上限告警，`perfBudget.warnOnly=true` 非阻断，见报告）。
- 无头 runner `.tmp-scripts/run-round2.js`：55 断言全绿（W1 计算样式/CSS 变量 31 项、W2 运行时门控 10 项、W4 热门搜索/阅读气泡 14 项），0 控制台错误，自收尾并校验端口 3324 释放；截图 4 张存 `.tmp-scripts/out/round2-*.png`。

## [1.0.2]

### Added

- **sitemap 按类型拆分**:`features.json5` 下 `sitemap` 段新增 `split`/`maxUrlsPerFile`(默认 500)/`postPriority`/`pagePriority`/`tagPriority`/`postFrequency`/`pageFrequency`/`tagFrequency`;URL 总数超过阈值自动拆为 `sitemap-{n}.xml` + 索引 `sitemap.xml`(`sitemapindex`)— `scripts/build.js` + `scripts/lib/features-schema.js`
- **界面双语切换(i18n)**:`ui-strings.json5` 词典 + `features.i18n`(zh/en 切换按钮、默认语言、localStorage 持久化)— `templates/layout.ejs`
- **Giscus 评论**:`features.giscus`(repo/repoId/category/categoryId/mapping/theme/loading),写入时动态加载 giscus.app 客户端 — `templates/post.ejs`
- **Pagefind 全文搜索**:`features.pagefind`(indexPath/integrate),`search.provider='pagefind'` 时启用离线搜索 UI — `templates/layout.ejs`
- **每日一言**:`features.dailyQuote`(内置 7 条按日期轮换,侧栏 widget + 文章页)— `templates/layout.ejs`
- **收藏**:`features.favorites`(纯前端 localStorage `s-favorites`,`/favorites/` 页)— `templates/post.ejs` + `templates/favorites.ejs`
- **代码主题切换器**:`features.prismTheme`(GitHub/Dark/Solarized/Django,文章内窗栏样条)`— templates/post.ejs`
- **文章封面样式库**:`features.cover`(渐变/条纹/圆点/气泡/网格,在线预览)— `templates/post.ejs`
- **侧栏拖拽重排**:`features.sidebarDrag`(桌面拖拽 + 移动端长按,localStorage `s-sidebarOrder`)— `templates/layout.ejs`
- **搜索增强**:搜索历史(最近 5 条)+ 键盘上下键导航 + 结果分组(文章/标签/分类)— `templates/layout.ejs`
- **主题预设切换器**:`features.themePresets`(6 套调色盘,localStorage `ss-preset`)— `templates/layout.ejs`
- **深色定时切换**:`features.themeSchedule`(`darkFrom` `22:00`/`lightFrom` `06:00`,固定时段自动切主题)— `templates/layout.ejs`
- **404 页美化**:插图 SVG + 搜索按钮 + 热门文章 — `templates/404.ejs`
- **灯箱缩放/平移/旋转**:`features.lightbox` 扩展(zoom/pan/rotate/pinch,双指),`templates/layout.ejs`
- **TOC 增强**:进度线 + URL 锚点 + 已读淡显 — `templates/layout.ejs`
- **阅读侧栏**:`features.readDock`(进度环 + 回目录 + 回顶)— `templates/layout.ejs`

### Changed

- **修复配置合并 bug(关键)**:`scripts/build.js` 中 `config.features` 原来经 `deepmerge({}, DEFAULT_FEATURES, features, {arrayMerge})` 合并 — deepmerge 只接受 3 参数,`features` 被当作 options,导致 **用户 `features.json5` 配置从未生效**(一直使用默认值);已修复为 `deepmerge.all([{}, DEFAULT_FEATURES, features], {arrayMerge: (t,s)=>s if Array})` — 配置链与 `docs/config-reference.md` 现在真实生效
- **README 全面更新**:配置数(11 文件/1200+ 项)、features(54 模块/440 项)、测试(67 项/17 组)、新功能列表、sitemap 拆分说明

### Security

- 保持全部既有安全修复。

### Fixed

- 修复 `features.json5` 配置不生效(deepmerge 参数错位)— 见 Changed

### Done

- `docs/config-reference.md` 补齐 sitemap/新模块章节(3.39+)

## [1.0.1]

### Security

- 修复 Markdown 内嵌原始 HTML 的存储型 XSS：新增 `sanitizeHtml` 白名单净化，`script/iframe/object/embed/svg/math/form` 等活动内容整块移除，`on*` 事件属性与 `style` 属性一律剥离，`javascript:`/`data:` URI 过滤，仅保留安全标签（含 `<dl>` 定义列表等既有内容所需标签）— `scripts/lib/utils.js`
- 修复搜索索引写入内联脚本的注入：`searchData` 序列化时转义 `<`（`escapeJsonForScript`），杜绝 `</script>` 标签逃逸 — `scripts/build.js`
- 修复 structuredData (ld+json) 标题/描述拼接注入：改为 JSON 结构化序列化并转义 `<` — `templates/layout.ejs`
- 修复社交联系方式弹窗 `onclick` 属性中的 JS 字符串注入：改为 `data-*` 属性 + 事件委托 — `templates/layout.ejs`
- 修复搜索结果为 `innerHTML` 注入：改为 DOM API 构建（`textContent`） — `templates/layout.ejs`
- 修复本地预览服务器路径遍历：`--serve` 下通过 `path.resolve` + 前缀校验隔离 `dist/` 目录 — `scripts/build.js`
- 清理 CSP 遗留示例域：移除 `connect-src` 中的 `https://api.example.com`；`style-src`/`font-src` 放行 `cdn.jsdelivr.net`（KaTeX 按需加载所需） — `security.json`
- `security-verify.js` 升级为语义化检查：tokenizer 感知引号属性与 RCDATA（`<title>`/`og:title` 内 `</script>` 字符实体是惰性文本而非逃逸），剥离 JS 字符串字面量后判定可执行代码，消除误报 — `scripts/security-verify.js`
- 消除 Worker 双配置漂移：`workers/security-worker.js` 改为读取构建时从 `security.json` 生成的 `workers/security-config.js`（单源配置，自动生成不入库），Worker 与 `_headers` 的 CSP/限流/路径限制/安全头从此一致；新增 `scripts/generate-security-config.js` 与 6 项单元测试（总计 51 项）

### Added

- **配置系统扩展（mega expansion）**：
  - 新增 `features.json5` 功能总控域：38 个功能模块、355 个可配置项（灯箱/进度条/快捷键/TTS/阅读面板/KaTeX/Mermaid/双链/系列/分享/打赏/画廊/热力图/统计等），每项均有注释、默认值等于此前行为，可任意开、关、微调 — `scripts/lib/features-schema.js`（单一真源 + 校验）
  - 配置文件/文章数据全量合法校验：JSON5 语法错误 → 构建终止并输出文件路径 + 行/列 + 3 行上下文 + `^` 定位 + 中文原因与修复提示（`scripts/lib/config-error.js`）；未知模块名 warning 防拼写错误；文章 slug 重复/日期非法 → 构建报错跳过；tags 非数组自动按逗号拆分
  - 新增 `docs/config-reference.md`：9 章逐字段权威参考文档
- **批 1（阅读体验）**：图片灯箱（键盘/触屏滑动/画廊联动）、文章置顶（pinned，全列表徽标 + 置前排序）、CJK 字数统计、阅读设置面板（字号/行高/宽度滑杆 + 重置 + localStorage）、快捷键面板（`/` 搜索、`D` 主题、`J`/`K` 上篇下篇、`?` 帮助）、TTS 朗读（`speechSynthesis` + 倍速）、移动端目录抽屉、内容区 1600px 居中布局 — `templates/*` + `scripts/build.js`
- **批 2（内容体系）**：KaTeX 数学公式（`$`/`$$` 按需注入，strict 关闭抑制中文噪音）、Mermaid 图表（按需 + `securityLevel: strict` + 暗色主题联动）、文章系列（front-matter `series`，侧栏 widget + 卡片徽标 + 上一篇/下一篇面板）、Wiki 双链（`[[标题]]` 自动转站内链接，未知目标回退纯文本）、标签别名（`tag-aliases.json` 多对一归一，如 `js`→`JavaScript`）、分享按钮（7 平台零依赖内联图标，微信/复制为剪贴板）、友情链接页（`/links/` + 导航自动菜单 + 侧栏 widget）、打赏（`reward` 配置：二维码图片/外链 + 弹窗展示）
- **批 3（站点运维）**：SEO 标题模板（`titleTemplate` 首页/文章/默认）、JSON Feed（`/feed.json`，与 RSS 同源同裁剪）、Cloudflare Web Analytics（token 走环境变量 `CF_WEB_ANALYTICS_TOKEN` 或配置）、AVIF 变体（`build.avif` 开关节省 40% 体积）、内容导入 CLI（`npm run import -- --from hexo|hugo|wordpress`）、维护模式（Worker 环境变量 `MAINTENANCE=1` → 503 页 / 本地 `--serve --maintenance`）、重定向（`redirects` 数组 → `_redirects` + 本地 301/302 通配匹配）
- **批 4（归档与统计）**：图片图库页（`/gallery/` 瀑布流聚合所有文章图片，点击复用灯箱）、归档热力图（按年 12 月色阶格子 + 悬停提示 + 图例）、归档统计卡（文章数/发文天数/总字数/日均/标签/分类）、侧栏站点统计 widget（默认关闭）、阅读进度条增强（贴底小圆点 + 点击跳转 + 悬停百分比提示）
- **Markdown 扩展**：`supSub` 上标/下标（`X^2^`/`H~2~O`）+ `mathGuard` 保护公式（`$...$`/`$$...$$` 优先于上标处理，修复 `$E=mc^2$` 被解析成上标的问题） — `scripts/build.js`
- 新增 10 篇覆盖性测试文章 + 5 张程序化生成本地图片（`scripts/generate-test-media.js` 可再生成）；新增 `pinned-check.md`/`math-katex.md`/`mermaid-chart.md`/`wiki-links.md`/`series-part-1..3.md`/`alias-tags.md` 等
- 新增 `scripts/import.js`，`npm run import` 支持 Hexo/Hugo/WordPress XML 导入
- 新增 `scripts/generate-security-config.js`（Worker 配置自动生成）
- 新增 `docs/config-reference.md`；README 全面更新

### Changed

- HTML 压缩器从 `html-minifier` 4.0.0（已停止维护，存在 REDoS）替换为 `@minify-html/node` 0.18.1
- `sharp` 0.33.5 → 0.35.4（修复 libvips CVE-2026-33327/33328/35590/35591）
- `wrangler` 4.112.0 → 4.129.0（devDependency）
- 新增 `engines.node: >=20.9.0` 声明（sharp 0.35 硬性要求）；配置文件系统默认解析 `features.json5`（可选，缺失回退内建默认）
- 内容区宽度改为 1600px 居中（原 flex:1 全宽）
- `sanitizeHtml` 放行站内 `<video>`/`<audio>`：媒体 `src` 仅允许站点本地路径（无协议/相对），绝对 URL 与协议相对 URL 被剥离
- 本地预览服务器（`--serve`）：404 回退页现在返回真实 `404` 状态码（此前恒为 200）；扩展 MIME 表覆盖视频/音频/字体/文档类型；支持 `--maintenance`
- CI 构建节点 Node 20 → 24 LTS；新增主分支 `npm audit --audit-level=high` 门禁与 `npm test`

### Fixed

- `media-manifest.json` 键/值补全 `/media/` 前缀，修复本地图片 `<picture>`/WebP/`srcset` 响应式管线（此前用外链 SVG 未触发该分支，本地图片测试挖出）
- `sanitizeHtml` 白名单补 `picture`/`source` 标签与 `srcset`/`sizes`/`loading` 属性（响应式图片曾被当作未知标签转义）
- 前置锚点标题被固定顶栏遮挡：`html { scroll-padding-top: calc(var(--hh) + 18px) }` 全局方案（断点自适应）
- 上标/下标与 KaTeX 冲突（`mathGuard`）；KaTeX 中文报错（`strict: false`）
- 分页/进度条件渲染若干模板拼接问题

### Accessibility

- Lighthouse 全面审计并修复可达性问题（首页+文章页 × 桌面/移动 × 亮/暗均 100 分）：
  - 搜索/暗色切换/返回顶部/移动菜单按钮补充 `aria-label`；分页 `aria-label` 与可见文本失配（label-content-name-mismatch）移除，保留 `aria-current`
  - 全局对比度提升：亮色 `textLight` `#a0aec0` → `#64748b`、`secondary` `#4a90d9` → `#2563eb`、`accent` `#e53e3e` → `#c53030`；暗色新增 `secondary` `#7caeff` 与 `accent` `#fca5a5` 覆盖（`--color-s`/`--color-a` 暗色下同步切换） — `theme.json`/`templates/layout.ejs`
  - 分页禁用项与标签云计数去掉 `opacity` 弱化、改用可读色；`footer-powered` 链接加下划线（link-in-text-block）；文章 footer（免责声明）暗色配色覆盖 — `templates/layout.ejs`
  - 任务列表 checkbox 增加 `aria-label="任务"`（marked `renderer.checkbox` 覆写），`sanitizeHtml` 放行 `aria-*` 属性白名单；标题层级测试文章补齐 h3/h2 过渡 — `scripts/build.js`/`scripts/lib/utils.js`

### Docs

- 新增 `docs/config-reference.md`（9 章：site/theme/features/navigation/sidebar/footer/security/content-policy/tag-aliases+friends，含校验行为、环境变量表、重定向/友链/标签别名示例）
- README 全面更新：目录结构、配置详解、构建管线、交互功能、NPM 速查、测试表、技术栈

[1.1.0]: https://github.com/stop666two/S-ynapse/releases/tag/v1.1.0
[1.0.1]: https://github.com/stop666two/S-ynapse/releases/tag/v1.0.1
[Unreleased]: https://github.com/stop666two/S-ynapse/compare/v1.1.0-a1...HEAD
[1.1.0-a1]: https://github.com/stop666two/S-ynapse/releases/tag/v1.1.0-a1
[1.1.0-a2]: https://github.com/stop666two/S-ynapse/releases/tag/v1.1.0-a2
