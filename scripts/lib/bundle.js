// esbuild 两段 chunk 打包（优化 Task 1.2）：
//   app      首屏启动链（js/core/main.js，含静态关键模块）
//   deferred 交互/重模块聚合（js/core/deferred.js，运行时按需载入）
// 产物带内容哈希（app.<hash>.js / deferred.<hash>.js），由 esbuild 生成；
// 写入使用项目原子写工具，保证不与 --watch 并发读者产生半截文件。
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { writeFileAtomicSync } = require('./atomic-write');

const APP_ENTRY = 'js/core/main.js';
const DEFERRED_ENTRY = 'js/core/deferred.js';
const APP_FILE_RE = /^app\.[0-9A-Za-z]+\.js$/;
const DEFERRED_FILE_RE = /^deferred\.[0-9A-Za-z]+\.js$/;

/**
 * 是否启用打包：默认启用；`--no-bundle` 或 esbuild 不可用时回退原生 ESM 拷贝模式。
 *
 * @param {string[]} argv 进程参数
 * @param {boolean} esbuildAvailable esbuild 是否可加载
 * @returns {boolean}
 */
function bundleEnabled(argv, esbuildAvailable) {
  return !argv.includes('--no-bundle') && !!esbuildAvailable;
}

/**
 * esbuild 是否可用（devDependency；CI/本地安装后为真）。
 *
 * @returns {boolean}
 */
function esbuildAvailable() {
  try {
    require.resolve('esbuild');
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 执行两段 chunk 打包并原子写入 outDir/assets/js。
 *
 * @param {{ root: string, outDir: string, minify?: boolean }} options
 * @returns {Promise<{ appJsHref: string, deferredUrl: string, files: string[] }>}
 * @throws {Error} esbuild 缺失或构建失败时抛出（由 build.js 统一失败处理）
 */
async function buildBundles(options) {
  const opts = /** @type {{ root?: string, outDir?: string, minify?: boolean }} */ (options || {});
  const root = opts.root;
  const outDir = opts.outDir;
  const minify = opts.minify !== false;
  if (!root || !outDir) throw new Error('buildBundles 需要 root 与 outDir');
  const esbuild = require('esbuild');
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: { app: APP_ENTRY, deferred: DEFERRED_ENTRY },
    outdir: path.join(outDir, 'assets', 'js'),
    bundle: true,
    format: 'esm',
    splitting: false,
    minify,
    target: ['es2020'],
    write: false,
    entryNames: '[name].[hash]',
    logLevel: 'warning'
  });
  const names = [];
  for (const out of result.outputFiles) {
    fs.mkdirSync(path.dirname(out.path), { recursive: true });
    writeFileAtomicSync(out.path, out.text);
    names.push(path.basename(out.path));
  }
  const appFile = names.find(function (n) { return APP_FILE_RE.test(n); });
  const deferredFile = names.find(function (n) { return DEFERRED_FILE_RE.test(n); });
  if (!appFile || !deferredFile) {
    throw new Error('打包产物缺少 app/deferred chunk：' + names.join(', '));
  }
  return {
    appJsHref: '/assets/js/' + appFile,
    deferredUrl: '/assets/js/' + deferredFile,
    files: names.sort()
  };
}

module.exports = { APP_ENTRY, DEFERRED_ENTRY, bundleEnabled, esbuildAvailable, buildBundles };
