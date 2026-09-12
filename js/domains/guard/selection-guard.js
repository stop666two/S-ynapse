// Guard selection guard —— 选择控制（allow / content / strict）
export function init(ctx) {
  const cfg = (ctx.G.selectionGuard) || {};
  const mode = cfg.mode || 'allow';
  if (cfg.enabled === false || mode === 'allow') return;
  const strict = mode === 'strict';

  const allow = Array.isArray(cfg.allowSelectors) ? cfg.allowSelectors.slice() : [];
  if (cfg.allowCode !== false) allow.push('.post-content pre', '.post-content code');
  allow.push('input', 'textarea', 'select', '[contenteditable="true"]', '[contenteditable=""]');
  const allowSel = allow.join(',');

  const scope = strict ? '*' : '.post-content';
  const css = scope + '{user-select:none;-webkit-user-select:none}' +
    allow.map(function (s) { return s + '{user-select:text !important;-webkit-user-select:text !important}'; }).join('');
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  let warned = false;
  function inScope(target) {
    if (!target || !target.closest) return false;
    return strict ? true : !!target.closest('.post-content');
  }
  function allowed(target) {
    return !!(target && target.closest && target.closest(allowSel));
  }
  function notify() {
    if (!cfg.noticeToast || warned) return;
    warned = true;
    ctx.toast(cfg.noticeText || ctx.t('selectDisabled', '本页内容不可选择'));
  }

  document.addEventListener('selectstart', function (e) {
    if (ctx.isEditable(e.target) || allowed(e.target) || !inScope(e.target)) return;
    e.preventDefault();
    notify();
  });

  document.addEventListener('keydown', function (e) {
    if (ctx.isEditable(e.target) || !inScope(e.target)) return;
    if (cfg.allowCtrlA === false && (e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      notify();
    } else if (cfg.allowShiftArrows === false && e.shiftKey && /^Arrow/.test(e.key)) {
      e.preventDefault();
      notify();
    }
  });

  ctx.log('selectionGuard ready', mode);
}
