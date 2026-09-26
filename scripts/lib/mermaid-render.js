'use strict';
// Mermaid 构建期渲染（SSR）共享库：
//   1) 纯逻辑：缓存键 / 代码块提取 / 替换为双主题内联 SVG（可单测，不依赖浏览器）；
//   2) 渲染器：一次 puppeteer-core 启动批量渲染（本地注入 node_modules/mermaid，
//      不联网），逐条 10s 超时，命中 .cache/mermaid/<key>.svg 直接复用；
//      启动/单条失败不抛出，返回 { svg?, error? } 结果数组（调用方回退客户端渲染）。
// 安全：替换前 SVG 必须通过 lib/content-policy.js 的 sanitizeSvg（script/foreignObject/
//       事件属性/危险 scheme 一律判不安全 → 回退 pending），SVG 内 <style> 注入构建期 CSP nonce。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { writeFileAtomicSync } = require('./atomic-write');
const { sanitizeSvg } = require('./content-policy');

const PRE_BLOCK_RX = /<pre\b([^>]*)>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi;
const DIV_BLOCK_RX = /<div\b([^>]*)>([\s\S]*?)<\/div>/gi;
const SVGS_PUBLIC = /<svg\b[^>]*>/i;

const WINDOWS_CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
];
const MAC_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const POSIX_CHROME_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

// 缓存键 = sha256(version \n theme \n code) 前 16 位十六进制。
function mermaidCacheKey(code, theme, version) {
  return sha256(String(version) + '\n' + String(theme) + '\n' + String(code)).slice(0, 16);
}

// 解码 marked 转义后的 mermaid 源码（&amp;/&lt;/&gt;/&quot;/&apos; 与数字实体）。
function decodeMermaidText(text) {
  return String(text)
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(Math.min(code, 0x10ffff)) : m;
    })
    .replace(/&#(\d{1,7});/g, (m, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(Math.min(code, 0x10ffff)) : m;
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, name) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0'
    }[name]));
}

function escapeMermaidText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function attrValue(attrs, name) {
  const rx = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
  const m = rx.exec(String(attrs || ''));
  if (!m) return '';
  return m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : '');
}

// 提取文章 HTML 中的 mermaid 代码块（marked 输出的 pre>code.language-mermaid，
// 兼容既有客户端渲染器形态 div.mermaid[data-src]；SSR 产物自身跳过以保证幂等）。
function extractMermaidBlocks(html) {
  const input = String(html || '');
  const out = [];
  let m;
  PRE_BLOCK_RX.lastIndex = 0;
  while ((m = PRE_BLOCK_RX.exec(input)) !== null) {
    if (!/\blanguage-mermaid\b/.test(m[2])) continue;
    out.push({
      form: 'pre',
      code: decodeMermaidText(m[3]).trim(),
      w: attrValue(m[1], 'data-w'),
      h: attrValue(m[1], 'data-h')
    });
  }
  DIV_BLOCK_RX.lastIndex = 0;
  while ((m = DIV_BLOCK_RX.exec(input)) !== null) {
    const classes = attrValue(m[1], 'class');
    if (!/\bmermaid\b/.test(classes) || /\bmermaid-ssr\b/.test(classes)) continue;
    const src = attrValue(m[1], 'data-src');
    if (!src) continue;
    out.push({
      form: 'div',
      code: decodeMermaidText(src).trim(),
      w: attrValue(m[1], 'data-w'),
      h: attrValue(m[1], 'data-h')
    });
  }
  return out;
}

// 将渲染结果的 SVG 压进容器：消毒 → 尺寸 → id 去重 → 内联样式类化 → CSP nonce；任一步失败返回 null（调用方回退）。
function prepareSvg(rawSvg, options, block, cls, uid) {
  const sanitized = sanitizeSvg(rawSvg);
  if (!sanitized.safe || !sanitized.content) return null;
  let svg = applySvgSizing(sanitized.content, options.size || {}, block.w, block.h);
  if (uid != null) svg = uniquifySvgIds(svg, uid);
  svg = svg.replace(SVGS_PUBLIC, (tag) => {
    const withClass = /\bclass\s*=/i.test(tag)
      ? tag.replace(/\bclass\s*=\s*("([^"]*)"|'([^']*)')/i, 'class="' + cls + '"')
      : tag.replace(/^<svg\b/i, '<svg class="' + cls + '"');
    return withClass;
  });
  svg = stylesToClasses(svg, uid, cls);
  if (options.nonce) return svg.replace(/<style\b/gi, '<style nonce="' + String(options.nonce).replace(/"/g, '&quot;') + '"');
  return svg;
}

// 把 SVG 内全部内联 style 属性（含 font-style 表现属性）搬进追加在末尾的 <style> 规则：
// CSP style-src-attr 收紧后属性语境不再放行；类规则以 #id#id 前缀提升优先级（高于 mermaid
// 自带的 #id .class 规则，语义上最接近原内联，且不使用 !important——mermaid 自身的
// !important 规则优先关系不变）。font-style="normal" 为 CSS 初始值且表现属性本就低于样式表，
// 直接移除不改变渲染，仅保留非 normal 值。
function stylesToClasses(svg, uid, cls) {
  const theme = /mm-dark/.test(String(cls || '')) ? 'd' : 'l';
  const idMatch = /<svg\b[^>]*\bid="([^"]+)"[^>]*>/i.exec(svg);
  const rootId = idMatch ? idMatch[1] : '';
  const prefix = rootId ? '#' + cssIdentEscape(rootId) + '#' + cssIdentEscape(rootId) : '';
  const token = uid == null ? 'x' : String(uid);
  const rules = [];
  let out = svg;
  // 根 <svg> 已带 id：尺寸直接生成 #id#id 规则并移除属性，避免改动 mm-light/mm-dark 类串。
  const rootTag = SVGS_PUBLIC.exec(out);
  if (rootTag) {
    const stripped = stripInlineStyleDecls(rootTag[0]);
    if (stripped.decls) {
      let rootStripped = stripped.tag;
      if (rootId) {
        rules.push(prefix + '{' + stripped.decls + '}');
      } else {
        const className = 'mm-si-' + token + '-' + theme + '-' + rules.length;
        rules.push('.' + className + '{' + stripped.decls + '}');
        rootStripped = addClass(rootStripped, className);
      }
      out = out.slice(0, rootTag.index) + rootStripped + out.slice(rootTag.index + rootTag[0].length);
    }
  }
  out = out.replace(/<[a-zA-Z][^>]*>/g, (tag) => {
    const stripped = stripInlineStyleDecls(tag);
    if (!stripped.decls) return stripped.tag;
    const className = 'mm-si-' + token + '-' + theme + '-' + rules.length;
    rules.push((rootId ? prefix + ' .' + className : '.' + className) + '{' + stripped.decls + '}');
    return addClass(stripped.tag, className);
  });
  if (!rules.length) return out;
  const styleTag = '<style>' + rules.join('') + '</style>';
  const close = out.lastIndexOf('</svg>');
  if (close === -1) return out;
  return out.slice(0, close) + styleTag + out.slice(close);
}

// 给标签追加类名（已有 class 则合并，否则新插入）。
function addClass(tag, className) {
  if (/\bclass\s*=/i.test(tag)) {
    return tag.replace(/\bclass\s*=\s*("([^"]*)"|'([^']*)')/i, (m, _q, dq, sq) => {
      const value = dq !== undefined ? dq : sq;
      return 'class="' + value + ' ' + className + '"';
    });
  }
  return tag.replace(/^<([a-zA-Z][^\s/>]*)/, '<$1 class="' + className + '"');
}

// 抽取标签上的 style / font-style（非 normal）声明并移除对应属性，返回 { tag, decls }。
function stripInlineStyleDecls(tag) {
  let next = String(tag);
  let decls = '';
  const styleMatch = next.match(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/);
  if (styleMatch) {
    decls += styleMatch[2] !== undefined ? styleMatch[2] : styleMatch[3];
    next = next.replace(styleMatch[0], '');
  }
  const fsMatch = next.match(/\sfont-style\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (fsMatch) {
    const raw = fsMatch[2] !== undefined ? fsMatch[2] : (fsMatch[3] !== undefined ? fsMatch[3] : fsMatch[4]);
    if (String(raw).toLowerCase() !== 'normal') {
      decls += (decls && !/;\s*$/.test(decls) ? ';' : '') + 'font-style:' + raw;
    }
    next = next.replace(fsMatch[0], '');
  }
  return { tag: next, decls };
}

// CSS 标识符转义：仅保留 [A-Za-z0-9_-]，其余字符以反斜杠转义（id 理论可来自第三方 SVG）。
function cssIdentEscape(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, (ch) => '\\' + ch);
}

// 同一页内重复图表会复用同一份缓存 SVG（id 相同）；按块序号重写 id 及其 style/url 引用，
// 避免重复 DOM id 与样式规则互相覆盖。
function uniquifySvgIds(svg, suffix) {
  const m = /<svg\b[^>]*\bid="([^"]+)"/.exec(svg);
  if (!m) return svg;
  const id = m[1];
  if (!id) return svg;
  return svg.split(id).join(id + '-' + suffix);
}

// 将 features.mermaid.size / 单图 w=、h= 应用到 SVG 根标签（合并既有 style，构建值在后覆盖）。
function applySvgSizing(svg, size, w, h) {
  const decls = [];
  const width = w || size.width;
  const height = h || size.height;
  if (width) decls.push('width:' + width);
  if (height) decls.push('height:' + height);
  if (size.minWidth) decls.push('min-width:' + size.minWidth);
  if (size.minHeight) decls.push('min-height:' + size.minHeight);
  if (size.maxHeight && size.maxHeight !== 'none') decls.push('max-height:' + size.maxHeight);
  if (size.maxWidth && size.maxWidth !== 'none') decls.push('max-width:' + size.maxWidth);
  else if (size.fit !== 'scale') decls.push('max-width:none');
  if (!decls.length) return svg;
  return svg.replace(SVGS_PUBLIC, (tag) => {
    const styleMatch = tag.match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
    const existing = styleMatch ? (styleMatch[2] !== undefined ? styleMatch[2] : styleMatch[3]) : '';
    const merged = (existing ? existing.replace(/;?\s*$/, ';') : '') + decls.join(';');
    const styleAttr = 'style="' + merged.replace(/"/g, '&quot;') + '"';
    if (styleMatch) return tag.replace(styleMatch[0], styleAttr);
    return tag.replace(/^<svg\b/i, '<svg ' + styleAttr);
  });
}

// 失败块标记：pre 原样保留（客户端 __mmRenderAll 接管；data-mm-error 供客户端失败占位）；
// div 形态还原为 pre。
function markPendingBlock(match, block, isPre, options) {
  const opts = options || {};
  const errAttr = opts.errorText ? ' data-mm-error="' + escapeAttrValue(opts.errorText) + '"' : '';
  if (isPre) {
    if (/data-mm-pending=/.test(match)) return match;
    return match.replace(/^<pre\b/i, '<pre data-mm-pending="1"' + errAttr);
  }
  const extra = (block.w ? ' data-w="' + escapeAttrValue(block.w) + '"' : '') + (block.h ? ' data-h="' + escapeAttrValue(block.h) + '"' : '');
  return '<pre data-language="mermaid" data-mm-pending="1"' + errAttr + extra + '><code class="language-mermaid">'
    + escapeMermaidText(block.code) + '</code></pre>';
}

function escapeAttrValue(value) {
  return String(value).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 复制按钮（features.mermaid.copyAfterRender=true）：
// 复制目标为容器上的 data-mm-code（原始 mermaid 源码，构建期保留在 SSR 产物中）；
// 不使用内联事件（CSP 合规），点击处理在 layout.ejs 的 mermaid 运行时脚本中事件委托。
function buildCopyButton(options) {
  if (!options || options.copyAfterRender !== true) return '';
  const label = escapeAttrValue(options.copyLabel || '复制图表代码');
  const copied = escapeAttrValue(options.copyCopiedLabel || '已复制');
  return '<button type="button" class="mm-copy" data-mm-copy data-copied-label="' + copied + '" aria-label="' + label + '" title="' + label + '">'
    + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
    + '</button>';
}

function buildSsrDiv(block, result, options, uid) {
  const light = result && result.svg ? prepareSvg(result.svg, options, block, 'mm-svg mm-light', uid) : null;
  if (!light) return null;
  const darkRaw = result && result.svgDark && options.darkMode !== false
    ? prepareSvg(result.svgDark, options, block, 'mm-svg mm-dark', uid)
    : null;
  const attrs = [
    'class="mermaid mermaid-ssr"',
    'data-theme-pair="' + (darkRaw ? 'light|dark' : 'light') + '"'
  ];
  if (options.copyAfterRender === true) attrs.push('data-mm-code="' + escapeAttrValue(block.code) + '"');
  if (block.w) attrs.push('data-w="' + escapeAttrValue(block.w) + '"');
  if (block.h) attrs.push('data-h="' + escapeAttrValue(block.h) + '"');
  return '<div ' + attrs.join(' ') + '>' + light + (darkRaw || '') + buildCopyButton(options) + '</div>';
}

// 把渲染结果按顺序回填到文章 HTML：成功 → 双主题内联 SVG 容器；失败/不安全 → pending。
// options: { darkMode = true, size = {}, nonce = '', copyAfterRender = false, copyLabel, copyCopiedLabel, errorText }
function replaceMermaidBlocks(html, results, options) {
  const opts = options || {};
  const list = Array.isArray(results) ? results : [];
  const input = String(html || '');
  let index = 0;
  let occurrence = 0;
  const build = (match, block, isPre) => {
    const result = list[index++];
    if (!result) return markPendingBlock(match, block, isPre, opts);
    return buildSsrDiv(block, result, opts, occurrence++) || markPendingBlock(match, block, isPre, opts);
  };
  let out = input.replace(PRE_BLOCK_RX, (match, preAttrs, codeAttrs, content) => {
    if (!/\blanguage-mermaid\b/.test(codeAttrs)) return match;
    return build(match, {
      form: 'pre',
      code: decodeMermaidText(content).trim(),
      w: attrValue(preAttrs, 'data-w'),
      h: attrValue(preAttrs, 'data-h')
    }, true);
  });
  out = out.replace(DIV_BLOCK_RX, (match, attrs) => {
    const classes = attrValue(attrs, 'class');
    if (!/\bmermaid\b/.test(classes) || /\bmermaid-ssr\b/.test(classes)) return match;
    const src = attrValue(attrs, 'data-src');
    if (!src) return match;
    return build(match, {
      form: 'div',
      code: decodeMermaidText(src).trim(),
      w: attrValue(attrs, 'data-w'),
      h: attrValue(attrs, 'data-h')
    }, false);
  });
  return out;
}

function defaultWhich(name) {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const res = spawnSync(cmd, [name], { encoding: 'utf-8', timeout: 5000 });
    if (res.status === 0 && res.stdout) {
      const first = res.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
      if (first) return first;
    }
  } catch (err) { /* 探测失败按未找到处理 */ }
  return null;
}

// Chrome 探测：显式配置 > CHROME_PATH > 平台默认路径 > PATH 中的 google-chrome/chromium。
// deps 可注入（env/platform/exists/which）以便单测不依赖真实文件系统。
function resolveChromePath(explicitPath, deps) {
  const d = Object.assign({
    env: process.env,
    platform: process.platform,
    exists: (p) => { try { return fs.existsSync(p); } catch (err) { return false; } },
    which: defaultWhich
  }, deps || {});
  const candidates = [];
  if (explicitPath) candidates.push(explicitPath);
  if (d.env && d.env.CHROME_PATH) candidates.push(d.env.CHROME_PATH);
  if (d.platform === 'win32') {
    for (const p of WINDOWS_CHROME_PATHS) candidates.push(p);
    if (d.env && d.env.LOCALAPPDATA) candidates.push(path.join(d.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  } else if (d.platform === 'darwin') {
    candidates.push(MAC_CHROME_PATH);
  }
  for (const candidate of candidates) {
    if (candidate && d.exists(candidate)) return candidate;
  }
  if (d.platform !== 'win32') {
    for (const name of POSIX_CHROME_COMMANDS) {
      const hit = d.which(name);
      if (hit) return hit;
    }
  }
  return null;
}

function resolveMermaidVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'node_modules', 'mermaid', 'package.json'), 'utf-8'));
    return pkg.version || '0';
  } catch (err) {
    return '0';
  }
}

function errorMessage(err) {
  return err && err.message ? err.message : String(err);
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('timeout:' + label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

// 创建批量渲染器。失败不抛出；返回 { svg?, cached?, error? }[]。
// 依赖注入点（测试用）：resolveChrome / puppeteer / mermaidPath / version / timeoutMs / logger。
function createMermaidRenderer(options) {
  const opts = options || {};
  const cacheDir = opts.cacheDir;
  const logger = opts.logger || console;
  const version = opts.version || resolveMermaidVersion();
  const mermaidPath = opts.mermaidPath || path.join(__dirname, '..', '..', 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
  const timeoutMs = opts.timeoutMs || 10000;
  const resolveChrome = opts.resolveChrome || (() => resolveChromePath(opts.chromePath || ''));

  function cacheFile(key) {
    return path.join(cacheDir, key + '.svg');
  }

  function readCache(key) {
    try {
      const file = cacheFile(key);
      if (!fs.existsSync(file)) return null;
      const svg = fs.readFileSync(file, 'utf-8');
      return svg || null;
    } catch (err) {
      return null;
    }
  }

  function writeCache(key, svg) {
    fs.mkdirSync(cacheDir, { recursive: true });
    writeFileAtomicSync(cacheFile(key), svg);
  }

  async function renderBatch(list) {
    const items = Array.isArray(list) ? list : [];
    const results = new Array(items.length);
    if (!items.length) return results;
    const pending = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i] || {};
      const theme = item.theme || 'default';
      const key = mermaidCacheKey(item.code || '', theme, version);
      const cached = readCache(key);
      if (cached) {
        results[i] = { svg: cached, cached: true };
        continue;
      }
      pending.push({ index: i, code: item.code || '', theme, key });
    }
    if (!pending.length) return results;

    const failPending = (message) => {
      for (const item of pending) if (!results[item.index]) results[item.index] = { error: message };
    };

    const executablePath = resolveChrome();
    if (!executablePath) {
      if (logger.warn) logger.warn('[mermaid] Chrome not found; ' + pending.length + ' block(s) fall back to client rendering');
      failPending('chrome-not-found');
      return results;
    }
    let puppeteer = opts.puppeteer || null;
    if (!puppeteer) {
      try { puppeteer = require('puppeteer-core'); } catch (err) { puppeteer = null; }
    }
    if (!puppeteer) {
      if (logger.warn) logger.warn('[mermaid] puppeteer-core unavailable; falling back to client rendering');
      failPending('puppeteer-unavailable');
      return results;
    }
    if (!fs.existsSync(mermaidPath)) {
      if (logger.warn) logger.warn('[mermaid] local mermaid bundle missing at ' + mermaidPath + '; falling back to client rendering');
      failPending('mermaid-asset-missing');
      return results;
    }

    let browser = null;
    try {
      const br = await puppeteer.launch({
        executablePath,
        headless: true,
        timeout: 30000,
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
      });
      browser = br;
      const newPage = async () => {
        const p = await br.newPage();
        await p.goto('about:blank');
        await p.addScriptTag({ path: mermaidPath });
        return p;
      };
      let page = await newPage();
      let currentTheme = null;
      for (const item of pending) {
        try {
          if (item.theme !== currentTheme) {
            await page.evaluate((theme) => {
              globalThis.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, theme });
            }, item.theme);
            currentTheme = item.theme;
          }
          const svg = await withTimeout(page.evaluate(async (code, id) => {
            const rendered = await globalThis.mermaid.render(id, code);
            return rendered && rendered.svg ? rendered.svg : '';
          }, item.code, 'mm-ssr-' + item.key), timeoutMs, item.key);
          if (!svg) throw new Error('empty-svg');
          writeCache(item.key, svg);
          results[item.index] = { svg };
        } catch (err) {
          const message = errorMessage(err);
          results[item.index] = { error: message };
          if (message.indexOf('timeout:') === 0) {
            // 页面可能被故障图表卡死：重建页面继续处理后续条目
            try { await page.close(); } catch (closeErr) { /* 忽略 */ }
            page = await newPage();
            currentTheme = null;
          }
        }
      }
    } catch (err) {
      const message = errorMessage(err);
      if (logger.warn) logger.warn('[mermaid] render batch failed: ' + message);
      failPending(message);
    } finally {
      if (browser) {
        try { await browser.close(); } catch (err) { /* 忽略 */ }
      }
    }
    return results;
  }

  return { renderBatch, version };
}

module.exports = {
  mermaidCacheKey,
  extractMermaidBlocks,
  replaceMermaidBlocks,
  resolveChromePath,
  defaultWhich,
  resolveMermaidVersion,
  createMermaidRenderer
};
