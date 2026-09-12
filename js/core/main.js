// 入口：仅关键模块静态加载并同步初始化；交互类/重模块全部由 boot.js 动态导入分阶段调度。
import { init as themeInit } from '../domains/theme.js';
import { init as navigationInit } from '../domains/navigation.js';
import { init as i18nInit } from '../domains/i18n.js';
import { init as announcementInit } from '../domains/announcement.js';
import { init as readPositionInit } from '../domains/read-position.js';
import { init as tocInit } from '../domains/toc.js';
import { init as readingInit } from '../domains/reading.js';
import { init as motionInit } from '../domains/motion.js';
import { init as imageLazyInit } from '../domains/image-lazy.js';
import { init as seamlessNavInit } from '../domains/seamless-nav.js';
import { init as pageTransitionInit } from '../domains/page-transition.js';
import { init as externalLinkInit } from '../domains/external-link.js';
import { init as readingModeInit } from '../domains/reading-mode.js';
import { init as codeBlockInit } from '../domains/code-block.js';
import { boot } from './boot.js';

const F = window.__FEATURES__ || {};

function enabled(mod) {
  return !mod || mod.enabled !== false;
}

function dyn(path) {
  return () => import(path).then(m => m.init());
}

const idleQueue = [
  dyn('../domains/search.js'),
  dyn('../domains/lightbox.js'),
  dyn('../domains/reading-panel.js'),
  dyn('../domains/tts.js'),
  dyn('../domains/shortcuts.js'),
  dyn('../domains/prev-next.js'),
  dyn('../domains/share.js'),
  dyn('../domains/contact-popup.js'),
  dyn('../domains/sidebar-drag.js'),
  dyn('../domains/theme-presets.js'),
  dyn('../domains/theme-schedule.js'),
  dyn('../domains/pwa.js'),
  dyn('../domains/comments.js'),
  dyn('../domains/daily-quote.js'),
  dyn('../domains/reading-history.js'),
  dyn('../domains/command-palette.js'),
  dyn('../domains/morphicons.js')
];
if (enabled(F.favorites)) {
  idleQueue.push(dyn('../domains/favorites.js'));
}

const criticalQueue = [
  () => themeInit(), () => navigationInit(), () => i18nInit(), () => announcementInit(),
  () => readPositionInit(), () => tocInit(), () => readingInit(), () => motionInit(),
  () => imageLazyInit(), () => seamlessNavInit(), () => pageTransitionInit(),
  () => externalLinkInit(), () => readingModeInit(), () => codeBlockInit()
];
if (window.__GUARD__) {
  criticalQueue.push(() => import('../domains/guard/core.js').then(m => m.init()));
}

boot({
  critical: criticalQueue,
  idle: idleQueue,
  heavy: [dyn('../domains/background.js'), dyn('../domains/reward.js')]
});
