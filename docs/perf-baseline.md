# 性能基线记录

> 由 `scripts/perf-audit.js` 生成；重跑同一命令会覆盖本文件。

## 采样信息

| 项 | 值 |
| --- | --- |
| 生成时间（UTC） | 2026-09-25T13:27:45.005Z |
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
| 1 | 3932 | 0.0000 | 0 | 375 | 26602 | 221188 | 51 | 3 | a |
| 2 | 2476 | 0.0000 | 0 | 354 | 26611 | 207700 | 41 | 2 | a |
| 3 | 2324 | 0.0000 | 0 | 155 | 26600 | 206411 | 40 | 1 | a |
| **中位数** | 2476 | 0.0000 | 0 | 354 | 26602 | 207700 | 41 | - | - |

## 说明与局限

- **INP 为代理值**：取 `event` 条目最大 `duration`（仅统计 ≥16ms 的事件），非官方 INP（缺少 98 分位与交互次数口径），仅用于同口径回归对比。
- **TBT 为代理值**：longtask 总时长，未按官方 TBT 定义扣除 50ms 与 FCP 前区间。
- 交互动作优先点击 `#themeToggle`，其次 `.dark-toggle`，再退化为首个可见 `nav a`（阻止默认跳转以保留采集状态）。
- 单次采样受生产网络与服务端波动影响；正式基线建议 `--runs 3` 取中位数。
