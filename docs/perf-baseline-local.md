# 性能基线记录

> 由 `scripts/perf-audit.js` 生成；重跑同一命令会覆盖本文件。

## 采样信息

| 项 | 值 |
| --- | --- |
| 生成时间（UTC） | 2026-10-01T10:42:48.549Z |
| 目标 URL | http://localhost:3312/zh/ |
| 命令行 | `node scripts/perf-audit.js --url http://localhost:3312/zh/ --runs 5 --out docs/perf-baseline-local.md` |
| 运行环境 | C:/Program Files/Google/Chrome/Application/chrome.exe（Chrome/153.0.8010.37） |
| 网络条件 | Slow 4G：下行 1.6 Mbps / 上行 750 kbps / RTT 150ms |
| CPU 节流 | 4x |
| 缓存 | 禁用（独立上下文 + `setCacheEnabled(false)`） |
| 视口 | 1440×900 @1x |
| 运行次数 | 5（成功 5） |

## 指标

| 运行 | LCP(ms) | CLS | 交互最大时长(ms)（INP 代理） | TBT(ms)（长任务总时长代理） | HTML 传输字节 | 总传输字节 | 请求数 | 长任务数 | LCP 元素 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 1704 | 0.0017 | 0 | 226 | 23241 | 1288916 | 36 | 3 | img.post-card-image |
| 2 | 920 | 0.0131 | 0 | 238 | 23241 | 1288916 | 36 | 3 | img.post-card-image |
| 3 | 1240 | 0.0024 | 0 | 252 | 23241 | 1288916 | 36 | 3 | img.post-card-image |
| 4 | 1060 | 0.0018 | 0 | 232 | 23241 | 1288916 | 36 | 3 | img.post-card-image |
| 5 | 908 | 0.0018 | 0 | 340 | 23241 | 1288916 | 36 | 4 | img.post-card-image |
| **中位数** | 1060 | 0.0018 | 0 | 238 | 23241 | 1288916 | 36 | - | - |

## LCP 元素与分相

| 运行 | 元素 | 类型 | 内容摘要 | TTFB(ms) | 资源加载延迟(ms) | 资源加载时长(ms) | 渲染延迟(ms) | FCP(ms) |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | img.post-card-image | img | http://localhost:3312/media/test-photo-1-640.53b36a7a57.jpg | 7 | 222 | 255 | 1220 | 1256 |
| 2 | img.post-card-image | img | http://localhost:3312/media/test-photo-1-640.53b36a7a57.jpg | 6 | 238 | 269 | 407 | 304 |
| 3 | img.post-card-image | img | http://localhost:3312/media/test-photo-1-640.53b36a7a57.jpg | 4 | 232 | 267 | 737 | 444 |
| 4 | img.post-card-image | img | http://localhost:3312/media/test-photo-1-640.53b36a7a57.jpg | 4 | 211 | 253 | 592 | 360 |
| 5 | img.post-card-image | img | http://localhost:3312/media/test-photo-1-640.53b36a7a57.jpg | 6 | 242 | 283 | 377 | 324 |
| **中位数** | - | - | - | 6 | 232 | 267 | 592 | 360 |

## render-blocking 资源（第 5 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 |
| --- | --- | ---: | ---: | ---: |
| /assets/js/runtime.53b78c047b.js | script | 320 | 228 | 2758 |

## 首屏请求（≤FCP，第 5 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 | 阻塞 |
| --- | --- | ---: | ---: | ---: | --- |
| /assets/css/site.9a8ee147e2.css | link | 245 | 614 | 28391 | non-blocking |
| /media/test-photo-1-640.53b36a7a57.jpg | link | 248 | 283 | 7176 | non-blocking |
| /assets/vendor/fonts/fonts.css | link | 254 | 184 | 468 | non-blocking |
| /assets/css/cjk-fonts.css?v=2446299e7f | link | 258 | 630 | 31948 | non-blocking |
| /assets/js/runtime.53b78c047b.js | script | 320 | 228 | 2758 | blocking |
| /assets/js/app.IPXB6LFR.js | script | 322 | 521 | 21520 | non-blocking |

> LCP 命中资源：`/media/test-photo-1-640.53b36a7a57.jpg`（传输 7176 字节，总时长 283ms，优先级 n/a）

## 说明与局限

- **LCP 分相口径**：TTFB 取 navigation `responseStart`；图片取命中的 `PerformanceResourceTiming` 条目——资源加载延迟 = `res.startTime − responseStart`，资源加载时长 = `res.duration`，渲染延迟 = `lcp.renderTime − res.responseEnd`；文本元素加载延迟/时长为 0，渲染延迟 = `lcp.renderTime − responseStart`。负值归零；资源条目缺失时退化为「渲染延迟 = renderTime − responseStart」。
- **render-blocking 判定**：取 `PerformanceResourceTiming.renderBlockingStatus === "blocking"`（Chrome 107+）；旧版浏览器回退为 `"unknown"` 并以空清单呈现。
- **首屏请求**：`startTime ≤ FCP` 的资源（未取到 FCP 时退化为 2000ms 窗口），按开始时间排序展示关键渲染路径。
- **INP 为代理值**：取 `event` 条目最大 `duration`（仅统计 ≥16ms 的事件），非官方 INP（缺少 98 分位与交互次数口径），仅用于同口径回归对比。
- **TBT 为代理值**：longtask 总时长，未按官方 TBT 定义扣除 50ms 与 FCP 前区间。
- 交互动作优先点击 `#themeToggle`，其次 `.dark-toggle`，再退化为首个可见 `nav a`（阻止默认跳转以保留采集状态）。
- 单次采样受生产网络与服务端波动影响；正式基线建议 `--runs 3` 取中位数。

## 治理前后对照（关键 CSS 内联专项）

> 上表由 `scripts/perf-audit.js` 生成（会覆盖本文件）；本节为手工补充的对照记录。
> 口径一致：本机 Slow4G（200KB/s、RTT 150ms）+ 4× CPU + 禁缓存 + 1440×900，`build --serve`
> 本地 gzip 服务，`/zh/` 首页，5 次取中位。

| 指标 | 治理前（round 1） | 治理后（本次） | 说明 |
| --- | ---: | ---: | --- |
| LCP 中位 | 1684ms | **1060ms** | 安静会话 652–908ms；繁忙会话最高 1520ms（见下方波动说明） |
| FCP 中位 | 1468ms | **360ms** | 关键样式内联后首个渲染帧不再等待样式网络往返 |
| LCP 分相（中位） | TTFB 4 / 延迟 180 / 时长 270 / 渲染 1226 | TTFB 6 / 延迟 232 / 时长 267 / 渲染 592 | 渲染延迟 −634ms |
| CLS 中位 | 0.0017 | 0.0018 | ≤0.05 达标（亚像素级） |
| HTML 传输字节（单页 gzip 最大） | 13824 | 23241 | +9417B：关键样式内联的已知代价 |
| render-blocking 资源 | fonts.css + site.css（28.4KB gzip） | 仅 runtime.js（2.8KB） | 样式阻塞请求清零 |
| 首屏阻塞字节（gzip 口径） | 13.8KB HTML + 28.4KB CSS ≈ 42.2KB | 22.5KB HTML + 0 ≈ 22.5KB | **−19.7KB** |

实现要点：
- 构建期由 `scripts/lib/critical-css.js` 从压缩后的全量样式抽取首屏规则（主题/暗色变量、重置与排版基座、
  页头导航、公告条、英雄区、首屏卡片与叠层、文章头与正文基础排版、目录列、侧栏挂件、阅读进度、移动底栏、
  加载遮罩），选择器白名单 + 变量引用闭包裁剪 + `@keyframes` 引用判定；解析异常自动回退全量阻塞样式。
- 关键 `<style>` 与主样式 `<link rel=preload as=style>` 置于 `<head>` 最前；主样式与本地字体声明以
  `media="print"` 异步应用，nonce 内联脚本就绪后翻回 `media="all"`，`<noscript>` 链接兜底无 JS。

FOUC / 无 JS / 回归验证（`.tmp-scripts/run-critical-css.js`，本轮 12 断言全过）：
- 中止全量 CSS 后比较「仅关键 CSS」与「全量 CSS」首屏 computedStyle + 几何：首页/文章页 0 差异
  （唯一 1.05px 卡片高度差来自阻断字体文件时的字形度量，未阻断换行，记为亚像素容差）。
- 全量 CSS 延迟 2s：400ms 首帧截图与全量到达后截图落盘（`.tmp-scripts/out/cc-first-frame-400ms.png`）。
- 禁用 JS：`<noscript>` 全量样式以 `media=all` 生效，首屏计算样式与正常态一致（0 差异）。
- 390×844 移动端仅关键 CSS：汉堡菜单显示、桌面导航隐藏、移动底栏显示（媒体查询生效）。
- 暗色切换（`html[data-theme=dark]` + 首屏背景变化）、软导航（URL 与主容器交换、0 控制台错误）。
- 端口释放校验（`PORT_3312_LISTENING=false`）。

预算处置（数据论证）：首屏阻塞字节由 ≈42.2KB 降至 ≈22.5KB（gzip），但 HTML 总量因内联每页增加
≈+9KB gzip / +37KB raw（重复导航重验 HTML 同样携带）。按实测将 `features.perfBudget.htmlKb`
40→45（实测最大 43.9KB）、`htmlRawKb` 50→85（实测中位 79.5KB）；`criticalCss` 关闭时旧口径仍有
原余量。`criticalCss` 默认关闭，示例站启用。

残余与波动说明：
- 会话间呈双峰：图片与关键样式先绘制时 LCP ≈0.6–0.9s；若主线程先被全量 CSS 解析/应用与 app 启动
  占用，LCP 落在 1.2–1.5s（4× CPU 放大固定样式/脚本解析成本）。本轮最终记录会话中位 1060ms。
- 进一步下探不属样式范畴：全量 CSS（141KB raw）解析与应用、CJK 子集 CSS（91KB raw）解析、
  app.js（~70KB raw）执行在 4× CPU 下共同占用主线程；如需稳定 1s 内，需在前端脚本启动链
  （配置外置拉取时机、boot 遮罩、imageFit 运行时代码）与 CSS 拆分/裁剪上另立专项。
- 生产建议复测：`/zh/` 与 `/en/` 各 ≥5 次官方口径 LCP/分相；确认 `/zh/` 无缓存首访
  `renderBlocking` 清单不含样式；暗色与软导航回归；侧栏/目录列在慢网下无可见跳动。
