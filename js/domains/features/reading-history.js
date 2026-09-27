export function init() {
  var F = (window.__FEATURES__ || {}).readingHistory || {};
  if (F.enabled === false) return;
  var KEY = String(F.storageKey);
  var maxItems = Number(F.maxItems) > 0 ? Number(F.maxItems) : 5;
  // features.readingHistory.maxStored（缺省/非法回退 50，保持历史行为；仅存储上限，展示条数由 maxItems 控制）。
  var maxStored = Number(F.maxStored) > 0 ? Math.floor(Number(F.maxStored)) : 50;
  var T = typeof window.__T === 'function' ? window.__T : function (k, d) { return d || k; };
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(o) ? o : [];
    } catch (e) { return []; }
  }
  function save(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, maxStored))); } catch (e) { /* storage 满或被禁用时静默降级 */ }
  }
  function currentUrl() {
    var can = document.querySelector('link[rel="canonical"]');
    var url = can ? can.getAttribute('href') : location.pathname;
    try { url = new URL(url, location.origin).pathname; } catch (e) { /* 保留原值 */ }
    return url;
  }
  function lang() {
    return (document.documentElement.getAttribute('lang') || 'zh').slice(0, 2) === 'en' ? 'en' : 'zh';
  }
  // 阅读进度百分比（0-100）：与站点进度条同口径；短页（无可滚动距离）按 0。
  function pct() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (!(max > 0)) return 0;
    return Math.round(Math.min(1, Math.max(0, window.scrollY / max)) * 100);
  }
  // 将当前页进度写回其历史记录（供继续阅读卡片展示）；记录不存在（非文章/未记录）时不写入。
  function updateProgress() {
    var url = currentUrl();
    var a = load(), hit = false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] && a[i].url === url) {
        var v = pct();
        if (a[i].p !== v) { a[i].p = v; hit = true; }
        break;
      }
    }
    if (hit) save(a);
  }
  function record() {
    if (document.prerendering) {
      document.addEventListener('prerenderingchange', function () { record(); }, { once: true });
      return;
    }
    if (!document.querySelector('.post-content')) return;
    var url = currentUrl();
    var h1 = document.querySelector('h1');
    var title = h1 ? h1.textContent.trim() : document.title;
    var prev = null;
    var old = load();
    for (var i = 0; i < old.length; i++) {
      if (old[i] && old[i].url === url) { prev = old[i]; break; }
    }
    var a = old.filter(function (x) { return x && x.url !== url; });
    // 重访保留既有进度；首次进入从 0 起，随滚动更新。
    a.unshift({ url: url, title: title, t: Date.now(), lang: lang(), p: prev && isFinite(+prev.p) ? Math.min(100, Math.max(0, Math.round(+prev.p))) : 0 });
    save(a);
  }
  // 滚动进度更新节流（800ms），pagehide 立即落盘最终进度；软导航前的最后进度已由滚动节流保存。
  var progTimer = 0;
  window.addEventListener('scroll', function () {
    if (progTimer || !document.querySelector('.post-content')) return;
    progTimer = setTimeout(function () { progTimer = 0; updateProgress(); }, 800);
  }, { passive: true });
  window.addEventListener('pagehide', function () { updateProgress(); });
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
  function apply() { record(); render(); }
  apply();
  // 软导航交换 DOM 后重跑：记录新页面浏览量并重渲染侧栏列表。
  window.__SOFTNAV_HOOKS__.push(apply);
}
