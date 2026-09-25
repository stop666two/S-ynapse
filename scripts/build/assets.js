'use strict';

// 静态资产与 PWA 生成模块（scripts/build/assets.js）。
// 由 scripts/build.js 机械拆分 5/N 迁移而来：函数体原样搬移，行为与拆分前保持一致，
// 以产物哈希等价门禁（scripts/dist-hash-guard.js diff）与 test:build 验证。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeFileAtomicSync } = require('../lib/atomic-write');

function createAssetsModule(ctx) {
  const { root, distDir, staticDir, cspNonce } = ctx;

// Generate PWA manifest.json and service worker.
// The service worker implements a cache-first strategy: serves from cache, fetches in background,
// updates cache on successful fetch. Activated only when site.pwa.enabled is true.
// Note: the generated SW has a fixed cache name (s-ynapse-v1) and ASSETS list.
function copyJsAssets() {
  const SRC = path.join(root, 'js');
  if (!fs.existsSync(SRC)) return;
  const DEST = path.join(distDir, 'assets', 'js');
  const walk = (dir, rel) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const src = path.join(dir, f.name);
      const dst = path.join(DEST, rel, f.name);
      if (f.isDirectory()) walk(src, path.join(rel, f.name));
      else if (f.name.endsWith('.js')) {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
      }
    }
  };
  walk(SRC, '');
  console.log('  Copied js/ assets to /assets/js/');
}

// 打包模式下仍需独立引导脚本 runtime.js（__T/__SB/__toast 与配置引导，必须先于 app 执行），
// 以内容哈希命名：runtime 与 bundle 版本错配时能自动换名，避免旧缓存混用。
function copyRuntimeBootstrap() {
  const SRC = path.join(root, 'js', 'core', 'runtime.js');
  if (!fs.existsSync(SRC)) return '';
  const content = fs.readFileSync(SRC);
  const hash = crypto.createHash('sha1').update(content).digest('hex').slice(0, 10);
  const rel = 'assets/js/runtime.' + hash + '.js';
  const dest = path.join(distDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  writeFileAtomicSync(dest, content);
  console.log('  Created: /' + rel);
  return '/' + rel;
}

// copyVendorAssets — 本地化第三方前端资产（Prism / Mermaid / KaTeX / 字体）。
// 源：node_modules（随项目安装）；产物：dist/assets/vendor/**（同源加载，CSP 'self' 即可，不再依赖外部 CDN）。
const PRISM_LANGS = ['bash', 'diff', 'json', 'python', 'typescript', 'yaml', 'sql', 'markdown'];
// 变量字体（@fontsource-variable，OFL 开源）：单文件覆盖 100–900 字重，体积更小、字重过渡更顺滑。
// 仅取 latin 子集（中文由系统字体链回退），详见 copyVendorAssets 中的 @font-face 生成。
const VENDOR_FONTS = {
  inter: { family: 'Inter', pkg: '@fontsource-variable/inter', file: 'inter-latin-wght-normal.woff2' },
  sora: { family: 'Sora', pkg: '@fontsource-variable/sora', file: 'sora-latin-wght-normal.woff2' },
  manrope: { family: 'Manrope', pkg: '@fontsource-variable/manrope', file: 'manrope-latin-wght-normal.woff2' }
};
const nodeModulesDir = path.join(root, 'node_modules');

function copyVendorAssets(config) {
  const VENDOR = path.join(distDir, 'assets', 'vendor');
  fs.mkdirSync(VENDOR, { recursive: true });
  // Prism：核心 + 常用语言组件 + line-numbers 插件（构建期拼接为单文件；新增语言在 PRISM_LANGS 登记）
  let prism = fs.readFileSync(path.join(nodeModulesDir, 'prismjs', 'prism.js'), 'utf-8');
  PRISM_LANGS.forEach(function (lang) {
    const f = path.join(nodeModulesDir, 'prismjs', 'components', 'prism-' + lang + '.min.js');
    if (fs.existsSync(f)) prism += '\n' + fs.readFileSync(f, 'utf-8');
  });
  const prismLn = path.join(nodeModulesDir, 'prismjs', 'plugins', 'line-numbers', 'prism-line-numbers.min.js');
  if (fs.existsSync(prismLn)) prism += '\n' + fs.readFileSync(prismLn, 'utf-8');
  writeFileAtomicSync(path.join(VENDOR, 'prism.js'), prism);
  // Mermaid：单文件压缩版（仅图表文章按需加载）
  fs.copyFileSync(path.join(nodeModulesDir, 'mermaid', 'dist', 'mermaid.min.js'), path.join(VENDOR, 'mermaid.min.js'));
  // morphicons：图标变形动画（懒加载；仅复制 JS 入口与共享 chunk，types 不落地）
  const MORPH_VENDOR = path.join(VENDOR, 'morphicons');
  fs.mkdirSync(MORPH_VENDOR, { recursive: true });
  const morphDist = path.join(nodeModulesDir, 'morphicons', 'dist');
  fs.readdirSync(morphDist).filter(function (f) { return /^(index|dom|adapters)\.js$/.test(f) || /^(controller|normalize|spring)-[^/]+\.js$/.test(f); }).forEach(function (f) {
    fs.copyFileSync(path.join(morphDist, f), path.join(MORPH_VENDOR, f));
  });
  // KaTeX：js/css/auto-render + 字体目录（CSS 以相对路径引用 fonts/）
  // 字体仅保留 woff2：CSS 的 @font-face 依次声明 woff2/woff/ttf，浏览器命中 woff2 后
  // 不会再请求后续格式；删除 woff/ttf 可再省约 300KB 产物，极端旧浏览器回退系统字体。
  const KATEX = path.join(VENDOR, 'katex');
  fs.mkdirSync(path.join(KATEX, 'contrib'), { recursive: true });
  fs.mkdirSync(path.join(KATEX, 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(nodeModulesDir, 'katex', 'dist', 'katex.min.js'), path.join(KATEX, 'katex.min.js'));
  fs.copyFileSync(path.join(nodeModulesDir, 'katex', 'dist', 'katex.min.css'), path.join(KATEX, 'katex.min.css'));
  fs.copyFileSync(path.join(nodeModulesDir, 'katex', 'dist', 'contrib', 'auto-render.min.js'), path.join(KATEX, 'contrib', 'auto-render.min.js'));
  const kFontsSrc = path.join(nodeModulesDir, 'katex', 'dist', 'fonts');
  fs.readdirSync(kFontsSrc).filter(function (f) { return /\.woff2$/.test(f); }).forEach(function (f) { fs.copyFileSync(path.join(kFontsSrc, f), path.join(KATEX, 'fonts', f)); });
  // 清理历史构建遗留的 woff/ttf（旧版本曾复制多格式）
  fs.readdirSync(path.join(KATEX, 'fonts')).forEach(function (f) { if (!/\.woff2$/.test(f)) fs.unlinkSync(path.join(KATEX, 'fonts', f)); });
  // 字体：按需复制 latin 子集 woff2 并生成 @font-face CSS（中文由系统字体链回退）
  const FONTS = path.join(VENDOR, 'fonts');
  fs.mkdirSync(FONTS, { recursive: true });
  const FONT_DISPLAY_ALLOWED = ['auto', 'block', 'swap', 'fallback', 'optional'];
  const _fd = config && config.site && config.site.performance && config.site.performance.fontDisplay;
  const fontDisplay = FONT_DISPLAY_ALLOWED.indexOf(_fd) >= 0 ? _fd : 'swap';
  let fontsCss = '';
  Object.keys(VENDOR_FONTS).forEach(function (name) {
    const cfg = VENDOR_FONTS[name];
    let css = '';
    const src = path.join(nodeModulesDir, cfg.pkg, 'files', cfg.file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(FONTS, cfg.file));
      css = '@font-face{font-family:\'' + cfg.family + '\';font-style:normal;font-weight:100 900;font-display:' + fontDisplay + ';src:url(\'./' + cfg.file + '\') format(\'woff2-variations\')}\n';
    } else {
      console.warn('  [WARN] variable font file missing: ' + cfg.pkg + '/files/' + cfg.file);
    }
    writeFileAtomicSync(path.join(FONTS, name + '.css'), css);
    fontsCss += css;
  });
  writeFileAtomicSync(path.join(FONTS, 'fonts.css'), fontsCss);
  console.log('  Copied vendor assets to /assets/vendor/ (prism/mermaid/katex/fonts)');
}

async function generatePWA(config) {
  if (!config.site.pwa || !config.site.pwa.enabled) {
    console.log('  [SKIP] PWA generation disabled');
    return;
  }
  console.log('[13/14] Generating PWA assets...');
  const manifest = config.site.pwa.manifest || {};
  // PWA 图标：优先按 site.favicon.svg 自动生成 192/512 PNG（模板默认配置引用这两个路径），
  // 避免 manifest 引用不存在的文件导致 404 与安装能力降级；随后逐条校验 icons 存在性并剔除缺失项。
  if (Array.isArray(manifest.icons) && manifest.icons.length) {
    const f = config.site.favicon || {};
    const svgRel = (typeof f.svg === 'string' && f.svg.charAt(0) === '/') ? f.svg.replace(/^\/+/, '').split('?')[0].split('#')[0] : '';
    const svgAbs = svgRel ? path.join(staticDir, svgRel) : '';
    if (svgAbs && fs.existsSync(svgAbs)) {
      try {
        const sharpPwa = require('sharp');
        fs.mkdirSync(path.join(distDir, 'icons'), { recursive: true });
        for (const size of [192, 512]) {
          await sharpPwa(svgAbs).resize(size, size, { fit: 'contain' }).png().toFile(path.join(distDir, 'icons', 'icon-' + size + '.png'));
        }
        console.log('  Generated: icons/icon-192.png, icons/icon-512.png');
      } catch (e) {
        console.warn('  [WARN] PWA 图标生成失败（将按存在性剔除）: ' + e.message);
      }
    } else {
      console.warn('  [WARN] 未配置可用的 site.favicon.svg，PWA 图标不会自动生成');
    }
    const kept = [];
    for (const ic of manifest.icons) {
      const src = ic && typeof ic.src === 'string' ? ic.src : '';
      const rel = src.charAt(0) === '/' ? src.replace(/^\/+/, '').split('?')[0] : '';
      if (rel && fs.existsSync(path.join(distDir, rel))) { kept.push(ic); continue; }
      console.warn('  [WARN] manifest 图标不存在，已从 manifest 剔除: ' + (src || JSON.stringify(ic)));
    }
    manifest.icons = kept;
  }
  if (Object.keys(manifest).length > 0) {
    const manifestPath = path.join(distDir, 'manifest.json');
    writeFileAtomicSync(manifestPath, JSON.stringify(manifest), 'utf-8');
    console.log('  Created: manifest.json');
  }
  const swUrl = config.site.pwa.serviceWorker;
  const featPwa = (config.features && config.features.pwa) || {};
  const pwaOffline = featPwa.offlinePage !== false;
  if (pwaOffline) {
    const isEn = config.site.language === 'en';
    const zh = (config.uiStrings && config.uiStrings.pwa) || {};
    const en = (config.uiStrings && config.uiStrings.en && config.uiStrings.en.pwa) || {};
    const S = isEn
      ? { t: en.offlineTitle || 'You are offline', d: en.offlineDesc || 'Network connection lost. Check and retry.', r: en.retry || 'Retry', h: 'Back to home' }
      : { t: zh.offlineTitle || '当前处于离线状态', d: zh.offlineDesc || '网络已断开，请检查连接后重试。', r: zh.retry || '重试', h: '返回首页' };
    const home = isEn ? '/en/' : '/zh/';
    const lt = config.theme.colors;
    const dk = (config.theme.darkMode && config.theme.darkMode.colors) || {};
    const offlineHtml = '<!DOCTYPE html><html lang="' + (isEn ? 'en' : 'zh') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + S.t + ' · ' + config.site.title + '</title><style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:' + lt.background + ';color:' + lt.text + ';font-family:system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:26rem;padding:2.5rem;text-align:center}h1{font-size:1rem;opacity:.6;margin:0 0 1.25rem}.t{font-size:1.35rem;font-weight:700;margin:0 0 .5rem}.d{opacity:.7;line-height:1.7;margin:0 0 1.75rem}button,a{font:inherit}button{cursor:pointer;padding:.6rem 1.4rem;border-radius:999px;border:0;background:' + lt.secondary + ';color:' + lt.surface + '}button:hover{filter:brightness(1.08)}a{color:inherit;margin-left:1rem;text-decoration:underline;text-underline-offset:3px}@media(prefers-color-scheme:dark){body{background:' + (dk.background || lt.background) + ';color:' + (dk.text || lt.text) + '}button{background:' + (dk.secondary || lt.secondary) + '}}</style></head><body><main><h1>' + config.site.title + '</h1><p class="t">' + S.t + '</p><p class="d">' + S.d + '</p><p><button type="button" id="offlineRetry">' + S.r + '</button><a href="' + home + '">' + S.h + '</a></p></main><script nonce="' + cspNonce + '">document.getElementById("offlineRetry").addEventListener("click",function(){location.reload()})</script></body></html>';
    writeFileAtomicSync(path.join(distDir, 'offline.html'), offlineHtml, 'utf-8');
    console.log('  Created: offline.html');
  }
  const swContent = `const CACHE = ${JSON.stringify(config.site.pwa.cacheName)};
const ASSETS = [
  '/',
  '/manifest.json'${pwaOffline ? ",\n  '/offline.html'" : ''}
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => ${pwaOffline ? "caches.match('/offline.html').then((off) => off || caches.match('/'))" : "caches.match('/')"})
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});`;
  const swPath = path.join(distDir, swUrl.replace(/^\//, ''));
  const swDir = path.dirname(swPath);
  if (!fs.existsSync(swDir)) fs.mkdirSync(swDir, { recursive: true });
  writeFileAtomicSync(swPath, swContent, 'utf-8');
  console.log(`  Created: ${swUrl.replace(/^\//, '')}`);
}

  return { copyJsAssets, copyRuntimeBootstrap, copyVendorAssets, generatePWA, VENDOR_FONTS };
}

module.exports = { createAssetsModule };
