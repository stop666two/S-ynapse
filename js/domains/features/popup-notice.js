// 弹窗公告（features.popupNotice）：延迟弹出、内容/按钮/关闭方式/配色可自定义；
// 展示频率与内容哈希记忆在 localStorage/sessionStorage，正文纯文本渲染。
function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return String(h); }
function langOf() { return /^en/i.test(document.documentElement.lang || '') ? 'en' : 'zh'; }
function pick(lang, base, en) { return (lang === 'en' && en) ? en : (base || ''); }
function todayStr(now) { var d = new Date(now); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

export function decideShow(now, cfg, hash, lsRaw, ssRaw) {
  if (!cfg || cfg.enabled !== true) return false;
  var stored;
  try { stored = JSON.parse(lsRaw); } catch (e) { stored = null; }
  var sess;
  try { sess = JSON.parse(ssRaw); } catch (e) { sess = null; }
  var freq = cfg.frequency || 'day';
  if (cfg.reshowOnChange !== false && (!stored || stored.h !== hash)) return true;
  if (freq === 'always') return true;
  if (freq === 'session') return !(sess && sess.h === hash);
  return !(stored && stored.h === hash && stored.d === todayStr(now));
}

function contentOf(cfg, lang) {
  var qr = cfg.qr || {};
  var buttons = Array.isArray(cfg.buttons) ? cfg.buttons : [];
  return {
    title: pick(lang, cfg.title, cfg.titleEn),
    body: pick(lang, cfg.body, cfg.bodyEn),
    image: cfg.image || '',
    imageAlt: pick(lang, cfg.imageAlt, cfg.imageAltEn),
    qr: { src: qr.enabled ? (qr.src || '') : '', caption: pick(lang, qr.caption, qr.captionEn) },
    buttons: buttons.map(function (b, i) {
      return {
        label: pick(lang, b.label, b.labelEn),
        url: b.url || '',
        style: b.style || (i === 0 ? 'primary' : 'ghost'),
        newTab: b.newTab !== false
      };
    }),
    closeLabel: pick(lang, (cfg.closeButton && cfg.closeButton.label) || '知道了', (cfg.closeButton && cfg.closeButton.labelEn) || 'Got it')
  };
}

function applyColors(dialog, cfg) {
  var colors = cfg.colors || {};
  var map = {
    overlay: '--pn-overlay', background: '--pn-bg', text: '--pn-fg', textSecondary: '--pn-fg2',
    border: '--pn-border', primary: '--pn-primary', primaryText: '--pn-primary-fg', ghost: '--pn-ghost-fg'
  };
  Object.keys(map).forEach(function (k) {
    if (colors[k]) { try { dialog.style.setProperty(map[k], colors[k]); } catch (e) { /* 忽略：非法颜色值不影响弹窗可用性 */ } }
  });
  if (cfg.width) { try { dialog.style.setProperty('--pn-width', cfg.width); } catch (e) { /* 忽略：非法宽度不影响弹窗可用性 */ } }
}

function build(cfg, lang, content, persist) {
  var overlay = document.createElement('div');
  overlay.className = 'pn-overlay';
  var dialog = document.createElement('div');
  dialog.className = 'pn-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('tabindex', '-1');
  applyColors(dialog, cfg);

  var prevFocus = document.activeElement;
  var closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    overlay.classList.remove('on');
    // 兜底值与 features-schema.js → DEFAULT_FEATURES.popupNotice 同值；仅在配置缺失/非法时生效。
    setTimeout(function () { overlay.remove(); }, isNaN(+cfg.removeDelayMs) ? 240 : Math.max(0, +cfg.removeDelayMs));
    try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) { /* 忽略：焦点恢复失败不影响关闭 */ }
    persist();
  }
  function onKey(e) {
    if (e.key === 'Escape' && cfg.escToClose !== false) { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      var nodes = dialog.querySelectorAll('a[href],button:not([disabled])');
      if (!nodes.length) return;
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); try { last.focus(); } catch (e2) { /* 忽略：焦点循环失败不影响键盘操作 */ } }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); try { first.focus(); } catch (e2) { /* 忽略：焦点循环失败不影响键盘操作 */ } }
    }
  }
  if (cfg.escToClose !== false) document.addEventListener('keydown', onKey, true);

  if (content.image) {
    var img = document.createElement('img');
    img.className = 'pn-image'; img.src = content.image; img.alt = content.imageAlt || ''; img.loading = 'lazy';
    dialog.appendChild(img);
  }
  if (content.title) {
    var h = document.createElement('h2');
    h.className = 'pn-title'; h.id = 'pnTitle'; h.textContent = content.title;
    dialog.appendChild(h);
  }
  var body = document.createElement('div');
  body.className = 'pn-body'; body.id = 'pnBody';
  String(content.body || '').split(/\n{2,}/).forEach(function (para) {
    var t = para.trim(); if (!t) return;
    var p = document.createElement('p'); p.textContent = t; body.appendChild(p);
  });
  if (body.childNodes.length) dialog.appendChild(body);
  if (content.qr.src) {
    var fig = document.createElement('figure'); fig.className = 'pn-qr';
    var q = document.createElement('img'); q.src = content.qr.src; q.alt = content.qr.caption || ''; q.loading = 'lazy';
    fig.appendChild(q);
    if (content.qr.caption) { var cap = document.createElement('figcaption'); cap.textContent = content.qr.caption; fig.appendChild(cap); }
    dialog.appendChild(fig);
  }
  var actions = document.createElement('div');
  actions.className = 'pn-actions';
  content.buttons.forEach(function (b) {
    if (!b.label && !b.url) return;
    var el;
    if (b.url) {
      el = document.createElement('a');
      el.href = b.url;
      if (b.newTab && /^https?:/i.test(b.url)) { el.target = '_blank'; el.rel = 'noopener'; }
    } else { el = document.createElement('button'); el.type = 'button'; }
    el.className = 'pn-btn pn-' + b.style;
    el.textContent = b.label || b.url;
    el.addEventListener('click', function () { close(); });
    actions.appendChild(el);
  });
  if ((cfg.closeButton || {}).enabled !== false) {
    var ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'pn-btn pn-' + ((cfg.closeButton && cfg.closeButton.style) || 'primary') + ' pn-ok';
    ok.textContent = content.closeLabel;
    ok.addEventListener('click', function () { close(); });
    actions.appendChild(ok);
  }
  if (actions.childNodes.length) dialog.appendChild(actions);
  if (cfg.closeIcon !== false) {
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'pn-x';
    x.setAttribute('aria-label', lang === 'en' ? 'Close' : '关闭');
    x.textContent = '×';
    x.addEventListener('click', function () { close(); });
    dialog.appendChild(x);
  }
  overlay.appendChild(dialog);
  if (cfg.closeOnBackdrop !== false) {
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  }
  document.body.appendChild(overlay);
  requestAnimationFrame(function () { overlay.classList.add('on'); });
  var focusFirst = actions.querySelector('.pn-primary') || actions.querySelector('.pn-btn') || dialog;
  try { focusFirst.focus(); } catch (e) { /* 忽略：初始聚焦失败不影响弹窗可用性 */ }
}

export function init() {
  var cfg = (window.__FEATURES__ || {}).popupNotice || {};
  if (cfg.enabled !== true) return;
  var lang = langOf();
  var content = contentOf(cfg, lang);
  var hash = hashStr(JSON.stringify(content));
  var key = cfg.storageKey || 's-popupNotice';
  var lsRaw, ssRaw;
  try { lsRaw = localStorage.getItem(key); } catch (e) { lsRaw = null; }
  try { ssRaw = sessionStorage.getItem(key + ':session'); } catch (e) { ssRaw = null; }
  if (!decideShow(Date.now(), cfg, hash, lsRaw, ssRaw)) return;
  function persist() {
    try { localStorage.setItem(key, JSON.stringify({ h: hash, d: todayStr(Date.now()) })); } catch (e) { /* 忽略：存储不可用时按当次会话处理 */ }
    try { sessionStorage.setItem(key + ':session', JSON.stringify({ h: hash })); } catch (e) { /* 忽略：存储不可用时按当次会话处理 */ }
  }
  function show() { build(cfg, lang, content, persist); }
  var delay = Math.max(0, parseInt(cfg.delayMs, 10) || 0);
  if (delay > 0) setTimeout(show, delay); else show();
}
