// PWA 运行时：Service Worker 注册、顶部更新提示条、离线/恢复提示、桌面安装引导。
// 更新流程：新 SW 安装完成进入 waiting → 顶部提示条（刷新 / 关闭）→ 点击刷新向 SW 发送
// SKIP_WAITING → controllerchange 后整页刷新；旧版本缓存由 SW activate 阶段按缓存名前缀清理。
// 提示条挂在 body（软导航只交换 .content-wrapper），软导航往返不丢失、不重复提示。
// 纯函数在模块顶层导出，供 Node 单测经 data URL 导入断言。

// 是否展示更新提示条：仅「已被旧 SW 控制」的更新场景（首次安装不提示）、存在等待中的
// 新版本、且本会话尚未提示过（不打扰用户）。
export function shouldPromptUpdate(state) {
  var s = state || {};
  return s.hasController === true && s.hasWaiting === true && s.prompted !== true;
}

function noop() {}

// 顶部更新提示条：文案取自 ui-strings 双语字典（pwa.updateReady / pwa.refresh / common.close）。
function showUpdateBar(F, reg, session) {
  if (session.prompted || document.getElementById('pwaUpdateBar')) return;
  session.prompted = true;
  var bar = document.createElement('div');
  bar.className = 'pwa-update-bar';
  bar.id = 'pwaUpdateBar';
  bar.setAttribute('role', 'status');
  var text = document.createElement('span');
  text.className = 'pwa-update-text';
  text.textContent = __T('pwa.updateReady', '新版本可用，刷新页面以更新');
  var refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'pwa-update-refresh';
  refresh.textContent = __T('pwa.refresh', '刷新');
  refresh.addEventListener('click', function () { requestRefresh(reg, session); });
  var close = document.createElement('button');
  close.type = 'button';
  close.className = 'pwa-update-close';
  close.setAttribute('aria-label', __T('common.close', '关闭'));
  close.textContent = '×';
  close.addEventListener('click', function () { bar.remove(); });
  bar.appendChild(text);
  bar.appendChild(refresh);
  bar.appendChild(close);
  document.body.appendChild(bar);
  var autoHide = parseInt(F.updateToastMs, 10);
  if (isFinite(autoHide) && autoHide > 0) {
    setTimeout(function () { if (bar.parentNode) bar.remove(); }, autoHide);
  }
}

// 点击刷新：等待中的 SW 收到 SKIP_WAITING 后接管，controllerchange 触发整页刷新；
// SW 未响应时按 features.pwa.reloadFallbackMs（默认 3000ms）兜底直接刷新（避免点击无反馈）。
function requestRefresh(reg, session) {
  session.reloading = true;
  if (reg && reg.waiting) {
    try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) { /* 忽略：消息通道异常时走超时兜底 */ }
    var fallbackMs = parseInt(session.reloadFallbackMs, 10);
    setTimeout(function () { if (session.reloading) window.location.reload(); }, isFinite(fallbackMs) && fallbackMs > 0 ? fallbackMs : 3000);
  } else {
    window.location.reload();
  }
}

function installPrompt(F) {
  if (F.installPrompt === false) return;
  var IK = F.installDismissKey;
  var dismissed = false;
  try { dismissed = localStorage.getItem(IK) === '1'; } catch (e) { /* 忽略：存储不可用时视为未关闭 */ }
  if (dismissed) return;
  var deferred = null;
  var wrap = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    try { if (localStorage.getItem(IK) === '1') return; } catch (err) { /* 忽略：存储不可用时继续尝试展示安装按钮 */ }
    e.preventDefault();
    deferred = e;
    if (document.getElementById('pwaInstallBtn')) return;
    wrap = document.createElement('div');
    wrap.className = 'pwa-install-wrap';
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'pwaInstallBtn';
    b.className = 'pwa-install-btn';
    b.textContent = __T('pwa.install', '安装到桌面');
    b.addEventListener('click', function () {
      if (!deferred) return;
      try { deferred.prompt(); } catch (err) { /* 忽略：prompt 需用户手势，失败时直接移除按钮 */ }
      if (deferred.userChoice && deferred.userChoice.then) {
        deferred.userChoice.then(function (c) {
          if (window.__toast && c && c.outcome === 'accepted') window.__toast(__T('pwa.installed', '应用已安装'), { type: 'success' });
        }).catch(noop);
      }
      deferred = null;
      wrap.remove();
    });
    var x = document.createElement('span');
    x.className = 'pwa-install-close';
    x.setAttribute('role', 'button');
    x.setAttribute('tabindex', '0');
    x.setAttribute('aria-label', '关闭');
    x.textContent = '×';
    var xClose = function (ev) {
      if (ev) ev.stopPropagation();
      try { localStorage.setItem(IK, '1'); } catch (e) { /* 忽略：存储不可用时关闭仅当次会话有效 */ }
      wrap.remove();
    };
    x.addEventListener('click', xClose);
    x.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        xClose(ev);
      }
    });
    wrap.appendChild(b);
    wrap.appendChild(x);
    document.body.appendChild(wrap);
  });
  window.addEventListener('appinstalled', function () {
    if (wrap && wrap.parentNode) wrap.remove();
    try { localStorage.setItem(IK, '1'); } catch (e) { /* 忽略：存储不可用时关闭仅当次会话有效 */ }
  });
}

function run() {
  var F = (window.__FEATURES__ || {}).pwa || {};
  if (F.enabled === false) return;
  if (!window.__PWA_ON__) return;
  var SW = window.__PWA_SW__;
  var session = { prompted: false, reloading: false, reloadFallbackMs: parseInt(F.reloadFallbackMs, 10) };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!session.reloading) return;
      session.reloading = false;
      window.location.reload();
    });
  }
  if (F.registerSW !== false && SW && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(SW).then(function (reg) {
      var prompt = function () {
        if (F.updatePrompt === false) return;
        showUpdateBar(F, reg, session);
      };
      if (shouldPromptUpdate({ hasController: !!navigator.serviceWorker.controller, hasWaiting: !!reg.waiting, prompted: session.prompted })) prompt();
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state !== 'installed') return;
          if (!navigator.serviceWorker.controller) return;
          prompt();
        });
      });
      // 长驻页面的周期更新检查（0 = 关闭，仅注册/导航时检查）。
      var interval = parseInt(F.updateCheckIntervalMs, 10);
      if (isFinite(interval) && interval > 0) {
        setInterval(function () { reg.update().catch(noop); }, interval);
      }
    }).catch(noop);
  }
  if (F.offlineNotice !== false) {
    window.addEventListener('offline', function () {
      if (window.__toast) window.__toast(__T('pwa.offline', '网络已断开'), { type: 'warning' });
    });
    window.addEventListener('online', function () {
      if (window.__toast) window.__toast(__T('pwa.online', '网络已恢复'), { type: 'success' });
    });
  }
  installPrompt(F);
}

export function init() {
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', run, { once: true });
  } else {
    run();
  }
}
