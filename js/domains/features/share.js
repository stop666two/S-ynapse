export function init() {
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-share]');
    if (!b) return;
    e.preventDefault();
    var kind = b.getAttribute('data-share');
    var url = window.location.href, title = document.title || '';
    var SH = window.__FEATURES__ && window.__FEATURES__.share || {};
    var __en = (document.documentElement.getAttribute('data-lang') || ((document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'zh')) === 'en';
    var showCopied = function () { var ms = +SH.copiedShowMs; if (window.__toast) window.__toast(__en ? (SH.copiedTextEn || SH.copiedText || __T('post.linkCopied', '链接已复制')) : (SH.copiedText || __T('post.linkCopied', '链接已复制')), { type: 'success', duration: isNaN(ms) ? undefined : ms }); };
    if (SH.useNativeShare && navigator.share && kind !== 'copy' && kind !== 'wechat') {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    if (kind === 'copy' || kind === 'wechat') {
      var tpl = (__en && SH.wechatTextEn) ? SH.wechatTextEn : SH.wechatText;
      var txt = (kind === 'wechat' && tpl) ? String(tpl).replace(/\{title\}/g, title).replace(/\{url\}/g, url) : ((kind === 'wechat' ? title + '\n' : '') + url);
      var legacyCopy = function () {
        var ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { /* 忽略：旧接口失败由 ok 标志回退提示 */ }
        document.body.removeChild(ta);
        if (ok) showCopied();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(showCopied).catch(function () { if (SH.copyFallback !== false) legacyCopy(); });
      } else if (SH.copyFallback !== false) {
        legacyCopy();
      }
      return;
    }
    var href = '';
    if (kind === 'weibo') href = 'https://service.weibo.com/share/share.php?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title);
    else if (kind === 'qq') href = 'https://connect.qq.com/widget/shareqq/index.html?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title);
    else if (kind === 'x') href = 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(title);
    else if (kind === 'facebook') href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
    else if (kind === 'mail') href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(url);
    window.open(href, '_blank', 'noopener,width=' + (isNaN(+SH.popupWidth) ? 640 : +SH.popupWidth) + ',height=' + (isNaN(+SH.popupHeight) ? 520 : +SH.popupHeight));
  });
}
