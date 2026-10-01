'use strict';

// internals.json5 的默认值与校验 Schema 注册表（工程内部参数唯一事实源）。
// scripts/lib/internals.js 以 DEFAULTS 为基底做深合并，并按 SCHEMA 逐叶子校验。
// 本文件被 scripts/check-config-refs.js 列为注册表（排除自证）；消费方在业务脚本中。

const DEFAULTS = {
  ports: { serve: 3000, a11y: 3224, perf: 3000 },
  chrome: { path: null },
  paths: { outDir: null, cacheDir: '.cache', artifactsDir: 'build-artifacts' },
  cache: { mediaTtlDays: 0, ogTtlDays: 0, fontsTtlDays: 7, mermaidTtlDays: 0 },
  audit: {
    a11y: { pages: 0, nodesPerRuleMax: 3, htmlSummaryMax: 120 },
    distHash: { previewLimit: 20 }
  },
  release: { listLimit: 200, previewLimit: 20 },
  report: { topN: 10, maxBuildMsWarn: 0 },
  deploy: { pagesProject: 's-ynapse', workerAssetsDir: 'dist', verifyOnDeploy: true },
  ci: { nodeVersion: '24', compatNodeVersion: '20.19.0', aggregate: true },
  ui: {
    reportColors: { good: '#16a34a', warn: '#d97706' },
    faviconFallbackColor: '#2d3748',
    faviconForegroundColor: '#ffffff'
  }
};

// 叶子校验规则：
//   integer — 非负/范围整数；boolean — 布尔；string — 非空字符串；
//   nullableString — null 或非空字符串；enum — 字符串枚举；color — 十六进制 #rrggbb；
//   version — 主版本或 x.y[.z] 版本号；pathLike — 非空、非绝对、非仓库外（不含 .. 段）。
const SCHEMA = {
  'ports.serve': { kind: 'integer', min: 1, max: 65535 },
  'ports.a11y': { kind: 'integer', min: 1, max: 65535 },
  'ports.perf': { kind: 'integer', min: 1, max: 65535 },
  'chrome.path': { kind: 'nullableString' },
  'paths.outDir': { kind: 'nullableString', pathLike: true },
  'paths.cacheDir': { kind: 'string', pathLike: true },
  'paths.artifactsDir': { kind: 'string', pathLike: true },
  'cache.mediaTtlDays': { kind: 'integer', min: 0, max: 3650 },
  'cache.ogTtlDays': { kind: 'integer', min: 0, max: 3650 },
  'cache.fontsTtlDays': { kind: 'integer', min: 0, max: 3650 },
  'cache.mermaidTtlDays': { kind: 'integer', min: 0, max: 3650 },
  'audit.a11y.pages': { kind: 'integer', min: 0, max: 100000 },
  'audit.a11y.nodesPerRuleMax': { kind: 'integer', min: 1, max: 100 },
  'audit.a11y.htmlSummaryMax': { kind: 'integer', min: 40, max: 2000 },
  'audit.distHash.previewLimit': { kind: 'integer', min: 0, max: 1000 },
  'release.listLimit': { kind: 'integer', min: 1, max: 10000 },
  'release.previewLimit': { kind: 'integer', min: 1, max: 10000 },
  'report.topN': { kind: 'integer', min: 1, max: 1000 },
  'report.maxBuildMsWarn': { kind: 'integer', min: 0, max: 86400000 },
  'deploy.pagesProject': { kind: 'string', identifierLike: true },
  'deploy.workerAssetsDir': { kind: 'string', pathLike: true },
  'deploy.verifyOnDeploy': { kind: 'boolean' },
  'ci.nodeVersion': { kind: 'version' },
  'ci.compatNodeVersion': { kind: 'version' },
  'ci.aggregate': { kind: 'boolean' },
  'ui.reportColors.good': { kind: 'color' },
  'ui.reportColors.warn': { kind: 'color' },
  'ui.faviconFallbackColor': { kind: 'color' },
  'ui.faviconForegroundColor': { kind: 'color' }
};

module.exports = { DEFAULTS, SCHEMA };
