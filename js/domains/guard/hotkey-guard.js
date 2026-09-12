// Guard hotkey guard —— 开发者工具快捷键拦截（威慑级）
export function init(ctx) {
  const cfg = (ctx.G.hotkeyGuard) || {};
  if (cfg.enabled === false) return;
  const keys = cfg.keys || {};

  function combo(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    let k = String(e.key || '').toLowerCase();
    if (k === ' ') k = 'space';
    parts.push(k);
    return parts.join('+');
  }

  const blocked = {};
  if (keys.f12 !== false) blocked['f12'] = true;
  if (keys.ctrlShiftI !== false) blocked['ctrl+shift+i'] = true;
  if (keys.ctrlShiftJ !== false) blocked['ctrl+shift+j'] = true;
  if (keys.ctrlShiftC !== false) blocked['ctrl+shift+c'] = true;
  if (keys.ctrlU !== false) blocked['ctrl+u'] = true;
  if (keys.ctrlS !== false) blocked['ctrl+s'] = true;
  if (keys.ctrlP !== false) blocked['ctrl+p'] = true;
  (Array.isArray(keys.custom) ? keys.custom : []).forEach(function (s) {
    blocked[String(s).toLowerCase().replace(/\s+/g, '')] = true;
  });

  let warned = false;
  function notify() {
    if (cfg.noticeToast === false) return;
    if (cfg.noticeOncePerSession !== false && warned) return;
    warned = true;
    ctx.toast(cfg.noticeText || ctx.t('hotkeyBlocked', '该快捷键已被站点禁用'));
  }

  document.addEventListener('keydown', function (e) {
    if (ctx.core.respectEditable !== false && ctx.isEditable(e.target)) return;
    const c = combo(e);
    if (blocked[c]) {
      e.preventDefault();
      e.stopPropagation();
      notify();
      return;
    }
    if (keys.printScreen && c === 'printscreen') notify();
  }, true);

  ctx.log('hotkeyGuard ready');
}
