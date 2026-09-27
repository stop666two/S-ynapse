# 发布流程（Release Runbook）

适用范围：从「代码完成」到「GitHub Release 可下载」的完整发布链路。
站点部署（Cloudflare Pages/Worker）与此流程相互独立，见 §8。

发布由三部分组成：**人工核验记录（RELEASE.json）** + **版本 tag（vX.Y.Z）** + **归档包（S-ynapse-X.Y.Z.zip）**。
三者通过 tag 绑定：任何 tag 必须先通过 RELEASE.json 双重校验与全套质量门禁，CI 才会创建 Release。

## 1. 前置门禁（发布前必须全部通过）

| # | 命令 | 内容 |
|---|---|---|
| 1 | `npm run lint` | ESLint（js/scripts/workers） |
| 2 | `npm run typecheck` | TypeScript checkJs（scripts/lib） |
| 3 | `npm test` | 单元测试全量 |
| 4 | `npm run test:build` | 构建冒烟（临时输出目录） |
| 5 | `npm run verify:config` | 配置默认值/结构一致性 |
| 6 | `npm run verify:config-refs` | 零引用键扫描 |
| 7 | `npm run verify:config-comments` | 逐键注释覆盖率 |
| 8 | `npm run verify:config-docs` | 配置参考文档覆盖 |
| 9 | `npm run verify:security` | 安全集成回归（恶意内容注入构建） |
| 10 | `npm run verify:compression` | 压缩无头对比（无 Chrome 时跳过并声明） |
| 11 | `npm run build` | 一次真实构建（不需要生产部署/线上验证） |

清单的单一来源是 `scripts/lib/release-version.js → RELEASE_GATES`：`release:mark` 按此顺序执行，
CI 与 RELEASE.json 的 `checks` 键也以此为准（缺项或不全 true 即拒绝发布）。

## 2. RELEASE.json 字段与双重校验

根 `RELEASE.json` 是「完成标记」的机器可读记录；初始态为 `unverified`（默认拒绝发布）。

| 字段 | 类型 | 含义与约束 |
|---|---|---|
| `schemaVersion` | number | 固定 `1`；结构升级时递增 |
| `version` | string | `X.Y.Z`，必须与 package.json 及 tag（去 v）一致 |
| `status` | string | 必须为 `verified` 才允许发布；初始 `unverified` |
| `humanVerifiedBy` | string | 人工核验人姓名（非空；机器无法替代人工确认） |
| `verifiedAt` | string | 人工核验时间，ISO 8601 UTC（如 `2026-09-27T12:00:00.000Z`，日历严格校验） |
| `commit` | string | 40 位小写 SHA；必须等于 tag 指向提交的**父提交**（被核验提交）。git 提交的内容无法包含自身 SHA（数学上不可自引用），因此记录父提交，校验以 `git rev-parse vX.Y.Z^{commit}^` 比对 |
| `checks` | object | 11 项门禁键 → `true`；任一缺失或 false 即失败 |

**双重校验** = ① tag 存在（CI 触发/`--verify-tag`）+ ② 该 tag 指向提交内的 RELEASE.json 满足上表全部约束（`commit` 的比对基准是 tag 的父提交，原因见字段表）。校验逻辑唯一实现：`scripts/lib/release-validate.js → validateReleaseState`；CI 用 `node scripts/lib/release-validate.js --tag vX.Y.Z` 执行。

## 3. 人工核验的含义

`release:mark` 只记录「谁在何时确认了什么版本」，它不替代人工判断。执行者必须确认：

1. `npm test` 等门禁全绿（脚本会强制，但需人工确认没有「将就放过」的情况）；
2. `RELEASE.json.checks` 的 11 项与实际执行结果一致；
3. 版本号选择正确（破坏性变更必须 major，见 SemVer 2.0.0）；
4. 工作区没有夹带无关变更，且 `--confirm <版本号>` 与目标版本一致。

任何一项不确定都应停止发布（存疑即 FAIL）。

## 4. 发布操作（release:mark）

```bash
# 演练（不执行门禁、不写文件，用于核对版本/CHANGELOG/提交计划）
npm run release:mark -- patch --human-verified "张三" --confirm 1.1.1 --dry-run

# 正式发布（顺序执行 11 项门禁；任一失败即停止且不修改任何文件）
npm run release:mark -- patch --human-verified "张三" --confirm 1.1.1
```

脚本步骤：① 工作区干净 + tag 未被占用 → ② 顺序执行 11 项门禁 → ③ 校验人工核验参数 →
④ `npm version --no-git-tag-version` 同步 package.json/lock → ⑤ CHANGELOG `[Unreleased]` 内容归入 `[X.Y.Z] - 日期` 并补版本链接 →
⑥ 生成 RELEASE.json（verified + checks 全 true，commit=被核验提交=当前 HEAD，即后续 release 提交的父提交）→ ⑦ **单提交** `chore(release): vX.Y.Z`（不做 amend，避免提交 SHA 漂移导致标记失配）→ ⑧ 创建附注 tag `vX.Y.Z` → ⑨ 默认不 push，打印后续命令。

推送需要显式二次确认：`--push --confirm-push`（分支与 tag 都会推送）。

## 5. 双通道发布

**通道 A（默认）：GitHub Actions on tag。** 推送 tag 后 `.github/workflows/release.yml` 自动：
`validate`（RELEASE.json 双重校验）→ `gates`（11 项门禁）→ `publish`（`release-archive` 生成归档 + `gh release create --verify-tag`）。
校验或门禁失败则 job 失败、**不创建 Release**。

**通道 B（备用，本地）：`npm run release:publish -- vX.Y.Z`。** 适用于 Actions 不可用时：
先 `git push origin vX.Y.Z`（远端必须存在 tag，本地脚本会检查），脚本复用同一套双重校验后调用 `gh release create`。
两条通道二选一，不要同时使用（同名 Release 会创建失败）。

## 6. 归档包与白名单

```bash
npm run release:archive -- --ref HEAD                # 默认输出 release-artifacts/S-ynapse-<version>.zip
npm run release:archive -- --ref v1.1.0 --out dist/release.zip
```

白名单单一来源：`scripts/lib/release-manifest.js`。
包含：`js/**`、`scripts/**`（含测试）、`templates/**`、`workers/**`、根全部 `*.json5`、`package.json`、
`package-lock.json`、`.env.example`、`.gitattributes`、`.gitignore`、`LICENSE`、`README.md`、`RELEASE.json`。
排除：`docs/**`、`.github/**`、`.githooks/**`、`.tmp-scripts/**`、`backups/**`、`real-site/**`、`dist/**`、
`articles/**`、`pages/**`、`media/**`、`static/**`、`workers/security-config.js` 等；未知路径默认拒绝。
归档生成后逐条复核（`assertArchiveContents`），任一条目越界或缺少必需文件即失败。

## 7. 失败排障

| 现象 | 原因与处理 |
|---|---|
| `RELEASE.json 校验失败`（CI validate） | 按日志逐条修复：常见为忘记 `release:mark`、tag 落在旧提交、version 未同步 |
| 门禁失败（release:mark 中途停止） | 已停止且未写文件；修复后重跑完整命令（从第一项门禁重新执行） |
| `tag 已存在` | 脚本拒绝重复发布；确认版本号或删除本地错误 tag（`git tag -d`，未推送时安全） |
| `git archive` 缺 RELEASE.json | ref 指向发布机制引入前的旧提交；改用含标记的 tag/HEAD |
| `gh release create` 失败 | 检查 `gh auth status`、tag 是否已推送、同名 Release 是否已存在；Actions 通道已建 Release 时不要再用通道 B |
| `verify:compression` 跳过 | 无 Chrome 属预期；阅读命令输出中的 `[SKIP]` 声明，必要时设置 `CHROME_PATH` 后重跑 |

## 8. 与站点部署的关系

- **Release ≠ 部署**：Release 是「已验证版本的可下载快照」；站点部署由 `deploy.yml`（push `main`）或手动 `wrangler deploy` 执行。
- `.github/workflows/deploy.yml` 的触发条件为 `push: branches: [main]`，**tag 推送不会触发站点部署**；
  反向亦然：部署失败不影响已建 Release。回滚流程见 `docs/runbook/rollback.md`。

## 9. 快速对照表

| 场景 | 命令 |
|---|---|
| 演练发布计划 | `npm run release:mark -- patch --human-verified "<姓名>" --confirm <版本> --dry-run` |
| 正式标记并提交/tag | `npm run release:mark -- <major|minor|patch|X.Y.Z> --human-verified "<姓名>" --confirm <版本>` |
| 推送分支与 tag | `git push origin <branch>` + `git push origin vX.Y.Z`（或 `release:mark --push --confirm-push`） |
| 本地生成归档 | `npm run release:archive -- --ref <tag|HEAD>` |
| 本地建 Release（备用） | `npm run release:publish -- vX.Y.Z` |
| 校验某 tag 的标记 | `node scripts/lib/release-validate.js --tag vX.Y.Z` |
