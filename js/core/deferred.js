// 延迟加载聚合入口（esbuild deferred chunk）：
// 交互类/重模块在此静态导入并注册为 name → init 映射，运行时由 main.js 经
// window.__DEFERRED_URL__ 动态载入本 chunk 后调用 load(name)。
// 未打包回退模式（--no-bundle）下本文件不参与产物，main.js 走原生动态 import。
import { init as searchInit } from '../domains/features/search.js';
import { init as lightboxInit } from '../domains/features/lightbox.js';
import { init as readingPanelInit } from '../domains/features/reading-panel.js';
import { init as ttsInit } from '../domains/features/tts.js';
import { init as shortcutsInit } from '../domains/features/shortcuts.js';
import { init as prevNextInit } from '../domains/features/prev-next.js';
import { init as shareInit } from '../domains/features/share.js';
import { init as contactPopupInit } from '../domains/features/contact-popup.js';
import { init as sidebarDragInit } from '../domains/features/sidebar-drag.js';
import { init as themePresetsInit } from '../domains/features/theme-presets.js';
import { init as themeScheduleInit } from '../domains/features/theme-schedule.js';
import { init as pwaInit } from '../domains/features/pwa.js';
import { init as commentsInit } from '../domains/features/comments.js';
import { init as dailyQuoteInit } from '../domains/features/daily-quote.js';
import { init as readingHistoryInit } from '../domains/features/reading-history.js';
import { init as commandPaletteInit } from '../domains/features/command-palette.js';
import { init as morphiconsInit } from '../domains/features/morphicons.js';
import { init as favoritesInit } from '../domains/features/favorites.js';
import { init as guardInit } from '../domains/guard/core.js';
import { init as backgroundInit } from '../domains/features/background.js';
import { init as rewardInit } from '../domains/features/reward.js';
import { init as popupNoticeInit } from '../domains/features/popup-notice.js';
import { init as coverInit } from '../domains/features/cover.js';
import { init as touchFallbackInit } from '../domains/features/touch-fallback.js';

const registry = {
  search: searchInit,
  lightbox: lightboxInit,
  'reading-panel': readingPanelInit,
  tts: ttsInit,
  shortcuts: shortcutsInit,
  'prev-next': prevNextInit,
  share: shareInit,
  'contact-popup': contactPopupInit,
  'sidebar-drag': sidebarDragInit,
  'theme-presets': themePresetsInit,
  'theme-schedule': themeScheduleInit,
  pwa: pwaInit,
  comments: commentsInit,
  'daily-quote': dailyQuoteInit,
  'reading-history': readingHistoryInit,
  'command-palette': commandPaletteInit,
  morphicons: morphiconsInit,
  favorites: favoritesInit,
  guard: guardInit,
  background: backgroundInit,
  reward: rewardInit,
  'popup-notice': popupNoticeInit,
  cover: coverInit,
  'touch-fallback': touchFallbackInit
};

export function load(name) {
  const init = registry[name];
  if (typeof init !== 'function') return Promise.resolve();
  try {
    return Promise.resolve(init());
  } catch (err) {
    return Promise.reject(err);
  }
}

export function has(name) {
  return typeof registry[name] === 'function';
}
