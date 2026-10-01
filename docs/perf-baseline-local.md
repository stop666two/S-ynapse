# 性能基线记录

> 由 `scripts/perf-audit.js` 生成；重跑同一命令会覆盖本文件。

## 采样信息

| 项 | 值 |
| --- | --- |
| 生成时间（UTC） | 2026-10-01T08:08:09.968Z |
| 目标 URL | http://localhost:3311/zh/ |
| 命令行 | `node scripts/perf-audit.js --url http://localhost:3311/zh/ --runs 3 --out docs/perf-baseline-local.md` |
| 运行环境 | C:/Program Files/Google/Chrome/Application/chrome.exe（Chrome/153.0.8010.37） |
| 网络条件 | Slow 4G：下行 1.6 Mbps / 上行 750 kbps / RTT 150ms |
| CPU 节流 | 4x |
| 缓存 | 禁用（独立上下文 + `setCacheEnabled(false)`） |
| 视口 | 1440×900 @1x |
| 运行次数 | 3（成功 3） |

## 指标

| 运行 | LCP(ms) | CLS | 交互最大时长(ms)（INP 代理） | TBT(ms)（长任务总时长代理） | HTML 传输字节 | 总传输字节 | 请求数 | 长任务数 | LCP 元素 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2020 | 0.0023 | 0 | 167 | 13807 | 1371879 | 38 | 2 | img.post-card-image.motion-reveal |
| 2 | 2204 | 0.0017 | 0 | 489 | 13807 | 1371879 | 38 | 6 | img.post-card-image |
| 3 | 2196 | 0.0017 | 0 | 358 | 13807 | 1371879 | 38 | 4 | img.post-card-image |
| **中位数** | 2196 | 0.0017 | 0 | 358 | 13807 | 1371879 | 38 | - | - |

## LCP 元素与分相

| 运行 | 元素 | 类型 | 内容摘要 | TTFB(ms) | 资源加载延迟(ms) | 资源加载时长(ms) | 渲染延迟(ms) | FCP(ms) |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | img.post-card-image.motion-reveal | img | http://localhost:3311/media/test-photo-1.e6d80b0b99.jpg | 7 | 183 | 544 | 1286 | 1272 |
| 2 | img.post-card-image | img | http://localhost:3311/media/test-photo-1.e6d80b0b99.jpg | 6 | 178 | 546 | 1474 | 1172 |
| 3 | img.post-card-image | img | http://localhost:3311/media/test-photo-1.e6d80b0b99.jpg | 4 | 190 | 541 | 1461 | 2180 |
| **中位数** | - | - | - | 6 | 183 | 544 | 1461 | 1272 |

## render-blocking 资源（第 3 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 |
| --- | --- | ---: | ---: | ---: |
| /assets/vendor/fonts/fonts.css | link | 194 | 169 | 468 |
| /assets/css/site.795b0e3ba5.css | link | 194 | 589 | 28334 |

## 首屏请求（≤FCP，第 3 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 | 阻塞 |
| --- | --- | ---: | ---: | ---: | --- |
| /assets/vendor/fonts/fonts.css | link | 194 | 169 | 468 | blocking |
| /media/test-photo-1.e6d80b0b99.jpg | link | 194 | 541 | 21722 | non-blocking |
| /assets/css/site.795b0e3ba5.css | link | 194 | 589 | 28334 | blocking |
| /assets/css/cjk-fonts.css?v=2446299e7f | link | 203 | 959 | 31948 | non-blocking |
| /media/test-photo-1-640.53b36a7a57.jpg | img | 203 | 315 | 7176 | non-blocking |
| /assets/js/runtime.53b78c047b.js | script | 238 | 201 | 2758 | non-blocking |
| /assets/js/app.7LEPRERB.js | script | 238 | 529 | 21482 | non-blocking |
| /assets/vendor/fonts/inter-latin-wght-normal.woff2 | css | 862 | 487 | 48556 | non-blocking |
| /media/test-photo-2-640.7585193eb6.png | img | 2164 | 1337 | 43994 | non-blocking |
| /media/test-photo-3-640.webp | img | 2164 | 371 | 7575 | non-blocking |
| /media/test-photo-5-large-640.7711019e76.jpg | img | 2164 | 418 | 10315 | non-blocking |
| /media/avatar.c687352512.svg | img | 2164 | 184 | 525 | non-blocking |
| /assets/config.fd904625b3.json | fetch | 2167 | 978 | 31345 | non-blocking |

> LCP 命中资源：`/media/test-photo-1.e6d80b0b99.jpg`（传输 21722 字节，总时长 541ms，优先级 n/a）

## 说明与局限

- **LCP 分相口径**：TTFB 取 navigation `responseStart`；图片取命中的 `PerformanceResourceTiming` 条目——资源加载延迟 = `res.startTime − responseStart`，资源加载时长 = `res.duration`，渲染延迟 = `lcp.renderTime − res.responseEnd`；文本元素加载延迟/时长为 0，渲染延迟 = `lcp.renderTime − responseStart`。负值归零；资源条目缺失时退化为「渲染延迟 = renderTime − responseStart」。
- **render-blocking 判定**：取 `PerformanceResourceTiming.renderBlockingStatus === "blocking"`（Chrome 107+）；旧版浏览器回退为 `"unknown"` 并以空清单呈现。
- **首屏请求**：`startTime ≤ FCP` 的资源（未取到 FCP 时退化为 2000ms 窗口），按开始时间排序展示关键渲染路径。
- **INP 为代理值**：取 `event` 条目最大 `duration`（仅统计 ≥16ms 的事件），非官方 INP（缺少 98 分位与交互次数口径），仅用于同口径回归对比。
- **TBT 为代理值**：longtask 总时长，未按官方 TBT 定义扣除 50ms 与 FCP 前区间。
- 交互动作优先点击 `#themeToggle`，其次 `.dark-toggle`，再退化为首个可见 `nav a`（阻止默认跳转以保留采集状态）。
- 单次采样受生产网络与服务端波动影响；正式基线建议 `--runs 3` 取中位数。
