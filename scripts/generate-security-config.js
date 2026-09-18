'use strict';

const fs = require('fs');
const path = require('path');

// ==================== 双配置漂移消除 ====================
// security.json5 是唯一配置源。本模块在每次构建时从 security.json5 提取
// Workers 边缘层需要的子集，生成 workers/security-config.js（自动生成、
// 不可手改、不入 Git）。security-worker.js 运行时 import 该文件，确保
// 静态层（_headers）与边缘层（Worker）永远一致，消除"需人工双改"导致的漂移。

const OUT_FILE = path.join(__dirname, '..', 'workers', 'security-config.js');

/** 基本校验单个 IP / CIDR 条目（IPv4 点分或 IPv6 冒号形式；供构建期告警用）。 */
function isValidIpEntry(entry) {
  if (typeof entry !== 'string') return false;
  const s = entry.trim();
  if (!s) return false;
  const slash = s.lastIndexOf('/');
  const addr = slash === -1 ? s : s.slice(0, slash);
  const prefix = slash === -1 ? null : Number(s.slice(slash + 1));
  const v4parts = addr.split('.');
  const isV4 = v4parts.length === 4 && v4parts.every((n) => /^\d{1,3}$/.test(n) && Number(n) <= 255);
  const isV6 = addr.includes(':') && /^[0-9a-f:.]+$/i.test(addr);
  if (!isV4 && !isV6) return false;
  if (prefix !== null) {
    const bits = isV4 ? 32 : 128;
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false;
  }
  return true;
}

function filterIpEntries(list, context) {
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (typeof item !== 'string') continue;
    if (!isValidIpEntry(item)) {
      console.warn(`  [WARN] security.json5 ${context}: invalid IP/CIDR entry ignored: "${item}"`);
      continue;
    }
    out.push(item);
  }
  return out;
}

/**
 * 将 hardening / customHeaders 段合并进最终响应头对象，返回合并结果。
 * _headers 与 Worker 共用本函数，确保两层头部完全一致（含 HSTS preload 保留）。
 */
function applyHeaderHardening(security) {
  const s = security && typeof security === 'object' ? security : {};
  const headers = Object.assign({}, s.headers && typeof s.headers === 'object' ? s.headers : {});
  const hd = s.hardening && typeof s.hardening === 'object' ? s.hardening : {};
  if (hd.hstsMaxAge) {
    const baseHsts = String(headers['Strict-Transport-Security'] || '');
    const preload = hd.hstsPreload === true || (/preload/i.test(baseHsts) && hd.hstsPreload !== false);
    headers['Strict-Transport-Security'] =
      `max-age=${hd.hstsMaxAge}` + (hd.hstsIncludeSubDomains ? '; includeSubDomains' : '') + (preload ? '; preload' : '');
  }
  if (hd.referrerPolicy) headers['Referrer-Policy'] = hd.referrerPolicy;
  if (hd.permissionsPolicy && Object.keys(hd.permissionsPolicy).length) {
    headers['Permissions-Policy'] = Object.entries(hd.permissionsPolicy).map(([k, v]) => `${k}=${v}`).join(', ');
  }
  if (hd.xssProtection) headers['X-XSS-Protection'] = hd.xssProtection;
  if (Array.isArray(hd.corsAllowedOrigins) && hd.corsAllowedOrigins.length) {
    headers['Access-Control-Allow-Origin'] = hd.corsAllowedOrigins.join(', ');
  }
  const custom = s.customHeaders && typeof s.customHeaders === 'object' ? s.customHeaders : {};
  for (const [key, val] of Object.entries(custom)) {
    if (val) headers[key] = val;
  }
  return headers;
}

/**
 * 从已解析的 security 配置中提取 Worker 需要的字段。
 * 缺失字段自动用安全兜底值（禁执行、不限制、严格头），保证任何手写损坏
 * 的 JSON 不会让 Worker 变为无保护状态。skipPaths 是仅有的例外：缺失即为空
 * 数组（不跳过任何路径，严格计数），避免代码内置隐式策略。
 */
function extractWorkerSecurity(security) {
  const s = security && typeof security === 'object' ? security : {};
  const rl = s.rateLimiting && typeof s.rateLimiting === 'object' ? s.rateLimiting : {};
  const csp = s.csp && typeof s.csp === 'object' ? s.csp : {};
  const directives =
    csp.directives && typeof csp.directives === 'object' ? csp.directives : {};
  const paths = Array.isArray(s.pathRestrictions)
    ? s.pathRestrictions
        .map((p) => (typeof p === 'string' ? { path: p } : p))
        .filter((p) => p && typeof p === 'object' && typeof p.path === 'string' && p.path.length > 0)
        .map((p) => {
          const rule = { path: p.path };
          if (p.requireAuth === true) rule.requireAuth = true;
          if (Array.isArray(p.allowedIPs) && p.allowedIPs.length) {
            const allowed = filterIpEntries(p.allowedIPs, `pathRestrictions[${p.path}].allowedIPs`);
            if (allowed.length) rule.allowedIPs = allowed;
          }
          return rule;
        })
    : [{ path: '/admin/*' }];

  return {
    rateLimiting: {
      enabled: rl.enabled !== false,
      maxRequests: Number.isFinite(rl.maxRequests) ? rl.maxRequests : 100,
      windowMs: Number.isFinite(rl.windowMs) ? rl.windowMs : 60000,
      blockDuration: Number.isFinite(rl.blockDuration) ? rl.blockDuration : 300000,
      whitelist: filterIpEntries(rl.whitelist, 'rateLimiting.whitelist'),
      blacklist: filterIpEntries(rl.blacklist, 'rateLimiting.blacklist'),
      skipPaths: Array.isArray(rl.skipPaths)
        ? rl.skipPaths.filter((x) => typeof x === 'string' && x.startsWith('/'))
        : []
    },
    csp: {
      directives,
      reportOnly: csp.reportOnly === true,
      reportUri: typeof csp.reportUri === 'string' && csp.reportUri.length > 0 ? csp.reportUri : '/csp-report'
    },
    pathRestrictions: paths,
    forceHttps: s.forceHttps === true,
    headers: applyHeaderHardening(s)
  };
}

/** 渲染 workers/security-config.js 内容（ESM export default，仅数据无逻辑）。 */
function renderWorkerConfig(extracted) {
  const body = JSON.stringify(extracted, null, 2);
  return (
    '// AUTO-GENERATED by scripts/generate-security-config.js — DO NOT EDIT manually.\n' +
    '// Single source of truth: security.json5. Regenerate with `npm run build`.\n' +
    'export default ' + body + ';\n'
  );
}

/** 读 security.json5 → 写 workers/security-config.js。返回生成的文件路径。 */
function generateSecurityConfig(securityConfig, outFile) {
  const file = outFile || OUT_FILE;
  const extracted = extractWorkerSecurity(securityConfig);
  const rendered = renderWorkerConfig(extracted);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rendered, 'utf-8');
  return file;
}

module.exports = { extractWorkerSecurity, renderWorkerConfig, generateSecurityConfig, applyHeaderHardening, isValidIpEntry, OUT_FILE };

if (require.main === module) {
  const ROOT = path.join(__dirname, '..');
  const securityPath = process.argv[2] || path.join(ROOT, 'security.json5');
  if (!fs.existsSync(securityPath)) {
    console.error(`[FATAL] security.json5 not found at ${securityPath}`);
    process.exit(1);
  }
  const json5 = require('json5');
  const security = json5.parse(fs.readFileSync(securityPath, 'utf-8'));
  const out = generateSecurityConfig(security);
  console.log(`[SECURITY-SYNC] worker config generated: ${path.relative(ROOT, out)}`);
}
