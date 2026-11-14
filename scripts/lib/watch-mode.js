'use strict';
// watch 模式编排（/）：构建串行器与监听路径清单。
// 抽成独立模块是为了可单测 —— scripts/build.js 被 require 即执行整轮构建，无法在测试里断言。
const path = require('path');

// 构建串行器：同一进程内任意时刻最多一轮任务在跑。进行中再次触发只置位排队，
// 当前轮结束后以同一任务补跑一次（多文件保存自然合并为一次重建）。
// 首轮也必须走这里：否则首轮绕过守卫，与重建并发跑两轮 build，
// 二者共享同一份 BUILD_ERRORS / INCREMENTAL_CTX / 媒体缓存闭包并写同一个 dist/
// 与 .build-cache.json，产物可能是两版状态混合、缓存条目与最终 HTML 不一致。
function createBuildSerializer() {
  let building = false;
  let queued = false;
  let activeTask = null;
  let activePromise = Promise.resolve();

  // 返回进行中（或本轮）的 promise；同一任务在队列中最多补跑一次。
  function run(task) {
    if (typeof task !== 'function') throw new TypeError('createBuildSerializer().run 需要函数');
    if (building) {
      queued = true;
      return activePromise;
    }
    building = true;
    queued = false;
    activeTask = task;
    activePromise = (async function () {
      try {
        do {
          queued = false;
          await task();
        } while (queued);
      } finally {
        building = false;
        queued = false;
        activeTask = null;
      }
    })();
    return activePromise;
  }

  return {
    run: run,
    isBuilding: function () { return building; },
    isQueued: function () { return queued; },
    activeTask: function () { return activeTask; }
  };
}

// 监听路径：文章/模板/静态资源/媒体/视频/素材/自定义页 + 根级配置 + data/。
// data/ 是每日一言等数据的默认来源（build/helpers.js → features.dailyQuote.dataFile 默认
// 'data/quotes.json5'），不监听它时改数据不会触发重建，必须改动别的文件才生效。
function resolveWatchPaths(root) {
  const base = String(root);
  return [
    path.join(base, 'articles', '**', '*.md'),
    path.join(base, 'templates', '**', '*.ejs'),
    path.join(base, 'static', '**', '*'),
    path.join(base, 'media', '**', '*'),
    path.join(base, 'videos', '**', '*'),
    path.join(base, 'assets', '**', '*'),
    path.join(base, 'pages', '**', '*.md'),
    path.join(base, 'data', '**', '*'),
    path.join(base, '*.json'),
    path.join(base, '*.json5')
  ];
}

module.exports = { createBuildSerializer, resolveWatchPaths };
