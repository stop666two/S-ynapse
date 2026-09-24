// Guard tamper watch —— 注入与篡改监视（脚本/内联属性/框架/原型/DOM/CSP）
// 说明：脚本监视默认放行同源 /pagefind/ 前缀（站点搜索的动态注入属预期行为）；
//   可选上报带节流与超时，隐私模式下不含 URL（仅 origin+pathname）。
export function init(ctx) {
  const cfg = (ctx.G.tamperWatch) || {};
  if (cfg.enabled === false) return;
  let fired = false;
  const REPORT_TIMEOUT_FALLBACK_MS = 5000;
  const REPORT_THROTTLE_FALLBACK_MS = 10000;

  function notify(text) {
    if (cfg.noticeOncePerSession !== false && fired) return;
    fired = true;
    ctx.toast(text || ctx.t('tamperDetected', '检测到页面被篡改'));
    if (cfg.logDetect) ctx.log('tamper', text);
  }

  let lastReportAt = 0;
  function report(kind) {
    const endpoint = cfg.reportEndpoint;
    if (!endpoint || !/^https?:/.test(endpoint)) return;
    const rawThrottle = parseInt(cfg.reportThrottleMs, 10);
    const throttleMs = Number.isFinite(rawThrottle) ? Math.max(0, Math.min(60000, rawThrottle)) : REPORT_THROTTLE_FALLBACK_MS;
    if (throttleMs > 0 && Date.now() - lastReportAt < throttleMs) return;
    lastReportAt = Date.now();
    const rawTimeout = parseInt(cfg.reportTimeoutMs, 10);
    const timeoutMs = Number.isFinite(rawTimeout) ? Math.max(1000, Math.min(30000, rawTimeout)) : REPORT_TIMEOUT_FALLBACK_MS;
    const body = cfg.reportPrivacyMode !== false
      ? { kind: kind }
      : { kind: kind, url: location.origin + location.pathname };
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
    try {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      }).catch(function () {}).then(function () { if (timer) clearTimeout(timer); });
    } catch (e) { if (timer) clearTimeout(timer); }
  }

  const scripts = cfg.scripts || {};
  const iframes = cfg.iframes || {};
  const attrs = cfg.attrs || {};

  // 同源白名单：站点自身功能（如本地搜索注入的 /pagefind/ 脚本）不应被当成注入移除；
  // 未配 allowPathPrefixes 时使用默认 ['/pagefind/']；配 [] 则关闭白名单。
  function isAllowedScript(node) {
    const src = node.getAttribute && node.getAttribute('src');
    if (!src) return false;
    try {
      const u = new URL(src, location.href);
      if (u.origin !== location.origin) return false;
      const allow = Array.isArray(scripts.allowPathPrefixes) ? scripts.allowPathPrefixes : ['/pagefind/'];
      return allow.some(function (p) { return typeof p === 'string' && p && u.pathname.indexOf(p) === 0; });
    } catch (e) { return false; }
  }

  if (scripts.monitor !== false || iframes.monitor !== false || attrs.monitor) {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (attrs.monitor && m.type === 'attributes' && m.attributeName && m.attributeName.indexOf('on') === 0) {
          if (scripts.action === 'remove' && m.target && m.target.removeAttribute) m.target.removeAttribute(m.attributeName);
          notify('检测到内联事件注入');
          report('attr');
        }
        if (m.addedNodes && m.addedNodes.length) {
          Array.prototype.forEach.call(m.addedNodes, function (n) {
            if (!n || !n.tagName) return;
            if (n.tagName === 'SCRIPT' && scripts.monitor !== false) {
              if (isAllowedScript(n)) return;
              const action = scripts.action || 'toast';
              if (action === 'remove') n.remove();
              notify(action === 'remove' ? '已移除注入脚本' : '检测到脚本注入');
              report('script');
            } else if (n.tagName === 'IFRAME' && iframes.monitor !== false) {
              const action = iframes.action || 'toast';
              if (action === 'remove') n.remove();
              notify(action === 'remove' ? '已移除注入框架' : '检测到框架注入');
              report('iframe');
            }
          });
        }
      });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: !!attrs.monitor });
  }

  const proto = cfg.prototype || {};
  const dom = cfg.dom || {};
  const interval = Math.max(1000, parseInt(cfg.probeIntervalMs, 10) || 2000);
  let originals = null;
  if (proto.watch) {
    originals = {
      fetch: window.fetch,
      xhr: window.XMLHttpRequest && XMLHttpRequest.prototype.open,
      eval: window.eval
    };
  }
  const domMissing = [];
  function probe() {
    if (originals) {
      if (window.fetch !== originals.fetch) notify('检测到 fetch 被替换');
      if (window.XMLHttpRequest && XMLHttpRequest.prototype.open !== originals.xhr) notify('检测到 XHR 被替换');
      if (window.eval !== originals.eval) notify('检测到 eval 被替换');
    }
    if (dom.monitor && Array.isArray(dom.targets)) {
      dom.targets.forEach(function (sel) {
        if (sel && !document.querySelector(sel) && domMissing.indexOf(sel) === -1) {
          domMissing.push(sel);
          notify('关键元素缺失: ' + sel);
        }
      });
    }
  }
  if (proto.watch || dom.monitor) setInterval(probe, interval);

  if (cfg.cspViolationToast !== false) {
    document.addEventListener('securitypolicyviolation', function () { notify('CSP 拦截了违规资源'); });
  }

  ctx.log('tamperWatch ready');
}
