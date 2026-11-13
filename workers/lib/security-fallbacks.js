// 安全兜底常量单点事实源：构建期 scripts/generate-security-config.js（缺字段默认值）与
// 运行时 workers/security-worker.js（security-config.js 缺失/缺字段时的 FALLBACK）共用，
// 两处值必须一致，禁止在任一文件另写字面量。
// workers/ 为 ESM 包（workers/package.json: type=module）：本文件用 ESM 具名导出，
// Node 端（>=20.19）通过 require() 读取同一份模块。

export const RATE_LIMIT_FALLBACKS = Object.freeze({
  maxRequests: 100,
  windowMs: 60000,
  blockDuration: 300000,
  maxTrackedEntries: 5000
});

export const MAINTENANCE_FALLBACKS = Object.freeze({
  // 审查 R-33 接线：features.maintenance.enabled 此前零消费（只有 serve --maintenance 与 Worker
  // 环境变量 MAINTENANCE=1 生效）。缺失/未生成配置时默认 false —— 兜底绝不能把站点推进维护态；
  // 环境变量仍是独立开关，Worker 侧对两者取或。
  enabled: false,
  // 审查 R-33 接线：message/messageEn/status 同样此前零消费。空串 = 未配置，运行时回退到内置
  // 中/英默认文案 —— 保证 security-config.js 缺失时维护页与今天的输出逐字一致。
  message: "",
  messageEn: "",
  status: 503,
  setRetryAfter: true,
  retryAfter: 3600
});

export const CSP_REPORT_MAX_BYTES = 16384;
