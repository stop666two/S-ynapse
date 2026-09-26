// Guard context menu —— 自定义右键菜单（含长按触屏触发）
const SVGS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  external: '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  translate: '<svg viewBox="0 0 24 24"><path d="M4 5h8M9 3v2c0 5-2.5 9-6 12"/><path d="M6 12c2 3 4.5 5 8 6"/><path d="m13 21 4-10 4 10"/><path d="M14.5 17h5"/></svg>',
  top: '<svg viewBox="0 0 24 24"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
  theme: '<svg viewBox="0 0 24 24"><path d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4"/><circle cx="12" cy="12" r="3.5"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg>',
  code: '<svg viewBox="0 0 24 24"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>',
  raw: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
};

export function init(ctx) {
  const cfg = (ctx.G.contextMenu) || {};
  if (cfg.enabled === false) return;
  const builtin = cfg.builtin || {};
  const showOn = cfg.showOn || {};
  const b = cfg.behavior || {};
  const st = cfg.style || {};
  const trigger = cfg.trigger || {};
  const edge = parseInt((ctx.core.edgePadding || '8px'), 10) || 8;

  let menu = null;
  let opened = false;
  let pressTimer = null, pressX = 0, pressY = 0;

  const t = ctx.t;

  function makeMenu() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'g-menu' + (st.blur !== false ? ' blur' : '');
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', cfg.ariaLabel || t('menuLabel', 'Actions menu'));
    if (st.width) menu.style.maxWidth = st.width;
    if (st.radius) menu.style.borderRadius = st.radius;
    if (typeof st.shadowOpacity === 'number') menu.style.setProperty('--guard-shadowOpacity', String(st.shadowOpacity));
    if (typeof st.animMs === 'number') menu.style.setProperty('--guard-menuAnim', st.animMs + 'ms');
    document.body.appendChild(menu);
    return menu;
  }

  function separator() {
    const d = document.createElement('div');
    d.className = 'g-sep';
    d.setAttribute('role', 'separator');
    return d;
  }

  function item(label, icon, run, disabled) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'g-item';
    btn.setAttribute('role', 'menuitem');
    btn.tabIndex = -1;
    if (disabled) btn.disabled = true;
    btn.innerHTML = (SVGS[icon] || '') + '<span class="g-label"></span>';
    btn.querySelector('.g-label').textContent = label;
    btn.addEventListener('click', function () { close(); run(); });
    return btn;
  }

  function copyText(text) {
    const fallback = function () {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ctx.toast(t('copied', 'Copied')); } catch (e) { /* 忽略 */ }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { ctx.toast(t('copied', 'Copied')); }).catch(fallback);
    } else {
      fallback();
    }
  }

  function itemsFor(e) {
    const sel = String(window.getSelection ? window.getSelection() : '').trim();
    const link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    const codeWrap = e.target && e.target.closest ? e.target.closest('pre') : null;
    const img = e.target && e.target.tagName === 'IMG' ? e.target : null;
    const list = [];
    if (sel && showOn.selection !== false && builtin.copy !== false) {
      list.push(item(t('copy', 'Copy'), 'copy', function () { copyText(sel); }));
    }
    if (link && showOn.link !== false) {
      if (builtin.copyLink !== false) list.push(item(t('copyLink', 'Copy link'), 'link', function () { copyText(link.href); }));
      if (builtin.openNewTab !== false) list.push(item(t('openNewTab', 'Open in new tab'), 'external', function () { window.open(link.href, '_blank', 'noopener'); }));
    }
    if (sel && showOn.selection !== false) {
      if (builtin.searchSelected !== false) list.push(item(t('searchSelected', 'Search "{text}"', { text: sel.length > 12 ? sel.slice(0, 12) + '…' : sel }), 'search', function () {
        if (typeof window.openSearch === 'function') window.openSearch();
        // 延迟来自 guard.contextMenu.searchFocusDelayMs；兜底值与 scripts/lib/guard-defaults.js 同值。
        setTimeout(function () {
          const input = document.querySelector('.search-modal input, #searchModal input, input[type="search"]');
          if (input) { input.value = sel; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
        }, parseInt(cfg.searchFocusDelayMs, 10) || 60);
      }));
      if (builtin.translate !== false) list.push(item(t('translate', 'Translate selection'), 'translate', function () {
        const tl = (document.documentElement.lang || 'zh').startsWith('en') ? 'zh-CN' : 'en';
        const tu = String((((window.__GUARD__ || {}).contextMenu || {}).translateUrl) || '').replace('{lang}', tl).replace('{text}', encodeURIComponent(sel));
        if (!tu) return;
        window.open(tu, '_blank', 'noopener');
      }));
    }
    if (codeWrap && showOn.code !== false) {
      const codeEl = codeWrap.querySelector('code') || codeWrap;
      if (list.length) list.push(separator());
      if (builtin.copyCode !== false) list.push(item(t('copyCode', 'Copy code'), 'code', function () { copyText(codeEl.textContent); }));
      if (builtin.copyRaw !== false) list.push(item(t('copyRaw', 'Copy source'), 'raw', function () { copyText(codeEl.textContent); }));
      if (builtin.download !== false) list.push(item(t('download', 'Download'), 'download', function () {
        const langMatch = /language-([\w-]+)/.exec(codeEl.className || '');
        const ext = langMatch ? langMatch[1].replace('plaintext', 'txt') : 'txt';
        const blob = new Blob([codeEl.textContent], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'snippet.' + ext;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, +(((window.__GUARD__ || {}).contextMenu || {}).revokeDelayMs));
      }));
    }
    if (img && showOn.image !== false) {
      if (list.length) list.push(separator());
      list.push(item(t('openNewTab', 'Open in new tab'), 'external', function () { window.open(img.currentSrc || img.src, '_blank', 'noopener'); }));
    }
    if (!list.length && showOn.blank !== false) {
      if (builtin.backToTop !== false) list.push(item(t('backToTop', 'Back to top'), 'top', function () { window.scrollTo({ top: 0, behavior: window.__SB() }); }));
      if (builtin.toggleTheme !== false) list.push(item(t('toggleTheme', 'Toggle theme'), 'theme', function () {
        const btn = document.querySelector('.dark-toggle');
        if (btn) btn.click();
      }));
      if (builtin.print !== false) list.push(item(t('print', 'Print'), 'print', function () { window.print(); }));
    }
    if (builtin.viewSource && builtin.viewSource !== false) {
      list.push(item(t('viewSource', 'View source'), 'raw', function () { window.open('view-source:' + location.href, '_blank'); }));
    }
    if (builtin.inspect && builtin.inspect !== false) {
      list.push(item(t('inspect', 'Inspect element'), 'code', function () { /* 浏览器限制，占位 */ }));
    }
    const customs = Array.isArray(cfg.items) ? cfg.items : [];
    customs.forEach(function (c) {
      if (!c || !c.label) return;
      if (c.selector && !(e.target && e.target.closest && e.target.closest(c.selector))) return;
      list.push(item((document.documentElement.lang || '').startsWith('en') && c.labelEn ? c.labelEn : c.label, c.icon, function () {
        if (c.url) window.open(c.url, c.newTab === false ? '_self' : '_blank', 'noopener');
        else if (c.action) document.dispatchEvent(new CustomEvent('guard:menu-action', { detail: { action: c.action } }));
      }));
    });
    return list;
  }

  function position(x, y) {
    const w = menu.offsetWidth, h = menu.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    menu.style.left = Math.max(edge, Math.min(x, vw - w - edge)) + 'px';
    menu.style.top = Math.max(edge, Math.min(y, vh - h - edge)) + 'px';
  }

  function open(x, y, list) {
    if (!list.length) return false;
    makeMenu();
    menu.textContent = '';
    list.forEach(function (n) { menu.appendChild(n); });
    menu.classList.add('open');
    opened = true;
    position(x, y);
    return true;
  }

  function close() {
    if (!opened) return;
    opened = false;
    if (menu) menu.classList.remove('open');
  }

  document.addEventListener('contextmenu', function (e) {
    if (ctx.core.respectEditable !== false && ctx.isEditable(e.target)) return;
    if (cfg.excludeSelectors && cfg.excludeSelectors.length && e.target.closest && e.target.closest(cfg.excludeSelectors.join(','))) return;
    const list = itemsFor(e);
    if (!list.length) return;
    if (cfg.disableNative !== false) e.preventDefault();
    open(e.clientX, e.clientY, list);
  });

  document.addEventListener('mousedown', function (e) { if (opened && !menu.contains(e.target)) close(); }, true);
  window.addEventListener('scroll', function () { if (b.closeOnScroll !== false) close(); }, { passive: true });
  window.addEventListener('blur', function () { if (b.closeOnBlur !== false) close(); });
  window.addEventListener('resize', close);
  document.addEventListener('keydown', function (e) {
    if (!opened) return;
    if (e.key === 'Escape' && b.closeOnEsc !== false) { close(); return; }
    const items = Array.prototype.filter.call(menu.querySelectorAll('.g-item'), function (n) { return !n.disabled; });
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1 + items.length) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); items[idx].click(); }
  });

  if (trigger.longPress !== false) {
    const ms = parseInt(trigger.longPressMs, 10) || 550;
    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      const target = e.target;
      if (ctx.isEditable(target)) return;
      pressX = e.touches[0].clientX; pressY = e.touches[0].clientY;
      pressTimer = setTimeout(function () {
        pressTimer = null;
        const list = itemsFor({ target: target, clientX: pressX, clientY: pressY });
        if (list.length && open(pressX, pressY, list)) {
          if (navigator.vibrate) navigator.vibrate(10);
        }
      }, ms);
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (pressTimer && e.touches.length && (Math.abs(e.touches[0].clientX - pressX) > 8 || Math.abs(e.touches[0].clientY - pressY) > 8)) {
        clearTimeout(pressTimer); pressTimer = null;
      }
    }, { passive: true });
    document.addEventListener('touchend', function () { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
    document.addEventListener('touchcancel', function () { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
  }

  ctx.log('contextMenu ready');
}
