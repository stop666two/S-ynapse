// 继续阅读卡片：读取阅读历史（features.readingHistory 的同一份 localStorage 数据，
// 含 progress 字段），在首页渲染最近读过文章的标题 / 进度 / 时间。
// 纯函数在模块顶层导出（与浏览器运行时同源，供 Node 单测经 data URL 导入断言）。

// 阅读进度百分比：y /（文档总高 - 视口高），输出 0-100 整数；
// 无可滚动距离（短页）按 0 处理，与站点阅读进度条（reading.js）口径一致。
export function progressPct(y, scrollHeight, viewportHeight) {
  var max = Number(scrollHeight) - Number(viewportHeight);
  if (!(max > 0)) return 0;
  var ratio = Number(y) / max;
  if (!isFinite(ratio)) return 0;
  if (ratio < 0) ratio = 0;
  if (ratio > 1) ratio = 1;
  return Math.round(ratio * 100);
}

// 单条历史记录归一化：url / title 缺失即丢弃；t 非法按 0；p 缺失或非法按 0，夹取 0-100。
export function normalizeItem(record) {
  if (!record || typeof record !== 'object') return null;
  var url = typeof record.url === 'string' ? record.url.trim() : '';
  var title = typeof record.title === 'string' ? record.title.trim() : '';
  if (!url || !title) return null;
  var t = Number(record.t);
  var p = Number(record.p);
  return {
    url: url,
    title: title,
    t: isFinite(t) ? t : 0,
    lang: typeof record.lang === 'string' ? record.lang : '',
    p: isFinite(p) ? Math.min(100, Math.max(0, Math.round(p))) : 0
  };
}

// 选取最近阅读：过滤非法记录与指定 URL（当前页）、按时间倒序、
// 同 URL 去重（保留最新一条）、截取展示上限（count 非法回退 3）。
export function selectRecent(items, options) {
  var o = options || {};
  var count = parseInt(o.count, 10);
  if (isNaN(count) || count < 1) count = 3;
  var excludeUrl = typeof o.excludeUrl === 'string' ? o.excludeUrl : '';
  var list = Array.isArray(items) ? items : [];
  var valid = [];
  for (var i = 0; i < list.length; i++) {
    var item = normalizeItem(list[i]);
    if (!item) continue;
    if (excludeUrl && item.url === excludeUrl) continue;
    valid.push(item);
  }
  valid.sort(function (a, b) { return b.t - a.t; });
  var seen = {};
  var out = [];
  for (var j = 0; j < valid.length && out.length < count; j++) {
    var cur = valid[j];
    if (seen[cur.url]) continue;
    seen[cur.url] = true;
    out.push(cur);
  }
  return out;
}

// 进度文案：将界面文案模板中的 {percent} 占位符替换为百分比数字（全部占位符）。
export function progressText(template, pct) {
  return String(template == null ? '' : template).split('{percent}').join(String(pct));
}

export function init() {
  var FEATURES = window.__FEATURES__ || {};
  var F = FEATURES.continueReading || {};
  if (F.enabled === false) return;
  // storageKey 留空时回退 readingHistory.storageKey，再回退历史默认键名：只读同一份数据。
  var RH = FEATURES.readingHistory || {};
  var KEY = String(F.storageKey || RH.storageKey || 's-history');
  var count = parseInt(F.count, 10);
  if (isNaN(count) || count < 1) count = 3;
  var showProgress = F.showProgress !== false;
  var T = typeof window.__T === 'function' ? window.__T : function (k, d) { return d || k; };
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(o) ? o : [];
    } catch (e) { return []; }
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
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
  function render() {
    var host = document.getElementById('continueReading');
    if (!host) return;
    var items = selectRecent(load(), { count: count, excludeUrl: location.pathname });
    if (!items.length) { host.hidden = true; host.innerHTML = ''; return; }
    var html = '<h2 class="cr-title">' + esc(T('continueReading.title', '继续阅读')) + '</h2><ul class="cr-list">';
    items.forEach(function (x) {
      var label = progressText(T('continueReading.progress', '已读 {percent}%'), x.p);
      html += '<li class="cr-item"><a class="cr-link" href="' + esc(x.url) + '">' +
        '<span class="cr-item-title">' + esc(x.title) + '</span>' +
        (showProgress
          ? '<span class="cr-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + x.p + '" aria-label="' + esc(label) + '"><span class="cr-bar" style="width:' + x.p + '%"></span></span>'
          : '') +
        '<span class="cr-meta">' +
        (showProgress ? '<span class="cr-pct" aria-hidden="true">' + x.p + '%</span>' : '') +
        '<span class="cr-time">' + esc(timeAgo(x.t)) + '</span></span>' +
        '</a></li>';
    });
    html += '</ul>';
    host.innerHTML = html;
    host.hidden = false;
  }
  function apply() { render(); }
  apply();
  // 软导航交换 DOM 后重跑：首页 ↔ 文章页往返时卡片区按最新历史重渲染。
  window.__SOFTNAV_HOOKS__.push(apply);
}
