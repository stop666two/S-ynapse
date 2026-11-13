'use strict';
// cacheBust 排除规则（审查 R-32）：产物重命名（scripts/build/minify.js → cacheBust）与
// 搜索索引的 featuredImage 最终路径预计算（scripts/lib/search-index.js → resolveFinalAssetUrl）
// 必须共用同一套判定。两处各写一份会漂移：索引可能写入「本轮从未被重命名」的哈希路径，
// 于是搜索结果缩略图 404（文件名带哈希但文件不存在，且映射里没有该键可被构建期改写）。
const path = require('path');
const { DEFAULT_CONFIG } = require('./site-defaults');

// 目录段（任意层级）不参与内容寻址：
//   - node_modules 不进入产物；
//   - assets 由构建前复制、文件名固定（搜索索引自身也放在这里）；
//   - og 图由 generate-og 生成，社交平台按固定 URL 缓存，改名会让旧链接失效。
const EXCLUDED_SEGMENTS = new Set(['node_modules', 'assets', 'og']);

// 从 site 配置派生「不参与内容寻址的固定文件名」：SW 脚本与 PWA manifest 图标。
// manifest.json 不参与 HTML 路径改写，图标被改名会让 manifest 引用 404；
// SW 外壳由浏览器按固定 URL 注册。
function cacheBustExclusionOptions(siteConfig) {
  const pwa = (siteConfig && siteConfig.pwa) || {};
  const manifest = pwa.manifest || {};
  const swRaw = String(pwa.serviceWorker || DEFAULT_CONFIG.site.pwa.serviceWorker);
  const swBaseName = path.basename(swRaw.split('?')[0].split('#')[0]);
  const iconBaseNames = new Set((Array.isArray(manifest.icons) ? manifest.icons : [])
    .map((icon) => (icon && typeof icon.src === 'string' ? path.basename(icon.src.split('?')[0].split('#')[0]) : ''))
    .filter(Boolean));
  return { swBaseName: swBaseName, iconBaseNames: iconBaseNames };
}

// relPath 可以是相对产物根的路径（含 Windows 分隔符）或站内绝对 URL（/media/x.png）。
function isCacheBustExcluded(relPath, options) {
  const opts = options || {};
  const rel = String(relPath == null ? '' : relPath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel) return true;
  const segments = rel.split('/');
  // 只检查目录段：根级同名文件不受目录豁免影响。
  for (let i = 0; i < segments.length - 1; i++) {
    if (EXCLUDED_SEGMENTS.has(segments[i])) return true;
  }
  const base = segments[segments.length - 1];
  if (opts.swBaseName && base === String(opts.swBaseName)) return true;
  const icons = opts.iconBaseNames;
  if (!icons) return false;
  if (typeof icons.has === 'function') return icons.has(base);
  return Array.isArray(icons) && icons.indexOf(base) !== -1;
}

module.exports = { EXCLUDED_SEGMENTS, cacheBustExclusionOptions, isCacheBustExcluded };
