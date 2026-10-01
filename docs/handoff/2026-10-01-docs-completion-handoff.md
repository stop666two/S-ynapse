# 交接：文档与 JSON5 配置注释全量校准（2026-10-01，v1.2.1 后）

## 结果一句话

15 个 JSON5 逐键复核并清除陈旧叙述，README / config-reference / architecture / runbook / SECURITY / CHANGELOG 全量对齐当前代码（1.2.1），`npm test` 996 项 / 144 组、`scripts/lib` 行覆盖率 93.9%、六项配置守卫 PASS、隔离构建产出唯一 `build-report.html`；主仓未 push、未动任何 tag；real-site 已按既有 SKIP 策略同步。

## 本轮完成

1. **JSON5（15 个）**：新增 `internals.json5` 默认值口径说明；修正 8 处陈旧叙述（features：mermaid 渲染模式、SW 提示、lcpOptimize 三项默认说明、公告关闭键、boot 开关、gallery 拉伸、continueReading 进度）；`verify:config-comments` 2734 键 0 违规。
2. **README**：测试/覆盖率计数实测回填（996/144、93.9%）；构建管线表重写为 14 阶段（与构建报告阶段名一致）；测试概览表改为稳定功能域清单；bat 使用说明补全；发布策略「tag 永不删除，仅自动清理旧 Releases」；`.nvmrc` 单源；预算阈值 45/85KB。
3. **docs/config-reference.md**：新增「快速索引：按需求找键」；复核 criticalCss / offscreenSkip / preloadFirstCard / cjkFonts / compression 全字段 / softNavigation / popupNotice / continueReading / release / internals 段落；修正旧行为措辞。
4. **docs/architecture.md**：14 阶段表 + 模块拆分图、构建报告区块、五作业发布流水线（validate→gates→archive→buildability→publish + 归档白名单 + tag 保护）、关键 CSS 与软导航运行期流程、缓存层（media/covers/og/fonts/mermaid/compression/build-cache）、编排器行数与模板/模块计数实测回填。
5. **CHANGELOG**：新增 `[Unreleased]`（本轮文档校准 + bat 加固 + release publish 依赖修复），链接改为 `v1.2.1...HEAD`；runbook 预发布示例改为 `1.2.2-rc.1`。

## 当前状态（事实源）

- 版本：`package.json` / `RELEASE.json` = 1.2.1（status=verified，commit=b7cb3d9）；tag `v1.2.1` 与历史 tag 一律保留。
- 发布：tag 推送触发 `.github/workflows/release.yml` 五作业；`release:prune` 只删旧 Release（不带 `--cleanup-tag`）。
- Windows：`build.bat`（依赖缺失才 `npm install --prefer-offline`，失败 pause）；`serve.bat [端口] [rebuild]`（仅清理 LISTENING 占用，失败 pause）。
- 报告：唯一 `dist/build-report.html`，位于压缩与 cacheBust 之后，天然豁免。
- real-site：派生副本不含 `docs/` 等路径（sync-now 既有 SKIP 策略），计数断言经 `SYNAPSE_DERIVED_COPY=1` 跳过。

## 残余（未完成清单）

1. `features.lcpOptimize.contentVisibility` 维持 false（长文 LCP 有改善但冷锚点 CLS 超线，数据见 features.json5 注释）。
2. 生产 LCP 目标 1.2s 未复测（需网络稳定时段；见前一份交接）。
3. 真机（iOS/Android）点检按 `docs/mobile-checklist.md` 由用户执行。
4. 老模块（site/theme/features 早期段落）注释为单行括号风格，未统一改写为「作用/类型/…」六要素模板；新特性均已按现代范式注释并由守卫覆盖。

## 工具与约定

- 长任务：`node scripts/spawn.js --max-ms N -- <命令>`；残留清理 `node .tmp-scripts/kill-orphans.js`（项目作用域）。
- 验收：`npm test`（996/144）、`npm run test:build`、`lint`、`typecheck`、五 config verify + `verify:internals`、`node scripts/build.js --out <隔离目录>`。
