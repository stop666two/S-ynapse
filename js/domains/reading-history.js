export function init() {
  var F = (window.__FEATURES__ || {}).readingHistory || {};
  if (F.enabled === false) return;
  var KEY = String(F.storageKey || 's-history');
  var maxItems = Number(F.maxItems) > 0 ? Number(F.maxItems) : 5;
  var T = typeof window.__T === 'function' ? window.__T : function (k, d) { return d || k; };
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(o) ? o : [];
    } catch (e) { return []; }
  }
  function save(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 50))); } catch (e) { /* storage 满或被禁用时静默降级 */ }
  }
  function record() {
    if (!document.querySelector('.post-content')) return;
    var can = document.querySelector('link[rel="canonical"]');
    var url = can ? can.getAttribute('href') : location.pathname;
    try { url = new URL(url, location.origin).pathname; } catch (e) { /* 保留原值 */ }
    var h1 = document.querySelector('h1');
    var title = h1 ? h1.textContent.trim() : document.title;
    var a = load().filter(function (x) { return x && x.url !== url; });
    a.unshift({ url: url, title: title, t: Date.now() });
    save(a);
  }
  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var m = Math.floor(diff / 60000);
    var h = Math.floor(diff / 3600000);
    var d = Math.floor(diff / 86400000);
    var lang = (document.documentElement.getAttribute('lang') || 'zh').slice(0, 2) === 'en' ? 'en' : 'zh';
    function rel(n, unit) {
      try { return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-n, unit); }
      catch (e) { return n + ' ' + unit; }
    }
    if (m < 1) return rel(0, 'minute');
    if (m < 60) return rel(m, 'minute');
    if (h < 24) return rel(h, 'hour');
    return rel(d, 'day');
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function render() {
    var host = document.getElementById('readingHistory');
    if (!host) return;
    if (F.showOnHome === false) { host.hidden = true; return; }
    var items = load().slice(0, maxItems).filter(function (x) {
      return x && x.url && x.url !== location.pathname;
    });
    if (!items.length) { host.hidden = true; return; }
    var html = '<h2 class="reading-history-title">' + esc(T('readingHistory.title', '继续阅读')) + '</h2><ul class="reading-history-list">';
    items.forEach(function (x) {
      html += '<li class="rh-item"><a class="rh-link" href="' + esc(x.url) + '"><span class="rh-title">' + esc(x.title) + '</span><span class="rh-time">' + esc(timeAgo(x.t)) + '</span></a></li>';
    });
    html += '</ul>';
    if (F.clearable !== false) html += '<button type="button" class="rh-clear">' + esc(T('readingHistory.clear', '清除')) + '</button>';
    host.innerHTML = html;
    host.hidden = false;
    var btn = host.querySelector('.rh-clear');
    if (btn) {
      btn.addEventListener('click', function () {
        try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
        host.hidden = true;
        host.innerHTML = '';
      });
    }
  }
  record();
  render();
}
