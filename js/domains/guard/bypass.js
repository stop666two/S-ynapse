// Guard bypass —— 绕过通道判定与 URL 清洗的纯函数层。
// 通道：URL 参数（?guard=off|on）> localStorage 标志 > localhost；accessGate 解锁码
//   （?key=）是否允许由 accessGateKey 单独控制。全部通道可用 core.bypass 逐项开关，
//   enabled=false 时全部失效。
// 本模块不直接访问 location/localStorage/history；宿主（core.js、access-gate.js）
// 负责读取环境值，便于单测直接覆盖判定矩阵。

export const GUARD_BYPASS_DEFAULTS = Object.freeze({
  enabled: true,
  urlParam: true,
  localStorage: true,
  localhost: false,
  cleanUrl: true,
  queryParam: 'guard',
  storageFlag: 's-guards-off',
  accessGateKey: true
});

export const ACCESS_GATE_KEY_PARAM = 'key';

// 非法值回退策略：布尔开关以「显式 false 才关闭、显式 true 才开启」为准，
// 其余类型回退内置默认；字符串键非字符串时回退默认。
export function normalizeGuardBypass(raw) {
  const b = (raw && typeof raw === 'object') ? raw : {};
  return {
    enabled: b.enabled !== false,
    urlParam: b.urlParam !== false,
    localStorage: b.localStorage !== false,
    localhost: b.localhost === true,
    cleanUrl: b.cleanUrl !== false,
    queryParam: typeof b.queryParam === 'string' && b.queryParam ? b.queryParam : GUARD_BYPASS_DEFAULTS.queryParam,
    storageFlag: typeof b.storageFlag === 'string' ? b.storageFlag : GUARD_BYPASS_DEFAULTS.storageFlag,
    accessGateKey: b.accessGateKey !== false
  };
}

function queryValue(search, name) {
  const re = new RegExp('[?&]' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^&]+)');
  const m = re.exec(String(search || ''));
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
}

function isLocalhostName(hostname) {
  const h = String(hostname || '');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

// 返回 { bypassed, reason }；reason 供调试可观测（'disabled' 表示总开关关闭）。
export function resolveGuardBypass(raw, env) {
  const cfg = normalizeGuardBypass(raw);
  const e = env || {};
  if (!cfg.enabled) return { bypassed: false, reason: 'disabled' };
  if (cfg.urlParam) {
    const v = queryValue(e.search, cfg.queryParam);
    if (v === 'off') return { bypassed: true, reason: 'url-off' };
    if (v === 'on') return { bypassed: false, reason: 'url-on' };
  }
  if (cfg.localStorage && cfg.storageFlag && e.storageValue === '1') return { bypassed: true, reason: 'storage' };
  if (cfg.localhost && isLocalhostName(e.hostname)) return { bypassed: true, reason: 'localhost' };
  return { bypassed: false, reason: 'none' };
}

// accessGate 的 ?key= 解锁码是否允许使用（同受绕过通道总开关约束）。
export function isAccessGateKeyAllowed(raw) {
  const cfg = normalizeGuardBypass(raw);
  return cfg.enabled && cfg.accessGateKey;
}

// 需要从地址栏清洗的参数名：绕过参数与 accessGate 解锁码参数（保持历史行为）。
export function guardCleanupParamNames(raw) {
  const cfg = normalizeGuardBypass(raw);
  return [cfg.queryParam, ACCESS_GATE_KEY_PARAM];
}

// 地址栏清洗：cleanUrl=false 时原样返回；否则删除已配置的参数名，
// 仅保留 pathname+search+hash（与 replaceState 的原地替换语义一致）。
export function stripGuardParams(href, raw) {
  const cfg = normalizeGuardBypass(raw);
  if (!cfg.cleanUrl) return { href: href, changed: false };
  try {
    const url = new URL(href);
    let changed = false;
    guardCleanupParamNames(cfg).forEach(function (name) {
      if (name && url.searchParams.has(name)) { url.searchParams.delete(name); changed = true; }
    });
    if (!changed) return { href: href, changed: false };
    return { href: url.pathname + url.search + url.hash, changed: true };
  } catch (e) { return { href: href, changed: false }; }
}
