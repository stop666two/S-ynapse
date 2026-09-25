export function init() {
  function scan() {
    var F = window.__FEATURES__ || {}, IL = (F && F.imageLazy) || {};
    if (IL.enabled === false) return;
    var fade = IL.fadeIn !== false;
    var FB = (F && F.imageFallback) || {}, fbimg = FB.fallbackImage || IL.placeholderColor || '';
    var lc = IL.loadingClass || 'js-img', ec = IL.errorClass || '', ef = Math.max(0, parseInt(IL.eagerFirst) || 0);
    if (IL.lqip !== false) {
      document.querySelectorAll('img[data-lqip]').forEach(function (i) {
        if (i.getAttribute('data-lqip-applied') === '1') return;
        i.setAttribute('data-lqip-applied', '1');
        i.style.backgroundSize = 'cover';
        i.style.backgroundPosition = '50% 50%';
        i.style.backgroundImage = 'url("' + i.getAttribute('data-lqip') + '")';
      });
    }
    var imgs = Array.prototype.slice.call(document.querySelectorAll('img:not([loading=eager])')).filter(function (i) {
      return i.getAttribute('data-lazy-bound') !== '1';
    });
    for (var j = 0; j < Math.min(ef, imgs.length); j++) {
      imgs[j].setAttribute('loading', 'eager');
      imgs[j].setAttribute('data-lazy-bound', '1');
    }
    imgs.slice(ef).forEach(function (i) {
      i.setAttribute('data-lazy-bound', '1');
      if (fbimg && !i.getAttribute('data-fb')) i.setAttribute('data-fb', fbimg);
      if (!fade) return;
      i.classList.add(lc);
      if (i.complete) i.classList.add('loaded');
      else i.addEventListener('load', function () { i.classList.add('loaded'); });
      i.addEventListener('error', function () {
        i.classList.add('loaded');
        if (ec) i.classList.add(ec);
        if (FB.enabled !== false && FB.fallbackImage && !i.dataset.fbdone) {
          var alt = i.getAttribute('alt') || '';
          if (FB.showAlt && alt) { i.alt = alt; i.classList.add('img-fallback-alt'); }
          else { i.src = FB.fallbackImage; i.classList.add('img-fallback'); i.dataset.fbdone = '1'; }
        }
      });
    });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', scan); } else { scan(); }
  window.__SOFTNAV_HOOKS__.push(scan);
}
