// 入口：关键模块静态加载并同步初始化；交互类/重模块由 boot.js 经 deferred chunk 分阶段调度。
// 双模式：
//   - 打包构建（存在 window.__DEFERRED_URL__）：按需 import deferred chunk 后调用 load(name)；
//   - 未打包回退（--no-bundle）：走原生动态 import 路径（产物为拷贝的 ESM 源码）。
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

const DEFERRED_URL = (typeof window !== 'undefined' && window.__DEFERRED_URL__) || '';
let deferredPromise = null;

function loadFeature(name) {
  if (!deferredPromise) {
    deferredPromise = import(DEFERRED_URL).catch(function (err) {
      console.warn('[bundle] deferred chunk 加载失败，交互类功能不可用：' + (err && err.message ? err.message : err));
      return null;
    });
  }
  return deferredPromise.then(function (m) { return m ? m.load(name) : undefined; });
}

function dyn(name, path) {
  return function () {
    if (DEFERRED_URL) return loadFeature(name);
    return import(path).then(function (m) { return m.init(); });
  };
}

const idleQueue = [
  dyn('search', '../domains/search.js'),
  dyn('lightbox', '../domains/lightbox.js'),
  dyn('reading-panel', '../domains/reading-panel.js'),
  dyn('tts', '../domains/tts.js'),
  dyn('shortcuts', '../domains/shortcuts.js'),
  dyn('prev-next', '../domains/prev-next.js'),
  dyn('share', '../domains/share.js'),
  dyn('contact-popup', '../domains/contact-popup.js'),
  dyn('sidebar-drag', '../domains/sidebar-drag.js'),
  dyn('theme-presets', '../domains/theme-presets.js'),
  dyn('theme-schedule', '../domains/theme-schedule.js'),
  dyn('pwa', '../domains/pwa.js'),
  dyn('comments', '../domains/comments.js'),
  dyn('daily-quote', '../domains/daily-quote.js'),
  dyn('reading-history', '../domains/reading-history.js'),
  dyn('command-palette', '../domains/command-palette.js'),
  dyn('morphicons', '../domains/morphicons.js'),
  dyn('favorites', '../domains/favorites.js')
];

const criticalQueue = [
  () => themeInit(), () => navigationInit(), () => i18nInit(), () => announcementInit(),
  () => readPositionInit(), () => tocInit(), () => readingInit(), () => motionInit(),
  () => imageLazyInit(), () => seamlessNavInit(), () => pageTransitionInit(),
  () => externalLinkInit(), () => readingModeInit(), () => codeBlockInit()
];
// 配置外置后 __GUARD__ 在 boot 等待 __CONFIG_READY__ 后才存在，因此延迟到执行期判定；
// favorites 同理（favorites.init 内部按 features.favorites.enabled 自行短路）。
criticalQueue.push(function () {
  if (!window.__GUARD__) return undefined;
  if (DEFERRED_URL) return loadFeature('guard');
  return import('../domains/guard/core.js').then(function (m) { return m.init(); });
});

boot({
  critical: criticalQueue,
  idle: idleQueue,
  heavy: [dyn('background', '../domains/background.js'), dyn('reward', '../domains/reward.js')]
});
