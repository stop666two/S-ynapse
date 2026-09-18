// Guard copy guard —— 复制控制（署名 / 弱拦截 / 硬拦截）
export function init(ctx) {
  const cfg = (ctx.G.copyGuard) || {};
  const mode = cfg.mode || 'off';
  if (mode === 'off') return;
  const attr = cfg.attribution || {};
  const allow = cfg.allow || {};
  const block = cfg.block || {};
  const extra = cfg.extra || {};
  const t = ctx.t;

  if (extra.iOSOverride) {
    const s = document.createElement('style');
    s.textContent = 'html{-webkit-touch-callout:none}';
    document.head.appendChild(s);
  }

  let warned = false;

  function flash() {
    if (!block.flash) return;
    const d = document.createElement('div');
    d.className = 'g-flash on';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, +(((window.__GUARD__ || {}).copyGuard || {}).flashRemoveMs));
  }

  function notifyBlocked() {
    if (block.toast === false) return;
    if (cfg.noticeOncePerSession !== false && warned) return;
    ctx.toast(block.toastText || t('copyBlocked', 'Content protected, copying disabled'));
    flash();
  }

  function renderSuffix() {
    const lang = (document.documentElement.lang || 'zh').startsWith('en') ? 'en' : 'zh';
    const tpl = (lang === 'en' ? (attr.textEn || attr.text) : attr.text) || '';
    if (!tpl) return '';
    const title = window.__ART_TITLE__ || document.title || '';
    const url = location.origin + location.pathname;
    const vars = {
      title: title,
      url: url,
      author: '',
      site: window.__SITE_TITLE__ || document.title || '',
    };
    return tpl.replace(/\{(title|url|author|site)\}/g, function (m, k) { return vars[k] || ''; });
  }

  function allowedTarget(target) {
    if (ctx.core.respectEditable !== false && ctx.isEditable(target)) return true;
    if (allow.codeBlocks !== false && target && target.closest && target.closest('pre, code')) return true;
    if (allow.selectors && allow.selectors.length && target && target.closest && target.closest(allow.selectors.join(','))) return true;
    return false;
  }

  function onCopy(e) {
    const sel = String(window.getSelection ? window.getSelection() : '').trim();
    if (!sel) return;
    if (allowedTarget(e.target)) return;

    if (mode === 'attribution') {
      if (attr.minChars && sel.length < parseInt(attr.minChars, 10)) return;
      if (attr.onlyArticles !== false && !window.__ART_TITLE__) return;
      const suffix = renderSuffix();
      if (!suffix) return;
      const sep = attr.separator != null ? attr.separator : '\n\n';
      const out = (attr.position === 'before') ? (suffix + sep + sel) : (sel + sep + suffix);
      try {
        e.clipboardData.setData('text/plain', out);
        e.preventDefault();
      } catch (err) { /* 部分浏览器只读，放弃改写 */ }
      if (cfg.logCopyEvents) ctx.log('copy attribution', sel.length);
      return;
    }

    if (mode === 'weakBlock') {
      if (!warned) {
        e.preventDefault();
        warned = true;
        notifyBlocked();
        if (cfg.logCopyEvents) ctx.log('copy weak-blocked');
      }
      return;
    }

    if (mode === 'block') {
      e.preventDefault();
      notifyBlocked();
      if (cfg.logCopyEvents) ctx.log('copy blocked');
    }
  }

  document.addEventListener('copy', onCopy);
  if (extra.alsoCut) document.addEventListener('cut', onCopy);

  if (extra.imageNotice) {
    document.addEventListener('contextmenu', function (e) {
      if (e.target && e.target.tagName === 'IMG' && !warned) {
        warned = true;
        ctx.toast(t('copyBlocked', 'Content protected, copying disabled'));
      }
    });
  }

  ctx.log('copyGuard ready', mode);
}
