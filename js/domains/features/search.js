import { ensureIndex, searchIndex, isValidIndex, highlightHtml } from './search-core.js';

export function init() {
  var TNS = (window.__TUNING__ || {}).search || {};
  var searchKbIdx = -1;
  var searchKbList = [];
  // 索引地址为构建期内容寻址 URL（页面内联注入）；缺失即索引不可用（旧固定路径已不再产出，不回退）。
  function searchIndexUrl() {
    return window.__SEARCH_INDEX_URL__ || '';
  }
  // 索引加载：倒排索引（构建期内容寻址 JSON）；缓存到 window.__SEARCH_DATA__（失败置 __SEARCH_ERROR__）。
  function ensureData(force) {
    var cur = window.__SEARCH_DATA__;
    if (!force && cur && isValidIndex(cur)) return Promise.resolve(cur);
    if (!force && window.__SEARCH_DATA_READY__ && isValidIndex(cur)) return Promise.resolve(cur);
    if (cur && !isValidIndex(cur)) {
      window.__SEARCH_DATA__ = null;
      window.__SEARCH_DATA_READY__ = false;
    }
    var tRaw = +TNS.indexTimeoutMs;
    var timeoutMs = isNaN(tRaw) || tRaw <= 0 ? 5000 : tRaw;
    var rRaw = parseInt(TNS.indexRetry, 10);
    var retries = isNaN(rRaw) || rRaw < 0 ? 1 : rRaw;
    window.__SEARCH_ERROR__ = false;
    var url = searchIndexUrl();
    if (!url) {
      // 无索引地址（构建未产出/配置关闭）：显式错误态，不请求任何地址。
      window.__SEARCH_DATA__ = null;
      window.__SEARCH_DATA_READY__ = false;
      window.__SEARCH_ERROR__ = true;
      return Promise.resolve(null);
    }
    return ensureIndex(url, { timeoutMs: timeoutMs, retries: retries, force: !!force }).then(function (data) {
      if (data) {
        window.__SEARCH_DATA__ = data;
        window.__SEARCH_DATA_READY__ = true;
        return data;
      }
      window.__SEARCH_DATA__ = null;
      window.__SEARCH_DATA_READY__ = false;
      window.__SEARCH_ERROR__ = true;
      return null;
    });
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
    // features.pagefind.integrate=false → 即使 provider=pagefind 也回退内置搜索链路。
    var PF = (window.__FEATURES__ || {}).pagefind || {};
    return String(window.__SEARCH_PROVIDER__ || '') === 'pagefind' && PF.integrate !== false;
  }
  function isEnSearch() {
    return window.langOf() === 'en';
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
  function ensurePagefind(wantFocus) {
    var focus = wantFocus !== false;
    if (window.__pfReady__) { if (focus) focusPagefind(); return; }
    if (window.__pfLoading__) { if (focus) window.__pfLoading__.then(focusPagefind); return; }
    var base = window.__SEARCH_PROVIDER_PATH__;
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
    if (focus) window.__pfLoading__.then(focusPagefind);
  }
  function openSearch() {
    var o = document.getElementById('searchOverlay');
    if (!o) return;
    o.classList.add('open');
    // 聚焦开关与延迟来自 features.search.focusOnOpen / focusDelayMs；兜底值与 features-schema.js → DEFAULT_FEATURES.search 同值。
    var _scf = (window.__FEATURES__ || {}).search || {};
    var _focus = _scf.focusOnOpen !== false;
    if (isPagefind()) { ensurePagefind(_focus); return; }
    ensureData();
    // features.search.emptyHint(En)：无输入提示（空 = 不显示，保持历史行为）。
    var _ih = isEnSearch() ? (_scf.emptyHintEn || '') : (_scf.emptyHint || '');
    var _ird = document.getElementById('searchResults');
    if (_ih && _ird && !_ird.classList.contains('has-results') && !_ird.childNodes.length) {
      var _hb = document.createElement('div');
      _hb.className = 'search-result-empty';
      _hb.textContent = _ih;
      _ird.appendChild(_hb);
    }
    if (!_focus) return;
    setTimeout(function () { var i = document.getElementById('searchInput'); if (i) i.focus(); }, isNaN(+_scf.focusDelayMs) ? 100 : Math.max(0, +_scf.focusDelayMs));
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
    window.__SEARCH_PROVIDER_PATH__ = String(PF.indexPath).replace(/\/$/, '');
  })();
  var __HSK = '';
  function __hs() {
    var F = window.__FEATURES__ || {}, HS = (F && F.hotSearches) || {};
    __HSK = HS.storageKey;
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
      searchKbIdx = -1;
      var t = document.getElementById('searchCount');
      if (t) t.textContent = '';
      if (!q) {
        // features.search.emptyHint(En)：无输入提示（空 = 不显示，保持历史行为）。
        var eh = isEnSearch() ? (SC.emptyHintEn || '') : (SC.emptyHint || '');
        if (eh) {
          var hintBox = document.createElement('div');
          hintBox.className = 'search-result-empty';
          hintBox.textContent = eh;
          d.appendChild(hintBox);
        }
      }
      return;
    }
    if (en) saveHistory(q);
    var idx = window.__SEARCH_DATA__;
    if (!isValidIndex(idx) && !window.__SEARCH_DATA_READY__) {
      ensureData().then(function () {
        // 加载竞态防护：请求返回时输入框内容已变化，则放弃本次渲染（新输入会重新检索）。
        var input = document.getElementById('searchInput');
        if (input && input.value !== q) return;
        if (isValidIndex(window.__SEARCH_DATA__)) { doSearchNow(q); return; }
        if (window.__SEARCH_ERROR__) renderSearchError(d, q);
      });
      return;
    }
    var mrst = isNaN(+TNS.resultLimit) ? (isNaN(+SC.maxResults) ? 30 : +SC.maxResults) : +TNS.resultLimit;
    var el = isNaN(+TNS.excerptLength) ? (isNaN(+SC.excerptLength) ? 120 : +SC.excerptLength) : +TNS.excerptLength;
    var shl = (F && F.searchHighlight) || {};
    var mm = isNaN(+shl.maxMatches) ? 20 : +shl.maxMatches;
    var hlOn = shl.enabled !== false && SC.highlightMatches !== false;
    // searchHighlight.markClass：core 侧只保留安全类名字符；空=不附加 class（默认，保持历史输出）。
    var mkCls = String(shl.markClass == null ? '' : shl.markClass);
    var idxCfg = SC.index || {};
    var hlBigram = idxCfg.bigram !== false;
    function hl(sx) {
      return highlightHtml(sx, q, { enabled: hlOn, maxMatches: mm, markClass: mkCls, bigram: hlBigram });
    }
    // features.search.weightTitle/weightExcerpt/weightContent（默认 5/2/1；权重 0 = 该字段不参与匹配与计分）
    // 与 matchTags/matchCategories（tags/categories 仅参与命中判定，计 0 分）。
    // canonical 纯函数语义见 scripts/lib/feature-wiring.js → rankSearchEntries；倒排查询实现见 js/domains/features/search-core.js。
    var __wNum = function (raw, dflt) { return (raw === '' || raw == null || isNaN(+raw)) ? dflt : Math.max(0, +raw); };
    var wT = __wNum(SC.weightTitle, 5), wE = __wNum(SC.weightExcerpt, 2), wC = __wNum(SC.weightContent, 1);
    var mTags = SC.matchTags !== false, mCats = SC.matchCategories !== false, showCnt = SC.showCount !== false;
    var r = searchIndex(isValidIndex(idx) ? idx : { docs: [], fields: {} }, q, {
      weights: { title: wT, excerpt: wE, content: wC },
      matchTags: mTags,
      matchCategories: mCats,
      limit: mrst
    });
    var cnt = document.getElementById('searchCount');
    if (r.length) {
      // 清空旧结果，避免连续查询时旧结果节点叠加（回归：重复查询追加）。
      d.innerHTML = '';
      searchKbIdx = -1;
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
          t2.innerHTML = hl(item.title);
          a.appendChild(t2);
          if (item.excerpt) {
            var e = document.createElement('div');
            e.className = 'search-result-excerpt';
            e.innerHTML = hl(item.excerpt.substring(0, el));
            a.appendChild(e);
          }
          d.appendChild(a);
        });
      });
      // features.search.showCount：结果计数显隐；文案取 ui-strings.search.foundCount（双语，{count} 占位）。
      if (cnt) cnt.textContent = showCnt ? __T('search.foundCount', '找到 {count} 个结果').replace('{count}', String(r.length)) : '';
    } else {
      d.classList.remove('has-results');
      d.innerHTML = '';
      searchKbIdx = -1;
      var empty = document.createElement('div');
      empty.className = 'search-result-empty';
      // 无结果文案优先级链：emptyHint(En) > noResultText(En) > tuning.search.emptyText(En) > i18n 兜底。
      empty.textContent = isEnSearch()
        ? (SC.emptyHintEn || SC.noResultTextEn || TNS.emptyTextEn || __T('search.noResult', '未找到相关内容'))
        : (SC.emptyHint || SC.noResultText || TNS.emptyText || __T('search.noResult', '未找到相关内容'));
      d.appendChild(empty);
      if (cnt) cnt.textContent = '';
    }
  }
  function renderSearchError(d, q) {
    d.classList.remove('has-results');
    d.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'search-result-empty search-result-error';
    var msg = document.createElement('div');
    // 失败提示链：tuning.search.errorText(En)（按语言，空 = 不参与）> i18n 内置双语兜底。
    msg.textContent = (isEnSearch() ? (TNS.errorTextEn || '') : (TNS.errorText || '')) || __T('search.loadError', '搜索索引加载失败，请检查网络后重试');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-retry-btn';
    btn.textContent = __T('search.retry', '重试');
    // 重试：force 丢弃失败缓存后重新加载索引；成功则重放查询，仍失败保持错误态。
    btn.addEventListener('click', function () {
      ensureData(true).then(function () {
        if (isValidIndex(window.__SEARCH_DATA__)) doSearchNow(q);
        else renderSearchError(d, q);
      });
    });
    box.appendChild(msg);
    box.appendChild(btn);
    d.appendChild(box);
    var cnt = document.getElementById('searchCount');
    if (cnt) cnt.textContent = '';
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
    try { localStorage.setItem(__HSK, JSON.stringify(h)); } catch (e) { /* 忽略：存储不可用时历史仅当次会话有效 */ }
    bumpHot(q);
  }
  var HOT_SUFFIX = ':hot';
  function readHot() {
    __hs();
    try {
      var o = JSON.parse(localStorage.getItem(__HSK + HOT_SUFFIX) || '{}');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch (e) { return {}; }
  }
  function bumpHot(q) {
    var F3 = window.__FEATURES__ || {}, HS = (F3 && F3.hotSearches) || {};
    if (HS.enabled === false || HS.showInDropdown === false || !q) return;
    // features.hotSearches.maxWords（缺省/非法回退 50，保持历史行为）。
    var MW = isNaN(+HS.maxWords) ? 50 : Math.max(1, Math.floor(+HS.maxWords));
    var hot = readHot();
    hot[q] = (+hot[q] || 0) + 1;
    var keys = Object.keys(hot);
    if (keys.length > MW) {
      keys.sort(function (a, b) { return hot[b] - hot[a]; });
      var pruned = {};
      keys.slice(0, MW).forEach(function (k) { pruned[k] = hot[k]; });
      hot = pruned;
    }
    try { localStorage.setItem(__HSK + HOT_SUFFIX, JSON.stringify(hot)); } catch (e) { /* 忽略：存储不可用时热门词不记录 */ }
  }
  function clearHot() {
    __hs();
    try { localStorage.removeItem(__HSK + HOT_SUFFIX); } catch (e) { /* 忽略：存储不可用时无需清理 */ }
    renderHistory();
  }
  function escWord(x) {
    return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderHistory() {
    var hist = document.getElementById('searchHistory');
    if (!hist) return;
    var FH = window.__FEATURES__ || {}, HS = (FH && FH.hotSearches) || {};
    var h = getHistory();
    var hotArr = [];
    if (HS.enabled !== false && HS.showInDropdown !== false) {
      var hot = readHot();
      hotArr = Object.keys(hot).filter(function (k) { return k && hot[k] > 0; })
        .sort(function (a, b) { return (hot[b] - hot[a]) || (a < b ? -1 : 1); })
        .slice(0, isNaN(+HS.top) ? 5 : Math.max(0, +HS.top));
    }
    if (!h.length && !hotArr.length) { hist.hidden = true; return; }
    var html = '';
    if (hotArr.length) {
      html += '<div class="search-history-title">' + __T('search.hot', '热门搜索')
        + (HS.showClear !== false ? '<button type="button" class="search-history-clear" data-hot-clear aria-label="' + escWord(__T('search.clearHot', '清空热门搜索')) + '">' + escWord(__T('search.clear', '清空')) + '</button>' : '')
        + '</div>';
      hotArr.forEach(function (x) {
        html += '<button type="button" class="search-history-item" data-word="' + escWord(x) + '">' + escWord(x) + '</button>';
      });
    }
    if (h.length) {
      html += '<div class="search-history-title">' + __T('search.recent', '最近搜索') + '</div>';
      h.forEach(function (x) {
        html += '<button type="button" class="search-history-item" data-word="' + escWord(x) + '">' + escWord(x) + '</button>';
      });
    }
    hist.innerHTML = html;
    hist.hidden = false;
    var clr = hist.querySelector('[data-hot-clear]');
    if (clr) clr.addEventListener('click', function (e) { e.preventDefault(); clearHot(); });
    hist.querySelectorAll('.search-history-item').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = document.getElementById('searchInput');
        if (i) { i.value = b.getAttribute('data-word'); doSearch(i.value); }
      });
    });
  }
  var ov = document.getElementById('searchOverlay');
  if (ov) ov.addEventListener('click', function (e) {
    if (e.target !== ov) return;
    var SC2 = (window.__FEATURES__ || {}).search || {};
    if (SC2.closeOnOverlay !== false) closeSearch();
  });
  var sc = document.querySelector('.search-close');
  if (sc) sc.addEventListener('click', function () { closeSearch(); });
  var si = document.getElementById('searchInput');
  if (si) si.addEventListener('input', function (e) { doSearch(e.target.value); });
  window.openSearch = openSearch;
  if (window.__openSearchPending) { window.__openSearchPending = false; openSearch(); }
  window.closeSearch = closeSearch;
  window.doSearch = doSearch;
  window.searchKbDir = searchKbDir;
  window.searchKbSelect = searchKbSelect;
}
