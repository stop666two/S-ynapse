// 文章导出（features.exportArticle）：打印按钮调用 window.print()（浏览器对话框内可另存 PDF）；
// 复制按钮 fetch 构建期产出的 /md 原文 → 剪贴板（navigator.clipboard + textarea 回退）→ 双语 toast。
// 文档级事件委托：软导航替换正文后按钮仍可用，无需重新绑定。
export function init() {
  var F = window.__FEATURES__ || {}, E = F.exportArticle || {};
  if (E.enabled === false) return;
  var en = (document.documentElement.getAttribute('data-lang') || ((document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'zh')) === 'en';
  function t(zh, enText) { return en ? enText : zh; }
  function toast(msg, type) {
    if (typeof window.__toast === 'function') window.__toast(msg, { type: type || 'info' });
  }
  // 复制回退：clipboard API 失败/不可用时用隐藏 textarea + execCommand（与 share/contact 同模式）。
  function copyText(text) {
    return new Promise(function (resolve) {
      var legacy = function () {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { /* 忽略：回退失败由 ok 标志上报 */ }
        document.body.removeChild(ta);
        resolve(ok);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { resolve(true); }).catch(legacy);
      } else {
        legacy();
      }
    });
  }
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    var printBtn = target.closest('[data-export-print]');
    if (printBtn) {
      e.preventDefault();
      if (typeof window.print === 'function') window.print();
      return;
    }
    var copyBtn = target.closest('[data-export-markdown]');
    if (!copyBtn || copyBtn.getAttribute('data-busy') === '1') return;
    e.preventDefault();
    var url = copyBtn.getAttribute('data-md-url') || '';
    var okMsg = (en && E.copiedTextEn) || E.copiedText || t('Markdown 已复制', 'Markdown copied');
    var failMsg = (en && E.copyFailTextEn) || E.copyFailText || t('复制失败', 'Copy failed');
    if (!url) { toast(failMsg, 'error'); return; }
    copyBtn.setAttribute('data-busy', '1');
    var finish = function () { copyBtn.removeAttribute('data-busy'); };
    fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        return copyText(text).then(function (ok) { toast(ok ? okMsg : failMsg, ok ? 'success' : 'error'); });
      })
      .catch(function () { toast(failMsg, 'error'); })
      .then(finish, finish);
  });
}
