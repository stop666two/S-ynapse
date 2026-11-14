# 发布面核对清单（Cloudflare）

> 适用：任何把 S-ynapse 产物挂到公网域之前/之后的自检。判定标准来自 `docs/architecture.md` §1.1 的能力矩阵，
> 禁令与回滚见 `docs/runbook/rollback.md` §1。本清单全部为**只读核对 + 控制台操作**，不需要改动仓库代码。

## 0. 目标（唯一真源）

- 生产流量**必须**由 Worker `blog` 提供（`workers/wrangler.toml`，静态资产绑定 `../dist`）。
- Pages（项目 `s-ynapse`）**不得**绑定任何公网自定义域：它只有构建期 `_headers` 的静态头，没有限流、路径拦截、
  维护模式、HTTP→HTTPS 跳转与 CSP 上报接收。
- 两个表面能力不等价，**不要做 DNS 灰度**（一半请求会失去防护）。

## 1. 域名归属判定（3 条只读命令）

把 `<domain>` 换成目标主机名：

```bash
# ① Worker 会给每个响应写 X-Request-Id；Pages 不会
curl -sI https://<domain>/ | grep -i '^x-request-id'
# 期望：有值（UUID 或 CF-Ray）→ 前方是 Worker

# ② 路径拦截只在 Worker 生效（security.pathRestrictions 默认 /admin/*）
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/admin/panel
# 期望：403 → Worker；404/200 → 不是 Worker

# ③ HTTP→HTTPS 跳转由 Worker 的 forceHttps 下发
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://<domain>/
# 期望：301/308 且 Location 指向 https://<domain>/
```

三条同时满足才算「由 Worker 提供」；任一条不满足即说明该域落在 Pages 或其它表面，必须整改。

## 2. 控制台检查点

| 位置 | 检查项 | 期望 |
|---|---|---|
| Workers & Pages → `blog` → Settings → Domains & Routes | Custom Domains / Routes | 列出全部生产域 |
| Workers & Pages → `s-ynapse`（Pages）→ Custom domains | 自定义域列表 | **为空** |
| DNS → 记录 | 指向 `*.pages.dev` 的 CNAME | 不存在或未被公网域引用 |
| Workers & Pages → `blog` → Deployments | 最新部署时间 | 与最近一次 `npm run deploy:worker` 一致 |

## 3. 整改步骤（按顺序，避免中断）

1. Workers & Pages → `blog` → Settings → Domains & Routes → **Add custom domain**，填入生产域。
2. 等待证书签发（通常 <1 分钟），从 Cloudflare 自动生成的 DNS 记录确认已接管。
3. 跑 §1 的三条命令复核。
4. 在 Pages 项目里**移除**该自定义域。
5. 再次跑 §1 复核（请求仍应命中原 Worker），并确认 Pages 预览域名不再被公开引用。
6. 记录：整改时间、执行人、三条 curl 的实际输出（贴进变更单/PR 描述）。

## 4. 可选：维护模式冒烟

```bash
# 仅在有部署权限时执行；结束后务必恢复
npx wrangler deploy --config workers/wrangler.toml --env production --var MAINTENANCE:1
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/        # 期望 503
curl -sI https://<domain>/ | grep -i '^retry-after'              # 期望有值
npx wrangler deploy --config workers/wrangler.toml --env production   # 恢复
```

## 5. 回滚

把自定义域从 Worker 移除、重新绑回 Pages 即可退回旧表面；但该表面**失去**限流/路径拦截/维护模式/HTTPS 跳转，
仅作应急，且需在下一次变更中改回 Worker。完整回滚流程见 `docs/runbook/rollback.md`。

## 6. 明确不做

- 不在 `_headers` 里写限流或路径拦截：平台不支持运行时逻辑，写了也不生效。
- 不用 Pages 的公网域做「先上线再迁移」：迁移窗口内的请求没有任何防护。
- 不为两个表面分别维护两套域名策略：唯一策略是「公网域 → Worker」。
