# 性能基线记录

> 由 `scripts/perf-audit.js` 生成；重跑同一命令会覆盖本文件。

## 采样信息

| 项 | 值 |
| --- | --- |
| 生成时间（UTC） | 2026-10-01T09:52:13.941Z |
| 目标 URL | http://localhost:3311/zh/ |
| 命令行 | `node scripts/perf-audit.js --url http://localhost:3311/zh/ --runs 5 --out docs/perf-baseline-local.md` |
| 运行环境 | C:/Program Files/Google/Chrome/Application/chrome.exe（Chrome/153.0.8010.37） |
| 网络条件 | Slow 4G：下行 1.6 Mbps / 上行 750 kbps / RTT 150ms |
| CPU 节流 | 4x |
| 缓存 | 禁用（独立上下文 + `setCacheEnabled(false)`） |
| 视口 | 1440×900 @1x |
| 运行次数 | 5（成功 5） |

## 指标

| 运行 | LCP(ms) | CLS | 交互最大时长(ms)（INP 代理） | TBT(ms)（长任务总时长代理） | HTML 传输字节 | 总传输字节 | 请求数 | 长任务数 | LCP 元素 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2132 | 0.0017 | 0 | 216 | 13824 | 1288916 | 36 | 3 | img.post-card-image |
| 2 | 1684 | 0.0017 | 0 | 328 | 13824 | 1288916 | 36 | 4 | img.post-card-image |
| 3 | 1724 | 0.0017 | 0 | 224 | 13824 | 1288916 | 36 | 4 | img.post-card-image |
| 4 | 1672 | 0.0017 | 0 | 336 | 13824 | 1288916 | 36 | 4 | img.post-card-image |
| 5 | 1668 | 0.0017 | 0 | 328 | 13824 | 1288916 | 36 | 4 | img.post-card-image |
| **中位数** | 1684 | 0.0017 | 0 | 328 | 13824 | 1288916 | 36 | - | - |

## LCP 元素与分相

| 运行 | 元素 | 类型 | 内容摘要 | TTFB(ms) | 资源加载延迟(ms) | 资源加载时长(ms) | 渲染延迟(ms) | FCP(ms) |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | img.post-card-image | img | http://localhost:3311/media/test-photo-1-640.53b36a7a57.jpg | 110 | 97 | 273 | 1652 | 1948 |
| 2 | img.post-card-image | img | http://localhost:3311/media/test-photo-1-640.53b36a7a57.jpg | 7 | 185 | 270 | 1223 | 1120 |
| 3 | img.post-card-image | img | http://localhost:3311/media/test-photo-1-640.53b36a7a57.jpg | 4 | 180 | 277 | 1263 | 1308 |
| 4 | img.post-card-image | img | http://localhost:3311/media/test-photo-1-640.53b36a7a57.jpg | 4 | 187 | 265 | 1217 | 1656 |
| 5 | img.post-card-image | img | http://localhost:3311/media/test-photo-1-640.53b36a7a57.jpg | 4 | 177 | 261 | 1226 | 1468 |
| **中位数** | - | - | - | 4 | 180 | 270 | 1226 | 1468 |

## render-blocking 资源（第 5 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 |
| --- | --- | ---: | ---: | ---: |
| /assets/vendor/fonts/fonts.css | link | 181 | 183 | 468 |
| /assets/css/site.9a8ee147e2.css | link | 181 | 481 | 28391 |

## 首屏请求（≤FCP，第 5 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 | 阻塞 |
| --- | --- | ---: | ---: | ---: | --- |
| /assets/vendor/fonts/fonts.css | link | 181 | 183 | 468 | blocking |
| /media/test-photo-1-640.53b36a7a57.jpg | link | 181 | 261 | 7176 | non-blocking |
| /assets/css/site.9a8ee147e2.css | link | 181 | 481 | 28391 | blocking |
| /assets/css/cjk-fonts.css?v=2446299e7f | link | 188 | 878 | 31948 | non-blocking |
| /assets/js/runtime.53b78c047b.js | script | 241 | 186 | 2758 | non-blocking |
| /assets/js/app.IPXB6LFR.js | script | 242 | 405 | 21520 | non-blocking |
| /assets/vendor/fonts/inter-latin-wght-normal.woff2 | css | 711 | 509 | 48556 | non-blocking |
| /media/test-photo-2-640.7585193eb6.png | img | 1433 | 1205 | 43994 | non-blocking |
| /media/test-photo-3-640.webp | img | 1433 | 327 | 7575 | non-blocking |
| /media/test-photo-5-large-640.7711019e76.jpg | img | 1433 | 358 | 10315 | non-blocking |
| /assets/config.6e64bac289.json | fetch | 1438 | 870 | 31385 | non-blocking |

> LCP 命中资源：`/media/test-photo-1-640.53b36a7a57.jpg`（传输 7176 字节，总时长 261ms，优先级 n/a）

## 说明与局限

- **LCP 分相口径**：TTFB 取 navigation `responseStart`；图片取命中的 `PerformanceResourceTiming` 条目——资源加载延迟 = `res.startTime − responseStart`，资源加载时长 = `res.duration`，渲染延迟 = `lcp.renderTime − res.responseEnd`；文本元素加载延迟/时长为 0，渲染延迟 = `lcp.renderTime − responseStart`。负值归零；资源条目缺失时退化为「渲染延迟 = renderTime − responseStart」。
- **render-blocking 判定**：取 `PerformanceResourceTiming.renderBlockingStatus === "blocking"`（Chrome 107+）；旧版浏览器回退为 `"unknown"` 并以空清单呈现。
- **首屏请求**：`startTime ≤ FCP` 的资源（未取到 FCP 时退化为 2000ms 窗口），按开始时间排序展示关键渲染路径。
- **INP 为代理值**：取 `event` 条目最大 `duration`（仅统计 ≥16ms 的事件），非官方 INP（缺少 98 分位与交互次数口径），仅用于同口径回归对比。
- **TBT 为代理值**：longtask 总时长，未按官方 TBT 定义扣除 50ms 与 FCP 前区间。
- 交互动作优先点击 `#themeToggle`，其次 `.dark-toggle`，再退化为首个可见 `nav a`（阻止默认跳转以保留采集状态）。
- 单次采样受生产网络与服务端波动影响；正式基线建议 `--runs 3` 取中位数。

## 治理前后对照（LCP 渲染延迟专项）

> 下列数据为本次专项实测；上表由 `scripts/perf-audit.js` 生成，重跑会覆盖本文件（本节为手工补充的对照记录）。

| 口径 | 治理前 | 治理后 | 说明 |
| --- | ---: | ---: | --- |
| 官方审计 LCP 中位（本机 Slow4G + 4× CPU + 禁缓存） | 2272ms（3 次） | 1684ms（5 次） | 不同会话；单次受本机负载影响，观察簇 1668–1724ms |
| 同会话交错 A/B LCP 中位（6 轮，旧/新构建各 6 次交替） | 2064ms | 1738ms | `.tmp-scripts/ab-lcp.js`，两端口同语义 gzip 静态服务 |
| LCP 命中资源与加载时长 | `test-photo-1` 1600w 原图 / 539ms | `test-photo-1-640` 640w 变体 / 270ms | `imagesrcset`/`imagesizes` 预载对齐卡片实际候选 |
| 传输总字节 | 1384888 | 1302763 | 离屏图片不再于首屏下载 |
| LCP 分相：渲染延迟 | 1554ms（早期基线） | 1226ms | 余量由首屏样式/布局与字体换排构成 |

### 残余地板与生产复测建议

- **地板构成（trace 证据）**：Slow 4G 下渲染阻塞 `site.<hash>.css`（28.4KB gzip）于 ~690ms 完成（已 `fetchpriority=high`）→ 4× CPU 首个样式+布局 250–570ms → 拉丁字体换排 ~200–300ms、CJK CSS 解析 ~80–170ms → 首图绘制 ~1.67–1.74s。CPU 1× 同构建实测 LCP 1136ms（≤1.2s），说明目标差额来自 4× 节流对上述 CPU 工作的放大。
- **不可消除项**：`site.css` 的慢网传输时长（内容寻址 + 已 gzip）与首屏样式/布局的固有 CPU 成本；进一步下探需要「关键 CSS 内联/拆分 + 非关键 CSS 异步」改造（涉及 FOUC 风险与新验证矩阵），不在本专项最小修复范围。
- **部署后生产复测项**：①`/zh/` 与 `/en/` 各 ≥3 次官方口径 LCP 与分相（目标 ≤2.5s）；②确认 LCP 命中 `-640` 变体（而非 1600w 原图）；③滚动到底部观察 `offscreenSkip` 区域渲染无可见跳动（CLS 增量 ≤0.05，本地基线 0.0002）；④首访（无缓存）拉丁字形自系统字体→Inter 的切换仍发生在 DOMContentLoaded 之前（优先级校准不影响字体时序）。
