// Boot scheduler —— 三阶段启动调度（关键同步 → 空闲切片 → 重模块），含加载遮罩控制。
// 配置：features.loading（遮罩）/ features.boot（调度）；时间线写入 window.__BOOT__ 供验证。
// 配置外置后先等待 window.__CONFIG_READY__（无则立即继续）再读取 features 并调度三队列，
// 保证降级路径（__CONFIG_OK__=false）不会因缺少 features 抛错。
let L = {};
let B = {};
function log(msg) { if (B.log) console.info('[boot] ' + Math.round(performance.now()) + 'ms ' + msg); }
function yieldToMain() {
  if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') return scheduler.yield();
  return new Promise(function (resolve) {
    setTimeout(function () { requestAnimationFrame(function () { resolve(); }); }, 0);
  });
}

function whenIdle(timeoutMs) {
  return new Promise(function (resolve) {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(function () { resolve(); }, { timeout: timeoutMs });
    else setTimeout(resolve, Math.min(timeoutMs, parseInt(B.idleFallbackMs, 10) || 120));
  });
}

function createOverlay() {
  const el = document.createElement('div');
  el.className = 'boot-overlay';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  const inner = document.createElement('div');
  inner.className = 'boot-inner';
  const spinnerOn = L.spinner !== false;
  const spinnerStyle = L.spinnerStyle === 'ring' ? 'ring' : 'orbit';
  if (L.showTitle) {
    const siteTitle = document.documentElement.getAttribute('data-site-title') || '';
    if (siteTitle) {
      const titleEl = document.createElement('span');
      titleEl.className = 'boot-title';
      titleEl.textContent = siteTitle;
      inner.appendChild(titleEl);
    }
  }
  if (spinnerOn) {
    const orbit = document.createElement('span');
    orbit.className = spinnerStyle === 'ring' ? 'boot-ring' : 'boot-orbit';
    orbit.setAttribute('aria-hidden', 'true');
    orbit.innerHTML = spinnerStyle === 'ring' ? '<i></i>' : '<i></i><i></i><i></i>';
    inner.appendChild(orbit);
  }
  const text = document.createElement('span');
  text.className = 'boot-text';
  let label = L.text || '';
  if (!label) {
    const S = ((window.__I18N__ || {}).common) || {};
    label = S.loading || 'Loading…';
  }
  text.textContent = label;
  inner.appendChild(text);
  el.appendChild(inner);
  document.body.appendChild(el);
  return el;
}

export async function boot(queues) {
  const stats = { start: performance.now(), critEnd: 0, idleEnd: 0, heavyEnd: 0 };
  window.__BOOT__ = stats;
  const ready = window.__CONFIG_READY__;
  if (ready && typeof ready.then === 'function') {
    try { await ready; } catch (e) { /* fail-open：配置层自身保证不 reject，此处仅防御 */ }
  }
  stats.configReadyAt = performance.now();
  const F = window.__FEATURES__ || {};
  L = F.loading || {};
  B = F.boot || {};
  // 说明：本文件各 parseInt(...) || 数字 的兜底值与 scripts/lib/features-schema.js →
  // DEFAULT_FEATURES.loading / boot 同值，仅在配置缺失或非法时生效（正常构建始终注入合并后的完整 features）。
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const loaderOn = L.enabled !== false && !(reduced && (L.reducedMotion || 'skip') === 'skip');
  let overlay = null, shownAt = 0, showTimer = null, failsafeTimer = null;

  function hideOverlay() {
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    if (failsafeTimer) { clearTimeout(failsafeTimer); failsafeTimer = null; }
    if (L.ariaBusy !== false && document.body) document.body.removeAttribute('aria-busy');
    if (!overlay) return;
    stats.overlayHideAt = performance.now();
    const minShow = parseInt(L.minShowMs, 10);
    const minMs = isNaN(minShow) ? 250 : Math.max(0, minShow);
    const wait = Math.max(0, minMs - (performance.now() - shownAt));
    const f = parseInt(L.fadeMs, 10);
    const fadeMs = isNaN(f) ? 380 : Math.max(0, f);
    const el = overlay;
    overlay = null;
    setTimeout(function () {
      el.style.animation = 'none';
      el.classList.add('out');
      setTimeout(function () { el.remove(); stats.overlayRemovedAt = performance.now(); }, fadeMs);
      log('overlay hidden');
    }, wait);
  }

  if (loaderOn) {
    const d = parseInt(L.delayMs, 10);
    const delayMs = isNaN(d) ? 120 : Math.max(0, d);
    if (delayMs === 0) {
      overlay = createOverlay();
      shownAt = performance.now();
      stats.overlayShownAt = shownAt;
      log('overlay shown (immediate)');
    } else {
      showTimer = setTimeout(function () {
        if (stats.critEnd) return;
        overlay = createOverlay();
        shownAt = performance.now();
        stats.overlayShownAt = shownAt;
        log('overlay shown');
      }, delayMs);
    }
    const m = parseInt(L.maxShowMs, 10);
    const maxMs = isNaN(m) ? 2000 : Math.max(300, m);
    const bm = parseInt(L.failsafeBufferMs, 10);
    failsafeTimer = setTimeout(function () { if (overlay) hideOverlay(); }, maxMs + (isNaN(bm) ? 60 : Math.max(0, bm)));
    if (L.ariaBusy !== false && document.body) document.body.setAttribute('aria-busy', 'true');
  }

  const critical = (queues && queues.critical) || [];
  const idleQ = ((queues && queues.idle) || []).slice();
  const heavyQ = ((queues && queues.heavy) || []).slice();

  let resolveAccel = null;
  const accel = (B.interactionWake === false) ? new Promise(function () {}) : new Promise(function (r) { resolveAccel = r; });
  if (resolveAccel) {
    const wake = function () {
      if (resolveAccel) { const r = resolveAccel; resolveAccel = null; log('interaction wake'); r(); }
    };
    const wakes = (Array.isArray(B.interactionEvents) && B.interactionEvents.length) ? B.interactionEvents : ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    wakes.forEach(function (ev) {
      window.addEventListener(ev, wake, { once: true, passive: true, capture: true });
    });
  }

  const results = critical.map(function (fn) {
    try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); }
  });
  Promise.allSettled(results).then(function (settled) {
    settled.forEach(function (s, i) {
      if (s.status === 'rejected') console.error('[boot] critical module #' + i + ' failed:', s.reason);
    });
    stats.critEnd = performance.now();
    log('critical done');
    hideOverlay();
    runQueues();
  });

  const budget = B.enabled === false ? Infinity : (parseInt(B.budgetMs, 10) || 40);
  stats.budgetMs = budget === Infinity ? 'off' : budget;
  stats.heavyMode = B.heavyMode || 'idle';
  async function runQueue(list) {
    while (list.length) {
      const t = performance.now();
      while (list.length && (performance.now() - t) < budget) {
        const fn = list.shift();
        try { await fn(); } catch (e) { console.error('[boot] phase item failed:', e); log('phase item failed'); }
      }
      if (list.length) await Promise.race([whenIdle(parseInt(B.idleTimeoutMs, 10) || 800), accel]);
      await yieldToMain();
    }
  }
  async function runQueues() {
    try {
      await runQueue(idleQ);
      stats.idleEnd = performance.now();
      log('idle queue done');
      const heavyMode = B.heavyMode || 'idle';
      if (heavyMode === 'interaction') await Promise.race([whenIdle(parseInt(B.idleTimeoutMs, 10) || 800), accel]);
      else if (heavyMode === 'idle') await whenIdle(parseInt(B.idleTimeoutMs, 10) || 800);
      await runQueue(heavyQ);
      stats.heavyEnd = performance.now();
      log('all queues done');
    } finally {
      window.__APP_READY__ = true;
    }
  }
}
