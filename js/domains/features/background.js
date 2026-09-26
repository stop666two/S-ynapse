export function init() {
  (function () {
    var F = window.__FEATURES__ || {}, BG = (F && F.background) || {}, G = BG.particles || {};
    if (G.enabled === false) return;
    var b = document.body;
    if (!b || !b.classList.contains('bg-particles')) return;
    var cv = document.getElementById('bgFx');
    if (!cv) return;
    if (G.autoDisableMobile && (window.matchMedia('(pointer:coarse)').matches || window.innerWidth < (+G.mobileMaxWidth || 640))) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    // 兜底数字与 features-schema.js → DEFAULT_FEATURES.background.particles 同值；仅在配置缺失/非法时生效。
    var N = Math.max(10, Math.min(120, parseInt(G.count) || 72)), R = parseFloat(G.speed) || 0.5, link = +(G.linkDistance || 120), opa = G.opacity || 0.7;
    var dotrgb = '139,153,168';
    try {
      var c = getComputedStyle(document.body).getPropertyValue('--color-s').trim();
      if (c && c[0] === '#') { dotrgb = parseInt(c.slice(1, 3), 16) + ',' + parseInt(c.slice(3, 5), 16) + ',' + parseInt(c.slice(5, 7), 16); }
    } catch (e) { /* 忽略：可选背景特性失败不阻塞页面 */ }
    var dots = [];
    function rs() {
      cv.width = window.innerWidth; cv.height = window.innerHeight; dots = [];
      for (var i = 0; i < N; i++) { dots.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, vx: (Math.random() - 0.5) * R, vy: (Math.random() - 0.5) * R, r: Math.random() * 1.8 + 1 }); }
    }
    var rafId = 0;
    function start() { if (!rafId) rafId = window.requestAnimationFrame(step); }
    function stop() { if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function step() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        if (d.x < 0 || d.x > cv.width) d.vx *= -1;
        if (d.y < 0 || d.y > cv.height) d.vy *= -1;
        d.x += d.vx; d.y += d.vy;
        if (G.showLines !== false) {
          for (var j = i + 1; j < dots.length; j++) {
            var dx = d.x - dots[j].x, dy = d.y - dots[j].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < link) {
              ctx.strokeStyle = 'rgba(' + dotrgb + ',' + Math.max(0, 1 - dist / link) * 0.35 + ')';
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(dots[j].x, dots[j].y); ctx.stroke();
            }
          }
        }
        ctx.fillStyle = 'rgba(' + dotrgb + ',' + opa + ')';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      }
      rafId = window.requestAnimationFrame(step);
    }
    rs(); start();
    window.addEventListener('resize', rs, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { stop(); } else { start(); } });
  })();
}
