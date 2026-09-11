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
