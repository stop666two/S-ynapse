const F = window.__FEATURES__ || {};

function enabled(mod) {
  return !mod || mod.enabled !== false;
}

if (enabled(F.favorites)) {
  import('../domains/favorites.js').then(m => m.init());
}

import('../domains/theme.js').then(m => m.init());
import('../domains/navigation.js').then(m => m.init());
import('../domains/search.js').then(m => m.init());
import('../domains/toc.js').then(m => m.init());
import('../domains/reading.js').then(m => m.init());
import('../domains/lightbox.js').then(m => m.init());
import('../domains/reading-panel.js').then(m => m.init());
import('../domains/tts.js').then(m => m.init());
import('../domains/page-transition.js').then(m => m.init());
import('../domains/shortcuts.js').then(m => m.init());
import('../domains/prev-next.js').then(m => m.init());
import('../domains/share.js').then(m => m.init());
