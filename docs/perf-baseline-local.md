# 性能基线记录

> 由 `scripts/perf-audit.js` 生成；重跑同一命令会覆盖本文件。

## 采样信息

| 项 | 值 |
| --- | --- |
| 生成时间（UTC） | 2026-09-25T14:51:00.619Z |
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
| 1 | 2416 | 0.0000 | 0 | 0 | 45635 | 435374 | 14 | 0 | img.post-card-image.motion-reveal |
| 2 | 2624 | 0.0000 | 0 | 85 | 45635 | 435374 | 14 | 1 | img.post-card-image |
| 3 | 2956 | 0.0000 | 0 | 194 | 45635 | 435374 | 14 | 2 | img.post-card-image |
| **中位数** | 2624 | 0.0000 | 0 | 85 | 45635 | 435374 | 14 | - | - |

## 说明与局限

- **INP 为代理值**：取 `event` 条目最大 `duration`（仅统计 ≥16ms 的事件），非官方 INP（缺少 98 分位与交互次数口径），仅用于同口径回归对比。
- **TBT 为代理值**：longtask 总时长，未按官方 TBT 定义扣除 50ms 与 FCP 前区间。
- 交互动作优先点击 `#themeToggle`，其次 `.dark-toggle`，再退化为首个可见 `nav a`（阻止默认跳转以保留采集状态）。
- 单次采样受生产网络与服务端波动影响；正式基线建议 `--runs 3` 取中位数。
