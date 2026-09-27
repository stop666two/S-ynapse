// 每日一言运行时：日期固定一条 + 「换一句」（中文页且在线时优先请求 Hitokoto 一言 API，
// 失败/超时/非 2xx/字段非法/离线/英文页静默回退本地随机；不持久化）+ 「复制」（剪贴板 API，
// textarea 回退）。数据由构建期注入 window.__QUOTES__（数据文件见 data/quotes.json5）；
// API 开关/端点/分类等见 features.dailyQuote.api，CSP connect-src 由构建期按开关裁剪。
// 语言按 document.documentElement.lang 判定：优先 *En 字段，空回退中文（西方公版条目
// textEn=text，为英文原文）。软导航替换内容区后经 __SOFTNAV_HOOKS__ 重渲染，已选条目保持。
// 本文件为自包含 ESM（无 import），单测经 data URL 导入以复用同一份源码。

const FEEDBACK_MS = 1600;
const DEFAULT_API_ENDPOINT = 'https://v1.hitokoto.cn/';
const DEFAULT_API_TIMEOUT_MS = 5000;

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

// 组装一言请求 URL：endpoint 必须为 https（否则返回空串，调用方回退本地）；
// categories 过滤为短标识符后逐个以「重复 c= 参数」追加（实测 API 仅接受重复参数；| 或逗号形式会 400）；
// maxLength>0 时追加 max_length。
export function buildApiUrl(api) {
  var cfg = api || {};
  var endpoint = typeof cfg.endpoint === 'string' && cfg.endpoint ? cfg.endpoint : DEFAULT_API_ENDPOINT;
  if (!/^https:\/\//i.test(endpoint)) return '';
  var cats = (Array.isArray(cfg.categories) ? cfg.categories : []).filter(function (c) {
    return typeof c === 'string' && /^[A-Za-z0-9_-]+$/.test(c);
  });
  var params = [];
  cats.forEach(function (c) { params.push('c=' + c); });
  var max = Math.floor(Number(cfg.maxLength));
  if (isFinite(max) && max > 0) params.push('max_length=' + max);
  if (!params.length) return endpoint;
  return endpoint + (endpoint.indexOf('?') === -1 ? '?' : '&') + params.join('&');
}

// 校验并归一化一言响应：hitokoto 必须为非空字符串，否则返回 null（调用方回退本地）；
// 作者优先 from_who、空回退 from；from_who 存在时 source 取 from（作品名），否则留空防署名重复。
export function normalizeApiQuote(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  var text = typeof payload.hitokoto === 'string' ? payload.hitokoto.trim() : '';
  if (!text) return null;
  var fromWho = typeof payload.from_who === 'string' ? payload.from_who.trim() : '';
  var from = typeof payload.from === 'string' ? payload.from.trim() : '';
  return { text: text, author: fromWho || from, source: fromWho ? from : '' };
}

// API 可用性决策（纯函数）：开关关闭 / 非中文页 / 离线 / 请求进行中 / 未过最小间隔
// 任一成立即回退本地随机（不发外部请求）；minIntervalMs<=0 或时间戳缺失时不节流。
export function canUseApi(opts) {
  var o = opts || {};
  if (o.enabled === false) return false;
  if (o.lang !== 'zh') return false;
  if (o.online === false) return false;
  if (o.pending === true) return false;
  var interval = Number(o.minIntervalMs);
  if (!isFinite(interval) || interval < 0) interval = 0;
  var now = Number(o.now);
  var last = Number(o.lastAt);
  if (interval > 0 && isFinite(now) && isFinite(last) && last > 0 && now - last < interval) return false;
  return true;
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

function apiConfig() {
  var Q = (config && config.features && config.features.dailyQuote) || {};
  return Q.api && typeof Q.api === 'object' ? Q.api : {};
}

function apiTimeoutMs(api) {
  var t = Math.floor(Number(api && api.timeoutMs));
  return isFinite(t) && t > 0 ? t : DEFAULT_API_TIMEOUT_MS;
}

function timeoutSignal(ms) {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
  } catch (e) { /* 无 AbortSignal.timeout 能力时退化为无超时请求 */ }
  return undefined;
}

function currentView() {
  if (state.apiView && state.apiViewLang === state.lang) return state.apiView;
  return quoteForLang(state.pool[state.index % state.pool.length], state.lang);
}

function copyPayload(view) {
  var attribution = [view.author, view.source].filter(Boolean).join(' · ');
  return attribution ? view.text + '\n— ' + attribution : view.text;
}

var config = null;
var state = null;
var copyTimer = null;

// 本地随机下一条（API 不可用或请求失败时的回退路径；清空 API 引语并重渲染）。
function localRefresh() {
  if (!state || state.pool.length < 2) return;
  state.apiView = null;
  state.apiViewLang = null;
  state.index = pickNextIndex(state.index, state.pool.length, Math.random);
  render();
}

// 「换一句」按钮禁用态与忙碌态：池不足或无状态时禁用；API 请求进行中禁用并标记 aria-busy。
function applyRefreshState(btn) {
  if (!btn) return;
  var pending = !!(state && state.apiPending);
  btn.disabled = !state || state.pool.length < 2 || pending;
  if (pending) btn.setAttribute('aria-busy', 'true');
  else btn.removeAttribute('aria-busy');
}

function onRefresh(btn) {
  if (!state || state.apiPending || state.pool.length < 2) return;
  var api = apiConfig();
  var now = Date.now();
  var useApi = canUseApi({
    enabled: api.enabled !== false,
    lang: state.lang,
    online: typeof navigator === 'undefined' || navigator.onLine !== false,
    pending: state.apiPending,
    now: now,
    lastAt: state.lastApiAt,
    minIntervalMs: api.minIntervalMs
  });
  if (!useApi) { localRefresh(); return; }
  state.lastApiAt = now;
  state.apiPending = true;
  applyRefreshState(btn);
  requestApiQuote(api, function (view) {
    if (view) {
      state.apiView = view;
      state.apiViewLang = state.lang;
      render();
    } else {
      localRefresh();
    }
    state.apiPending = false;
    applyRefreshState(btn);
  });
}

// 请求一言并归一化结果；网络错误、超时（AbortSignal.timeout）、非 2xx、JSON 解析失败与
// 字段非法统一回调 null，由调用方静默回退本地（不弹错误提示）。
function requestApiQuote(api, done) {
  var url = buildApiUrl(api);
  if (!url || typeof fetch !== 'function') { done(null); return; }
  var options = { headers: { Accept: 'application/json' }, cache: 'no-store' };
  var signal = timeoutSignal(apiTimeoutMs(api));
  if (signal) options.signal = signal;
  var request;
  try {
    request = fetch(url, options);
  } catch (e) {
    done(null);
    return;
  }
  if (!request || typeof request.then !== 'function') { done(null); return; }
  request.then(function (res) {
    if (!res || res.ok !== true || typeof res.json !== 'function') { done(null); return; }
    return res.json().then(function (data) { done(normalizeApiQuote(data)); }, function () { done(null); });
  }, function () { done(null); });
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
    refresh.addEventListener('click', function () { onRefresh(refresh); });
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
    applyRefreshState(refreshBtn);
  }
  if (copyBtn) {
    copyBtn.textContent = copyLabel;
    copyBtn.setAttribute('aria-label', copyLabel);
  }
}

// API 来源署名小字：仅当展示的是 API 引语且配置了 attributionText 时可见，其余状态置空隐藏。
function updateAttribution(container) {
  if (!container) return;
  var el = container.querySelector('.quote-widget-attribution');
  if (!el) {
    el = document.createElement('span');
    el.className = 'quote-widget-attribution';
    var actions = container.querySelector('.quote-widget-actions');
    if (actions) container.insertBefore(el, actions);
    else container.appendChild(el);
  }
  var text = apiConfig().attributionText;
  var show = !!(state && state.apiView) && typeof text === 'string' && !!text;
  el.textContent = show ? text : '';
  el.hidden = !show;
}

function render() {
  if (!config || !state) return;
  var Q = (config.features && config.features.dailyQuote) || {};
  var qt = document.getElementById('quoteText');
  if (!qt) return;
  state.lang = langOf();
  if (state.lang !== 'zh') {
    // 英文页始终本地：API 引语仅中文语境有效，切换语言后清除回退本地池。
    state.apiView = null;
    state.apiViewLang = null;
  }
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
  updateAttribution(qt.parentNode);
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
      lang: langOf(),
      apiPending: false,
      lastApiAt: 0,
      apiView: null,
      apiViewLang: null
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
