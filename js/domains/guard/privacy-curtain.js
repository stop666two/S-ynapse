// Guard privacy curtain —— 窗口隐私帘（失焦/切标签遮罩 + PrintScreen 检测）
export function init(ctx) {
  const cfg = (ctx.G.privacyCurtain) || {};
  if (cfg.enabled === false) return;
  const html = document.documentElement;
  const lang = (document.documentElement.lang || 'zh').startsWith('en') ? 'en' : 'zh';

  html.style.setProperty('--g-curtainBlur', cfg.blurAmount || '8px');

  const overlay = document.createElement('div');
  overlay.className = 'g-curtain-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'g-curtain-text';
  label.textContent = (lang === 'en' ? (cfg.curtainTextEn || cfg.curtainText) : cfg.curtainText) || '';
  overlay.appendChild(label);
  document.body.appendChild(overlay);

  let timer = null;
  function show() {
    clearTimeout(timer);
    html.classList.add('g-curtain-on');
  }
  function hide() {
    const delay = Math.max(0, parseInt(cfg.revealDelayMs, 10) || 200);
    clearTimeout(timer);
    timer = setTimeout(function () { html.classList.remove('g-curtain-on'); }, delay);
  }

  if (cfg.blurOnBlur !== false) {
    window.addEventListener('blur', show);
    window.addEventListener('focus', hide);
  }
  if (cfg.blurOnVisibility !== false) {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) show();
      else hide();
    });
  }

  if (cfg.prtScNotice) {
    let fired = false;
    document.addEventListener('keyup', function (e) {
      if (e.key !== 'PrintScreen') return;
      if (cfg.prtScOncePerSession !== false && fired) return;
      fired = true;
      ctx.toast(cfg.prtScText || ctx.t('screenKey', '已检测到截屏按键'));
    });
  }

  ctx.log('privacyCurtain ready');
}
