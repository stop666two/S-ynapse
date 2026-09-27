// 每日一言运行时：日期固定一条 + 「换一句」随机下一条（不持久化）+ 「复制」（剪贴板 API，
// textarea 回退）。数据由构建期注入 window.__QUOTES__（数据文件见 data/quotes.json5）。
// 语言按 document.documentElement.lang 判定：优先 *En 字段，空回退中文（西方公版条目
// textEn=text，为英文原文）。软导航替换内容区后经 __SOFTNAV_HOOKS__ 重渲染，已选条目保持。
// 本文件为自包含 ESM（无 import），单测经 data URL 导入以复用同一份源码。

const FEEDBACK_MS = 1600;

// 日期哈希：同一天返回同一条（与历史算法一致，回退随机模式时由调用方处理）。
export function pickDailyIndex(total, date) {
  var n = Math.floor(Number(total)) || 0;
  if (n <= 0) return 0;
  var d = date instanceof Date ? date : new Date();
  return (d.getDate() * 7 + d.getMonth() * 3 + d.getFullYear()) % n;
}

// 下一条索引：保证与当前不同（池 > 1）；rand 可注入以便单测确定性。
export function pickNextIndex(current, total, rand) {
  var n = Math.floor(Number(total)) || 0;
  if (n <= 0) return 0;
  var cur = Math.floor(Number(current)) || 0;
  if (cur < 0 || cur >= n) cur = 0;
  if (n === 1) return 0;
  var rnd = typeof rand === 'function' ? rand : Math.random;
  var v = Number(rnd());
  if (!isFinite(v)) v = 0;
  v = Math.min(Math.max(v, 0), 0.9999999);
  return (cur + 1 + Math.floor(v * (n - 1))) % n;
}

// 语言回退链：目标语言字段为空时回退另一语言，再回退空串。
export function quoteForLang(quote, lang) {
  var q = quote || {};
  var en = lang === 'en';
  var pick = function (primary, fallback) {
    if (typeof primary === 'string' && primary) return primary;
    if (typeof fallback === 'string' && fallback) return fallback;
    return '';
  };
  return {
    text: en ? pick(q.textEn, q.text) : pick(q.text, q.textEn),
    author: en ? pick(q.authorEn, q.author) : pick(q.author, q.authorEn),
    source: en ? pick(q.sourceEn, q.source) : pick(q.source, q.sourceEn)
  };
}

function langOf() {
  try {
    return /^en/i.test(document.documentElement.lang || '') ? 'en' : 'zh';
  } catch (e) {
    return 'zh';
  }
}
function labelOf(key, keyEn) {
  var Q = (config && config.features && config.features.dailyQuote) || {};
  var en = langOf() === 'en';
  var primary = Q[en ? keyEn : key];
  var fallback = Q[en ? key : keyEn];
  if (typeof primary === 'string' && primary) return primary;
  if (typeof fallback === 'string' && fallback) return fallback;
  return '';
}

function legacyCopy(text) {
  try {
    var ta = document.createElement('textarea');
    ta.className = 'quote-copy-proxy';
    ta.value = text;
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

function writeClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
  }
  return Promise.resolve(legacyCopy(text));
}

function currentView() {
  return quoteForLang(state.pool[state.index % state.pool.length], state.lang);
}

function copyPayload(view) {
  var attribution = [view.author, view.source].filter(Boolean).join(' · ');
  return attribution ? view.text + '\n— ' + attribution : view.text;
}

var config = null;
var state = null;
var copyTimer = null;

function onRefresh() {
  if (!state || state.pool.length < 2) return;
  state.index = pickNextIndex(state.index, state.pool.length, Math.random);
  render();
}

function onCopy(copyBtn) {
  writeClipboard(copyPayload(currentView())).then(function (ok) {
    if (!ok) return;
    var copyLabel = labelOf('copyLabel', 'copyLabelEn');
    var copiedLabel = labelOf('copiedLabel', 'copiedLabelEn') || copyLabel;
    if (copyTimer) { clearTimeout(copyTimer); copyTimer = null; }
    copyBtn.textContent = copiedLabel;
    copyBtn.setAttribute('aria-label', copiedLabel);
    copyTimer = setTimeout(function () {
      copyBtn.textContent = copyLabel;
      copyBtn.setAttribute('aria-label', copyLabel);
      copyTimer = null;
    }, FEEDBACK_MS);
    if (typeof window.__toast === 'function') {
      window.__toast(copiedLabel, { type: 'success', duration: FEEDBACK_MS });
    }
  });
}

function ensureActions(container) {
  if (!container) return;
  var actions = container.querySelector('.quote-widget-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'quote-widget-actions';
    var refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'quote-widget-btn quote-widget-refresh';
    refresh.addEventListener('click', onRefresh);
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'quote-widget-btn quote-widget-copy';
    copy.addEventListener('click', function () { onCopy(copy); });
    actions.appendChild(refresh);
    actions.appendChild(copy);
    container.appendChild(actions);
  }
  var refreshBtn = actions.querySelector('.quote-widget-refresh');
  var copyBtn = actions.querySelector('.quote-widget-copy');
  var refreshLabel = labelOf('refreshLabel', 'refreshLabelEn');
  var copyLabel = labelOf('copyLabel', 'copyLabelEn');
  if (refreshBtn) {
    refreshBtn.textContent = refreshLabel;
    refreshBtn.setAttribute('aria-label', refreshLabel);
    refreshBtn.disabled = !state || state.pool.length < 2;
  }
  if (copyBtn) {
    copyBtn.textContent = copyLabel;
    copyBtn.setAttribute('aria-label', copyLabel);
  }
}

function render() {
  if (!config || !state) return;
  var Q = (config.features && config.features.dailyQuote) || {};
  var qt = document.getElementById('quoteText');
  if (!qt) return;
  state.lang = langOf();
  var wq = qt.closest('.quote-widget');
  if (wq) {
    var plain = Q.widgetStyle === 'plain';
    wq.classList.toggle('quote-widget-plain', plain);
    wq.classList.toggle('quote-widget-card', !plain);
  }
  var view = currentView();
  qt.textContent = view.text;
  if (Q.quoteColor) qt.style.color = String(Q.quoteColor);
  var qa = document.getElementById('quoteAuthor');
  if (qa) {
    var TNQ = (config.tuning && config.tuning.dailyQuote) || {};
    qa.textContent = view.author && String(TNQ.showAuthor) !== 'false' ? '— ' + view.author : '';
    qa.title = view.author + (view.source ? (view.author ? ' · ' : '') + view.source : '');
  }
  ensureActions(qt.parentNode);
}

export function init() {
  var F = window.__FEATURES__ || {};
  var Q = F.dailyQuote || {};
  if (Q.enabled === false) return;
  if (!document.getElementById('quoteText')) return;
  var pool = Array.isArray(window.__QUOTES__) ? window.__QUOTES__.filter(Boolean) : [];
  if (!pool.length) return;
  config = { features: F, tuning: window.__TUNING__ || {} };
  var TNQ = (window.__TUNING__ || {}).dailyQuote || {};
  if (!state) {
    state = {
      pool: pool,
      index: String(TNQ.refreshDaily) === 'false' ? Math.floor(Math.random() * pool.length) : pickDailyIndex(pool.length, new Date()),
      lang: langOf()
    };
  } else {
    state.pool = pool;
    if (state.index >= pool.length) state.index = 0;
  }
  render();
  if (Array.isArray(window.__SOFTNAV_HOOKS__)) {
    window.__SOFTNAV_HOOKS__.push(render);
  }
}
