// S-ynapse 内容策略模块 — media/ videos/ assets/ 三目录文件判定
// 纯函数、无 IO, 便于单测与在 build.js 中复用。
// 判定优先级(高 → 低):
//   1. blockedFilenames 精确匹配 → reject
//   2. blockedExts 可执行/脚本扩展名 → reject
//   3. documentRenderedTypes 渲染型文档(media/ 下的 svg 除外, 由 svg 消毒处理) → reject
//   4. media/: mediaExts 白名单; 命中且 sharp 支持 → 'media-optimized', 否则 'media-raw'
//   5. videos/: 排除制 (videoMode: 'deny-list'), 前置检查通过即放行
//   6. assets/: assetExts 白名单
// 返回: { allowed, category, reason }
//   category: 'rejected' | 'media-optimized' | 'media-raw' | 'video' | 'asset'
//   reason:   拒绝原因(供 build-report 展示), allowed 为 true 时为空字符串

const DEFAULT_POLICY = {
  enabled: true,
  mediaExts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'tiff', 'tif', 'heic', 'heif'],
  videoMode: 'deny-list',
  assetExts: [
    'txt', 'csv', 'json', 'yml', 'yaml', 'toml', 'ini', 'log', 'conf',
    'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'epub', 'rtf', 'odt', 'ods', 'odp',
    'zip', '7z', 'rar', 'gz', 'tgz', 'tar', 'bz2', 'xz', 'zst',
    'mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'opus',
    'woff', 'woff2', 'ttf', 'otf', 'eot'
  ],
  blockedExts: [
    'exe', 'dll', 'sys', 'ocx', 'drv', 'com', 'scr', 'pif', 'cpl', 'msi', 'msp', 'msu', 'mst',
    'bat', 'cmd', 'reg', 'lnk', 'url', 'hta', 'wsc', 'wsf', 'wsh', 'vbs', 'vbe', 'js', 'jse',
    'ps1', 'psd1', 'psm1', 'msix', 'msixbundle', 'appx', 'appxbundle',
    'appimage', 'dmg', 'pkg', 'mpkg', 'jar', 'jnlp', 'apk', 'ipa', 'deb', 'rpm',
    'sh', 'bash', 'zsh', 'fish', 'bin', 'run', 'elf', 'so', 'o', 'ko', 'snap',
    'py', 'pyw', 'pyc', 'pl', 'pm', 'php', 'phtml', 'rb', 'lua', 'tcl', 'r', 'jl',
    'java', 'class', 'go', 'rs', 'cs', 'c', 'cpp', 'h', 'hpp', 'm', 'scala', 'kt', 'swift', 'cr',
    'ts', 'tsx', 'jsx', 'mjs', 'cjs'
  ],
  documentRenderedTypes: ['html', 'htm', 'xhtml', 'xml', 'xsl', 'xslt', 'dtd', 'svg', 'shtml'],
  blockedFilenames: ['.ds_store', 'thumbs.db', 'desktop.ini', '.gitkeep'],
  svgSanitize: true
};

// sharp 直接优化的扩展名(其余媒体走原样复制: svg 需消毒, gif/animated 保真)
const SHARP_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'tiff', 'webp']);

function extnameOf(filename) {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return '';
  return filename.slice(dot + 1).toLowerCase();
}

function normalizePolicy(raw) {
  if (!raw || typeof raw !== 'object') return normalizePolicy(DEFAULT_POLICY);
  const mediaExts = new Set((raw.mediaExts || DEFAULT_POLICY.mediaExts).map(e => String(e).toLowerCase()));
  const assetExts = new Set((raw.assetExts || DEFAULT_POLICY.assetExts).map(e => String(e).toLowerCase()));
  const blockedExts = new Set((raw.blockedExts || DEFAULT_POLICY.blockedExts).map(e => String(e).toLowerCase()));
  const docRendered = new Set((raw.documentRenderedTypes || DEFAULT_POLICY.documentRenderedTypes).map(e => String(e).toLowerCase()));
  const blockedNames = new Set((raw.blockedFilenames || DEFAULT_POLICY.blockedFilenames).map(e => String(e).toLowerCase()));
  return {
    enabled: raw.enabled !== false,
    mediaExts,
    assetExts,
    blockedExts,
    documentRenderedTypes: docRendered,
    blockedFilenames: blockedNames,
    svgSanitize: raw.svgSanitize !== false
  };
}

// 判定单个相对路径文件在指定源目录类别下的结果
// srcCategory: 'media' | 'videos' | 'assets'
function classifyFile(relPath, srcCategory, rawPolicy) {
  const policy = normalizePolicy(rawPolicy);
  const rejected = (reason) => ({ allowed: false, category: 'rejected', reason });
  const normalizeSep = (p) => p.replace(/\\/g, '/');
  const rel = normalizeSep(relPath);
  const fileName = rel.split('/').pop() || relPath;
  const ext = extnameOf(fileName);

  if (!policy.enabled) return rejected('content-policy-disabled');
  if (policy.blockedFilenames.has(fileName.toLowerCase())) return rejected('blocked-filename');
  if (ext && policy.blockedExts.has(ext)) return rejected('blocked-executable');
  if (ext && policy.documentRenderedTypes.has(ext)) {
    if (srcCategory === 'media' && ext === 'svg' && policy.svgSanitize) {
      // media/ 下 svg 允许, 需经消毒
    } else {
      return rejected('active-document');
    }
  }
  if (srcCategory === 'media') {
    if (!ext || !policy.mediaExts.has(ext)) return rejected('not-in-media-whitelist');
    return SHARP_EXTENSIONS.has(ext)
      ? { allowed: true, category: 'media-optimized', reason: '' }
      : { allowed: true, category: 'media-raw', reason: '' };
  }
  if (srcCategory === 'videos') {
    return { allowed: true, category: 'video', reason: '' };
  }
  if (srcCategory === 'assets') {
    if (!ext || !policy.assetExts.has(ext)) return rejected('not-in-asset-whitelist');
    return { allowed: true, category: 'asset', reason: '' };
  }
  return rejected('unknown-category');
}

// SVG 消毒: 移除 <script>/on* 事件/内部存在执行面/外部引用
// 返回 { safe: boolean, content: string } — safe=false 表示含危险内容(调用方应拒绝复制)

// 最小实体解码表(仅覆盖 scheme/事件属性混淆所需), 含常用命名实体与全部数字实体
const SVG_NAMED_ENTITIES = {
  colon: ':', tab: '\t', newline: '\n', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  sol: '/', period: '.', num: '#', commat: '@', excl: '!', quest: '?', equals: '=',
  semi: ';', dollar: '$', perc: '%', ast: '*', plus: '+', comma: ',', lpar: '(', rpar: ')'
};

function decodeSvgEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(Math.min(code, 0x10ffff)) : m;
    })
    .replace(/&#(\d{1,7});/g, (m, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(Math.min(code, 0x10ffff)) : m;
    })
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name) => Object.prototype.hasOwnProperty.call(SVG_NAMED_ENTITIES, name.toLowerCase()) ? SVG_NAMED_ENTITIES[name.toLowerCase()] : m);
}

function sanitizeSvg(svgText) {
  if (typeof svgText !== 'string') return { safe: false, content: '' };
  const decoded = decodeSvgEntities(svgText);
  // 去除全部 ASCII 空白与控制符后再比对: 浏览器解析 URL 时会丢弃 \t\n\r 等,
  // 因此 `java\tscript:` 与 javascript: 等效
  // eslint-disable-next-line no-control-regex -- 有意匹配控制字符：`java\tscript:` 等伪装需先剔除控制符再比对
  const squeezed = decoded.replace(/[\u0000-\u0020\u007f]+/g, '');
  const hasExecutable = /<script[\s>]/i.test(decoded) ||
    /<foreignobject[\s>]/i.test(decoded) ||
    /<\s*[a-z]+\s[^>]*(on\w+\s*=|xl-on\w+\s*=)/i.test(decoded) ||
    /\s(onerror|onload|onclick|onmouseover)\s*=/i.test(decoded) ||
    /(xlink:href|href|src)\s*=\s*["']?\s*(javascript|vbscript):/i.test(decoded) ||
    /(xlink:href|href|src)=["']?(javascript|vbscript):/i.test(squeezed);
  if (hasExecutable) return { safe: false, content: '' };
  let content = svgText.replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  content = content.replace(/<\s*foreignobject[\s\S]*?<\s*\/\s*foreignobject\s*>/gi, '');
  content = content.replace(/(\s)(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  content = content.replace(/(xlink:href|href|src)\s*=\s*("|')?\s*(javascript|vbscript|data):[^"'>]*(("|')?)/gi, '');
  const looksExternal = /(href|xlink:href|src)\s*=\s*["']\s*(https?:|\/\/)/i.test(decoded) ||
    /(href|xlink:href|src)=["']?(https?:|\/\/)/i.test(squeezed);
  if (looksExternal) return { safe: false, content: '' };
  return { safe: true, content };
}

module.exports = { classifyFile, sanitizeSvg, normalizePolicy, DEFAULT_POLICY, SHARP_EXTENSIONS, extnameOf };
