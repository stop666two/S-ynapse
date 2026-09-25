# 发布回滚预案（Rollback Runbook）

适用对象：Cloudflare Pages 静态站点（`dist/`）与可选安全 Worker（`workers/`）。
触发条件：发布后出现线上故障（页面 4xx/5xx、CSP 阻断功能、构建产物缺页、Worker 误拦截等）。

## 0. 前置原则

- 每次发布前留一份可回滚锚点：`git bundle create <仓库外路径> --all` + `git bundle verify`（见 AGENTS.md 推送流程）。
- 发布产物对应唯一 git tag/commit；回滚以 commit 为最小单位（`git revert <sha>`）。
- 数据回滚：内容源（articles/media/pages/配置）均在 git 中，回滚 commit 即回滚数据；`database.db` 非站点数据源，不参与本站回滚。

## 1. 静态站点回滚（Cloudflare Pages）

1. **最快路径（平台侧）**：Cloudflare Dashboard → Workers & Pages → 项目 `s-ynapse` → Deployments →
   选择上一个健康部署 → **Rollback to this deployment**（即时生效，无需重新构建）。
2. **CLI 路径**：`npx wrangler pages deployment list --project-name=s-ynapse` 找到健康 Deployment ID，
   使用 Dashboard 回滚（wrangler 仅支持发布新部署，回滚以 Dashboard 为准）；
   或本地检出健康 commit 后重新发布：`git checkout <good-sha>`（或 `git revert` 后构建）→
   `npm ci && npm run build` → `npx wrangler pages deploy dist --project-name=s-ynapse`。
3. **验证**：`curl -sI https://<域名>/zh/ | findstr /I "HTTP|content-security-policy"`，
   并抽查首页/文章页/搜索/feed 与 Console 无 CSP 违规。

## 2. Worker 回滚（安全层）

- `npx wrangler deployments list --config workers/wrangler.toml` 查看版本；
- `npx wrangler rollback <deployment-id> --config workers/wrangler.toml`（或 `--message` 指定）；
- 紧急停用：在 Dashboard 将 Worker 路由/绑定暂时移除（静态 `_headers` 仍提供基础安全头），
  或 `MAINTENANCE=1` 进入维护页（`security-worker.js` 支持）。
- 回滚后验证：`X-Frame-Options`、CSP `nonce-`、限流 429、维护页 503 各抽查一次。

## 3. 数据与缓存回滚

- 内容：`git revert <坏提交>`（或 `git checkout <good-sha> -- articles media pages *.json5`）后按第 1 节重新发布。
- 构建缓存：`.build-cache.json` 与 `.cache/` 为加速层，可在回滚后删除以强制全量重建（不参与版本控制）。
- Worker 配置（`workers/security-config.js`）是构建产物，随 `npm run build` 重新生成，禁止手改。

## 4. 保留与演练

- 保留策略：git 历史全量保留；Cloudflare Pages 默认保留历史部署（按平台策略），至少保留最近 10 次。
- 演练：每季度或每次重大变更（CSP/Worker 结构调整）后在预发环境走一遍第 1 节步骤 1 与第 2 节，
  记录耗时与阻塞点；演练不触碰生产，除非已公告维护窗口。
- 事后分析：故障恢复后 48 小时内输出根因/影响/修复/预防四段记录（AGENTS.md 规则 207）。

## 5. 快速对照表

| 故障类型 | 首选动作 | 预期恢复时间 |
|---|---|---|
| 页面缺页/样式错乱/构建产物错误 | Dashboard 回滚上一部署 | < 1 分钟 |
| CSP/安全头阻断功能 | Worker rollback 或暂时解绑 Worker | < 5 分钟 |
| 内容错误（文章/配置） | `git revert` + 重新构建发布 | 5–15 分钟 |
| 误拦截/限流过严 | Worker rollback；或调 `security.json5` 后重建 | < 5 分钟 |
