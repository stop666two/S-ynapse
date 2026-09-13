export function init() {
  var TNS = (window.__TUNING__ || {}).search || {};
  var searchKbIdx = -1;
  var searchKbList = [];
  var lcIndex = null;
  var dataPromise = null;
  function ensureData() {
    var cur = window.__SEARCH_DATA__;
    if (cur && cur.length) return Promise.resolve(cur);
    if (window.__SEARCH_DATA_READY__) return Promise.resolve(cur || []);
    if (dataPromise) return dataPromise;
    var url = window.__SEARCH_INDEX_URL__;
    if (!url) {
      var m = location.pathname.match(/^\/([a-z]{2})(\/|$)/);
      url = '/' + (m ? m[1] : 'zh') + '/search-index.json';
    }
    dataPromise = fetch(url, { credentials: 'same-origin' }).then(function (r) {
      return r.ok ? r.json() : [];
    }).then(function (d) {
      window.__SEARCH_DATA__ = Array.isArray(d) ? d : [];
      window.__SEARCH_DATA_READY__ = true;
      return window.__SEARCH_DATA__;
    }).catch(function () {
      window.__SEARCH_DATA__ = [];
      window.__SEARCH_DATA_READY__ = true;
      return [];
    });
    return dataPromise;
  }
  function searchKbDir(dir) {
    var items = document.querySelectorAll('.search-result-item');
    searchKbList = Array.prototype.slice.call(items);
    if (!searchKbList.length) return;
    searchKbIdx += dir;
    if (searchKbIdx >= searchKbList.length) searchKbIdx = 0;
    if (searchKbIdx < 0) searchKbIdx = searchKbList.length - 1;
    searchKbList.forEach(function (a) { a.classList.remove('kb-active'); });
    searchKbList[searchKbIdx].classList.add('kb-active');
    searchKbList[searchKbIdx].scrollIntoView({ block: 'nearest' });
  }
  function searchKbSelect() {
    if (searchKbIdx > -1 && searchKbList[searchKbIdx]) {
      location.href = searchKbList[searchKbIdx].getAttribute('href');
    }
  }
  function isPagefind() {
    return String(window.__SEARCH_PROVIDER__ || '') === 'pagefind';
  }
  function focusPagefind() {
    var wrap = document.getElementById('pfWrap');
    var i = wrap && wrap.querySelector('input');
    if (i) i.focus();
  }
  function restoreLocalSearch() {
    var fi = document.getElementById('searchInput');
    if (fi) fi.hidden = false;
    var kb = document.querySelector('.search-kbd');
    if (kb) kb.hidden = false;
    var wrap = document.getElementById('pfWrap');
    if (wrap) wrap.hidden = true;
  }
  function ensurePagefind() {
    if (window.__pfReady__) { focusPagefind(); return; }
    if (window.__pfLoading__) { window.__pfLoading__.then(focusPagefind); return; }
    var base = window.__SEARCH_PROVIDER_PATH__ || '/pagefind';
    window.__pfLoading__ = new Promise(function (resolve) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = base + '/pagefind-ui.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = base + '/pagefind-ui.js';
      s.onload = function () {
        var ok = false;
        try {
          var wrap = document.getElementById('pfWrap');
          if (window.PagefindUI && wrap) {
            if (!wrap.getAttribute('data-ready')) {
              new window.PagefindUI({ element: '#pfWrap', showSubResults: true, showImages: false, autofocus: false });
              wrap.setAttribute('data-ready', '1');
            }
            var fi = document.getElementById('searchInput');
            if (fi) fi.hidden = true;
            var kb = document.querySelector('.search-kbd');
            if (kb) kb.hidden = true;
            wrap.hidden = false;
            ok = true;
          }
        } catch (e) { ok = false; }
        if (ok) window.__pfReady__ = true;
        else restoreLocalSearch();
        resolve();
      };
      s.onerror = function () { restoreLocalSearch(); resolve(); };
      document.body.appendChild(s);
    });
    window.__pfLoading__.then(focusPagefind);
  }
  function openSearch() {
    var o = document.getElementById('searchOverlay');
    if (!o) return;
    o.classList.add('open');
    if (isPagefind()) { ensurePagefind(); return; }
    ensureData();
    setTimeout(function () { var i = document.getElementById('searchInput'); if (i) i.focus(); }, 100);
  }
  function closeSearch() {
    var o = document.getElementById('searchOverlay');
    if (o) o.classList.remove('open');
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSearch();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var o = document.getElementById('searchOverlay');
      if (o && !o.classList.contains('open')) {
        var cd = document.querySelector('dialog.cmdp');
        if (cd && cd.open && typeof cd.close === 'function') cd.close();
        openSearch();
      } else closeSearch();
    }
  });
  (function () {
    var F = window.__FEATURES__ || {}, PF = (F && F.pagefind) || {};
    window.__SEARCH_PROVIDER_PATH__ = String(PF.indexPath || '/pagefind').replace(/\/$/, '');
  })();
  var __HSK = 's-hotSearches';
  var __HST = 5;
  function __hs() {
    var F = window.__FEATURES__ || {}, HS = (F && F.hotSearches) || {};
    __HSK = HS.storageKey || 's-hotSearches';
    __HST = isNaN(+TNS.hotCount) ? (isNaN(+HS.top) ? 5 : +HS.top) : +TNS.hotCount;
  }
  (function () {
    var F0 = window.__FEATURES__ || {}, SC0 = (F0 && F0.search) || {};
    if (SC0.showHistoryOnFocus === false) return;
    var inp0 = document.getElementById('searchInput');
    if (inp0) inp0.addEventListener('focus', function () {
      var HS0 = (window.__FEATURES__ || {}).hotSearches || {};
      if (HS0.enabled === false) return;
      renderHistory();
    });
  })();
  var __sdT = null;
  function doSearch(q) {
    var d = document.getElementById('searchResults');
    if (!d) return;
    var F = window.__FEATURES__ || {}, SC = (F && F.search) || {};
    var db = isNaN(+TNS.debounceMs) ? (isNaN(+SC.debounceMs) ? 120 : +SC.debounceMs) : +TNS.debounceMs;
    if (__sdT) clearTimeout(__sdT);
    __sdT = setTimeout(function () { doSearchNow(q); }, db);
  }
  function doSearchNow(q) {
    var d = document.getElementById('searchResults');
    if (!d) return;
    var F = window.__FEATURES__ || {}, SC = (F && F.search) || {};
    var HS = (F && F.hotSearches) || {}, en = HS.enabled !== false;
    var mc = isNaN(+TNS.minQueryLength) ? (isNaN(+SC.minChars) ? 1 : +SC.minChars) : +TNS.minQueryLength;
    var hist = document.getElementById('searchHistory');
    if (hist) {
      if (en && (!q || q.length < mc)) renderHistory();
      else if (hist && !hist.hidden) hist.hidden = true;
    }
    if (!q || q.length < mc) {
      d.classList.remove('has-results');
      d.innerHTML = '';
      var t = document.getElementById('searchCount');
      if (t) t.textContent = '';
      return;
    }
    if (en) saveHistory(q);
    var w = window.__SEARCH_DATA__ || [];
    if (!w.length && !window.__SEARCH_DATA_READY__) {
      ensureData().then(function () {
        if ((window.__SEARCH_DATA__ || []).length) doSearchNow(q);
      });
    }
    var r = [], lq = q.toLowerCase();
    var mrst = isNaN(+TNS.resultLimit) ? (isNaN(+SC.maxResults) ? 30 : +SC.maxResults) : +TNS.resultLimit;
    var el = isNaN(+TNS.excerptLength) ? (isNaN(+SC.excerptLength) ? 120 : +SC.excerptLength) : +TNS.excerptLength;
    var shl = (F && F.searchHighlight) || {};
    var mm = isNaN(+shl.maxMatches) ? 20 : +shl.maxMatches;
    function hl(sx, qq) {
      var esc = sx.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var re;
      try { re = new RegExp('(' + qq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'); }
      catch (e) { return esc; }
      var n = 0;
      return esc.replace(re, function (m) { return n++ < mm ? '<mark>' + m + '</mark>' : m; });
    }
    if (!lcIndex || lcIndex.length !== w.length) {
      lcIndex = [];
      for (var ci = 0; ci < w.length; ci++) {
        var it0 = w[ci] || {};
        lcIndex.push({
          it: it0,
          t: String(it0.title || '').toLowerCase(),
          e: String(it0.excerpt || '').toLowerCase(),
          c: String(it0.content || '').toLowerCase()
        });
      }
    }
    for (var i = 0; i < lcIndex.length; i++) {
      var row = lcIndex[i];
      if (row.t.includes(lq) || row.e.includes(lq) || row.c.includes(lq)) {
        r.push(row.it);
        if (r.length >= mrst) break;
      }
    }
    var cnt = document.getElementById('searchCount');
    if (r.length) {
      d.classList.add('has-results');
      var groups = {};
      r.forEach(function (item) { var g = item.group || 'article'; if (!groups[g]) groups[g] = []; groups[g].push(item); });
      var order = Object.keys(groups);
      order.sort();
      order.forEach(function (g) {
        var gl = document.createElement('div');
        gl.className = 'search-result-group';
        gl.textContent = g === 'article' ? __T('group.article', '文章') : g === 'tag' ? __T('group.tag', '标签') : g === 'category' ? __T('group.category', '分类') : g;
        d.appendChild(gl);
        groups[g].forEach(function (item) {
          var a = document.createElement('a');
          a.className = 'search-result-item';
          a.href = item.url;
          var t2 = document.createElement('div');
          t2.className = 'search-result-title';
          t2.innerHTML = hl(item.title, q);
          a.appendChild(t2);
          if (item.excerpt) {
            var e = document.createElement('div');
            e.className = 'search-result-excerpt';
            e.innerHTML = hl(item.excerpt.substring(0, el), q);
            a.appendChild(e);
          }
          d.appendChild(a);
        });
      });
      if (cnt) cnt.textContent = r.length + ' ' + __T('search.foundText', '个结果');
      saveHistory(q);
    } else {
      d.classList.remove('has-results');
      d.innerHTML = '';
      var empty = document.createElement('div');
      empty.className = 'search-result-empty';
      empty.textContent = TNS.emptyText || SC.noResultText || __T('search.noResult', '未找到相关内容');
      d.appendChild(empty);
      if (cnt) cnt.textContent = '';
    }
  }
  function getHistory() {
    __hs();
    try { return JSON.parse(localStorage.getItem(__HSK) || '[]'); } catch (e) { return []; }
  }
  function saveHistory(q) {
    __hs();
    var h = getHistory();
    var F2 = window.__FEATURES__ || {}, SC2 = (F2 && F2.search) || {};
    var mx = isNaN(+TNS.historyCount) ? (isNaN(+SC2.maxHistory) ? 5 : +SC2.maxHistory) : +TNS.historyCount;
    h = h.filter(function (x) { return x !== q; });
    h.unshift(q);
    h = h.slice(0, mx);
    try { localStorage.setItem(__HSK, JSON.stringify(h)); } catch (e) {}
  }
  function renderHistory() {
    var hist = document.getElementById('searchHistory');
    if (!hist) return;
    var h = getHistory();
    if (!h.length) { hist.hidden = true; return; }
    var html = '<div class="search-history-title">' + __T('search.recent', '最近搜索') + '</div>';
    h.forEach(function (x) {
      html += '<button type="button" class="search-history-item" data-word="' + x.replace(/"/g, '&quot;') + '">' + String(x).replace(/</g, '&lt;') + '</button>';
    });
    hist.innerHTML = html;
    hist.hidden = false;
    hist.querySelectorAll('.search-history-item').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = document.getElementById('searchInput');
        if (i) { i.value = b.getAttribute('data-word'); doSearch(i.value); }
      });
    });
  }
  window.openSearch = openSearch;
  window.closeSearch = closeSearch;
  window.doSearch = doSearch;
  window.searchKbDir = searchKbDir;
  window.searchKbSelect = searchKbSelect;
}
