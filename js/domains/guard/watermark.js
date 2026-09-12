// Guard watermark —— 页面水印（fixed / tiled / diagonal）
export function init(ctx) {
  const cfg = (ctx.G.watermark) || {};
  if (cfg.enabled === false) return;
  if (cfg.mobileEnabled !== true && window.matchMedia('(max-width: 768px)').matches) return;

  const type = cfg.type || 'diagonal';
  const lang = (document.documentElement.lang || 'zh').startsWith('en') ? 'en' : 'zh';
  const tpl = (lang === 'en' ? (cfg.textEn || cfg.text) : cfg.text) || '{site}';

  let id = '';
  if (cfg.identity === 'storage' || cfg.identity === 'random') {
    try {
      if (cfg.identity === 'storage') {
        id = localStorage.getItem('s-wm-id') || '';
        if (!id) {
          id = Math.random().toString(36).slice(2, 12);
          localStorage.setItem('s-wm-id', id);
        }
      } else {
        id = Math.random().toString(36).slice(2, 12);
      }
    } catch (e) {
      id = Math.random().toString(36).slice(2, 12);
    }
    const len = Math.max(4, Math.min(16, parseInt(cfg.idLength, 10) || 6));
    id = id.slice(0, len);
  }

  const d = new Date();
  const pad = function (n) { return String(n).padStart(2, '0'); };
  const vars = {
    site: window.__SITE_TITLE__ || document.title || '',
    date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    time: pad(d.getHours()) + ':' + pad(d.getMinutes()),
    id: id,
  };
  const text = tpl.replace(/\{(site|date|time|id)\}/g, function (m, k) { return vars[k] || ''; });

  const root = document.documentElement.style;
  root.setProperty('--g-wmOpacity', String(cfg.opacity != null ? cfg.opacity : 0.06));
  root.setProperty('--g-wmSize', cfg.fontSize || '13px');
  if (cfg.color) root.setProperty('--g-wmColor', cfg.color);
  root.setProperty('--g-wmGapX', cfg.gapX || '180px');
  root.setProperty('--g-wmGapY', cfg.gapY || '140px');
  root.setProperty('--g-wmRotate', (parseFloat(cfg.rotate) || -22) + 'deg');

  const wrap = document.createElement('div');
  wrap.className = 'g-wm g-wm-' + type;
  wrap.setAttribute('aria-hidden', 'true');
  if (cfg.zIndex) wrap.style.zIndex = String(cfg.zIndex);
  if (cfg.animate) wrap.classList.add('g-wm-anim');
  if (cfg.hideOnPrint !== false) wrap.classList.add('g-wm-noprint');
  if (cfg.showInLightbox) wrap.classList.add('g-wm-over-lightbox');

  function makeItem() {
    const s = document.createElement('span');
    s.className = 'g-wm-item';
    s.textContent = text;
    return s;
  }

  if (type === 'fixed') {
    wrap.classList.add('pos-' + (cfg.position || 'bottom-right'));
    wrap.appendChild(makeItem());
  } else {
    const count = type === 'tiled' ? 72 : 80;
    for (let i = 0; i < count; i++) wrap.appendChild(makeItem());
  }
  document.body.appendChild(wrap);

  ctx.log('watermark ready', type, id ? 'id:' + id : 'no-id');
}
