# 测试极大扩充计划（随机/属性 + 恶意载荷 + 冒烟 + 覆盖率）

> 目标：把测试从「快乐路径的示例断言」扩充为「用户不会那么老实」的随机与对抗性验证体系。
> 本文件是 T1–T5 的总体计划与预算基线；T1（基础设施与骨架）与 T2 批 A（markdown/frontmatter、slug/路径/URL、配置合并校验三域）已完成，其余按本文件推进。

## 1. 已确认决策（8 项）

1. **引入 fast-check**（精确版本 `4.10.2`，仅 devDependencies）作为属性测试引擎；随机载荷生成器自研（`scripts/lib/test-random.js` 的确定性 RNG），不引入第二套随机库。
2. **随机覆盖全部 8 域**：markdown/frontmatter、slug/路径/URL、配置合并校验、搜索索引查询、压缩/混淆往返、XML/Feed/sitemap、增量指纹、wiki/双语/导出。
3. **恶意场景全 10 类**：超长海量、XSS 全字段、路径遍历 slug、坏 JSON5、空站、编码异常、损坏媒体、日期/重复/保留 slug、emoji/双向文本、磁盘写失败模拟（语料见 `scripts/lib/test-payloads.js`）。
4. **策略二分**：安全类（XSS/遍历/坏配置/非法日期/重复与保留 slug 等）判 `hard-fail`（必须拒绝或阻断）；资源类（超长/海量、空站、编码异常、损坏媒体、磁盘写失败等）判 `degrade`（不崩溃、跳过或降级并留可观测告警）。
5. **本地与 CI 同强度**：统一命令 `npm run test:all`，本地与 CI 跑完全相同的步骤集合，不设「CI 专属」或「本地专属」差异；无 Chrome 环境（smoke/覆盖率）按既有 `verify:compression` 语义 skip-with-notice（exit 0）。
6. **新增 GitHub schedule 夜间随机任务**（`.github/workflows/nightly.yml`，每日 UTC 18:00 + `workflow_dispatch`）：深度档 `FC_NUM_RUNS=2000`、`STRESS=1`、不设 `TEST_SEED`（每夜随机种子），跑 `test:all`，上传失败留档与覆盖率工件。
7. **引入无头 v8 覆盖率汇总**（`scripts/coverage-web.js`）：CDP `Profiler.takePreciseCoverage`（callCount + detailed）逐页累加，按 URL 聚合 `js/**`（排除 vendor）行覆盖与函数覆盖，输出 `build-artifacts/web-coverage/{summary.txt,coverage.json}`，未达标 exit 1。
8. **失败必须可复现**：随机种子打印（无 `TEST_SEED` 时生成 32 位并打印）+ 失败留档 `build-artifacts/fuzz-failures/<test>-<UTC时间戳>.json`（种子、counterexample、重放命令），复现命令 `TEST_SEED=<种子> FC_NUM_RUNS=<次数> npm run test:fuzz`。

## 2. T1（本波，已完成）：基础设施与骨架

| 交付 | 文件 |
|---|---|
| 种子管理 + 失败留档 | `scripts/lib/test-random.js` |
| 恶意/畸形载荷语料库（10 类 + 生成器） | `scripts/lib/test-payloads.js` |
| 临时站点夹具生成器（`.tmp-test/`，可配文章数/媒体/坏配置/编码） | `scripts/lib/test-site-builder.js` |
| 示范属性测试（safeSlug/validateSlug 不变量） | `scripts/lib/slug.fuzz.test.js` |
| 浏览器无头共享底座（serve + Chrome + 看门狗） | `scripts/lib/web-harness.js` |
| 浏览器冒烟（代表页 200 / 标题 / DOM / 零控制台错误） | `scripts/smoke-web.js` |
| 无头覆盖率汇总（no-bundle + 压缩关闭 + CDP 精确覆盖） | `scripts/coverage-web.js` |
| 覆盖率阈值独立常量 | `scripts/lib/web-coverage-thresholds.js` |
| 统一入口 | `package.json`（`test:fuzz` / `test:smoke` / `test:cov-web` / `test:all`） |
| CI 接入 + 夜间任务 | `.github/workflows/deploy.yml` / `.github/workflows/nightly.yml` |

T1 实证：
- 属性测试首跑即抓到真实缺陷：`safeSlug('\uD800')`（孤立代理）因 `encodeURIComponent` 抛 `URIError` 崩溃；已修复为跳过编码分支走确定性哈希兜底（`scripts/lib/utils.js`），失败留档与重放命令同日演示（`build-artifacts/fuzz-failures/safeSlug-*.json`），修复后用原种子 3766049923 重放 9/9 通过。
- 冒烟：10 页全 200、0 控制台错误、端口释放校验通过。
- 覆盖率首测：**行 4109/7106 = 57.8%；函数 516/904 = 57.1%**。

## 3. 覆盖率阈值（首测定档）

- 初始阈值策略：首次实测后取「向下取整到 5 的倍数且不高于实测 - 3%」，下限 50。
- 推导：行 `min(57.8, 57.8×0.97=56.07) → floor5 = 55`；函数 `min(57.1, 55.39) → floor5 = 55`。
- 定档：**行覆盖 ≥ 55%、函数覆盖 ≥ 55%**（`scripts/lib/web-coverage-thresholds.js`）；回填后重跑实测行 57.8%、函数 57.3%，通过。
- 口径：只统计 `assets/js/**` 映射回 `js/**` 的脚本（vendor / 内联脚本 / config.json 不计）；行覆盖分母为非空白行；函数覆盖以 CDP `functions[].ranges[0]` 区间为单位（未调用函数计分母、被调用计分子）。

## 4. T2–T5 任务清单

### T2：8 域随机属性测试（happy-path 不变量）

**进度：批 A（3/8 域）与批 B（5/8 域）均已完成；T2 八域全部落地。**

批 A 交付与 `npm run test:fuzz` 默认档实测：

| 文件 | 域 | 属性数 | 时长 |
|---|---|---|---|
| `scripts/lib/markdown.fuzz.test.js` | markdown/frontmatter 解析、marked 渲染围栏与确定性、sanitize 净化、extractMediaRefs | 14 | 约 0.5 s |
| `scripts/lib/paths.fuzz.test.js` | safeSlug/validateSlug 路径安全、encodeLoc、sitemap、toSitemapLastmod、nav-match、mediaResolver | 14 | 约 0.35 s |
| `scripts/lib/config.fuzz.test.js` | compression 深合并/校验、validateFeatures、buildRuntimeConfig、findDuplicateKeys、check-config-refs 纯函数 | 23 | 约 0.4 s |

全量 fuzz（含 T1 slug 套件）4 套件 / 60 用例约 1.1 s，远低于 90 s 预算。

批 A 过程记录（均为测试侧断言或生成器修正，非产品缺陷）：

- `front-matter` 允许 YAML 根为标量：`---\n(\n---\n` 解析成功且 `attributes` 为 string；产品侧统一以 `fm.attributes || {}` 消费，属性断言按此真实契约放宽（不视为缺陷）。
- `validateSlug` 先 `trim()`：尾随空格输入 `'a '` 归一化为合法 `'a'`；拒绝注入属性改为把注入字符插入中段（尾随空格走归一化路径）。
- `scripts/check-config-refs.js` 为可测性补齐 `require.main === module` 守卫并导出 `collectLeaves`/`isAllowed`/`GENERIC_KEYS`，CLI 行为逐字不变。
- 保留 slug（`tags`/`categories`/`assets`/`search`）预校验仍留待 T3；本批未改产品行为（测试断言中未涉及该预校验）。

批 B 交付与 `npm run test:fuzz` 默认档实测（含批 A 全量 9 套件 / 129 用例约 10–14 s，预算 120 s）：

| 文件 | 域 | 属性数 | 时长 |
|---|---|---|---|
| `scripts/lib/search.fuzz.test.js` | 搜索索引与查询：buildIndex 确定性/字段白名单/自命中、searchIndex 容错与结构、权重单调与零权排除、标签分类开关、空查询与无命中、序列化往返、searchIndexOptions/pruneIndexToBudget | 11 | 约 0.45 s |
| `scripts/lib/compression.fuzz.test.js` | 压缩装配与 CSS 合并去重：dedupeCss 保守不变量（A;B;A 保留、相邻折叠、!important、@keyframes、不配平必抛、幂等、字节不增）、mergeStyleBlocks 保序/分组/nonce、选项装配确定性 | 18 | 约 0.3 s |
| `scripts/lib/feeds.fuzz.test.js` | XML/Feed/sitemap 转义：RSS/JSON Feed/sitemap 真实写出与数量一致、XML 非法字符清洗、无头 Chrome DOMParser parsererror 为空与文本往返（无 Chrome 时 DOMParser 用例 skip） | 8 | 约 4.7 s |
| `scripts/lib/incremental.fuzz.test.js` | 增量指纹与缓存：buildCacheKey 确定性/区分度、变更序列 skip/rebuild、pruneTo、configFingerprint、stableSerialize 键序/nonce/循环、hashContent/pageCacheKey、computeIncrementalContext、真实 cacheBust 内容寻址与幂等 | 15 | 约 1.1 s |
| `scripts/lib/wiki.fuzz.test.js` | wiki 双链/双语/导出：resolveWikiLinks 三态与大小写/标签/slug/外链/孤立代理、bilingual-core 纯函数、findAlternateArticle 配对不误配、mdExportRelPath 白名单、writeArticleMarkdown 字节一致 | 17 | 约 0.65 s |

批 B 过程记录与产品缺陷（真实缺陷均含最小反例、修复与确定性回归）：

- **XML 非法字符（RSS/sitemap）**：控制字符/孤立代理原样写出致 DOMParser `parsererror`（反例：标题 `A\u0001B\u0007C`）；`scripts/lib/utils.js` 新增 `stripInvalidXmlChars`，`scripts/build/feeds.js` 对 RSS 字段与 sitemap 的 loc/changefreq/priority/索引条目统一清洗转义。
- **CDATA 连续 `]]>`（xml-js 上游只分割第一个）**：反例标题 `x]]>y]]>z` 产出裸 `]]>`（随机种子运行命中）；`scripts/build/feeds.js` 新增 `escapeCdataSplits` 预分割第 2 个起的结束符，feeds 属性测试断言完整往返。
- **`stableSerialize` 循环数组栈溢出**：`const a=[]; a.push(a)` 抛 `RangeError`；`scripts/lib/incremental.js` 将循环检测提前到数组分支之前并登记/注销数组。
- **`resolveWikiLinks` 孤立代理编码崩溃**：`unknownMode='link'` 下 `[[\uD800]]` 抛 `URIError`；`scripts/lib/utils.js` 新增 `encodeSearchTarget`（失败时按 UTF-8 解码语义替换 U+FFFD 再编码）。
- 测试基础设施：新增 `checkPropertyAsync`（异步属性运行器）与 fast-check v4 `errorInstance` 失败文本记录；`scripts/lib/bilingual-pair.js` 自 pages.js 抽出配对纯函数（构建行为不变）；`writeFileAtomicSync` 补可选 `encoding` 透传；pagefind 动态导入改变量模块名以通过类型检查；`scripts/lib/paths.fuzz.test.js` 注入位置生成器限定 1..len-1（消除首尾空白被 trim 归一化的随机假失败，非产品缺陷）。
- `STRESS=1` 放大路径以 `FC_NUM_RUNS=20` 实测通过（超长/海量文档、sitemap 分页、随机文件集放大）。

| 域 | 覆盖对象（示例） | 关键不变量 |
|---|---|---|
| markdown/frontmatter | `front-matter` 解析、`processPagesContent` 前置转换 | 任意 UTF-8 文本解析不崩溃；frontmatter 往返保序保值 |
| slug/路径/URL | `safeSlug`/`validateSlug`/`encodeLoc` | 无路径分隔符与遍历；幂等；确定性 |
| 配置合并校验 | `deepmerge` 策略、`validateFeatures`、`formatConfigError` | 合并幂等/交换律边界；非法类型必报错且错误消息含键名 |
| 搜索索引查询 | `search-core`（tokenize/buildIndex/searchIndex/loadIndex） | 建索引后再查必命中自身词项；打分单调；空查询空结果 |
| 压缩/混淆往返 | clean-css、terser、`javascript-obfuscator` 封装 | 压缩是幂等的（二次压缩字节不变）；非法输入报错而非产出坏文本 |
| XML/Feed/sitemap | `feeds` 生成、`encodeLoc`、`toSitemapLastmod` | XML 转义闭合；URL 编码后可解码回原值；非法日期省略 lastmod |
| 增量指纹 | `stableSerialize`/`hashContent`/`pageCacheKey` | 相同输入同哈希；键序不影响；nonce 归一化 |
| wiki/双语/导出 | `resolveWikiLinks`、`md-export`、双语文案回退 | 未知目标按模式降级；导出路径不出 `dist/md/**`；文案回退链稳定 |

### T3：恶意场景 fuzz（10 类，hard-fail/degrade）

**进度：待推进（T2 批 B 已先行落地，其中 XML/编码类缺陷的修复与回归已随批 B 完成，但恶意场景载荷消费与 hard-fail/degrade 策略断言仍待本 T3 波次）。**

- 逐条消费 `test-payloads.js` 的载荷，按 `policy` 断言：hard-fail 类必须被预校验/消毒/抛错拒绝，degrade 类必须不崩溃且留下告警。
- 重点补测：保留 slug（`tags`/`categories`/`assets`）与生成目录的冲突、JSON-LD 注入出口、`%2e%2e` 双重编码、Windows 保留名、孤立代理与非法 UTF-8、损坏媒体降级、原子写失败传播。
- 回归：`safeSlug` 孤立代理（T1 已修）必须保留专门用例。

### T4：冒烟增强（构建 + 浏览器）

- 构建冒烟扩展：临时站点夹具 + `--features-override` 多态构建（空站/坏配置/超长标题/带媒体），断言 hard-fail 阻断与 degrade 告警。
- 浏览器冒烟扩展：在 `smoke-web.js` 上增加交互断言（搜索输入、主题切换、省流、双语、软导航链），保持「0 控制台错误」硬门槛。
- STRESS=1 时启用海量夹具（数百文章、超长正文），验证构建时长与内存不失控。

### T5：CI 加固与夜间消费

- 夜间失败留档的聚合消费（失败即产出可下载工件；本波已上传 `test-artifacts`）。
- 覆盖率阈值随 T2–T4 覆盖提升后再评估上调；下调需在 CHANGELOG 记录理由。
- 文档收尾：本计划、README、architecture、CHANGELOG 与实现保持同步。

## 5. 预算与运行基线

### 本地与 CI 同强度命令集合

```bash
npm run test:all
# = npm test + npm run test:build + npm run test:fuzz + npm run test:smoke + npm run test:cov-web（串行）
```

| 步骤 | 说明 | 本地实测（T1，热缓存） |
|---|---|---|
| `npm test` | 单元测试（894 项 / 130 组，含既有全部用例；fuzz 文件默认排除） | 约 13–16 s |
| `npm run test:build` | 构建管线集成冒烟（临时目录两态 + 坏文章阻断） | 约 2–3 min |
| `npm run test:fuzz` | 属性测试（fast-check；默认 `FC_NUM_RUNS=100`；T2 批 A 后 4 套件 / 60 用例） | 约 1.1 s |
| `npm run test:smoke` | 浏览器冒烟（Chrome；dist 缺失时自建） | 新建约 1–2 min；复用 dist 约 30 s |
| `npm run test:cov-web` | 覆盖率采集（no-bundle + 压缩关闭构建 + 两遍页面集合；产物新鲜时复用） | 冷构建约 3–4 min；热约 1.5 min |

- **时长目标**：`test:all` 冷启动 ≤ 10 分钟、热缓存 ≤ 6 分钟；夜间深度档 ≤ 40 分钟（超时上限 90 分钟）。
- **无 Chrome 环境**：`test:smoke` 与 `test:cov-web` 打印 `[SKIP]` 后 exit 0（与 `verify:compression` 同一降级语义），其余步骤不受影响。

### 夜间深度档差异（`.github/workflows/nightly.yml`）

| 维度 | 本地 / PR（deploy.yml） | 夜间（nightly.yml） |
|---|---|---|
| 迭代次数 | `FC_NUM_RUNS` 默认 100 | `FC_NUM_RUNS=2000` |
| 超大/海量用例 | 关闭（`STRESS` 未设） | `STRESS=1` |
| 随机种子 | 每次运行随机（打印 32 位种子） | 每次运行随机（不设 `TEST_SEED`） |
| 命令 | `npm run test:all` | `npm run test:all`（同命令） |
| 触发 | push / PR | `cron: 0 18 * * *`（UTC 18:00）+ `workflow_dispatch` |
| 工件 | `test-artifacts`（`build-artifacts/**`） | `nightly-test-artifacts`（失败留档 / 覆盖率 / 冒烟摘要） |

## 6. 失败复现手册（对所有 T 生效）

1. 从失败输出的 `[test-seed]` 行或 `build-artifacts/fuzz-failures/*.json` 取 `seed` 与 `counterexample`。
2. 重放：`TEST_SEED=<seed> FC_NUM_RUNS=<runs> npm run test:fuzz`（PowerShell：`$env:TEST_SEED='<seed>'; $env:FC_NUM_RUNS='<runs>'; npm run test:fuzz`）。
3. 最小复现应固化为新的确定性用例（红-绿-重构），并保留原留档 JSON 作为证据。

## 7. 遗留与风险

- 保留 slug（`tags`/`categories`/`assets`/`search`）目前无预校验，与生成目录冲突属已知风险（T3 处理；处理前不得弱化断言）。
- `date: 2026/01/01` 依赖 V8 宽松解析、闰秒按 ECMAScript 进位——属兼容路径，不得顺手改为 hard-fail。
- `test:cov-web` 依赖 no-bundle + 压缩关闭产物：若未来取消 `--no-bundle`/`--compression-override`，URL→源码映射与行粒度将失效，需同步改造（sourcemap 方案）。
- 磁盘写失败（ENOSPC）无法在本机真实复现，T3 以注入错误码/只读目标模拟，断言错误传播与告警可见性。
