# 进程卫生：任何命令都必须能自行结束

## 背景

自动化运行（AI 代理、CI、脚本）中的长命令一旦派生出子进程（浏览器、本地服务、watch 进程），
在异常路径上容易出现“父脚本已结束但句柄未释放、进程永不退出”的挂死，进而占用端口、堆积进程树。

## 强制规则

1. **自动化一律使用受控运行器**：
   ```
   node scripts/spawn.js [--max-ms <毫秒>] [--log <输出文件>] -- <命令> [参数...]
   ```
   - 为子进程注入进程守卫（`SYNAPSE_GUARD=1` / `SYNAPSE_MAX_MS` / `SYNAPSE_PARENT_PID`）；
   - 超时（默认 15 分钟，`--max-ms` 可调，0=不限时）或收到信号时，清理**整棵进程树**；
   - 超时退出码 `124`，正常透传子进程退出码；stdin 置空，杜绝“等待输入”型挂起。
2. **禁止脱离监管的启动方式**：不得使用 `Start-Process`、`--detach`、后台窗口等方式让命令脱离控制；
   必须让运行器前台等待并持有超时。
3. **仓库入口接入守卫**：`scripts/**` 中会创建服务、浏览器、子进程或定时器的高风险入口，
   必须在文件顶部 `require` 进程守卫（`scripts/lib/process-guard.js`），
   或在同文件标注 `// process-guard: exempt <理由>`；由 `npm run verify:process-guards` 巡检并在 CI 聚合中阻断。
4. **runner 脚本模板**：`.tmp-scripts/run-*.js` 等一次性脚本必须满足两者之一：
   - 由 `scripts/spawn.js` 启动（推荐，环境自动注入）；或
   - 顶部 `require('../scripts/lib/process-guard.js')`，并在 `finally` 中调用 `guard.done()` 结束。

## 守卫行为

| 触发条件 | 行为 | 退出码 |
|---|---|---|
| 超过 `SYNAPSE_MAX_MS` | 清理后代进程并退出 | 87 |
| 父进程消失（每 2s 检测） | 清理后代进程并退出 | 86 |
| 收到 SIGINT/SIGTERM/SIGHUP | 清理后代进程并退出 | 130/143 |
| 未设置守卫环境 | 完全不干预（人工运行不受影响） | 原样 |

## 自检与清理

- 巡检：`npm run verify:process-guards`
- 残留清理：`node .tmp-scripts/kill-orphans.js`（项目作用域，默认执行；`--dry-run` 仅列出）
- 查看端口占用：`Get-NetTCPConnection -LocalPort <端口>`（Windows）
