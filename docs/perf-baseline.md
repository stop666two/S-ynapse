# 性能基线记录

> 由 `scripts/perf-audit.js` 生成；重跑同一命令会覆盖本文件。

## 采样信息

| 项 | 值 |
| --- | --- |
| 生成时间（UTC） | 2026-10-01T08:46:41.041Z |
| 目标 URL | https://blog.stop666.dpdns.org/zh/ |
| 命令行 | `node scripts/perf-audit.js --url https://blog.stop666.dpdns.org/zh/ --runs 3 --out docs/perf-baseline.md` |
| 运行环境 | C:/Program Files/Google/Chrome/Application/chrome.exe（Chrome/153.0.8010.37） |
| 网络条件 | Slow 4G：下行 1.6 Mbps / 上行 750 kbps / RTT 150ms |
| CPU 节流 | 4x |
| 缓存 | 禁用（独立上下文 + `setCacheEnabled(false)`） |
| 视口 | 1440×900 @1x |
| 运行次数 | 3（成功 3） |

## 指标

| 运行 | LCP(ms) | CLS | 交互最大时长(ms)（INP 代理） | TBT(ms)（长任务总时长代理） | HTML 传输字节 | 总传输字节 | 请求数 | 长任务数 | LCP 元素 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 3316 | 0.0003 | 0 | 212 | 11763 | 998859 | 31 | 2 | img.post-card-image.motion-reveal |
| 2 | 3456 | 0.0003 | 0 | 719 | 11763 | 998830 | 31 | 7 | img.post-card-image |
| 3 | 2920 | 0.0003 | 0 | 482 | 11764 | 999006 | 31 | 4 | img.post-card-image |
| **中位数** | 3316 | 0.0003 | 0 | 482 | 11763 | 998859 | 31 | - | - |

## LCP 元素与分相

| 运行 | 元素 | 类型 | 内容摘要 | TTFB(ms) | 资源加载延迟(ms) | 资源加载时长(ms) | 渲染延迟(ms) | FCP(ms) |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | img.post-card-image.motion-reveal | img | https://blog.stop666.dpdns.org/og/cover-s-textpaste.4e2221a9.webp | 1219 | 99 | 745 | 1254 | 3300 |
| 2 | img.post-card-image | img | https://blog.stop666.dpdns.org/og/cover-s-textpaste.4e2221a9.webp | 1264 | 83 | 806 | 1303 | 3420 |
| 3 | img.post-card-image | img | https://blog.stop666.dpdns.org/og/cover-s-textpaste.4e2221a9.webp | 761 | 84 | 742 | 1333 | 2620 |
| **中位数** | - | - | - | 1219 | 84 | 745 | 1303 | 3300 |

## render-blocking 资源（第 3 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 |
| --- | --- | ---: | ---: | ---: |
| /assets/vendor/fonts/fonts.css | link | 844 | 254 | 460 |
| /assets/css/site.795b0e3ba5.css | link | 846 | 789 | 31786 |

## 首屏请求（≤FCP，第 3 次运行）

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 | 阻塞 |
| --- | --- | ---: | ---: | ---: | --- |
| /cdn-cgi/speculation | other | 801 | 222 | 451 | non-blocking |
| /assets/vendor/fonts/fonts.css | link | 844 | 254 | 460 | blocking |
| /og/cover-s-textpaste.4e2221a9.webp | link | 845 | 742 | 33312 | non-blocking |
| /assets/css/site.795b0e3ba5.css | link | 846 | 789 | 31786 | blocking |
| /assets/js/runtime.70ea0de001.js | script | 847 | 332 | 2084 | non-blocking |
| /assets/js/app.IPXB6LFR.js | script | 848 | 755 | 23182 | non-blocking |
| /beacon.min.js/v31edd6df95cf4e85bb4c19e7a9bdbcba1788362987495 | script | 848 | 630 | 0 | non-blocking |
| /assets/css/cjk-fonts.css?v=0ef5d08c4c | link | 866 | 1049 | 12718 | non-blocking |
| /assets/vendor/fonts/inter-latin-wght-normal.woff2 | css | 1717 | 478 | 48556 | non-blocking |

> LCP 命中资源：`/og/cover-s-textpaste.4e2221a9.webp`（传输 33312 字节，总时长 742ms，优先级 n/a）

## 说明与局限

- **LCP 分相口径**：TTFB 取 navigation `responseStart`；图片取命中的 `PerformanceResourceTiming` 条目——资源加载延迟 = `res.startTime − responseStart`，资源加载时长 = `res.duration`，渲染延迟 = `lcp.renderTime − res.responseEnd`；文本元素加载延迟/时长为 0，渲染延迟 = `lcp.renderTime − responseStart`。负值归零；资源条目缺失时退化为「渲染延迟 = renderTime − responseStart」。
- **render-blocking 判定**：取 `PerformanceResourceTiming.renderBlockingStatus === "blocking"`（Chrome 107+）；旧版浏览器回退为 `"unknown"` 并以空清单呈现。
- **首屏请求**：`startTime ≤ FCP` 的资源（未取到 FCP 时退化为 2000ms 窗口），按开始时间排序展示关键渲染路径。
- **INP 为代理值**：取 `event` 条目最大 `duration`（仅统计 ≥16ms 的事件），非官方 INP（缺少 98 分位与交互次数口径），仅用于同口径回归对比。
- **TBT 为代理值**：longtask 总时长，未按官方 TBT 定义扣除 50ms 与 FCP 前区间。
- 交互动作优先点击 `#themeToggle`，其次 `.dark-toggle`，再退化为首个可见 `nav a`（阻止默认跳转以保留采集状态）。
- 单次采样受生产网络与服务端波动影响；正式基线建议 `--runs 3` 取中位数。
