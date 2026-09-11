const F = window.__FEATURES__ || {};

function enabled(mod) {
  return !mod || mod.enabled !== false;
}

if (enabled(F.favorites)) {
  import('../domains/favorites.js').then(m => m.init());
}

import('../domains/theme.js').then(m => m.init());
import('../domains/navigation.js').then(m => m.init());
