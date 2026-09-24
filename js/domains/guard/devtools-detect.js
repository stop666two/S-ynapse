// Guard devtools detect —— 开发者工具入侵检测（sizeDiff / timingDebugger）
export function init(ctx) {
  const cfg = (ctx.G.devtoolsDetect) || {};
  if (cfg.enabled === false) return;
  const methods = cfg.methods || {};
  const intervalMs = Math.max(1000, parseInt(cfg.intervalMs, 10) || 1500);
  const sizeThreshold = Math.max(80, parseInt(cfg.thresholdSizePx, 10) || 160);
  const timingThreshold = Math.max(50, parseInt(cfg.thresholdTimingMs, 10) || 120);
  const once = cfg.noticeOncePerSession !== false;
  let fired = false;
  let lock = null;
  const RELOAD_KEY = 's-dt-reload';

  function detectSize() {
    return (window.outerWidth - window.innerWidth) > sizeThreshold ||
      (window.outerHeight - window.innerHeight) > sizeThreshold;
  }

  function detectTiming() {
    const t0 = performance.now();
    // 此处的 debugger 是 timingDebugger 检定的一部分（依赖断点暂停造成耗时差），非调试残留，故意保留
    // eslint-disable-next-line no-debugger
    debugger;
    return (performance.now() - t0) > timingThreshold;
  }

  function fire() {
    if (once && fired) return;
    fired = true;
    if (cfg.logDetect) ctx.log('devtools detected');
    document.dispatchEvent(new CustomEvent('guard:devtools'));
    const action = cfg.action || 'none';
    if (action === 'notice') {
      ctx.toast(cfg.noticeText || ctx.t('devtoolsDetected', '检测到开发者工具已打开'));
      return;
    }
    if (action === 'blurPage') {
      document.documentElement.style.setProperty('--g-dtBlur', cfg.blurAmount || '6px');
      document.documentElement.classList.add('g-dt-blur');
      return;
    }
    if (action === 'lockOverlay') {
      if (lock) return;
      lock = document.createElement('div');
      lock.className = 'g-lock';
      const h = document.createElement('h3');
      h.textContent = cfg.lockTitle || '开发者工具已打开';
      const p = document.createElement('p');
      p.textContent = cfg.lockText || '请关闭开发者工具后继续浏览';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '关闭';
      btn.addEventListener('click', function () { lock.remove(); lock = null; });
      lock.appendChild(h);
      lock.appendChild(p);
      lock.appendChild(btn);
      document.body.appendChild(lock);
      return;
    }
    if (action === 'reload') {
      // 熔断：每会话最多自动刷新一次，避免检测持续命中形成刷新死循环；
      // sessionStorage 不可用（隐私模式等）时放弃刷新——宁可少刷新，也不进入循环。
      try {
        if (sessionStorage.getItem(RELOAD_KEY)) return;
        sessionStorage.setItem(RELOAD_KEY, '1');
      } catch (e) { return; }
      setTimeout(function () { location.reload(); }, Math.max(0, parseInt(cfg.reloadDelayMs, 10) || 800));
    }
  }

  setInterval(function () {
    if (cfg.pauseWhenHidden !== false && document.hidden) return;
    let hit = false;
    if (methods.sizeDiff !== false && detectSize()) hit = true;
    if (!hit && methods.timingDebugger === true && detectTiming()) hit = true;
    if (hit) fire();
  }, intervalMs);

  ctx.log('devtoolsDetect ready');
}
