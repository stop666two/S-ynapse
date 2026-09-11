export function init() {
  var searchKbIdx = -1;
  var searchKbList = [];
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
  function openSearch() {
    var o = document.getElementById('searchOverlay');
    if (o) {
      o.classList.add('open');
      setTimeout(function () { var i = document.getElementById('searchInput'); if (i) i.focus(); }, 100);
    }
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
      if (o && !o.classList.contains('open')) openSearch(); else closeSearch();
    }
  });
  (function () {
    var F = window.__FEATURES__ || {}, PF = (F && F.pagefind) || {};
    if (PF.enabled !== false && PF.indexPath) {
      var done = false;
      function loadPF() {
        if (done || window.__pagefind__) return;
        done = true;
        var s = document.createElement('script');
        s.src = (PF.indexPath.replace(/\/$/, '')) + '/pagefind-ui.js';
        s.onload = function () {
          if (window.PagefindUI && document.getElementById('pfWrap')) {
            if (window.__pfInit__ === false) {
              window.__pfInit__ = new window.PagefindUI({ element: '#pfWrap', showSubResults: true, translations: window.__I18N__ && window.__I18N__['zh'] ? {} : {} });
            }
          }
        };
        document.body.appendChild(s);
      }
      var inp = document.getElementById('searchInput');
      if (inp) inp.addEventListener('focus', loadPF);
    }
  })();
  var __HSK = 's-hotSearches';
  var __HST = 5;
  function __hs() {
    var F = window.__FEATURES__ || {}, HS = (F && F.hotSearches) || {};
    __HSK = HS.storageKey || 's-hotSearches';
    __HST = isNaN(+HS.top) ? 5 : +HS.top;
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
    var db = isNaN(+SC.debounceMs) ? 120 : +SC.debounceMs;
    if (__sdT) clearTimeout(__sdT);
    __sdT = setTimeout(function () { doSearchNow(q); }, db);
  }
  function doSearchNow(q) {
    var d = document.getElementById('searchResults');
    if (!d) return;
    var F = window.__FEATURES__ || {}, SC = (F && F.search) || {};
    var HS = (F && F.hotSearches) || {}, en = HS.enabled !== false;
    var mc = isNaN(+SC.minChars) ? 1 : +SC.minChars;
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
    var w = window.__SEARCH_DATA__ || [], r = [], lq = q.toLowerCase();
    var mrst = isNaN(+SC.maxResults) ? 30 : +SC.maxResults;
    var el = isNaN(+SC.excerptLength) ? 120 : +SC.excerptLength;
    var shl = (F && F.searchHighlight) || {};
    var mm = isNaN(+shl.maxMatches) ? 20 : +shl.maxMatches;
    function hl(sx, qq) {
      var esc = sx.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var re = new RegExp('(' + qq.replace(/[.*+?^${}()|]/g, '$&') + ')', 'gi');
      var n = 0;
      return esc.replace(re, function (m) { return n++ < mm ? '<mark>' + m + '</mark>' : m; });
    }
    for (var i = 0; i < w.length; i++) {
      var it = w[i];
      if (it.title && it.title.toLowerCase().includes(lq) || it.excerpt && it.excerpt.toLowerCase().includes(lq) || it.content && it.content.toLowerCase().includes(lq)) {
        r.push(it);
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
      var empty = document.createElement('div');
      empty.className = 'search-result-empty';
      empty.textContent = SC.noResultText || __T('search.noResult', '未找到相关内容');
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
    var mx = isNaN(+SC2.maxHistory) ? 5 : +SC2.maxHistory;
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
