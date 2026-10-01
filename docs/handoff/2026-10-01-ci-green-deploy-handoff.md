# 交接：CI 全绿 + 生产部署（2026-10-01）

## 结果一句话

主仓 GitHub CI 首次全绿（run 36823485229），生产 Worker `blog` 已部署 `ded91283-aff1-4abb-87a6-9f9e94c2cd82`，回滚点 `7e52ad6f-659d-4a0f-8127-8d0003bab862`；主仓与远端 `origin/main` 同步（`6b567b5` 起）。

## 本阶段解决（按审计/CI 发现）

1. **CI 阻塞项**
   - `stableSerialize` 以自有属性重建对象，修复 `__proto__` 键丢失（fuzz 反例 `[{"__proto__":null}]`）；同类外部键写入隐患 12 处一并改为 `setOwnProperty`/`Object.defineProperty` 语义。
   - `security-verify` 输出改独立目录（`build-artifacts/sec-verify/site`），不再污染真实 `dist/`；`smoke-web` 默认输出改 `build-artifacts/web-smoke/site`，CI 步骤顺序无关。
   - 冒烟属性断言全部改为引号无关（Linux 压缩会剥离简单属性引号：`class=math-inline`、`href=/zh/...`）。
   - CI 聚合执行器：每项超时 + 进程树清理 + `--only/--skip/--list` + 状态回写（`ci/aggregate`）；无变化重复运行自动跳过（连错 2 / 连净 5，告警中性，`workflow_dispatch`/`CI_FORCE`/`[ci force]` 强跑）。
2. **进程永不挂死**：`scripts/spawn.js`（ComSpec 执行、verbatim 引号、超时清树、状态文件、心跳）+ `scripts/lib/process-guard.js`（父死 86/绝对寿命 87/信号 130-143/后代清理）+ 11 入口接入 + `verify:process-guards` 入 CI。
3. **a11y 全页归零**：`.pwa-install-close`/`.pwa-update-close` 24px 命中区、3 处对比度（code-scroll-hint、cr-clear、fav-btn、offline h1）、a11y serve 关闭等待 exit；主仓与真站审计 0 违规。
4. **依赖安全**：brace-expansion 2.1.7、dompurify 3.4.16、wrangler 4.145.0（miniflare/undici 链解除）→ `npm audit` **0 漏洞**。
5. **覆盖率**：无头 web 覆盖率扩充为 55 条交互断言；主仓行 69%/函数 65.2%，真站 65.8%/60.8%（阈值 55/55）；`--no-minify-js` 隔离开关修正度量。
6. **GitHub Actions**：`compat-node20`（Node 20.19 实机）与 `build`（22 项聚合）双双成功。

## 生产部署与线上验证

- 命令：`npx wrangler deploy --config workers/wrangler.toml --env production`（real-site 目录，wrangler 4.145.0）。
- 线上校验：`/zh/`、`/en/`、`/manifest.json`、`/sw.js`、`/zh/search/` 200；`/admin/` 403；`/feed.json`、`/feed.xml` 302（根别名预期）；CSP `script-src/style-src` 均 nonce、无 `unsafe-inline`、无 `style-src-attr`、`frame-ancestors 'none'`；CJK 字体 `immutable`；未知路径 404 含 `S-LANG-REDIRECT-404`；`verify-live-softnav.js` ALL PASS；`probe-live-csp.js` 0 违规（唯一无 nonce 为 `speculationrules`，CSP 白名单允许）。
- 备份：`backups/S-ynapse-2026-10-01-deploy.bundle`（verify 完整历史）。

## 剩余事项（未完成清单）

1. **生产 LCP 未达 1.2s 目标**：历史实测 2.7–5.5s 波动；`lcpOptimize` 已上线，需在网络稳定时段复测并决定是否继续专项（候选：首图 priority/尺寸、字体子集加载时序）。
2. `content-visibility` 维持默认关闭（实测长文 LCP 改善但 CLS 惩罚，决策保留）。
3. `Object.assign` 隐式写入残余：`scripts/lib/utils.js`（sanitize attribs 白名单后写入）与构建报告内部拷贝；风险低，未纳入本批。
4. 真机（iOS/Android）点检：按 `docs/mobile-checklist.md` 由用户执行，结果回传后可闭环。
5. real-site 的 `.github/**` 有意不随主仓同步（其 CI/项目名自有）。
6. 其余更早遗留见 `docs/plans/2026-09-29-hardening.md` 与各审计报告的「残余」节。

## 工具与约定

- 长任务一律 `node scripts/spawn.js --max-ms N --log … --status-file … -- <cmd>`（心跳 30s，可轮询）；禁止 Start-Process 直启业务命令。
- 本地 CI 镜像：`node scripts/ci-checks.js`（22 项，跑完整套后统一失败）。
- 部署冒烟顺序：`npm ci → node scripts/ci-checks.js → npx wrangler deploy → 线上 curl/探针`。
