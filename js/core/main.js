const F = window.__FEATURES__ || {};

function enabled(mod) {
  return !mod || mod.enabled !== false;
}

const tasks = [];

if (enabled(F.favorites)) {
  tasks.push(import('../domains/favorites.js').then(m => m.init()));
}

[
  'theme', 'navigation', 'search', 'toc', 'reading', 'lightbox', 'reading-panel',
  'tts', 'page-transition', 'shortcuts', 'prev-next', 'share', 'motion',
  'image-lazy', 'daily-quote', 'reward', 'background', 'i18n', 'reading-mode',
  'contact-popup', 'external-link', 'sidebar-drag',
  'theme-presets', 'theme-schedule', 'pwa', 'code-block', 'comments'
].forEach(name => {
  tasks.push(import('../domains/' + name + '.js').then(m => m.init()));
});

Promise.allSettled(tasks).then(() => {
  window.__APP_READY__ = true;
});
