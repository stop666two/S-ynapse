// Guard core —— 防护与交互控制总控
// 职责：档位解析（off/soft/strict）、绕过通道（URL/localStorage/localhost/解锁码）、
//      共享上下文（i18n、toast、可编辑区判断、日志）与子模块懒加载。
import { normalizeGuardBypass, resolveGuardBypass, stripGuardParams } from './bypass.js';
import { DEFAULT_GUARD } from './defaults.js';

const F = window.__FEATURES__ || {};
// 外置配置加载失败（__CONFIG_OK__=false）时按 __FEATURES__.guards 档位使用内置默认档，
// 避免弱网降级路径上防护整体失效；正常态缺 guard.json5（__GUARD__ 为空对象）保持既有语义（不激活）。
const G = (window.__GUARD__ && Object.keys(window.__GUARD__).length)
  ? window.__GUARD__
  : (window.__CONFIG_OK__ === false && F.guards && F.guards.enabled !== false ? DEFAULT_GUARD : {});
const CORE = G.core || {};

// 读取绕过判定所需环境值（localStorage 访问在隐私模式下可能抛错，读取点单独包裹）。
function readBypassEnv() {
  const cfg = normalizeGuardBypass(CORE.bypass);
  let storageValue = '';
  if (cfg.storageFlag) {
    try { storageValue = localStorage.getItem(cfg.storageFlag) || ''; } catch (e) { /* 隐私模式忽略 */ }
  }
  return { search: location.search, storageValue: storageValue, hostname: location.hostname };
}

// 清除地址栏中的防护参数（?guard= 绕过标记与 ?key= 解锁码），保留其它查询串与 hash。
// 时序约束：必须在绕过判定与 accessGate 解锁逻辑读取完成之后调用——过早移除会让
// 解锁码失效。仅原地替换当前历史记录（replaceState），不新增历史条目。
// 是否清洗由 core.bypass.cleanUrl 控制；false 时保留参数，判定结果不变。
function stripUrlParams() {
  const r = stripGuardParams(location.href, CORE.bypass);
  if (!r.changed) return;
  try { history.replaceState(history.state, '', r.href); } catch (e) { /* 忽略：URL 清理失败不影响防护判定与解锁 */ }
}

// 当前页是否为英文页（guard 文案字典仅中/英变体）：统一走 runtime.js 的 langOf
// （判定 data-lang → html lang BCP 47 前缀 → URL 前缀 → 默认语言）。
function isEnglishPage() {
  return window.langOf() === 'en';
}

// 按键取 guard 文案；英文页优先取 __I18N__.en.guard（与 __T 共用同一份外置字典），
// 缺失时回退中文顶层与调用方默认值。
function t(key, fallback, vars) {
  const D = window.__I18N__ || {};
  const S = (isEnglishPage() && D.en && D.en.guard) ? D.en.guard : (D.guard || {});
  let s = S[key] || fallback || key;
  if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
  return s;
}

function isEditable(el) {
  if (!el || !el.closest) return false;
  return !!el.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]');
}

function log() {
  if (CORE.logLevel === 'debug') console.info.apply(console, ['[guard]'].concat(Array.prototype.slice.call(arguments)));
  else if (CORE.logLevel === 'info' && arguments.length) console.info('[guard]', arguments[0]);
}

function toast(msg) {
  if (typeof window.__toast === 'function') window.__toast(msg, { type: 'info' });
}

function markReady() { try { window.__GUARD_READY__ = true; } catch (e) { /* 忽略：就绪标记写入失败不影响防护初始化 */ } }

export function init() {
  if (!Object.keys(G).length) { markReady(); return; }
  const resolved = resolveGuardBypass(CORE.bypass, readBypassEnv());
  try { window.__GUARD_BYPASS__ = resolved.reason; } catch (e) { /* 忽略：可观测标记写入失败不影响防护 */ }
  if (resolved.bypassed) { log('bypassed'); stripUrlParams(); markReady(); return; }
  const preset = (F.guards && F.guards.enabled === false) ? 'off' : ((F.guards && F.guards.preset) || 'soft');
  if (preset === 'off') { log('preset off'); stripUrlParams(); markReady(); return; }

  function active(mod) {
    if (F.guards && F.guards[mod] === false) return false;
    const mc = G[mod] || {};
    if (mc.enabled === false) return false;
    if (preset === 'strict') return true;
    if (preset === 'soft') {
      if (mod === 'contextMenu' || mod === 'copyGuard') return true;
      return mc.enabled === true;
    }
    return false;
  }

  const ctx = { G: G, core: CORE, t: t, isEditable: isEditable, log: log, toast: toast };

  if (active('contextMenu')) import('./context-menu.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('contextMenu load failed', e); });
  if (active('copyGuard')) import('./copy-guard.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('copyGuard load failed', e); });
  if (active('selectionGuard')) import('./selection-guard.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('selectionGuard load failed', e); });
  if (active('hotkeyGuard')) import('./hotkey-guard.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('hotkeyGuard load failed', e); });
  if (active('watermark')) import('./watermark.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('watermark load failed', e); });
  if (active('devtoolsDetect')) import('./devtools-detect.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('devtoolsDetect load failed', e); });
  if (active('consoleGuard')) import('./console-guard.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('consoleGuard load failed', e); });
  if (active('privacyCurtain')) import('./privacy-curtain.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('privacyCurtain load failed', e); });
  if (active('tamperWatch')) import('./tamper-watch.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('tamperWatch load failed', e); });
  // 解锁码读取在 access-gate 初始化内完成；等其就绪后再清理地址栏（含 ?key=）。
  // 未启用 accessGate 时无解锁读取，可直接清理。
  const gateReady = active('accessGate')
    ? import('./access-gate.js').then(function (m) { m.init(ctx); }).catch(function (e) { log('accessGate load failed', e); })
    : null;
  log('init', preset);
  if (gateReady) gateReady.then(stripUrlParams); else stripUrlParams();
  markReady();
}
