'use strict';

// auto-cover — 无封面文章自动封面（纯函数 + SVG 渲染，无文件 I/O）。
// 设计约束（用户 2026-09-26 验收反馈）：
//   1. 确定性：标题 / 站点名 / 主题色 / 样式参数相同 → 相同 hash、相同产物文件名，
//      二次构建可直接命中缓存（内容寻址命名，URL 永不陈旧）；
//   2. 可降级：本模块只产出 SVG 字符串与名字，栅格化与写盘由 scripts/build/auto-cover.js
//      负责；主题色缺失/非法时返回 null 由构建侧跳过（页面回退 pattern/无图，不阻断构建）；
//   3. 换行估算：中文（含全角标点/假名/谚文）按 1 字宽，拉丁按字符类别近似，英文按单词
//      整体换行、超宽单词按字符硬切，超出最大行数在末行追加省略号；
//   4. 视觉规则变更（间距/字号/元素增删）必须递增 STYLE_VERSION —— 它参与 hash，
//      旧缓存文件名连同旧图自然失效，无需人工清理。

const crypto = require('crypto');

// 样式版本：任何影响成图的视觉规则调整都要 +1（参与缓存键，旧图自动失效）。
const STYLE_VERSION = 1;

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 630;
const DEFAULT_FORMAT = 'webp';
// 合法画布边界：过小文字无法排布，过大单图体积失控（与 OG 图量级对齐）。
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 4096;
// 格式 → 产物扩展名。jpeg 归一为 'jpeg'（sharp 格式名），扩展名用社交/站点惯例 'jpg'。
const FORMAT_EXT = Object.freeze({ webp: 'webp', jpeg: 'jpg' });
// 标题最多行数与相对画布高度的字号比例（1200x630 时约 79px、3 行）。
const TITLE_MAX_LINES = 3;
const TITLE_FONT_RATIO = 0.125;
const TITLE_LINE_HEIGHT_RATIO = 1.28;
// 与 scripts/generate-og.js 同一字体偏好链：Windows 下 Microsoft YaHei 可渲染中文，
// 其余环境回退 system-ui；不引用任何外部字体文件（离线构建可用）。
const FONT_FAMILY = 'Microsoft YaHei, system-ui, sans-serif';
// 自动封面产物文件名模式（供 generate-og 清理与缓存清理互不误伤；hash 固定 8 位十六进制）。
const AUTO_COVER_FILE_RX = /^cover-.+\.[0-9a-f]{8}\.(?:webp|jpg|png)$/i;

// 画布尺寸解析：非数字 / 非正数回退默认；正数越界夹取到 [min, max]。
function clampNumber(value, fallback, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseColor(val, fallback) {
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(s) || /^rgba?\([^)]*\)$/.test(s)) return s;
  }
  return fallback;
}

// 解析 features.listCover.autoGenerate 配置为归一化值：
//   enabled（默认 true，仅显式 false 关闭）
//   width/height（默认 1200x630；非法/越界夹到 [64, 4096]）
//   format（'webp' 默认 / 'jpeg'；'jpg' 视为同义；其余值回退 webp）
//   backgroundStyle（'gradient' 默认 / 'solid'；其余值回退 gradient）
//   showSiteName（默认 true）/ showCategory（默认 false）
// 返回 ext 为可直接拼接的扩展名（webp/jpg），调用方无需再判断格式。
function resolveAutoCoverConfig(raw) {
  const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const rawFormat = typeof cfg.format === 'string' ? cfg.format.trim().toLowerCase() : '';
  const format = rawFormat === 'jpeg' || rawFormat === 'jpg' ? 'jpeg' : DEFAULT_FORMAT;
  return {
    enabled: cfg.enabled !== false,
    width: clampNumber(cfg.width, DEFAULT_WIDTH, MIN_DIMENSION, MAX_DIMENSION),
    height: clampNumber(cfg.height, DEFAULT_HEIGHT, MIN_DIMENSION, MAX_DIMENSION),
    format,
    ext: FORMAT_EXT[format],
    backgroundStyle: cfg.backgroundStyle === 'solid' ? 'solid' : 'gradient',
    showSiteName: cfg.showSiteName !== false,
    showCategory: cfg.showCategory === true
  };
}

// 从站点主题取自动封面用色。primary/secondary 缺失或非法时返回 null（调用方跳过生成，
// 页面回退 pattern/无图）—— 不内置兜底配色，避免自动封面与站点主题脱节。
// titleColor 取深色模式的 text（浅色字），保证在深色渐变上有足够对比度。
function resolveAutoCoverColors(theme) {
  const colors = (theme && theme.colors) || {};
  const dark = (theme && theme.darkMode && theme.darkMode.colors) || {};
  const primary = parseColor(colors.primary, null);
  const secondary = parseColor(colors.secondary, primary);
  if (!primary || !secondary) return null;
  return {
    primary,
    secondary,
    titleColor: parseColor(dark.text, '#ffffff'),
    siteName: parseColor(dark.text, '#ffffff')
  };
}

// 单个字符的近似宽度（em）：全角 1.0；空格 0.30；大小写/数字 0.52–0.62；标点 0.34；其余 0.60。
function charWidth(ch) {
  if (/\s/.test(ch)) return 0.3;
  const code = ch.codePointAt(0);
  const fullWidth =
    (code >= 0x1100 && code <= 0x115f) || // 谚文字母
    (code >= 0x2e80 && code <= 0x303e) || // CJK 部首 / 标点
    (code >= 0x3040 && code <= 0x33ff) || // 假名 / CJK 兼容
    (code >= 0x3400 && code <= 0x4dbf) || // 扩展 A
    (code >= 0x4e00 && code <= 0x9fff) || // 基本区
    (code >= 0xa000 && code <= 0xa4cf) || // 彝文
    (code >= 0xac00 && code <= 0xd7a3) || // 谚文音节
    (code >= 0xf900 && code <= 0xfaff) || // CJK 兼容表意
    (code >= 0xfe30 && code <= 0xfe4f) || // CJK 兼容形式
    (code >= 0xff00 && code <= 0xff60) || // 全角形式
    (code >= 0xffe0 && code <= 0xffe6);   // 全角符号
  if (fullWidth) return 1;
  if (ch >= 'A' && ch <= 'Z') return 0.62;
  if (ch >= 'a' && ch <= 'z') return 0.52;
  if (ch >= '0' && ch <= '9') return 0.56;
  if (".,;:!?'\"()[]{}<>-_/\\|@#%&*+=~^`".includes(ch)) return 0.34;
  return 0.6;
}

// 文本宽度（em 单位）。
function measureText(text) {
  let width = 0;
  for (const ch of String(text)) width += charWidth(ch);
  return width;
}

// 标题分词：全角字符逐字成 token（可任意断行）；拉丁词整体成 token（优先整词换行）；
// 空格独立成 token（宽度 0.30em，行尾/行首丢弃）；半角标点粘到前一个 token 尾部，
// 避免行首出现孤立标点。
function tokenizeTitle(text) {
  const tokens = [];
  let word = '';
  const flush = () => {
    if (word) {
      tokens.push({ text: word, word: true });
      word = '';
    }
  };
  for (const ch of String(text)) {
    if (/\s/.test(ch)) {
      flush();
      tokens.push({ text: ' ', word: false });
      continue;
    }
    if (charWidth(ch) === 1) {
      flush();
      tokens.push({ text: ch, word: false });
      continue;
    }
    if (/[A-Za-z0-9'’\-_.@:/#+&%$]/.test(ch)) {
      word += ch;
      continue;
    }
    flush();
    if (tokens.length) tokens[tokens.length - 1].text += ch;
    else tokens.push({ text: ch, word: false });
  }
  flush();
  return tokens;
}

// 标题换行：maxWidthEm 为单行最大宽度（em），maxLines 为最大行数。
// 规则：整词放不下时整体换行；超宽单词按字符硬切；空格不会出现在行首/行尾；
// 超行时末行以省略号收尾并保证省略号不溢出。
function wrapTitleLines(text, options) {
  const opts = options || {};
  const maxWidthEm = Number.isFinite(+opts.maxWidthEm) && +opts.maxWidthEm > 0 ? +opts.maxWidthEm : 12;
  const maxLines = Number.isFinite(+opts.maxLines) && +opts.maxLines > 0 ? Math.floor(+opts.maxLines) : TITLE_MAX_LINES;
  const normalized = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const tokens = tokenizeTitle(normalized);
  const lines = [];
  let line = '';
  let lineWidth = 0;
  let truncated = false;
  const commit = () => {
    lines.push(line.replace(/\s+$/, ''));
    line = '';
    lineWidth = 0;
  };
  for (const token of tokens) {
    const tokenWidth = measureText(token.text);
    if (token.text === ' ') {
      if (!line || lineWidth + tokenWidth > maxWidthEm) continue;
      line += token.text;
      lineWidth += tokenWidth;
      continue;
    }
    if (token.word && tokenWidth <= maxWidthEm) {
      if (line && lineWidth + tokenWidth > maxWidthEm) {
        if (lines.length + 1 >= maxLines) {
          truncated = true;
          break;
        }
        commit();
      }
      line += token.text;
      lineWidth += tokenWidth;
      continue;
    }
    // 单字或超宽单词：逐字符填充
    for (const ch of token.text) {
      const w = charWidth(ch);
      if (line && lineWidth + w > maxWidthEm) {
        if (lines.length + 1 >= maxLines) {
          truncated = true;
          break;
        }
        commit();
      }
      line += ch;
      lineWidth += w;
    }
    if (truncated) break;
  }
  if (line && lines.length < maxLines) commit();
  if (!lines.length) lines.push('');
  if (truncated) {
    let last = lines[lines.length - 1] || '';
    while (last && measureText(last + '…') > maxWidthEm) last = Array.from(last).slice(0, -1).join('');
    lines[lines.length - 1] = last + '…';
  }
  return lines.slice(0, maxLines);
}

// 缓存/产物文件名 hash：标题 + 站点名 + 主题色 + 样式版本 + 宽高格式 + 影响成图的样式开关
// （backgroundStyle/showSiteName/showCategory 改变输出像素，必须同键失效；分类角标开启时
// 角标文本也参与 hash，避免同题不同分类的文章互相覆盖同一产物名）。
// 返回 8 位十六进制（SHA-1 截断；碰撞概率对单站图片量级可忽略）。
function autoCoverHash(input) {
  const src = input || {};
  const parts = [
    'v' + STYLE_VERSION,
    String(src.title || ''),
    String(src.siteName || ''),
    src.showCategory === true ? String(src.category || '') : '',
    String(src.primary || ''),
    String(src.secondary || ''),
    String(src.titleColor || ''),
    String(src.backgroundStyle || 'gradient'),
    src.showSiteName === false ? '0' : '1',
    src.showCategory === true ? '1' : '0',
    String(Math.round(Number(src.width) || 0)),
    String(Math.round(Number(src.height) || 0)),
    String(src.format || DEFAULT_FORMAT)
  ];
  return crypto.createHash('sha1').update(JSON.stringify(parts), 'utf8').digest('hex').slice(0, 8);
}

function autoCoverFileName(slug, hash, ext) {
  return 'cover-' + String(slug || '') + '.' + String(hash || '') + '.' + String(ext || 'webp');
}

// 判定文件名是否为自动封面产物（generate-og 的陈旧清理与 .cache/covers 清理共用，避免互删）。
function isAutoCoverFileName(name) {
  return AUTO_COVER_FILE_RX.test(String(name || ''));
}

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 生成封面 SVG（纯字符串，无外部引用/注释/emoji）：
//   - 背景：gradient（primary → secondary 135°）或 solid（primary）；
//   - 右上/左下低透明度装饰圆（标题色 6%）提升层次；
//   - 左上角分类/系列角标（showCategory 且存在时，半透明圆角块）；
//   - 标题左对齐、垂直居中，最多 3 行；
//   - 左下角站点名（showSiteName）；底部 8px 强调色条（secondary）。
function buildAutoCoverSvg(input) {
  const src = input || {};
  const width = clampNumber(src.width, DEFAULT_WIDTH, MIN_DIMENSION, MAX_DIMENSION);
  const height = clampNumber(src.height, DEFAULT_HEIGHT, MIN_DIMENSION, MAX_DIMENSION);
  const titleColor = parseColor(src.titleColor, '#ffffff');
  const siteColor = parseColor(src.siteNameColor, titleColor);
  const primary = parseColor(src.primary, '#334155');
  const secondary = parseColor(src.secondary, primary);
  const backgroundStyle = src.backgroundStyle === 'solid' ? 'solid' : 'gradient';
  const showSiteName = src.showSiteName !== false;
  const showCategory = src.showCategory === true;
  const category = String(src.category || '').trim();

  const pad = Math.round(width * 0.075);
  const titleSize = Math.max(24, Math.round(height * TITLE_FONT_RATIO));
  const lineHeight = Math.round(titleSize * TITLE_LINE_HEIGHT_RATIO);
  const maxWidthEm = Math.max(4, (width - pad * 2) / titleSize);
  const lines = wrapTitleLines(src.title, { maxWidthEm, maxLines: TITLE_MAX_LINES });

  const blockHeight = lines.length ? (lines.length - 1) * lineHeight + titleSize : 0;
  const startY = Math.round((height - blockHeight) / 2 + titleSize * 0.36 + (showCategory && category ? titleSize * 0.18 : 0));
  const barHeight = Math.max(6, Math.round(height * 0.013));
  const decoR = Math.round(height * 0.62);
  const deco = `<circle cx="${width - Math.round(pad * 0.3)}" cy="${Math.round(pad * 0.4)}" r="${decoR}" fill="${titleColor}" opacity="0.06"/><circle cx="${Math.round(pad * 0.2)}" cy="${height - Math.round(pad * 0.3)}" r="${Math.round(decoR * 0.6)}" fill="${titleColor}" opacity="0.05"/>`;

  let bg;
  if (backgroundStyle === 'solid') {
    bg = `<rect width="${width}" height="${height}" fill="${primary}"/>`;
  } else {
    bg = `<defs><linearGradient id="ac-bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${esc(primary)}"/><stop offset="100%" stop-color="${esc(secondary)}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#ac-bg)"/>`;
  }

  let chip = '';
  if (showCategory && category) {
    const chipHeight = Math.max(28, Math.round(titleSize * 0.62));
    const chipFont = Math.max(16, Math.round(chipHeight * 0.52));
    const chipWidth = Math.min(width - pad * 2, Math.round(measureText(category) * chipFont + chipHeight * 1.1));
    chip = `<rect x="${pad}" y="${Math.round(pad * 0.7)}" rx="${Math.round(chipHeight / 2)}" width="${chipWidth}" height="${chipHeight}" fill="${titleColor}" opacity="0.16"/><text x="${pad + Math.round(chipHeight * 0.55)}" y="${Math.round(pad * 0.7 + chipHeight * 0.68)}" font-family="${FONT_FAMILY}" font-size="${chipFont}" font-weight="600" fill="${titleColor}">${esc(category)}</text>`;
  }

  const titleTexts = lines
    .map((line, i) => `<text x="${pad}" y="${startY + i * lineHeight}" font-family="${FONT_FAMILY}" font-size="${titleSize}" font-weight="700" fill="${titleColor}">${esc(line)}</text>`)
    .join('\n  ');
  const siteText = showSiteName
    ? `<text x="${pad}" y="${height - Math.round(pad * 0.55)}" font-family="${FONT_FAMILY}" font-size="${Math.max(16, Math.round(height * 0.045))}" font-weight="600" fill="${siteColor}" opacity="0.85">${esc(src.siteName || '')}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${bg}
  ${deco}
  <rect x="0" y="${height - barHeight}" width="${width}" height="${barHeight}" fill="${esc(secondary)}" opacity="0.9"/>
  ${chip}
  ${titleTexts}
  ${siteText}
</svg>`;
}

module.exports = {
  STYLE_VERSION,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_FORMAT,
  MIN_DIMENSION,
  MAX_DIMENSION,
  TITLE_MAX_LINES,
  FONT_FAMILY,
  resolveAutoCoverConfig,
  resolveAutoCoverColors,
  measureText,
  tokenizeTitle,
  wrapTitleLines,
  autoCoverHash,
  autoCoverFileName,
  isAutoCoverFileName,
  buildAutoCoverSvg
};
