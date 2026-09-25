# S-ynapse 审计修复交接（2026-09-25）

## 原始请求（用户原文摘要）

1. 首轮消息要求「首次全项目只读审计」：8 个审计项、只读、输出中文报告、不修改代码。
2. 审计完成后用户：「全部开始，有问题请问我。」
3. 用户随后：「启动 grill-me」→ 通过 9 项设计问答敲定修复策略。
4. 用户：「可以一次性问多个问题。」（后续问答批量执行）

## 本批交付（15 个提交，`2c11970..HEAD`）

| 提交 | 审计项 | 摘要 |
|------|--------|------|
| fcfbfa3 | — | 新增实施计划 `docs/plans/2026-09-25-remediation.md`（决策记录/任务清单） |
| 8592ee6 | T1 | `scripts/lib/build-errors.js` 收集器 + 6 单测 |
| fc72fb1 | T1/F-9/F-12 | 构建前只读预校验（重复 slug/非法日期/空标签/缺失媒体）+ 硬失败 + `--allow-degraded`；降级时空标签过滤 |
| 564df4f | F-1/F-2/F-3 | 运行期失败接线：renderPage/feed/sitemap/媒体/OG/压缩/cacheBust 全部记录并使退出码非零 |
| 47b0fdc | F-11 | 未来日期文章按定时发布过滤（页面/feed/sitemap/搜索），日志提示 |
| ef3732c | SEC-6 | Worker `pathRestrictions: []` / `skipPaths: []` 显式语义；仅缺失字段回退兜底；文档同步 |
| 28fb52e | SEC-7 | 安全头名校验（RFC 7230 token）与值 CR/LF/NUL 构建期阻断 |
| f962095 | SEC-2 | `normalizePath` 解码循环 + 点段折叠（阻断 `%2e%2e`/双重编码） |
| cc1c3a4 | L-1/L-2 | 搜索索引 5s 超时 + 一次重试 + 错误态重试按钮；入口按钮守卫 |
| f3d0632 | P-5 | `_headers` 分级缓存（css immutable / js|vendor 1h+SWR / media|og 7d+SWR） |
| 96db66b | SEC-3/SEC-8 | 匿名请求共享桶限流（fail-closed）；`LOG_IP_SECRET` → HMAC-SHA256 |
| 3fde9c1 | F-14/O-5 | README/CHANGELOG 计数 180/38；新增 `SECURITY.md` |
| 49bc850 | F-7 | a11y 页面列表从 dist 派生、HTTP 2xx 断言、wcag22aa、CHROME_PATH 文档化 |
| 92f6e97 | T2（部分） | 媒体增量缓存（`.cache/media` + `.build-cache.json`）、watch 跳过 OG |
| ea00ddb | — | content-validate JSDoc 类型修正（tsc 门禁） |

**注意**：92f6e97 经 `--amend` 追加了 lint 修复（`stats` 无用赋值），未推送，安全。

## 质量基线（本批结束时实测）

- `npm test`：**180 项 / 38 组，全通过**
- `npm run lint` / `npm run typecheck` / `npm run verify:config`：退出码 0
- `npm run audit`：0 vulnerabilities
- `npm run verify:security`：PASS
- `npm run build`：成功；媒体二次构建 `Optimized 0 images (reused 5 unchanged)`

## 用户可感知变更（需浏览器/真机验收）

1. 构建失败默认硬失败；`npm run build -- --allow-degraded` 降级（README「构建行为说明」）。
2. `date` 晚于构建时间的文章不再出现在站点；日志提示排期数量。
3. 搜索弱网显示错误态与「重试」；入口按钮提前点击不报错。
4. `_headers` 新增 Cache-Control 段；`/assets/js|vendor` 未指纹故仅 1h（**未按原决策 1y immutable**，见「偏差说明」）。
5. `SECURITY.md` 声明 accessGate 为软防护。

## 偏差说明（重要）

- **P-5 缓存**：原决策「/assets/* 1y immutable」，实测 `assets/js|vendor` 不带内容指纹（仅 `site.<hash>.css` 带哈希），1y immutable 会导致升级后陈旧一年；改为按指纹分级（css 1y immutable、js|vendor 1h+SWR、media|og 7d+SWR）。后续若要 1y，需先给 js/vendor 做指纹化（单独立项）。
- **T2 范围**：媒体增量缓存已完成；**OG 图片未做条目级缓存**（仅 watch 模式跳过执行），首建仍全量生成。

## 未完成清单（下一会话按序继续）

1. **T4 CSP nonce 化**（3 子提交）：模板内联事件全量改写 → 构建期 nonce 注入（HTML + `_headers` + Worker 同步）→ 移除 `script-src 'unsafe-inline'`。内联处理器清单：`layout.ejs:77,114,118,119,123,136,141,152,165,196,197,205,206`、`index.ejs:14`、`post.ejs:67`、`search.ejs:4`。注意 KaTeX/Mermaid 的 `onload` 与内联脚本块。
2. **T2 OG 条目级缓存**：`generate-og.js` 按「md mtime+size+模板/主题指纹」跳过未变文章（参考 `.build-cache.json` 的 `og` 段与 `scripts/lib/asset-cache.js`）。
3. **F-6 构建集成测试**：`--out`/`SYNAPSE_OUT_DIR` 临时输出 + `scripts/build-smoke.test.js` + `npm run test:build` 进 CI（不进 `npm test`）。
4. **P2 前端批次**：`reading.js` rAF 节流、`background.js` hidden 暂停 + 移动端默认关、reduced-motion 补齐（announcement/image-lazy/theme-schedule）、TTS 暂停心跳、blob revoke ≥1s、lightbox/sidebar-drag 配置接线。
5. **P2 i18n**：`archive.textArticle`/`archive.heatmapSuffix` 等缺键（`templates/archive.ejs:25`、`post.ejs:47/66/161`、`search.ejs:7`）。
6. **仓库卫生**：`chokidar` 移入 devDependencies（`package.json:33`）、`exports/` 加入 .gitignore、工作树 CRLF 清理（`.githooks/pre-commit`、`wrangler.toml`、2 个 svg）。
7. **O-11 回滚预案**：`docs/runbook/rollback.md`。
8. **O-2 real-site 定源**：README/handoff 记录「主仓库唯一事实源」与 `git diff --no-index` 同步核对命令（用户已确认保留副本、不定源删除）。
9. **P1 剩余安全项**：`customHeaders` CRLF 已在 SEC-7 覆盖；`accessGate ?key` 的 `history.replaceState` 清理未做；`frame-ancestors` 未补。

## 关键文件地图

- 构建错误：`scripts/lib/build-errors.js`、`scripts/lib/content-validate.js`、`scripts/lib/publish-window.js`、`scripts/lib/asset-cache.js`
- 构建接线：`scripts/build.js`（preflightContent/buildErrors/recordBuildFailure/BUILD_ERRORS、getPublished 排期、optimizeMedia 缓存、generateSecurityHeaders 缓存头、`--allow-degraded`）
- Worker：`workers/security-worker.js`（resolveWorkerConfig/hashIp/fail-closed）、`workers/lib/ip-utils.mjs`
- 安全配置：`scripts/generate-security-config.js`（validateHeaderEntries）、`security.json5`、`SECURITY.md`、`.env.example`
- 前端：`js/domains/search.js`、`templates/index.ejs`、`templates/layout.ejs`
- 计划与决策：`docs/plans/2026-09-25-remediation.md`

## 回归配方（下一会话开工前先跑）

```
npm test && npm run lint && npm run typecheck && npm run verify:config
npm run audit && npm run verify:security && npm run build
```

浏览器验收（需用户授权端口）：`npm run serve -- --port 3224` + `npm run audit:a11y`；手动路径：断网点搜索（错误态+重试）、点 hero/侧栏搜索（无 ReferenceError）、改文章 date 到未来（不出现在站点）。

## 风险与注意事项

- 未推送、未打 tag；推送前按项目规则先做 bundle 备份并征求用户确认。
- `real-site/` 派生副本未同步本批修复（用户选择保留+文档定源，尚未写入文档）。
- `.build-cache.json` 与 `.cache/` 已 gitignore；CI 首次构建无缓存属预期（全量生成）。
- 浏览器侧变更（搜索/入口守卫）尚未经真实浏览器验证，仅静态断言与构建验证。

---

## 第二批交付（同一会话续，`a7b3852..0111de5`，合计 24 个提交）

| 提交 | 审计项 | 摘要 |
|------|--------|------|
| f92a9fc | T2 收口 | OG 条目级缓存改为持久目录 `.cache/og` + 命中拷贝；二建 `made 0, reused 16` |
| a7b3852 | L/A 系列 | 前端流畅性批次：readDock rAF、粒子 hidden 暂停、轮播/图片/主题 reduced-motion、TTS 心跳、blob revoke 1s、lightbox minSize/counterFormat、sidebar-drag 两键 |
| 5b72494 | SEC-1 | CSP nonce 化：构建期 nonce 注入 HTML/`_headers`/Worker/meta；15 处模板内联事件改 `addEventListener`；根语言重定向与离线页同步；`script-src` 移除 `'unsafe-inline'` |
| 0b040f6 | C-2/O-8/O-9 | chokidar → devDependencies（npm 同步锁文件）、`exports/` 忽略、工作树 CRLF 清理 |
| 30ece29 | F-6 | `--out`/`SYNAPSE_OUT_DIR` + `scripts/build-smoke.test.js`（2 用例）+ `npm run test:build` 进 CI + 文档 |
| 9dca6fd | F-10 | i18n 补键（archive.textArticle/heatmapSuffix、search.widgetPlaceholder 等 5 对）+ 模板中文残留清理（post/search/layout/links） |
| 4079f76 | O-11/O-2 | `docs/runbook/rollback.md` + README 多工作区定源与回滚链接 + CI 门禁列表补 test:build |
| 0111de5 | F-7 收口 | 浅色 Prism comment/fn/punct 对比度校正（≥4.5:1）、`.reader-gear` 移出 dock 重叠区、a11y 脚本禁用缓存（修 304 误判） |

### 最终基线（本会话结束时实测）

- `npm test`：188 项 / 42 组全通过；lint / typecheck / verify:config 退出码 0；`npm run test:build` 2/2 pass（~5s，缓存命中）。
- `npm run audit`：0 vulnerabilities；`npm run verify:security`：PASS。
- `npm run audit:a11y`：pages=14 checked=14 httpFailures=0 violations=0 critical=0 serious=0（真实无头 Chrome + axe wcag2a/2aa/21aa/22aa）。
- 构建：`npm run build` 4.33s（媒体/OG 缓存全命中）；dist 85 页全部 `<script>` 均带与 `_headers` 一致的 nonce。
- 无头浏览器验证：5 类页面主线程心跳 40/40、0 页面错误；交互（主题/预设/搜索/TTS/阅读模式/返回顶部）心跳 30/30、0 错误。

### 残余与未做

1. **推送未执行**：提交仅在本机，未推送、未打 tag。CI 推送只部署 Pages；**生产 Worker 需手动 `npm run build` + `npx wrangler deploy --config workers/wrangler.toml --env production`**（本批未部署），推送前建议 bundle 备份。
2. **生产环境动态验证**：上线后需抽查响应头（nonce、无 unsafe-inline）、限流、日志脱敏；`LOG_IP_SECRET` 需在 Cloudflare 侧配置。
3. **real-site 派生副本**：仍未同步（用户选择保留+文档定源，README 已写明同步核对命令）。
4. **风格残余**：`style-src` 仍含 `'unsafe-inline'`（已在 SECURITY.md 声明为已知残余面）；Worker FALLBACK（无构建产物时）保留 `unsafe-inline` 保障可用性。
5. **i18n 配置层**：reward/newsletter/friends 等纯配置字段缺 `*En` 变体，未动（属配置文件层，建议另立 issue）。
6. **TTS 心跳取舍**：任何 `paused` 状态都会 `resume()`（含系统级暂停）；如需尊重手动暂停需另加来源标记。

---

### 第三批（文档更正，本会话末）

- 按用户实际部署路径（**Wrangler → Workers**）更正三份文档：
  - `docs/runbook/rollback.md` 重写为 Worker 优先（`wrangler rollback` 同时回退脚本+静态资产、`LOG_IP_SECRET` 配置、部署后 curl 抽查、维护模式与 `run_worker_first` 紧急摘除）。
  - `README.md` 方式二标注为**生产部署路径**，新增“CI 只部署 Pages、不更新 Worker”的说明与密钥/回滚链接；测试计数更新为 188/42 并补 `asset-cache` 套件行。
  - 本交接文档更正“推送=生产部署”的表述。
