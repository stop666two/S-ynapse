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
    var TNQ = (window.__TUNING__ || {}).dailyQuote || {};
    var k = String(TNQ.refreshDaily) === 'false' ? Math.floor(Math.random() * n) : (d.getDate() * 7 + d.getMonth() * 3 + d.getFullYear()) % (n || 1);
    var pick = qs[k % n];
    qt.textContent = pick.text || '';
    if (Q.quoteColor) qt.style.color = String(Q.quoteColor);
    if (qa && pick.author && String(TNQ.showAuthor) !== 'false') qa.textContent = '— ' + pick.author;
  })();
}
