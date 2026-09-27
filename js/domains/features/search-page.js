import { ensureIndex, searchIndexState, searchIndex, isValidIndex, highlightHtml, extractSnippet } from './search-core.js';

// /search 独立搜索页（本地链路）：读取 #searchPageInput / #searchPageResults，支持 ?q= 直达；
// 与搜索浮层共用 search-core 的倒排查询与索引缓存；加载失败显示错误态与重试按钮。
export function init() {
  var rDiv = document.getElementById('searchPageResults');
  var input = document.getElementById('searchPageInput');
  if (!rDiv || !input) return;
  var T = typeof window.__T === 'function' ? window.__T : function (k, d) { return d || k; };
  var F = (window.__FEATURES__ || {}).search || {};
  var TNS = (window.__TUNING__ || {}).search || {};
  function num(raw, dflt) { return (raw === '' || raw == null || isNaN(+raw)) ? dflt : +raw; }
  var mc = num(TNS.minQueryLength, num(F.minChars, 1));
  var maxResults = num(TNS.resultLimit, num(F.maxResults, 30));
  var excerptLen = num(TNS.excerptLength, num(F.excerptLength, 120));
  var wT = num(F.weightTitle, 5), wE = num(F.weightExcerpt, 2), wC = num(F.weightContent, 1);
  var mTags = F.matchTags !== false, mCats = F.matchCategories !== false, showCnt = F.showCount !== false;
  var bigram = (F.index || {}).bigram !== false;
  var timeouts = { timeoutMs: num(TNS.indexTimeoutMs, 5000), retries: num(TNS.indexRetry, 1) };
  var shl = (window.__FEATURES__ || {}).searchHighlight || {};
  var hlOn = shl.enabled !== false && F.highlightMatches !== false;
  var maxMatches = num(shl.maxMatches, 20);
  var markClass = String(shl.markClass == null ? '' : shl.markClass);
  var current = '';

  function isEnSearch() {
    return (document.documentElement.getAttribute('data-lang') || ((document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'zh')) === 'en';
  }
  function indexUrl() {
    var u = window.__SEARCH_INDEX_URL__;
    if (!u) {
      var m = location.pathname.match(/^\/([a-z]{2})(\/|$)/);
      u = '/' + (m ? m[1] : 'zh') + '/search-index.json';
    }
    return u;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function hl(sx, q) {
    return highlightHtml(sx, q, { enabled: hlOn, maxMatches: maxMatches, markClass: markClass, bigram: bigram });
  }
  function noResultText() {
    if (isEnSearch()) return F.emptyHintEn || F.noResultTextEn || TNS.emptyTextEn || T('search.notFound', 'No matching articles');
    return F.emptyHint || F.noResultText || TNS.emptyText || T('search.notFound', '未找到相关文章');
  }
  function errorText() {
    return (isEnSearch() ? (TNS.errorTextEn || '') : (TNS.errorText || '')) || T('search.loadError', '搜索索引加载失败，请检查网络后重试');
  }
  function startHint() {
    return T('search.startHint', '输入关键词开始搜索');
  }

  function renderEmpty() {
    rDiv.innerHTML = '<p class="empty-state">' + esc(startHint()) + '</p>';
  }
  function renderError(query) {
    rDiv.innerHTML = '<p class="empty-state search-result-error">' + esc(errorText()) + '</p>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-retry-btn';
    btn.textContent = T('search.retry', '重试');
    btn.addEventListener('click', function () {
      load(true).then(function (idx) {
        if (isValidIndex(idx)) render(query);
        else renderError(query);
      });
    });
    var holder = rDiv.querySelector('.search-result-error');
    if (holder) holder.appendChild(btn);
  }
  function renderResult(query, list) {
    if (!list.length) {
      rDiv.innerHTML = '<p class="empty-state">' + esc(noResultText()) + '</p>';
      return;
    }
    var html = '';
    if (showCnt) html += '<p class="search-count">' + esc(T('search.foundCount', '找到 {count} 个结果').replace('{count}', String(list.length))) + '</p>';
    for (var i = 0; i < list.length; i++) {
      var r = list[i] || {};
      var meta = '';
      if (r.date) meta += '<span class="post-card-meta-item">' + esc(r.date) + '</span>';
      if (r.categories && r.categories.length) {
        meta += '<span class="post-card-meta-item">' + r.categories.map(esc).join(' · ') + '</span>';
      }
      var tagsHtml = '';
      if (r.tags && r.tags.length) {
        tagsHtml = '<div class="post-tags search-result-tags">' + r.tags.slice(0, 6).map(function (t) {
          return '<span class="post-tag">' + esc(t) + '</span>';
        }).join('') + '</div>';
      }
      var excerptHtml = r.excerpt
        ? '<p class="post-card-excerpt">' + hl(extractSnippet(String(r.excerpt), query, excerptLen), query) + '</p>'
        : '';
      html += '<article class="post-card">'
        + (r.featuredImage ? '<a href="' + esc(r.url) + '"><img src="' + esc(r.featuredImage) + '" alt="' + esc(r.title) + '" class="post-card-image" loading="lazy"></a>' : '')
        + '<h2 class="post-card-title"><a href="' + esc(r.url) + '">' + hl(String(r.title || ''), query) + '</a></h2>'
        + excerptHtml
        + (meta ? '<div class="post-card-meta">' + meta + '</div>' : '')
        + tagsHtml
        + '</article>';
    }
    rDiv.innerHTML = html;
  }
  function render(query) {
    current = query;
    if (!query || query.length < mc) { renderEmpty(); return; }
    var state = searchIndexState();
    if (!state.index) {
      load(false).then(function (idx) {
        if (input.value !== query && current !== query) return;
        if (isValidIndex(idx)) render(query);
        else renderError(query);
      });
      return;
    }
    var list = searchIndex(state.index, query, {
      weights: { title: wT, excerpt: wE, content: wC },
      matchTags: mTags,
      matchCategories: mCats,
      limit: maxResults
    });
    renderResult(query, list);
  }
  var loadPromise = null;
  function load(force) {
    var state = searchIndexState();
    if (state.index && !force) return Promise.resolve(state.index);
    if (!force && loadPromise) return loadPromise;
    loadPromise = ensureIndex(indexUrl(), { timeoutMs: timeouts.timeoutMs, retries: timeouts.retries, force: !!force }).then(function (idx) {
      loadPromise = null;
      return idx;
    });
    return loadPromise;
  }

  input.addEventListener('input', function () { render(input.value); });
  var params = new URLSearchParams(location.search);
  var q = params.get('q');
  if (q) {
    input.value = q;
    render(q);
  } else {
    renderEmpty();
    load(false);
  }
}
