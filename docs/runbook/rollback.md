# 发布回滚预案（Rollback Runbook）

适用对象：**Cloudflare Workers 部署**（`workers/wrangler.toml`：安全层脚本 + `../dist` 静态资产同版本发布）与备用路径 Cloudflare Pages（根 `wrangler.toml`，仅 CI 使用）。
触发条件：发布后出现线上故障（页面 4xx/5xx、CSP 阻断功能、Worker 误拦截、限流异常等）。

## 0. 前置原则

- 每次发布前留一份可回滚锚点：`git bundle create <仓库外路径> --all` + `git bundle verify`（见 AGENTS.md 推送流程）。
- 发布产物对应唯一 git commit；回滚以 commit 为最小单位（`git revert <sha>`）。
- **生产路径 = Worker 部署**：`npm run build` → `npx wrangler deploy --config workers/wrangler.toml --env production`。
  静态资产与 Worker 脚本是**同一版本**，一次 `rollback` 同时回退页面与安全层。
- **当前生产版本：`36cf88fe-eabb-45d7-9746-a6a8277e116b`；上一个可回滚版本：`2fa78c1d-db76-4108-b32b-42ad5f42a61a`**（示例；实际以 `wrangler deployments list` 为准）。
- CI（`.github/workflows/deploy.yml`）推送时只执行 `wrangler pages deploy`（Pages），**不会更新生产 Worker**；更新 Worker 必须手动执行上面的部署命令。
- 数据回滚：内容源（articles/media/pages/配置）均在 git 中，回滚 commit 即回滚数据；`workers/security-config.js` 为构建产物（gitignore），随 `npm run build` 重新生成；`database.db` 非站点数据源。

## 1. Worker 回滚（首选）

1. **查看版本**：`npx wrangler deployments list --config workers/wrangler.toml`
2. **回滚**：`npx wrangler rollback <deployment-id> --config workers/wrangler.toml`
   （回退 Worker 脚本 + 静态资产到该版本，即时生效；不重新构建）
3. **从源码重发的等价路径**（当平台侧无可用版本时）：
   ```
   git checkout <good-sha>（或 git revert 坏提交后）
   npm ci && npm run build          # 重建 dist 与 workers/security-config.js
   npx wrangler deploy --config workers/wrangler.toml --env production
   ```
4. **验证**：
   ```
   curl -sI https://<域名>/zh/ | findstr /I "content-security-policy x-frame-options cache-control"
   # 期望：script-src 与 style-src 含同一 'nonce-...' 且均无 'unsafe-inline'（elem 语境），
   #       无 style-src-attr 'unsafe-inline'（模板/产物无内联 style 属性），frame-ancestors 'none' 存在
   curl -sI https://<域名>/assets/css/site.<hash>.css | findstr /I "cache-control"   # immutable 1 年
   ```
   另抽查首页/文章页/搜索 Console 无 CSP 违规、feed/sitemap 可访问。

## 2. Pages 回滚（备用路径）

仅当你实际使用 Pages 项目时适用（CI 推送或手动 `npx wrangler pages deploy dist --project-name=s-ynapse`）：
1. Dashboard → Workers & Pages → 项目 `s-ynapse` → Deployments → 选上一个健康部署 → Rollback；
2. 或本地检出健康 commit 重新发布（同上第 1.3 节命令但改用 `wrangler pages deploy`）。

## 3. 紧急停用与维护模式

- 维护页：`npx wrangler secret put MAINTENANCE --config workers/wrangler.toml --env production`（值 `1`）→ 全站 503，恢复时删除该 secret 或置空；不设置 `MAINTENANCE_MESSAGE` 时默认文案按 `Accept-Language` 自动选中/英（`en*` → 英文，其余 → 中文），自定义时原样覆盖。
- 暂时摘除安全层：将 `[assets] run_worker_first = false` 后重新部署（静态 `_headers` 仍提供基础安全头），故障排除后改回 `true` 再部署。

## 4. 压缩验证失败回退（构建期排障）

构建增强步骤（`compression.json5`，默认开）完成后会执行无头对比门禁；失败时按 `verify.fallbackOnFailure` 自动回退未压缩基线并告警，构建仍成功。排障路径：

1. **看结果 JSON**：`.cache/compression-verify/last.json` —— `status`（`passed`/`failed`/`skipped`）、失败页面与断言类型、`phaseDurationsMs` 阶段耗时、端口释放结论。
2. **看构建报告**：`dist/build-report.html` —— 「压缩统计与无头验证」区块（本轮未运行会如实标注）与「CSS 合并/去重跳过」明细（文件 + 原因）；跳过项不代表产物损坏（该文件保持原样，不计入失败账本）。
3. **独立复核**：`npm run verify:compression -- --json`（完整构建 + 两态断言；`passed=0`、`failed=1`、`skipped=0`）。无 Chrome 环境会跳过并告警，不阻断构建；可用 `CHROME_PATH` 指定浏览器。
4. **回退是否生效**：回退后构建日志有 `[WARN]`，且快照产物的逐字节复核通过；若复核不一致会升级为阻断失败（此时不要部署，按第 5 步回滚现有版本或修复后重建）。
5. **确认是压缩还是内容问题**：`--compression-override` 传一份 `enabled:false` 的配置重跑构建（隔离验证第二态，不写回仓库配置）；仍失败说明与压缩无关，按内容/模板问题排查。

> 说明：Chrome 每次运行在 `.cache/chrome-verify-profile/` 下新建随机临时 profile，运行结束（含失败）自动清理，并发构建互不干扰；该目录可安全删除。

## 5. 运行时密钥与配置

- **`LOG_IP_SECRET`（必须生产配置）**：`npx wrangler secret put LOG_IP_SECRET --config workers/wrangler.toml --env production`
  （随机长字符串；未配置时 IP 日志哈希用固定盐，可被枚举反推）。
- 限流/路径/CSP 调整：改 `security.json5` → `npm run build`（重新生成 `workers/security-config.js`）→ 重新 `wrangler deploy`。
- 构建缓存 `.build-cache.json` / `.cache/` 可在回滚后删除以强制全量重建（不参与版本控制）；含 `.cache/compression-baseline/`（验证基线快照）、`.cache/compression-verify/last.json`。

## 6. 保留与演练

- 保留策略：git 历史全量；Cloudflare Worker 版本按平台策略保留（`wrangler deployments list` 可查）。
- 演练：每季度或每次重大变更（CSP/Worker 结构调整）后在预发环境走一遍第 1 节步骤 1–2 与第 3 节维护模式，记录耗时与阻塞点。
- 事后分析：恢复后 48 小时内输出根因/影响/修复/预防四段记录（AGENTS.md 规则 207）。

## 7. 快速对照表

| 故障类型 | 首选动作 | 预期恢复时间 |
|---|---|---|
| 页面缺页/样式错乱/构建产物错误 | `wrangler rollback <id>`（脚本+资产同回退） | < 5 分钟 |
| CSP/安全头阻断功能 | `wrangler rollback`；或 `run_worker_first=false` 重部署 | < 5 分钟 |
| 内容错误（文章/配置） | `git revert` + `npm run build` + `wrangler deploy` | 5–15 分钟 |
| 误拦截/限流过严 | 改 `security.json5` 重建后部署；或临时维护模式 | < 5 分钟 |
| 日志隐私（未配密钥） | `wrangler secret put LOG_IP_SECRET` 后重新部署 | < 5 分钟 |
| 压缩验证 failed（构建已自动回退） | 查 `.cache/compression-verify/last.json` 与 `build-report.html`；独立 `verify:compression` 复核 | 10–30 分钟 |
| 压缩回退复核不一致（构建阻断） | 不部署；修复后重建，或 `wrangler rollback` 回上一版本 | < 10 分钟 |
