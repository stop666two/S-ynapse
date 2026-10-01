# 性能基线记录

> 由 `scripts/perf-audit.js` 生成；重跑同一命令会覆盖本文件。

## 采样信息

| 项 | 值 |
| --- | --- |
| 生成时间（UTC） | 2026-10-01T10:56:20.971Z |
| 目标 URL | https://blog.stop666.dpdns.org/zh/ |
| 命令行 | `node scripts/perf-audit.js --url https://blog.stop666.dpdns.org/zh/ --runs 5 --out docs/perf-baseline.md` |
| 运行环境 | C:/Program Files/Google/Chrome/Application/chrome.exe（Chrome/153.0.8010.37） |
| 网络条件 | Slow 4G：下行 1.6 Mbps / 上行 750 kbps / RTT 150ms |
| CPU 节流 | 4x |
| 缓存 | 禁用（独立上下文 + `setCacheEnabled(false)`） |
| 视口 | 1440×900 @1x |
| 运行次数 | 5（成功 5） |

## 指标

| 运行 | LCP(ms) | CLS | 交互最大时长(ms)（INP 代理） | TBT(ms)（长任务总时长代理） | HTML 传输字节 | 总传输字节 | 请求数 | 长任务数 | LCP 元素 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 7992 | 0.0004 | 0 | 421 | 22026 | 999759 | 31 | 4 | img.post-card-image |
| 2 | 2020 | 0.0004 | 0 | 444 | 22023 | 999783 | 31 | 4 | img.post-card-image |
| 3 | 2100 | 0.0004 | 0 | 477 | 22025 | 999892 | 31 | 4 | img.post-card-image |
| 4 | 3160 | 0.0004 | 0 | 525 | 22024 | 999783 | 31 | 5 | img.post-card-image |
| 5 | 2180 | 0.0004 | 0 | 749 | 22024 | 999692 | 31 | 6 | img.post-card-image |
| **中位数** | 2180 | 0.0004 | 0 | 477 | 22024 | 999783 | 31 | - | - |

## LCP 元素与分相

| 运行 | 元素 | 类型 | 内容摘要 | TTFB(ms) | 资源加载延迟(ms) | 资源加载时长(ms) | 渲染延迟(ms) | FCP(ms) |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | img.post-card-image | img | https://blog.stop666.dpdns.org/og/cover-s-textpaste.4e2221a9.webp | 6998 | 134 | 795 | 66 | 7360 |
| 2 | img.post-card-image | img | https://blog.stop666.dpdns.org/og/cover-s-textpaste.4e2221a9.webp | 820 | 135 | 780 | 286 | 1020 |
| 3 | img.post-card-image | img | https://blog.stop666.dpdns.org/og/cover-s-textpaste.4e2221a9.webp | 877 | 153 | 656 | 414 | 1100 |
| 4 | img.post-card-image | img | https://blog.stop666.dpdns.org/og/cover-s-textpaste.4e2221a9.webp | 1952 | 140 | 855 | 213 | 2160 |
| 5 | img.post-card-image | img | https://blog.stop666.dpdns.org/og/cover-s-textpaste.4e2221a9.webp | 855 | 138 | 851 | 336 | 1080 |
| **中位数** | - | - | - | 877 | 138 | 795 | 286 | 1100 |

## render-blocking 资源（第 5 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 |
| --- | --- | ---: | ---: | ---: |
| /assets/js/runtime.53b78c047b.js | script | 1053 | 367 | 2903 |

## 首屏请求（≤FCP，第 5 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 | 阻塞 |
| --- | --- | ---: | ---: | ---: | --- |
| /cdn-cgi/speculation | other | 892 | 188 | 451 | non-blocking |
| /assets/css/site.9a8ee147e2.css | link | 991 | 618 | 31741 | non-blocking |
| /og/cover-s-textpaste.4e2221a9.webp | link | 993 | 851 | 33312 | non-blocking |
| /assets/vendor/fonts/fonts.css | link | 1006 | 385 | 460 | non-blocking |
| /assets/css/cjk-fonts.css?v=0ef5d08c4c | link | 1009 | 662 | 12654 | non-blocking |
| /assets/js/runtime.53b78c047b.js | script | 1053 | 367 | 2903 | blocking |
| /assets/js/app.IPXB6LFR.js | script | 1054 | 759 | 23182 | non-blocking |
| /beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495 | script | 1054 | 680 | 0 | non-blocking |

> LCP 命中资源：`/og/cover-s-textpaste.4e2221a9.webp`（传输 33312 字节，总时长 851ms，优先级 n/a）

## 说明与局限

- **LCP 分相口径**：TTFB 取 navigation `responseStart`；图片取命中的 `PerformanceResourceTiming` 条目——资源加载延迟 = `res.startTime − responseStart`，资源加载时长 = `res.duration`，渲染延迟 = `lcp.renderTime − res.responseEnd`；文本元素加载延迟/时长为 0，渲染延迟 = `lcp.renderTime − responseStart`。负值归零；资源条目缺失时退化为「渲染延迟 = renderTime − responseStart」。
- **render-blocking 判定**：取 `PerformanceResourceTiming.renderBlockingStatus === "blocking"`（Chrome 107+）；旧版浏览器回退为 `"unknown"` 并以空清单呈现。
- **首屏请求**：`startTime ≤ FCP` 的资源（未取到 FCP 时退化为 2000ms 窗口），按开始时间排序展示关键渲染路径。
- **INP 为代理值**：取 `event` 条目最大 `duration`（仅统计 ≥16ms 的事件），非官方 INP（缺少 98 分位与交互次数口径），仅用于同口径回归对比。
- **TBT 为代理值**：longtask 总时长，未按官方 TBT 定义扣除 50ms 与 FCP 前区间。
- 交互动作优先点击 `#themeToggle`，其次 `.dark-toggle`，再退化为首个可见 `nav a`（阻止默认跳转以保留采集状态）。
- 单次采样受生产网络与服务端波动影响；正式基线建议 `--runs 3` 取中位数。
