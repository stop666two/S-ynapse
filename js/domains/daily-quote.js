export function init() {
  (function () {
    var F = window.__FEATURES__ || {}, Q = (F && F.dailyQuote) || {};
    if (Q.enabled === false) return;
    var qt = document.getElementById('quoteText');
    if (!qt || !window.__QUOTES__) return;
    var qa = document.getElementById('quoteAuthor');
    var qs = window.__QUOTES__;
    var n = qs.length;
    if (!n) return;
    var d = new Date();
    var k = (d.getDate() * 7 + d.getMonth() * 3 + d.getFullYear()) % (n || 1);
    var pick = qs[k % n];
    qt.textContent = pick.text || '';
    if (qa && pick.author) qa.textContent = '— ' + pick.author;
  })();
}
