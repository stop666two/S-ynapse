// Guard console guard —— 控制台克制与反制（banner / clear / mute / trap）
export function init(ctx) {
  const cfg = (ctx.G.consoleGuard) || {};
  if (cfg.enabled === false) return;
  const lang = (document.documentElement.lang || 'zh').startsWith('en') ? 'en' : 'zh';
  let fired = false;

  function notice(text) {
    if (cfg.noticeOncePerSession !== false && fired) return;
    fired = true;
    ctx.toast(text);
  }

  if (cfg.hideSelfLogs) ctx.log = function () {};

  if (cfg.bannerEnabled) {
    const text = (lang === 'en' ? (cfg.bannerTextEn || cfg.bannerText) : cfg.bannerText) || '';
    if (text) {
      if (cfg.bannerAscii) {
        console.log('%c' + text.split('').join(' '), 'font-family:monospace;font-weight:700;font-size:14px');
      } else {
        console.log('%c' + text, 'font-weight:700;font-size:14px');
      }
    }
  }

  if (cfg.clearEnabled) {
    const ms = Math.max(2000, parseInt(cfg.clearIntervalMs, 10) || 2000);
    setInterval(function () {
      if (typeof console.clear === 'function') console.clear();
    }, ms);
  }
  if (cfg.clearOnDetect !== false) {
    document.addEventListener('guard:devtools', function () {
      if (typeof console.clear === 'function') console.clear();
    });
  }

  if (cfg.muteEnabled) {
    const list = Array.isArray(cfg.muteMethods) ? cfg.muteMethods : ['log', 'info', 'debug'];
    list.forEach(function (m) {
      try {
        if (typeof console[m] === 'function') console[m] = function () {};
      } catch (e) { /* 忽略只读环境 */ }
    });
    if (cfg.muteFreeze) {
      try { Object.freeze(console); } catch (e) { /* 忽略 */ }
    }
  }

  if (cfg.trapEnabled) {
    try {
      const orig = console.log;
      Object.defineProperty(console, 'log', {
        configurable: true,
        get: function () {
          if ((cfg.trapAction || 'notice') !== 'none') {
            notice(cfg.trapText || ctx.t('devtoolsDetected', '检测到开发者工具已打开'));
          }
          return orig;
        },
        set: function (v) {
          try { Object.defineProperty(console, 'log', { value: v, writable: true, configurable: true }); } catch (e) { /* 忽略 */ }
        }
      });
    } catch (e) { /* 忽略 */ }
  }

  ctx.log('consoleGuard ready');
}
