# 安全策略（Security Policy）

S-ynapse 是静态博客生成器：构建期为 Markdown/HTML 做白名单消毒，运行期由 Cloudflare
Pages `_headers` 与可选 `security-worker` 双层下发安全策略。本文件说明支持范围、
报告渠道与已知边界。

## 报告漏洞

- 请勿公开提交安全 Issue。通过 `SECURITY.md` 指定的维护者私密渠道报告（仓库启用
  GitHub Security Advisories 时优先使用 **Report a vulnerability**）。
- 请附：复现步骤、影响版本/提交、预期与实际行为、最小复现（勿附真实用户数据）。
- 我们遵循协同披露：确认后 7 天内给出处置计划，修复发布后致谢（如你希望署名）。

## 安全模型与已知边界

- **构建期消毒**：`marked` 渲染 → CJK 间距 → `sanitize-html` 白名单；危险标签、
  事件属性与 `javascript:`/`data:` 协议被剥离；SVG 走 `content-policy` 检测。
- **CSP**：默认由 `_headers` 与 Worker 下发。`script-src` 已移除 `'unsafe-inline'`：构建期为所有
  可执行内联脚本注入一次性 nonce（HTML 与 CSP 同步），模板内联事件属性全部改为监听器；
  `style-src` 仍含 `'unsafe-inline'`（大量内联 `style=` 与 `<style>` 未治理），属已知残余面。
  未构建的原型部署（security-config.js 缺失）会用 Worker 内置 FALLBACK，其中保留
  `'unsafe-inline'` 以保障可用性——正式产物会覆盖。
- **accessGate（`guard.json5`）是软防护，不是访问控制**：密码哈希与解锁码内联在
  前端产物中，`?guard=off` 与 localStorage 伪造均可绕过；关闭 JavaScript 或直接
  读取 HTML 也能看到内容。请勿用它保护机密数据——需要真实门禁请使用
  Cloudflare Access 或服务端鉴权。
- **速率限制为单 isolate 内存实现**：多 colo/isolate 可分散绕过；`CF-Connecting-IP`
  缺失时按共享桶计数（fail-closed），但白名单/黑名单无法匹配匿名来源。生产建议
  在 Cloudflare 侧叠加 WAF Rate Limiting 规则。
- **日志**：Worker 输出 JSON Lines，含 `requestId`；不落 IP/UA 明文。默认 IP 哈希
  使用固定盐 SHA-256，可被枚举反推；配置 `LOG_IP_SECRET`（随机长字符串）后改用
  HMAC-SHA256，生产必须配置。
- **路径限制**：`pathRestrictions` 在 Worker 侧做解码、重复编码与点段折叠后再匹配；
  `[]` 表示无受保护路径，字段缺失才回退内置 `/admin/*` 兜底。

## 运行时环境变量（Worker）

| 变量 | 必填 | 说明 |
|------|------|------|
| `LOG_LEVEL` | 否 | `off`/`error`/`warn`/`info`/`debug`，默认 `info` |
| `LOG_IP_SECRET` | 生产建议必填 | IP 日志哈希 HMAC 密钥；未设置时使用固定盐 |
| `MAINTENANCE` | 否 | `1` 时全站返回 503 维护页 |
| `MAINTENANCE_MESSAGE` | 否 | 维护页提示文案（HTML 转义后输出） |
| `CF-Connecting-IP` | 平台注入 | 客户端 IP 来源；缺失时限流按共享桶 fail-closed |

## 支持版本

- 仅支持默认分支最新提交；Node 版本见 `package.json` `engines`。
- 依赖漏洞通过 `npm run audit`（官方 registry）与 CI `npm audit --audit-level=high`
  持续检查，高危（CVSS ≥ 7）7 天内处置。
