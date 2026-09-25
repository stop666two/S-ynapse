# 性能基线记录

> 由 `scripts/perf-audit.js` 生成；重跑同一命令会覆盖本文件。

## 采样信息

| 项 | 值 |
| --- | --- |
| 生成时间（UTC） | 2026-09-25T13:25:48.091Z |
| 目标 URL | https://blog.stop666.dpdns.org/zh/ |
| 命令行 | `node scripts/perf-audit.js --url https://blog.stop666.dpdns.org/zh/ --runs 1 --out docs/perf-baseline.md --json C:\Users\Administrator\AppData\Local\Temp\opencode\perf-baseline.json` |
| 运行环境 | C:/Program Files/Google/Chrome/Application/chrome.exe（Chrome/153.0.8010.37） |
| 网络条件 | Slow 4G：下行 1.6 Mbps / 上行 750 kbps / RTT 150ms |
| CPU 节流 | 4x |
| 缓存 | 禁用（独立上下文 + `setCacheEnabled(false)`） |
| 视口 | 1440×900 @1x |
| 运行次数 | 1（成功 1） |

## 指标

| 运行 | LCP(ms) | CLS | 交互最大时长(ms)（INP 代理） | TBT(ms)（长任务总时长代理） | HTML 传输字节 | 总传输字节 | 请求数 | 长任务数 | LCP 元素 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 4924 | 0.0000 | 0 | 198 | 26607 | 221111 | 51 | 2 | a |
| **中位数** | 4924 | 0.0000 | 0 | 198 | 26607 | 221111 | 51 | - | - |

## 说明与局限

- **INP 为代理值**：取 `event` 条目最大 `duration`（仅统计 ≥16ms 的事件），非官方 INP（缺少 98 分位与交互次数口径），仅用于同口径回归对比。
- **TBT 为代理值**：longtask 总时长，未按官方 TBT 定义扣除 50ms 与 FCP 前区间。
- 交互动作优先点击 `#themeToggle`，其次 `.dark-toggle`，再退化为首个可见 `nav a`（阻止默认跳转以保留采集状态）。
- 单次采样受生产网络与服务端波动影响；正式基线建议 `--runs 3` 取中位数。
- 待补：本地环境基线与 3 次运行中位数（当前成功 1 次；建议以 `--runs 3` 复测）。
