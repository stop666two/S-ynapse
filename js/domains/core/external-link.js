// 外链拦截链路：白名单放行（可选强制新标签页）、黑名单/模式（warn|prohibit|hint）拦截、复制链接按钮。
// 配置来源：features.externalLink（经 window.__FEATURES__ 注入）与 site.externalLinkWarning（window.__LINK_WARNING__）。
export function init() {
  var c = window.__LINK_WARNING__ || {};
  var F = window.__FEATURES__ || {}, EL = F.externalLink || {};
  var enabled = (EL.enabled !== false && c.enabled !== false);
  if (!enabled) return;
  var wl = EL.whitelist && EL.whitelist.length ? EL.whitelist : (c.whitelist || []);
  var bl = EL.blacklist || [];
  var mode = EL.mode || 'warn';
  var msg = (EL.messageEn && window.__T && document.documentElement.getAttribute('data-lang') === 'en') ? EL.messageEn : (EL.message || c.message || '');
  var isEn = function () { return window.__T && document.documentElement.getAttribute('data-lang') === 'en'; };
  var escH = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  var fullUrl = EL.showFullUrl !== false, newTab = EL.openInNewTab !== false;
  // whitelistNewTab=true：白名单外链强制新标签页打开（target=_blank + noopener/noreferrer 等效语义）；
  // false（默认）= 不改写浏览器默认行为（当前页面跳转），保持历史行为。
  var wlNewTab = EL.whitelistNewTab === true;
  var copyBtn = document.getElementById('linkWarningCopy');
  var COPY_FEEDBACK_MS = 1500;
  var openExt = function (u) { window.open(u, newTab ? '_blank' : '_self', newTab ? 'noopener' : ''); };
  // 复制按钮文案优先级：copyButtonTextEn（en 站，空回退中文键）> copyButtonText > ui-strings/built-in 双语。
  function copyButtonLabel() {
    if (isEn()) return EL.copyButtonTextEn || EL.copyButtonText || __T('toolbar.copyLink', 'Copy link');
    return EL.copyButtonText || __T('toolbar.copyLink', '复制链接');
  }
  // 复制当前外链 URL：Clipboard API 优先，不可用时回退 execCommand；成功短暂显示「已复制」。
  function wireCopy(u) {
    if (!copyBtn) return;
    var label = copyButtonLabel();
    copyBtn.textContent = label;
    copyBtn.onclick = function () {
      var done = function () {
        copyBtn.textContent = __T('toolbar.copied', '已复制');
        setTimeout(function () { copyBtn.textContent = label; }, COPY_FEEDBACK_MS);
      };
      var fallback = function () {
        try {
          var ta = document.createElement('textarea');
          ta.value = u.href; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        } catch (err) { /* 复制不可用时不改写反馈，不阻断外链流程 */ }
        done();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(u.href).then(done, fallback);
      } else fallback();
    };
  }
  function matchWhitelist(url) {
    for (var i = 0; i < wl.length; i++) {
      var raw = wl[i];
      var p = raw.replace(/\./g, '\\.').replace(/\*/g, '[^/]*?');
      if (new RegExp('^' + p + '$', 'i').test(url)) return true;
      if (raw.startsWith('*.')) {
        var p2 = raw.slice(2).replace(/\./g, '\\.');
        if (new RegExp('^' + p2 + '$', 'i').test(url)) return true;
      }
    }
    return false;
  }
  function inBlacklist(host) {
    for (var j = 0; j < bl.length; j++) {
      var b = bl[j].replace(/\./g, '\\.');
      if (new RegExp('(^|\\.)' + b + '$', 'i').test(host)) return true;
    }
    return false;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var h = a.getAttribute('href');
    if (!h || h[0] == '/' || h[0] == '#' || h.slice(0, 7) == 'mailto:' || h.slice(0, 11) == 'javascript:') return;
    var u;
    try { u = new URL(h, window.location.href); } catch (ex) { return; }
    if (u.origin == window.location.origin) return;
    if (matchWhitelist(u.hostname + u.pathname) || matchWhitelist(u.hostname)) {
      if (wlNewTab) { e.preventDefault(); window.open(u.href, '_blank', 'noopener,noreferrer'); }
      return;
    }
    var o = document.getElementById('linkWarningOverlay'), b = document.getElementById('linkWarningBody'), x = document.getElementById('linkWarningConfirm'), n = document.getElementById('linkWarningCancel');
    var blocked = inBlacklist(u.hostname);
    if (blocked) {
      e.preventDefault();
      if (o && b && x) {
        b.innerHTML = (isEn() ? __T('toolbar.linkBlocked', 'Link blocked') : '该链接被站点屏蔽') + (fullUrl ? '<span class="link-url">' + escH(h) + '</span>' : '');
        o.hidden = false;
        x.textContent = isEn() ? __T('toolbar.close', 'Close') : '关闭';
        x.onclick = function () { o.hidden = true; };
        n.onclick = function () { o.hidden = true; };
        wireCopy(u);
      }
      return;
    }
    if (mode === 'hint') { openExt(h); return; }
    if (mode === 'prohibit') {
      e.preventDefault();
      if (o && b && x) {
        b.innerHTML = (isEn() ? __T('toolbar.extLinkBlocked', 'External links are blocked by site policy') : '外部链接已被站点策略阻止') + (fullUrl ? '<span class="link-url">' + escH(h) + '</span>' : '');
        o.hidden = false;
        x.textContent = isEn() ? __T('toolbar.okay', 'Got it') : '我知道了';
        x.onclick = function () { o.hidden = true; };
        n.onclick = function () { o.hidden = true; };
        wireCopy(u);
      }
      return;
    }
    e.preventDefault();
    if (!o || !b) return;
    b.innerHTML = (msg || '').replace('{url}', '') + (fullUrl ? '<span class="link-url">' + escH(h) + '</span>' : '');
    o.hidden = false;
    x.onclick = function () { o.hidden = true; openExt(h); };
    n.onclick = function () { o.hidden = true; };
    wireCopy(u);
  });
}
