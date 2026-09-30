// 继续阅读卡片：读取阅读历史（features.readingHistory 的同一份 localStorage 数据，
// 含 progress 字段），在首页渲染最近读过文章的标题 / 进度 / 时间；
// 支持单条移除与一键清空（均写回同一份历史数据，不新建数据源）。
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

// 存储上限重算（canonical）：保留列表前段（存储约定为最新在前），超过 maxStored 截断；
// maxStored 非法/缺省（非正数）时不截断；始终返回新数组，不修改入参。
export function capList(items, maxStored) {
  var list = Array.isArray(items) ? items : [];
  var cap = Math.floor(Number(maxStored));
  if (!(cap > 0)) return list.slice();
  return list.slice(0, cap);
}

// 按 URL 移除原始记录：过滤同 URL 全部条目（保持其余记录字段原样，不得经归一化重写数据源），
// 再按 maxStored 重算存储上限；url 非字符串/空串时不做移除（仅按上限返回副本）。
export function removeByUrl(items, url, maxStored) {
  var list = Array.isArray(items) ? items : [];
  var target = typeof url === 'string' ? url : '';
  var out = target
    ? list.filter(function (x) { return !x || x.url !== target; })
    : list.slice();
  return capList(out, maxStored);
}

// 清空契约：返回空列表（供运行时落盘；任意输入安全）。
export function clearList() {
  return [];
}

export function init() {
  var FEATURES = window.__FEATURES__ || {};
  var F = FEATURES.continueReading || {};
  if (F.enabled === false) return;
  // storageKey 留空时回退 readingHistory.storageKey，再回退历史默认键名：只读同一份数据。
  var RH = FEATURES.readingHistory || {};
  var KEY = String(F.storageKey || RH.storageKey || 's-history');
  // 存储上限与阅读历史一致（features.readingHistory.maxStored，缺省/非法回退 50）。
  var maxStored = Number(RH.maxStored) > 0 ? Math.floor(Number(RH.maxStored)) : 50;
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
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(capList(list, maxStored))); } catch (e) { /* 存储满或被禁用时静默降级 */ }
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function isEn() {
    return (document.documentElement.getAttribute('lang') || 'zh').slice(0, 2) === 'en';
  }
  // 文案键解析：config 键（removeLabel(En) / clearLabel(En)）优先，空回退 ui-strings。
  function label(zhKey, enKey, uiKey, dflt) {
    var v = isEn() ? F[enKey] : F[zhKey];
    return v || T('continueReading.' + uiKey, dflt);
  }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var m = Math.floor(diff / 60000);
    var h = Math.floor(diff / 3600000);
    var d = Math.floor(diff / 86400000);
    var lang = isEn() ? 'en' : 'zh';
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
    disarm();
    var items = selectRecent(load(), { count: count, excludeUrl: location.pathname });
    if (!items.length) { host.hidden = true; host.innerHTML = ''; return; }
    var removeLabel = label('removeLabel', 'removeLabelEn', 'remove', '移除');
    var clearText = label('clearLabel', 'clearLabelEn', 'clear', '清空');
    var html = '<div class="cr-head"><h2 class="cr-title">' + esc(T('continueReading.title', '继续阅读')) +
      '</h2><button type="button" class="cr-clear" aria-label="' + esc(clearText) + '" title="' + esc(clearText) + '">' + esc(clearText) + '</button></div>';
    html += '<ul class="cr-list">';
    items.forEach(function (x) {
      var progressLabel = progressText(T('continueReading.progress', '已读 {percent}%'), x.p);
      var removeAria = removeLabel + ' ' + x.title;
      html += '<li class="cr-item"><a class="cr-link" href="' + esc(x.url) + '">' +
        '<span class="cr-item-title">' + esc(x.title) + '</span>' +
        (showProgress
          ? '<span class="cr-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + x.p + '" aria-label="' + esc(progressLabel) + '"><span class="cr-bar" style="width:' + x.p + '%"></span></span>'
          : '') +
        '<span class="cr-meta">' +
        (showProgress ? '<span class="cr-pct" aria-hidden="true">' + x.p + '%</span>' : '') +
        '<span class="cr-time">' + esc(timeAgo(x.t)) + '</span></span>' +
        '</a>' +
        '<button type="button" class="cr-remove" data-url="' + esc(x.url) + '" aria-label="' + esc(removeAria) + '" title="' + esc(removeLabel) + '">&times;</button>' +
        '</li>';
    });
    html += '</ul>';
    host.innerHTML = html;
    host.hidden = false;
  }
  // 单条移除：写回同一存储键 → 即时动画移除卡片 → 重渲染（全部移除后 section 隐藏）。
  function removeOne(url, li) {
    save(removeByUrl(load(), url, maxStored));
    if (!li || reducedMotion()) { render(); return; }
    li.classList.add('cr-removing');
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      li.classList.remove('cr-removing');
      li.removeEventListener('transitionend', finish);
      render();
    }
    li.addEventListener('transitionend', finish);
    setTimeout(finish, 360);
  }
  // 一键清空：二次点击轻确认（按钮进入 armed 态并显示确认文案，3 秒未确认自动复位）；
  // 确认后清空同一份历史并隐藏 section。非阻塞，无弹窗。
  var armedBtn = null;
  var armTimer = 0;
  function disarm() {
    if (armTimer) { clearTimeout(armTimer); armTimer = 0; }
    if (!armedBtn) return;
    armedBtn.classList.remove('cr-clear-armed');
    armedBtn.setAttribute('aria-pressed', 'false');
    armedBtn.textContent = label('clearLabel', 'clearLabelEn', 'clear', '清空');
    armedBtn = null;
  }
  function clearAll(btn) {
    if (armedBtn !== btn) {
      disarm();
      armedBtn = btn;
      btn.classList.add('cr-clear-armed');
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = T('continueReading.clearConfirm', '再次点击确认清空');
      armTimer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    save(clearList());
    var host = document.getElementById('continueReading');
    if (host) { host.hidden = true; host.innerHTML = ''; }
  }
  // 文档级委托：软导航交换内容后无需重绑；仅命中继续阅读的移除/清空按钮。
  if (!window.__continueReadingBound) {
    window.__continueReadingBound = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || typeof t.closest !== 'function') return;
      var rm = t.closest('.cr-remove');
      if (rm) { removeOne(rm.getAttribute('data-url') || '', rm.closest('.cr-item')); return; }
      var cl = t.closest('.cr-clear');
      if (cl) clearAll(cl);
    });
  }
  function apply() { render(); }
  apply();
  // 软导航交换 DOM 后重跑：首页 ↔ 文章页往返时卡片区按最新历史重渲染。
  window.__SOFTNAV_HOOKS__.push(apply);
}
