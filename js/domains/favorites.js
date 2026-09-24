export function init() {
  const F = window.__FEATURES__ || {};
  const FV = F.favorites || {};
  if (FV.enabled === false) return;
  const KEY = FV.storageKey;
  const T = (k, fb) => (window.__T ? window.__T(k, fb) : fb);

  function read() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function save(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* 忽略：存储不可用时收藏仅当次会话有效 */ }
  }
  function has(url) {
    return read().some(x => x.url === url);
  }

  const btn = document.getElementById('favBtn');
  if (btn) {
    const url = btn.getAttribute('data-url') || location.pathname;
    const title = btn.getAttribute('data-title') || document.title;
    const sp = btn.querySelector('span');
    const paint = () => {
      const on = has(url);
      btn.classList.toggle('faved', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (sp) sp.textContent = on ? T('favorites.faved', FV.favedText || '已收藏') : T('favorites.not', FV.notText || '收藏');
    };
    paint();
    btn.addEventListener('click', () => {
      let list = read();
      const on = has(url);
      if (on) list = list.filter(x => x.url !== url);
      else list.unshift({ url, title, time: Date.now() });
      save(list);
      paint();
      if (window.__toast) window.__toast(on ? T('favorites.removed', '已取消收藏') : T('favorites.faved', FV.favedText || '已收藏'), { type: on ? 'info' : 'success' });
    });
  }

  const listEl = document.getElementById('favPageList');
  if (listEl) {
    const render = () => {
      const data = read();
      listEl.innerHTML = '';
      if (!data.length) {
        const p = document.createElement('p');
        p.className = 'fav-empty';
        p.textContent = T('favorites.empty', '暂无收藏');
        listEl.appendChild(p);
        return;
      }
      data.forEach(it => {
        const row = document.createElement('div');
        row.className = 'fav-page-item';
        const a = document.createElement('a');
        a.href = it.url;
        a.textContent = it.title;
        row.appendChild(a);
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'fav-remove';
        rm.setAttribute('aria-label', T('favorites.remove', '从收藏中移除'));
        rm.textContent = '×';
        rm.addEventListener('click', () => {
          save(read().filter(x => x.url !== it.url));
          render();
          if (window.__toast) window.__toast(T('favorites.removed', '已取消收藏'), { type: 'info' });
        });
        row.appendChild(rm);
        listEl.appendChild(row);
      });
    };
    render();
  }
}
