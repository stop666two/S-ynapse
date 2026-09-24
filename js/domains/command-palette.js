export function init() {
  var F = (window.__FEATURES__ || {}).commandPalette || {};
  if (F.enabled === false) return;
  // 解析组合键配置（如 'ctrl+shift+p' / 'alt+k' / 'meta+p'）。
  // 兼容旧写法：不含 '+' 的单个键（如 'k'）= 主修饰键（Ctrl 或 Cmd）+ 该键，且无 Shift/Alt。
  // 返回 null 表示未配置热键（不监听）。
  function parseHotkey(raw) {
    var s = String(raw || '').trim().toLowerCase();
    if (!s) return null;
    var parts = s.split('+').map(function (p) { return p.trim(); }).filter(Boolean);
    var key = parts.length ? parts[parts.length - 1] : '';
    if (!key) return null;
    var mods = parts.slice(0, -1);
    if (!mods.length) return { key: key, ctrl: false, meta: false, shift: false, alt: false, primaryOnly: true };
    return {
      key: key,
      ctrl: mods.indexOf('ctrl') !== -1 || mods.indexOf('control') !== -1,
      meta: mods.indexOf('meta') !== -1 || mods.indexOf('cmd') !== -1 || mods.indexOf('command') !== -1,
      shift: mods.indexOf('shift') !== -1,
      alt: mods.indexOf('alt') !== -1,
      primaryOnly: false
    };
  }
  // 热键语义：undefined/null 回退默认 'k'；空字符串=显式关闭监听（与 features.json5 注释一致）
  var hotkey = parseHotkey(F.hotkey === undefined || F.hotkey === null ? 'k' : F.hotkey);
  var maxResults = Number(F.maxResults) > 0 ? Number(F.maxResults) : 8;
  var T = typeof window.__T === 'function' ? window.__T : function (k, d) { return d || k; };
  var dlg = null, input = null, listEl = null;
  var navItems = null, actItems = null, posts = null, results = [], active = -1;

  function langPrefix() {
    var m = location.pathname.match(/^\/([a-z]{2})(\/|$)/);
    return '/' + (m ? m[1] : 'zh') + '/';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function gatherNav() {
    if (!F.includeNavigation || navItems) return navItems || [];
    var seen = {};
    navItems = Array.prototype.slice.call(document.querySelectorAll('.nav-list .nav-link')).map(function (a) {
      return { type: 'nav', label: (a.textContent || '').trim(), url: a.getAttribute('href') || a.href };
    }).filter(function (it) {
      var key = it.url.replace(/\/+$/, '') || '/';
      if (!it.label || seen[key]) return false;
      seen[key] = 1;
      return true;
    });
    return navItems;
  }
  function gatherActions() {
    if (!F.includeActions || actItems) return actItems || [];
    actItems = [];
    if (document.querySelector('.dark-toggle')) {
      actItems.push({ type: 'action', label: T('commandPalette.actTheme', '切换主题'), run: function () { if (typeof window.toggleDark === 'function') window.toggleDark(); } });
    }
    actItems.push({ type: 'action', label: T('commandPalette.actTop', '回到顶部'), run: function () { window.scrollTo({ top: 0, behavior: window.__SB() }); } });
    if (document.querySelector('.search-toggle, #searchBtn')) {
      actItems.push({ type: 'action', label: T('commandPalette.actSearch', '打开搜索'), run: function () { if (typeof window.openSearch === 'function') window.openSearch(); } });
    }
    if (document.getElementById('favBtn') || document.querySelector('a[href$="favorites/"]')) {
      actItems.push({ type: 'action', label: T('commandPalette.actFavorites', '我的收藏'), url: langPrefix() + 'favorites/' });
    }
    return actItems;
  }
  function loadPosts() {
    if (!F.includeSearch || posts !== null) return Promise.resolve(posts || []);
    return fetch(langPrefix() + 'search-index.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (data) {
      posts = Object.keys(data || {}).map(function (k) { return data[k]; }).filter(function (p) {
        return p && p.title;
      }).map(function (p) {
        return { type: 'post', label: p.title, url: p.url, hint: p.excerpt || '' };
      });
      return posts;
    }).catch(function () {
      posts = [];
      return posts;
    });
  }
  function build() {
    if (dlg) return;
    dlg = document.createElement('dialog');
    dlg.className = 'cmdp';
    dlg.setAttribute('aria-label', T('commandPalette.open', '命令面板'));
    dlg.innerHTML = '<div class="cmdp-box"><input type="text" class="cmdp-input" role="combobox" aria-expanded="true" aria-controls="cmdpList" autocomplete="off" spellcheck="false"><div class="cmdp-list" id="cmdpList" role="listbox"></div></div>';
    document.body.appendChild(dlg);
    input = dlg.querySelector('.cmdp-input');
    input.placeholder = T('commandPalette.placeholder', '搜索文章、页面或操作…');
    listEl = dlg.querySelector('.cmdp-list');
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    input.addEventListener('input', function (e) { if (e.isComposing) return; update(input.value); });
    input.addEventListener('keydown', onKey);
    dlg.addEventListener('close', function () { active = -1; });
  }
  function onKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter') {
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      pick();
    }
  }
  function move(d) {
    if (!results.length) return;
    active = (active + d + results.length) % results.length;
    paint();
  }
  function paint() {
    var els = listEl.querySelectorAll('.cmdp-item');
    Array.prototype.forEach.call(els, function (el, i) { el.classList.toggle('active', i === active); });
    if (active > -1 && els[active]) {
      els[active].scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', els[active].id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }
  function pick() {
    var it = results[active > -1 ? active : 0];
    if (it) activate(it);
  }
  function activate(it) {
    if (dlg.open) dlg.close();
    if (it.run) { it.run(); return; }
    if (it.url) location.href = it.url;
  }
  function update(q) {
    q = String(q || '').trim().toLowerCase();
    var nav = gatherNav().filter(function (i) { return !q || i.label.toLowerCase().indexOf(q) > -1; });
    var act = gatherActions().filter(function (i) { return !q || i.label.toLowerCase().indexOf(q) > -1; });
    var post = [];
    if (q && F.includeSearch && posts) {
      post = posts.filter(function (p) {
        return p.label.toLowerCase().indexOf(q) > -1 || (p.hint || '').toLowerCase().indexOf(q) > -1;
      }).sort(function (a, b) {
        return a.label.toLowerCase().indexOf(q) - b.label.toLowerCase().indexOf(q);
      });
    }
    results = nav.concat(act).concat(post).slice(0, maxResults);
    render();
  }
  function render() {
    var heads = { nav: T('commandPalette.groupNav', '页面'), action: T('commandPalette.groupAction', '操作'), post: T('commandPalette.groupPost', '文章') };
    var html = '', cur = '';
    results.forEach(function (it, i) {
      if (it.type !== cur) {
        cur = it.type;
        html += '<div class="cmdp-group">' + heads[cur] + '</div>';
      }
      html += '<div class="cmdp-item" role="option" id="cmdp-i-' + i + '" data-i="' + i + '"><span>' + esc(it.label) + '</span></div>';
    });
    if (!results.length) html = '<div class="cmdp-empty">' + T('commandPalette.noResults', '没有匹配结果') + '</div>';
    listEl.innerHTML = html;
    active = results.length ? 0 : -1;
    paint();
    Array.prototype.forEach.call(listEl.querySelectorAll('.cmdp-item'), function (el) {
      el.addEventListener('click', function () { activate(results[Number(el.getAttribute('data-i'))]); });
      el.addEventListener('mousemove', function () { active = Number(el.getAttribute('data-i')); paint(); });
    });
  }
  function open() {
    build();
    if (dlg.open) return;
    var so = document.getElementById('searchOverlay');
    if (so && so.classList.contains('open') && typeof window.closeSearch === 'function') window.closeSearch();
    input.value = '';
    update('');
    dlg.showModal();
    if (F.autoFocus !== false) input.focus();
    loadPosts().then(function () { if (dlg.open) update(input.value); });
  }
  function toggle() {
    if (dlg && dlg.open) { dlg.close(); return; }
    open();
  }
  document.addEventListener('keydown', function (e) {
    if (!hotkey || e.repeat) return;
    if (e.key.toLowerCase() !== hotkey.key) return;
    if (e.altKey !== hotkey.alt || e.shiftKey !== hotkey.shift) return;
    if (hotkey.primaryOnly) {
      if (!(e.ctrlKey || e.metaKey)) return;
    } else {
      if (e.ctrlKey !== hotkey.ctrl || e.metaKey !== hotkey.meta) return;
      // 显式组合键必须至少含一个非 Shift 修饰键，避免裸键/仅 Shift 劫持常规输入。
      if (!hotkey.ctrl && !hotkey.meta && !hotkey.alt) return;
    }
    if (hotkey.key === 'k' && document.getElementById('searchOverlay')) return;
    e.preventDefault();
    toggle();
  });
}
