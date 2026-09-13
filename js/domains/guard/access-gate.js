// Guard access gate —— 访问门槛（路径前缀密码 + 限次 + 解锁码 + 会话记忆）
export function init(ctx) {
  const cfg = (ctx.G.accessGate) || {};
  if (cfg.enabled === false) return;
  const pw = cfg.password || {};
  const PASS_KEY = 's-gate-pass';
  const VIEW_KEY = 's-gate-views';
  const paths = Array.isArray(cfg.paths) ? cfg.paths.filter(Boolean) : [];
  const inScope = paths.length === 0 || paths.some(function (p) { return String(p).charAt(0) === '/' && location.pathname.indexOf(p) === 0; });

  function unlocked() {
    try {
      const v = JSON.parse(localStorage.getItem(PASS_KEY) || 'null');
      return !!(v && typeof v.exp === 'number' && v.exp > Date.now());
    } catch (e) { return false; }
  }

  function storeUnlock() {
    const hours = Math.max(0, parseInt(pw.rememberHours, 10) || 0);
    try { localStorage.setItem(PASS_KEY, JSON.stringify({ exp: Date.now() + hours * 3600000 })); } catch (e) { /* 忽略 */ }
  }

  async function sha256hex(s) {
    if (!(typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest)) {
      throw new Error('crypto.subtle unavailable');
    }
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function renderGate(limitMode) {
    if (document.querySelector('.g-gate')) return;
    const wrap = document.createElement('div');
    wrap.className = 'g-gate';
    wrap.setAttribute('role', 'dialog');
    const card = document.createElement('div');
    card.className = 'g-gate-card';
    const h = document.createElement('h3');
    h.textContent = limitMode ? ctx.t('gateLimit', '今日访问次数已达上限') : (pw.title || ctx.t('gateTitle', '此内容受保护'));
    card.appendChild(h);
    if (!limitMode) {
      const input = document.createElement('input');
      input.type = 'password';
      input.className = 'g-gate-input';
      input.placeholder = pw.placeholder || ctx.t('gatePlaceholder', '请输入访问密码');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '进入';
      const err = document.createElement('p');
      err.className = 'g-gate-err';
      btn.addEventListener('click', function () {
        sha256hex((pw.salt || '') + (input.value || '')).then(function (hex) {
          if (pw.hash && hex === pw.hash) {
            storeUnlock();
            wrap.remove();
            if (cfg.logDetect) ctx.log('gate unlocked');
          } else {
            err.textContent = pw.errorText || ctx.t('gateError', '密码错误，请重试');
          }
        }).catch(function () {
          err.textContent = ctx.t('gateInsecure', '当前环境无法校验密码（需 HTTPS 或 localhost）');
        });
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
      card.appendChild(input);
      card.appendChild(btn);
      card.appendChild(err);
    }
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    if (!limitMode) setTimeout(function () { const i = wrap.querySelector('input'); if (i) i.focus(); }, 50);
  }

  function countView() {
    const limit = parseInt(cfg.viewsPerDay, 10) || 0;
    if (limit <= 0) return false;
    const today = new Date().toISOString().slice(0, 10);
    let rec = null;
    try { rec = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); } catch (e) { /* 忽略 */ }
    if (!rec || rec.d !== today) rec = { d: today, n: 0 };
    rec.n += 1;
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(rec)); } catch (e) { /* 忽略 */ }
    return rec.n > limit;
  }

  const over = document.prerendering ? false : countView();
  if (over) {
    if ((cfg.viewsAction || 'toast') === 'lock') renderGate(true);
    else ctx.toast(ctx.t('gateLimit', '今日访问次数已达上限'));
  }

  if (pw.enabled && inScope) {
    const key = new URLSearchParams(location.search).get('key');
    const codes = Array.isArray(cfg.unlockCodes) ? cfg.unlockCodes : [];
    if (key && codes.indexOf(key) > -1) storeUnlock();
    else if (!unlocked() && pw.hash) renderGate(false);
  }

  if (cfg.logDetect) ctx.log('accessGate ready');
}
