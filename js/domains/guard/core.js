// Guard core —— 防护与交互控制总控
// 职责：档位解析（off/soft/strict）、绕过通道（URL/localStorage/localhost）、
//      共享上下文（i18n、toast、可编辑区判断、日志）与子模块懒加载。
const F = window.__FEATURES__ || {};
const G = window.__GUARD__ || {};
const CORE = G.core || {};

function queryValue(name) {
  const m = new RegExp('[?&]' + name + '=([^&]+)').exec(location.search);
  return m ? decodeURIComponent(m[1]) : '';
}

function bypassed() {
  const b = CORE.bypass || {};
  const q = b.queryParam || 'guard';
  const v = queryValue(q);
  if (v === 'off') return true;
  if (v === 'on') return false;
  try {
    const flag = b.storageFlag || 's-guards-off';
    if (flag && localStorage.getItem(flag) === '1') return true;
  } catch (e) { /* 隐私模式忽略 */ }
  if (b.localhost) {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  }
  return false;
}

function t(key, fallback, vars) {
  const S = ((window.__I18N__ || {}).guard) || {};
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

export function init() {
  if (!Object.keys(G).length) return;
  if (bypassed()) { log('bypassed'); return; }
  const preset = (F.guards && F.guards.preset) || 'soft';
  if (preset === 'off') { log('preset off'); return; }

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
  log('init', preset);
}
