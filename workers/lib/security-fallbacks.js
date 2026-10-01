// 安全兜底常量单点事实源：构建期 scripts/generate-security-config.js（缺字段默认值）与
// 运行时 workers/security-worker.js（security-config.js 缺失/缺字段时的 FALLBACK）共用，
// 两处值必须一致，禁止在任一文件另写字面量。
// workers/ 为 ESM 包（workers/package.json: type=module）：本文件用 ESM 具名导出，
// Node 端（>=20.19）通过 require() 读取同一份模块。

export const RATE_LIMIT_FALLBACKS = Object.freeze({
  maxRequests: 100,
  windowMs: 60000,
  blockDuration: 300000
});

export const MAINTENANCE_FALLBACKS = Object.freeze({
  setRetryAfter: true,
  retryAfter: 3600
});

export const CSP_REPORT_MAX_BYTES = 16384;
