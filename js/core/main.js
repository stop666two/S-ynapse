import { init as themeInit } from '../domains/theme.js';
import { init as navigationInit } from '../domains/navigation.js';
import { init as searchInit } from '../domains/search.js';
import { init as tocInit } from '../domains/toc.js';
import { init as readingInit } from '../domains/reading.js';
import { init as lightboxInit } from '../domains/lightbox.js';
import { init as announcementInit } from '../domains/announcement.js';
import { init as readingPanelInit } from '../domains/reading-panel.js';
import { init as ttsInit } from '../domains/tts.js';
import { init as pageTransitionInit } from '../domains/page-transition.js';
import { init as seamlessNavInit } from '../domains/seamless-nav.js';
import { init as shortcutsInit } from '../domains/shortcuts.js';
import { init as prevNextInit } from '../domains/prev-next.js';
import { init as shareInit } from '../domains/share.js';
import { init as motionInit } from '../domains/motion.js';
import { init as imageLazyInit } from '../domains/image-lazy.js';
import { init as dailyQuoteInit } from '../domains/daily-quote.js';
import { init as rewardInit } from '../domains/reward.js';
import { init as backgroundInit } from '../domains/background.js';
import { init as i18nInit } from '../domains/i18n.js';
import { init as readingModeInit } from '../domains/reading-mode.js';
import { init as contactPopupInit } from '../domains/contact-popup.js';
import { init as externalLinkInit } from '../domains/external-link.js';
import { init as sidebarDragInit } from '../domains/sidebar-drag.js';
import { init as themePresetsInit } from '../domains/theme-presets.js';
import { init as themeScheduleInit } from '../domains/theme-schedule.js';
import { init as pwaInit } from '../domains/pwa.js';
import { init as codeBlockInit } from '../domains/code-block.js';
import { init as commentsInit } from '../domains/comments.js';
import { init as morphIconsInit } from '../domains/morphicons.js';
import { init as readPositionInit } from '../domains/read-position.js';
import { init as commandPaletteInit } from '../domains/command-palette.js';
import { init as readingHistoryInit } from '../domains/reading-history.js';

const F = window.__FEATURES__ || {};

function enabled(mod) {
  return !mod || mod.enabled !== false;
}

const tasks = [];

if (enabled(F.favorites)) {
  tasks.push(import('../domains/favorites.js').then(m => m.init()));
}

if (window.__GUARD__) {
  tasks.push(import('../domains/guard/core.js').then(m => m.init()).catch(() => {}));
}

[
  themeInit, navigationInit, searchInit, tocInit, readingInit, lightboxInit,
  readingPanelInit, ttsInit, seamlessNavInit, pageTransitionInit, shortcutsInit, prevNextInit,
  shareInit, motionInit, imageLazyInit, dailyQuoteInit, rewardInit, backgroundInit,
  i18nInit, readingModeInit, contactPopupInit, externalLinkInit, sidebarDragInit,
  themePresetsInit, themeScheduleInit, pwaInit, codeBlockInit, commentsInit, morphIconsInit, readPositionInit, commandPaletteInit, readingHistoryInit, announcementInit
].forEach(fn => {
  try { tasks.push(Promise.resolve(fn())); } catch (e) { tasks.push(Promise.reject(e)); }
});

Promise.allSettled(tasks).then(() => {
  window.__APP_READY__ = true;
});
