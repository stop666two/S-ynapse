# 发布流程（Release Runbook）

适用范围：从「代码完成」到「GitHub Release 可下载」的完整发布链路。
站点部署（Cloudflare Pages/Worker）与此流程相互独立，见 §9。

发布由三部分组成：**人工核验记录（RELEASE.json）** + **版本 tag（vX.Y.Z 或 vX.Y.Z-<预发布>）** + **归档包（S-ynapse-<版本>.zip）**。
三者通过 tag 绑定：任何 tag 必须先通过 RELEASE.json 双重校验与全套质量门禁，CI 才会创建 Release。

**基础包语义**：归档是「可完整体验 README 全部功能的最基本骨架」——含运行/构建/部署/测试所需的全部代码与配置、
保留的示例页面（`pages/**`）与默认资源（`static/**`）；但不含任何示例文章与演示媒体，
`articles/**` 与 `media/**` 在包内以 `.gitkeep` 标记的空目录呈现，由使用者放入自己的内容。
由此，归档必须满足三条硬约束，`buildability` 作业逐条验证（见 §5）：**空站可构建**（0 文章时 `npm run build` 成功并产出
`dist/index.html`、`dist/report.txt`、`dist/zh/search-index.json`）、**测试可跑**（解压后 `npm test` 全绿）、**配置为默认初始态**（无个人/真实数据）。

发布策略：**只保留最新版本**——新 Release 创建成功后，CI 自动删除其余 Release 及其 tag（见 §7）。

## 1. 前置门禁（发布前必须全部通过）

| # | 命令 | 内容 |
|---|---|---|
| 1 | `npm run lint` | ESLint（js/scripts/workers） |
| 2 | `npm run typecheck` | TypeScript checkJs（scripts/lib） |
| 3 | `npm test` | 单元测试全量 |
| 4 | `npm run test:build` | 构建冒烟（临时输出目录） |
| 5 | `npm run verify:config` | 配置默认值/结构一致性 |
| 6 | `npm run verify:config-refs` | 零引用键扫描 |
| 7 | `npm run verify:config-dupes` | 重复键扫描（同一对象内重复键） |
| 8 | `npm run verify:config-comments` | 逐键注释覆盖率 |
| 9 | `npm run verify:config-docs` | 配置参考文档覆盖 |
| 10 | `npm run verify:security` | 安全集成回归（恶意内容注入构建） |
| 11 | `npm run verify:compression` | 压缩无头对比（无 Chrome 时跳过并声明） |
| 12 | `npm run build` | 一次真实构建（不需要生产部署/线上验证） |

清单的单一来源是 `scripts/lib/release-version.js → RELEASE_GATES`：`release:mark` 按此顺序执行，
CI 与 RELEASE.json 的 `checks` 键也以此为准（缺项或不全 true 即拒绝发布）。

## 2. RELEASE.json 字段与双重校验

根 `RELEASE.json` 是「完成标记」的机器可读记录；初始态为 `unverified`（默认拒绝发布）。

| 字段 | 类型 | 含义与约束 |
|---|---|---|
| `schemaVersion` | number | 固定 `1`；结构升级时递增 |
| `version` | string | `X.Y.Z` 或 `X.Y.Z-<预发布>`（SemVer 2.0.0），必须与 package.json 及 tag（去 v）一致 |
| `status` | string | 必须为 `verified` 才允许发布；初始 `unverified` |
| `humanVerifiedBy` | string | 人工核验人姓名（非空；机器无法替代人工确认） |
| `verifiedAt` | string | 人工核验时间，ISO 8601 UTC（如 `2026-09-27T12:00:00.000Z`，日历严格校验） |
| `commit` | string | 40 位小写 SHA；必须等于 tag 指向提交的**父提交**（被核验提交）。git 提交的内容无法包含自身 SHA（数学上不可自引用），因此记录父提交，校验以 `git rev-parse vX.Y.Z^{commit}^` 比对 |
| `checks` | object | 12 项门禁键 → `true`；任一缺失或 false 即失败 |

**双重校验** = ① tag 存在（CI 触发/`--verify-tag`）+ ② 该 tag 指向提交内的 RELEASE.json 满足上表全部约束（`commit` 的比对基准是 tag 的父提交，原因见字段表）。校验逻辑唯一实现：`scripts/lib/release-validate.js → validateReleaseState`；CI 用 `node scripts/lib/release-validate.js --tag vX.Y.Z` 执行（预发布 tag 同样支持）。

## 3. 人工核验的含义

`release:mark` 只记录「谁在何时确认了什么版本」，它不替代人工判断。执行者必须确认：

1. `npm test` 等门禁全绿（脚本会强制，但需人工确认没有「将就放过」的情况）；
2. `RELEASE.json.checks` 的 12 项与实际执行结果一致；
3. 版本号选择正确（破坏性变更必须 major，见 SemVer 2.0.0；预发布/正式版关系见 §4.2）；
4. 工作区没有夹带无关变更，且 `--confirm <版本号>` 与目标版本一致。

任何一项不确定都应停止发布（存疑即 FAIL）。

## 4. 发布操作（release:mark）

```bash
# 演练（不执行门禁、不写文件，用于核对版本/CHANGELOG/提交计划）
npm run release:mark -- patch --human-verified "张三" --confirm 1.1.1 --dry-run

# 正式发布（顺序执行 12 项门禁；任一失败即停止且不修改任何文件）
npm run release:mark -- patch --human-verified "张三" --confirm 1.1.1

# 预发布（演练；显式 X.Y.Z-<预发布>，核心版本等于当前正式版时允许）
npm run release:mark -- 1.1.0-a1 --human-verified "张三" --confirm 1.1.0-a1 --dry-run
```

脚本步骤：① 工作区干净 + tag 未被占用 → ② 顺序执行 12 项门禁 → ③ 校验人工核验参数 →
④ `npm version --no-git-tag-version` 同步 package.json/lock → ⑤ CHANGELOG `[Unreleased]` 内容归入 `[版本] - 日期` 并补版本链接 →
⑥ 生成 RELEASE.json（verified + checks 全 true，commit=被核验提交=当前 HEAD，即后续 release 提交的父提交）→ ⑦ **单提交** `chore(release): v<版本>`（不做 amend，避免提交 SHA 漂移导致标记失配）→ ⑧ 创建附注 tag → ⑨ 默认不 push，打印后续命令。

推送需要显式二次确认：`--push --confirm-push`（分支与 tag 都会推送）。
`--dry-run` 会额外打印「发布类型：正式版 / 预发布」。

### 4.1 同版本标记（为当前版本建立首个 Release）

当 package.json 已是目标版本、且该版本从未发布过（tag 不存在）时，用「同版本标记」直接为当前版本建 Release，不做版本递增：

```bash
# 演练（当前 package.json 为 1.1.0 时）
npm run release:mark -- 1.1.0 --human-verified "张三" --confirm 1.1.0 --dry-run

# 正式标记
npm run release:mark -- 1.1.0 --human-verified "张三" --confirm 1.1.0
```

- 触发条件：参数为显式版本且等于 package.json 当前版本（正式版或预发布均可）；关键字 `major|minor|patch` 或更高的显式版本仍走递增路径。
- 版本同步：跳过 `npm version`（版本号已一致）；仅当 `package-lock.json` 根版本（顶层 `version` 与 `packages[""].version`）漂移时同步为目标版本。
- 其余步骤与递增路径完全一致。
- **已发布版本不可重复使用**：tag 已存在时脚本在门禁前直接拒绝。

### 4.2 预发布标记（X.Y.Z-<预发布>）

显式传入合法 SemVer 预发布版本（如 `1.1.0-a1`、`1.2.0-rc.1`）即可发布预发布版，用于正式版发布前的可下载验证：

- 规则：显式预发布版本必须 **大于** 当前版本；**例外**——当前版本不带预发布标识时，允许标记与其核心版本相同的预发布（`1.1.0 → 1.1.0-a1`）；预发布之间仍必须严格递增（`a2 > a1`），不允许回退。
- SemVer 校验：预发布标识符按 SemVer 2.0.0（数字标识符不得有前导零、仅 `[0-9A-Za-z-]` 与 `.`），比较遵循「正式版 > 预发布；数字按数值、字母数字按 ASCII」。
- 版本同步：走递增路径（`npm version --no-git-tag-version`），package.json/lock 同步为预发布版本；tag 为 `v1.1.0-a1`。
- GitHub Release：CI 与本地 `release:publish` 均以 `--latest` 创建 Release——版本名保留预发布标识（SemVer 预发布，如 `1.1.0-a1`），但 GitHub 侧标记为正式 Latest、下载页置顶；历史若因 `--prerelease` 未置顶，用 `gh release edit vX.Y.Z --prerelease=false --latest` 手动修正。
- 后续正式版：直接标记 `1.1.0`（大于 `1.1.0-a1`），发布成功后旧预发布 Release 会按 §7 策略被清理。

**CHANGELOG 变换规则（三态，纯函数 `scripts/lib/release-version.js → planChangelogRewrite`）**：

| 输入态 | 变换 |
|---|---|
| ① 有 `[Unreleased]`、无 `[版本]` | `[Unreleased]` 标题重命名为 `## [版本] - <YYYY-MM-DD>` 并补版本链接 |
| ② 有 `[Unreleased]`、已有 `[版本]` | `[Unreleased]` 各小节按标题合并进 `[版本]` 对应小节顶部（新条目在前、既有条目保留；目标段没有的标题按原顺序追加到末尾），删除 `[Unreleased]` 段，版本段日期更新为发布日 |
| ③ 无 `[Unreleased]` | 仅确保 `[版本]` 段与版本链接：段已存在则只补缺失链接，段缺失则在最新版本段前新建空段 |

三个分支都不改动其他段落，原有链接引用块原样保留；dry-run 与正式执行共用同一变换计划（预发布版本段同样适用）。

## 5. 双通道发布

**通道 A（默认）：GitHub Actions on tag。** 推送 tag 后 `.github/workflows/release.yml` 自动：

```
validate（RELEASE.json 双重校验）
→ gates（12 项门禁）
→ archive（白名单归档：articles/media 仅 .gitkeep 骨架 + RELEASE.json=package.json=tag
           版本一致性校验，上传 artifact）
→ buildability（下载归档 → 解压 → npm ci --ignore-scripts → npm test → npm run build
                 断言 dist/index.html、dist/report.txt、dist/zh/search-index.json；
                 任一环节失败即不发布）
→ publish（gh release create --verify-tag --latest → release-prune 清理其余 Release 与远端 v* tag）
```

任一环节失败都不会创建 Release。

**通道 B（备用，本地）：`npm run release:publish -- vX.Y.Z`。** 适用于 Actions 不可用时：
先 `git push origin vX.Y.Z`（远端必须存在 tag，本地脚本会检查），脚本复用同一套双重校验后调用 `gh release create --latest`，随后执行同款旧版清理（Release + 远端 v* tag）。
两条通道二选一，不要同时使用（同名 Release 会创建失败）。

## 6. 归档包与白名单

```bash
npm run release:archive -- --ref HEAD                # 默认输出 release-artifacts/S-ynapse-<version>.zip
npm run release:archive -- --ref v1.1.0 --out dist/release.zip
```

白名单单一来源：`scripts/lib/release-manifest.js`。口径：**基础包 = 可完整体验 README 全部功能的最基本骨架**，解压后 `npm ci --ignore-scripts && npm test && npm run build` 必须全部成功。

- 包含：`js/**`、`scripts/**`（含全部 `*.test.js`，保证解压后 `npm test` 可运行）、`templates/**`、`workers/**`、`.githooks/**`、示例页面 `pages/**`、默认资源 `static/**`、默认数据 `data/**`（如每日一言 `data/quotes.json5`，属可体验的默认功能）；根全部 `*.json5`、`package.json`、`package-lock.json`、`.env.example`、`.gitattributes`、`.gitignore`、`LICENSE`、`README.md`、`RELEASE.json`、`build.bat`、`serve.bat`、`eslint.config.js`、`tsconfig.json`、`wrangler.toml`。
- 骨架目录（只保留 `.gitkeep`，实体内容一律过滤）：`articles/**`（如 `articles/zh/.gitkeep`、`articles/en/.gitkeep`）与 `media/**`（`media/.gitkeep`）。pathspec 对这两个目录只注入 `**/.gitkeep`；`assertArchiveContents` 兜底拒绝任何非标记条目，错误信息标注「骨架目录只允许 .gitkeep」。
- 排除：`docs/**`、`.github/**`、`.tmp-scripts/**`、`.playwright-mcp/**`、`backups/**`、`real-site/**`、`dist/**`、`node_modules/**`、`.cache/**`、`build-artifacts/**`、`release-artifacts/**`、`workers/security-config.js`；未知路径默认拒绝。
- 注意：可选内容目录 `videos/`、`assets/` 当前仓库尚无内容；`git archive` 对未匹配的 pathspec 会直接失败，故不能预先写入，待目录出现内容时显式加入白名单。
- 归档生成后逐条复核（`assertArchiveContents`），任一条目越界或缺少必需文件（含 `.gitkeep` 骨架标记、`scripts/**/*.test.js`）即失败；同时校验版本三方一致（RELEASE.json = package.json = tag 名，见 `assertVersionConsistency`）。
- 本地核对归档清单：`release:archive` 输出骨架目录统计（`articles/` 与 `media/` 各几个 `.gitkeep`）、测试文件数与总文件数。

## 7. 只保留最新版本（旧版清理）

- **策略**：同一仓库任意时刻只保留**最新一个** Release 及其 tag；其余 Release 与旧 `v*` tag（含没有 Release 的残留 tag）随新版本发布自动下线。非 `v*` 命名的 tag 视为用户资产，不在清理范围。
- **执行顺序**：固定「先 Release 后 tag」——① `gh release delete <tag> --yes --cleanup-tag` 删除旧 Release 并连带其 tag；② 对没有 Release 的残留 `v*` tag 执行 `git push origin :refs/tags/<tag>`；`--keep` 指定的当前 tag 全程受保护，避免删 tag 后 Release 悬空。
- **CI（通道 A）**：publish 最后一步执行 `node scripts/release-prune.js --keep "$GITHUB_REF_NAME"`（排除刚发布的版本）。
- **本地（通道 B）**：`release:publish` 成功后自动执行同一清理；也可手动执行：

```bash
npm run release:prune -- --keep v1.1.0            # 实际删除：先旧 Release，再残留 v* tag
npm run release:prune -- --keep v1.1.0 --dry-run  # 仅打印两阶段删除清单
```

- 依赖 `gh` 认证（CI 注入 `GH_TOKEN`）与可访问的 `origin` 远端；两阶段任一删除失败以非零退出码报告（失败项不会自动重试，需人工重跑）。
- 远端列表先于删除动作读取：`gh release list` 或 `git ls-remote --tags --refs origin` 任一失败即中止，不会出现删了一半的状态。
- 注意：`--cleanup-tag` 会删除远端 tag。本地若仍保留旧 tag，需自行 `git tag -d` 或 `git fetch --prune --prune-tags` 同步。
- 示例：仓库有 `v1.1.0`（正式版 Release）、`v1.0.0`（旧 Release）与游离 tag `v0.9.0`（无 Release），发布 `v1.1.0-a1` 后执行 `--keep v1.1.0-a1`：`v1.1.0`、`v1.0.0` 的 Release 与 tag 被删除，`v0.9.0` 残留 tag 由 `git push` 删除，最终只保留 `v1.1.0-a1`。

## 8. 失败排障

| 现象 | 原因与处理 |
|---|---|
| `RELEASE.json 校验失败`（CI validate） | 按日志逐条修复：常见为忘记 `release:mark`、tag 落在旧提交、version 未同步；预发布 tag 格式非法（如数字标识符前导零 `v1.1.0-01`）也会在此失败 |
| 门禁失败（release:mark 中途停止） | 已停止且未写文件；修复后重跑完整命令（从第一项门禁重新执行） |
| `tag 已存在` | 脚本拒绝重复发布；确认版本号或删除本地错误 tag（`git tag -d`，未推送时安全） |
| `版本不一致` / `tag 与版本不一致`（archive 作业） | RELEASE.json、package.json、tag 三者必须一致；用 `release:mark` 重新标记，不要手工改版本号 |
| `buildability` 作业失败 | 归档解压后 `npm ci --ignore-scripts` / `npm test` / `npm run build` 失败、或缺少 `dist/index.html`/`report.txt`/`zh/search-index.json`；**不会创建 Release**。按日志修复（多为白名单漏文件或空站构建回归）后重新标记新版本/重推 tag |
| `git archive` 缺 RELEASE.json | ref 指向发布机制引入前的旧提交；改用含标记的 tag/HEAD |
| `gh release create` 失败 | 检查 `gh auth status`、tag 是否已推送、同名 Release 是否已存在；Actions 通道已建 Release 时不要再用通道 B |
| Release 已建但下载页未置顶 Latest | 历史 Release 受 `--prerelease` 影响；手动修正示例：`gh release edit vX.Y.Z --prerelease=false --latest`（或删掉该 Release 后重跑发布）。现行 CI/本地通道已固定 `--latest`，不再出现该现象 |
| 旧 tag 残留（无对应 Release） | 重跑 `npm run release:prune -- --keep vX.Y.Z`（第一阶段删 Release，第二阶段 `git push origin :refs/tags/<tag>` 删残留 `v*` tag）；或手动 `git push origin :refs/tags/vX.Y.Z`。非 `v*` tag 不会被清理 |
| 旧版清理失败（publish 最后一步） | Release 已创建但策略未完全生效；检查 `GH_TOKEN` 权限与 `origin` 可访问后手动执行 `npm run release:prune -- --keep vX.Y.Z` |
| `verify:compression` 跳过 | 无 Chrome 属预期；阅读命令输出中的 `[SKIP]` 声明，必要时设置 `CHROME_PATH` 后重跑 |

## 9. 与站点部署的关系

- **Release ≠ 部署**：Release 是「已验证版本的可下载快照」；站点部署由 `deploy.yml`（push `main`）或手动 `wrangler deploy` 执行。
- `.github/workflows/deploy.yml` 的触发条件为 `push: branches: [main]`，**tag 推送不会触发站点部署**；
  反向亦然：部署失败不影响已建 Release。回滚流程见 `docs/runbook/rollback.md`。

## 10. 快速对照表

| 场景 | 命令 |
|---|---|
| 演练发布计划 | `npm run release:mark -- patch --human-verified "<姓名>" --confirm <版本> --dry-run` |
| 正式标记并提交/tag | `npm run release:mark -- <major\|minor\|patch\|X.Y.Z\|X.Y.Z-预发布> --human-verified "<姓名>" --confirm <版本>` |
| 同版本标记（首个 Release） | `npm run release:mark -- <当前版本> --human-verified "<姓名>" --confirm <当前版本>` |
| 预发布标记 | `npm run release:mark -- 1.1.0-a1 --human-verified "<姓名>" --confirm 1.1.0-a1` |
| 推送分支与 tag | `git push origin <branch>` + `git push origin vX.Y.Z`（或 `release:mark --push --confirm-push`） |
| 本地生成归档 | `npm run release:archive -- --ref <tag\|HEAD>` |
| 本地建 Release（备用） | `npm run release:publish -- vX.Y.Z` |
| 清理旧版（只留最新） | `npm run release:prune -- --keep vX.Y.Z`（先删旧 Release，再删残留 v* tag；加 `--dry-run` 预览两阶段清单） |
| 手动修正 Latest 标记 | `gh release edit vX.Y.Z --prerelease=false --latest` |
| 校验某 tag 的标记 | `node scripts/lib/release-validate.js --tag vX.Y.Z` |
