// 入口：关键模块静态加载并同步初始化；交互类/重模块由 boot.js 经 deferred chunk 分阶段调度。
// 双模式：
//   - 打包构建（存在 window.__DEFERRED_URL__）：按需 import deferred chunk 后调用 load(name)；
//   - 未打包回退（--no-bundle）：走原生动态 import 路径（产物为拷贝的 ESM 源码）。
import { init as themeInit } from '../domains/core/theme.js';
import { init as navigationInit } from '../domains/core/navigation.js';
import { init as i18nInit } from '../domains/core/i18n.js';
import { init as announcementInit } from '../domains/core/announcement.js';
import { init as readPositionInit } from '../domains/core/read-position.js';
import { init as tocInit } from '../domains/core/toc.js';
import { init as readingInit } from '../domains/core/reading.js';
import { init as motionInit } from '../domains/core/motion.js';
import { init as imageLazyInit } from '../domains/core/image-lazy.js';
import { init as seamlessNavInit } from '../domains/core/seamless-nav.js';
import { init as pageTransitionInit } from '../domains/core/page-transition.js';
import { init as vtNamesInit } from '../domains/core/vt-names.js';
import { init as softNavInit } from './soft-nav.js';
import { init as externalLinkInit } from '../domains/core/external-link.js';
import { init as readingModeInit } from '../domains/core/reading-mode.js';
import { init as codeBlockInit } from '../domains/core/code-block.js';
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
  dyn('search', '../domains/features/search.js'),
  dyn('lightbox', '../domains/features/lightbox.js'),
  dyn('reading-panel', '../domains/features/reading-panel.js'),
  dyn('tts', '../domains/features/tts.js'),
  dyn('shortcuts', '../domains/features/shortcuts.js'),
  dyn('prev-next', '../domains/features/prev-next.js'),
  dyn('share', '../domains/features/share.js'),
  dyn('contact-popup', '../domains/features/contact-popup.js'),
  dyn('sidebar-drag', '../domains/features/sidebar-drag.js'),
  dyn('theme-presets', '../domains/features/theme-presets.js'),
  dyn('theme-schedule', '../domains/features/theme-schedule.js'),
  dyn('pwa', '../domains/features/pwa.js'),
  dyn('comments', '../domains/features/comments.js'),
  dyn('daily-quote', '../domains/features/daily-quote.js'),
  dyn('reading-history', '../domains/features/reading-history.js'),
  dyn('command-palette', '../domains/features/command-palette.js'),
  dyn('morphicons', '../domains/features/morphicons.js'),
  dyn('favorites', '../domains/features/favorites.js'),
  dyn('popup-notice', '../domains/features/popup-notice.js')
];

const criticalQueue = [
  () => themeInit(), () => navigationInit(), () => i18nInit(), () => announcementInit(),
  () => readPositionInit(), () => tocInit(), () => readingInit(), () => motionInit(),
  () => imageLazyInit(), () => seamlessNavInit(), () => pageTransitionInit(), () => vtNamesInit(),
  () => externalLinkInit(), () => readingModeInit(), () => codeBlockInit(), () => softNavInit()
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
  heavy: [dyn('background', '../domains/features/background.js'), dyn('reward', '../domains/features/reward.js')]
});
