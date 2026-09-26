// Guard core —— 防护与交互控制总控
// 职责：档位解析（off/soft/strict）、绕过通道（URL/localStorage/localhost）、
//      共享上下文（i18n、toast、可编辑区判断、日志）与子模块懒加载。
const F = window.__FEATURES__ || {};
const G = window.__GUARD__ || {};
const CORE = G.core || {};

function queryValue(name) {
  const m = new RegExp('[?&]' + name + '=([^&]+)').exec(location.search);
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
}

function bypassed() {
  const b = CORE.bypass || {};
  const q = b.queryParam || 'guard';
  const v = queryValue(q);
  if (v === 'off') return true;
  if (v === 'on') return false;
  try {
    const flag = b.storageFlag;
    if (flag && localStorage.getItem(flag) === '1') return true;
  } catch (e) { /* 隐私模式忽略 */ }
  if (b.localhost) {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  }
  return false;
}

// 清除地址栏中的防护参数（?guard= 绕过标记与 ?key= 解锁码），保留其它查询串与 hash。
// 时序约束：必须在绕过判定与 accessGate 解锁逻辑读取完成之后调用——过早移除会让
// 解锁码失效。仅原地替换当前历史记录（replaceState），不新增历史条目。
function stripUrlParams() {
  const names = [(CORE.bypass && CORE.bypass.queryParam) || 'guard', 'key'];
  try {
    const url = new URL(location.href);
    let changed = false;
    names.forEach(function (name) {
      if (name && url.searchParams.has(name)) { url.searchParams.delete(name); changed = true; }
    });
    if (changed) history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch (e) { /* 忽略：URL 清理失败不影响防护判定与解锁 */ }
}

// 当前页是否为英文语言页。判定按可靠性排序：
//   data-lang（core/i18n.js 运行时写入）→ <html lang>（构建期输出 en-US）→ URL 前缀。
function isEnglishPage() {
  const el = document.documentElement;
  if (el.getAttribute('data-lang') === 'en') return true;
  if (/^en\b/i.test(el.getAttribute('lang') || '')) return true;
  return /^\/en(\/|$)/.test(location.pathname);
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
  if (bypassed()) { log('bypassed'); stripUrlParams(); markReady(); return; }
  const preset = (F.guards && F.guards.preset) || 'soft';
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
