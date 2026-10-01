'use strict';

// 关键 CSS 提取（构建期把首屏样式内联进 HTML，非关键样式可异步加载）。
// 纯字符串处理、不依赖 DOM/浏览器：顶层规则按注释/字符串/括号安全的扫描配对，
// 依据「前导选择器白名单」保留首屏区域（变量/重置/页头/英雄区/首屏卡片/侧栏与目录列）
// 的规则；:root 与 [data-theme] 变量声明按「关键规则引用的变量闭包 + 强制保留前缀」裁剪，
// 避免内联体积失控。
// 安全性：
//   · 只筛选择器、不改写规则内部声明、不重排顺序——同一规则内保留的选择器获得与全量 CSS
//     完全一致的声明与层叠顺序（非关键选择器交由异步全量 CSS 承担）；
//   · 容器 at-rule（@media/@supports）递归筛选，内部无保留规则时整体丢弃；
//   · @keyframes 仅在名称被保留规则引用时保留；
//   · 解析异常（注释/引号/括号不配对）一律抛出，由调用方回退为「全量阻塞样式」（现状行为）。

// 文档级选择器：html/body 的变体（save-data、背景模式、伪元素装饰）与裸标签/伪类。
// 与元素名以非标识符字符或行尾为界，避免 article/aside 误命中 a。
const TAG_CRITICAL_RE = /^(?:\*|a|h[1-6]|img|hr|::selection|:focus-visible|::-[a-z-]*scrollbar(?:-thumb|-track)?)(?![\w-])/;
const DOC_CRITICAL_RE = /^(?:html|body)(?=$|[.:[])/;

// 交互态与触摸回退类不参与首屏静态渲染：悬停/按下样式只在交互时可见，
// 触摸标题锚点回退规则由运行时按设备启用；均让异步全量 CSS 承担。
const EXCLUDED_SELECTOR_RE = /:hover|:active|data-touch-fallback/;

// 类/属性选择器前缀白名单：覆盖首屏可见区域（页头、英雄区、列表卡片、文章头与目录列骨架）。
// 取舍：侧栏挂件（.widget-*）与目录条目细节（.toc-sidebar-link.level-* 等）不进入内联——
// 它们位于首屏内的固定列宽容器中，文本重排不会移动列外元素（CLS 由运行验证兜底）。
const CLASS_CRITICAL_PREFIXES = [
  '.container', '.site-wrapper', '.content-wrapper', '.main-content',
  // 侧栏挂件：位于首屏右侧列内，未定型会随全量样式到达产生可见重排（CLS 主来源）。
  '.sidebar-', '.widget-',
  '.site-header', '.header-inner', '.site-logo',
  '.nav-', '.dark-toggle', '.search-toggle', '.lang-', '.m-bottom-nav',
  '.hero', '.blog-grid', '.card-', '.pin-badge',
  '.post-header', '.post-title', '.post-meta', '.post-featured-image',
  '.breadcrumb', '.page-enter', '.motion-reveal',
  '.img-', '.js-img'
];

// 精确选择器白名单：无法用前缀表达的首屏元素。
const EXACT_CRITICAL_SELECTORS = new Set([
  '#bgFx', '.sidebar', '.reading-progress', '.rp-dot',
  // 依赖 CSS 初始隐藏、且无 hidden 属性的覆盖层与面板：缺失会把未样式化内容暴露在首屏。
  '.main-nav', '.search-overlay', '.preset-pop',
  '.preset-wrap', '.preset-btn', '.nav-boost', '.nav-boost-btn',
  // 文章正文的首屏排版（标题/段落/链接/图片/列表）；代码、表格、公式、图表等重型块异步接管。
  '.post-content', '.post-content p', '.post-content h2', '.post-content h3', '.post-content h4',
  '.post-content :is(h2,h3,h4)', '.post-content a', '.post-content img',
  '.post-content ul', '.post-content ol', '.post-content li',
  // 列表首屏卡片（含 bento 首卡与无封面回退）。
  '.post-card', '.post-card-image', '.post-card-nocover', '.post-card-title',
  '.post-card-title a', '.post-card-meta', '.post-card-meta a', '.post-card-excerpt',
  '.post-card .pin-badge.pin-badge-corner', '.post-card.card-shine', '.post-card.card-shine::after',
  // 目录列骨架与加载遮罩（首屏可见或短暂覆盖首屏）。
  '.toc-sidebar', '.toc-sidebar.visible', '.toc-sidebar-inner',
  '.boot-overlay', '.boot-overlay.out', '.boot-inner', '.boot-title', '.boot-text',
  // 顶部公告条（fixed 于页头上方，未定型会推挤页头 → 首屏位移）。
  '.announcement-bar', '.announcement-bar.closing', '.announcement-bar a.announce-item',
  '.announce-accent', '.announce-solid', '.announce-minimal', '.announce-gradient',
  '.announce-dot', '.announce-solid .announce-dot', '.announce-gradient .announce-dot',
  '.announce-icon', '.announce-viewport', '.announce-item', '.announce-item.on',
  '.announce-close'
]);

// 精确排除：命中白名单前缀但属隐藏面板/软导航加载条，首屏静态渲染不需要。
const EXCLUDED_EXACT_SELECTORS = new Set([
  '.nav-boost-panel', 'html.softnav-busy::after'
]);

// 变量强制保留前缀：运行时早置脚本会在首屏读取（background.js 取 --color-s，
// theme-lab 读取主题调色板），即使关键规则未直接引用也必须保留。
const FORCED_VAR_PREFIXES = ['--color-', '--zIndex-'];

function isCriticalSelector(selector, options) {
  const sel = selector.trim();
  if (!sel) return false;
  if (sel === ':root' || sel.startsWith('[data-theme')) return true;
  if (EXCLUDED_SELECTOR_RE.test(sel) || EXCLUDED_EXACT_SELECTORS.has(sel)) return false;
  if (TAG_CRITICAL_RE.test(sel) || DOC_CRITICAL_RE.test(sel)) return true;
  const exacts = (options && options.exactSelectors) ? options.exactSelectors : EXACT_CRITICAL_SELECTORS;
  if (exacts.has(sel)) return true;
  const prefixes = (options && Array.isArray(options.classPrefixes)) ? options.classPrefixes : CLASS_CRITICAL_PREFIXES;
  for (const prefix of prefixes) {
    if (sel.startsWith(prefix)) return true;
  }
  return false;
}

// 提取需要保留的选择器子集：同一规则内的非关键选择器不进入内联（其声明由异步全量 CSS 承担），
// 关键选择器保留原声明与顺序，层叠结果对首屏元素与全量加载一致。
function pickCriticalSelectors(prelude, options) {
  const opts = options || {};
  const matcher = typeof opts.isSelectorCritical === 'function'
    ? opts.isSelectorCritical
    : (selector) => isCriticalSelector(selector, opts);
  return splitTopLevelList(prelude).map((selector) => selector.trim()).filter((selector) => selector && matcher(selector));
}

// 顶层级分隔：按逗号切分选择器列表，括号/引号/注释内逗号不切分。
function splitTopLevelList(text) {
  const out = [];
  let start = 0;
  let round = 0;
  let square = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '/' || ch === '"' || ch === "'") {
      const next = skipCommentOrString(text, i);
      if (next === -1) throw new Error('CSS 注释/字符串未闭合');
      i = next - 1;
      continue;
    }
    if (ch === '(') round += 1;
    else if (ch === ')') round -= 1;
    else if (ch === '[') square += 1;
    else if (ch === ']') square -= 1;
    else if (ch === ',' && round === 0 && square === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
    if (round < 0 || square < 0) throw new Error('CSS 括号顺序异常');
  }
  out.push(text.slice(start));
  return out;
}

function skipCommentOrString(text, i) {
  if (text[i] === '/' && text[i + 1] === '*') {
    const close = text.indexOf('*/', i + 2);
    return close === -1 ? -1 : close + 2;
  }
  if (text[i] === '"' || text[i] === "'") {
    const quote = text[i];
    let j = i + 1;
    while (j < text.length) {
      if (text[j] === '\\') { j += 2; continue; }
      if (text[j] === quote) return j + 1;
      j += 1;
    }
    return -1;
  }
  return i + 1;
}

// 查找顶层 '{'；先出现顶层 ';' 时视为无块语句 at-rule（返回 block=-1、statement=true）。
function findTopLevelBlock(text, from) {
  let round = 0;
  let square = 0;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (ch === '/' || ch === '"' || ch === "'") {
      const next = skipCommentOrString(text, i);
      if (next === -1) throw new Error('CSS 注释/字符串未闭合');
      i = next - 1;
      continue;
    }
    if (ch === '(') round += 1;
    else if (ch === ')') round -= 1;
    else if (ch === '[') square += 1;
    else if (ch === ']') square -= 1;
    else if (ch === '{' && round === 0 && square === 0) return { brace: i, statement: false };
    else if (ch === ';' && round === 0 && square === 0) return { brace: -1, statement: true, semi: i };
    if (round < 0 || square < 0) throw new Error('CSS 括号顺序异常');
  }
  return { brace: -1, statement: false };
}

function findMatchingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '/' || ch === '"' || ch === "'") {
      const next = skipCommentOrString(text, i);
      if (next === -1) throw new Error('CSS 注释/字符串未闭合');
      i = next - 1;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
      if (depth < 0) throw new Error('CSS 大括号顺序异常');
    }
  }
  throw new Error('CSS 大括号未闭合');
}

// 解析文本为节点序列：
//   { type: 'rule', prelude, body }         普通选择器规则
//   { type: 'container', prelude, children }  @media/@supports/@layer 等可嵌套块
//   { type: 'keyframes', name, prelude, body }@keyframes
//   { type: 'raw-at', prelude, body }        其它带块 at-rule（@font-face/@property/@page 等）
//   { type: 'statement', prelude }           无块 at-rule（@charset/@import/@layer a,b 等）
function parseNodes(text) {
  const nodes = [];
  let pos = 0;
  while (pos < text.length) {
    const found = findTopLevelBlock(text, pos);
    if (found.statement) {
      const prelude = text.slice(pos, found.semi);
      if (prelude.trim()) nodes.push({ type: 'statement', prelude });
      pos = found.semi + 1;
      continue;
    }
    if (found.brace === -1) {
      const tail = text.slice(pos);
      if (tail.trim()) nodes.push({ type: 'statement', prelude: tail });
      break;
    }
    const prelude = text.slice(pos, found.brace);
    const close = findMatchingBrace(text, found.brace);
    const body = text.slice(found.brace + 1, close);
    const trimmed = prelude.trim();
    if (trimmed.startsWith('@keyframes')) {
      const name = trimmed.slice('@keyframes'.length).trim().replace(/^["']|["']$/g, '');
      nodes.push({ type: 'keyframes', name, prelude, body });
    } else if (/^@(?:media|supports|layer|container|scope|document)\b/.test(trimmed)) {
      nodes.push({ type: 'container', prelude, children: parseNodes(body) });
    } else if (trimmed.startsWith('@')) {
      nodes.push({ type: 'raw-at', prelude, body });
    } else {
      nodes.push({ type: 'rule', prelude, body });
    }
    pos = close + 1;
  }
  return nodes;
}

function containerIsPrintOnly(prelude) {
  return /@media[^{]*\bprint\b/.test(prelude);
}

// 声明切分：按顶层 ';' 切块，括号/引号/注释安全；返回 { text, name, isCustom } 列表。
function splitDeclarations(body) {
  const segments = [];
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '/' || ch === '"' || ch === "'") {
      const next = skipCommentOrString(body, i);
      if (next === -1) throw new Error('CSS 注释/字符串未闭合');
      i = next - 1;
      continue;
    }
    if (ch === '{' || ch === '}') throw new Error('声明列表中出现花括号');
    if (ch === ';') {
      segments.push(body.slice(start, i));
      start = i + 1;
    }
  }
  if (start < body.length) segments.push(body.slice(start));
  return segments.map((segment) => {
    const colon = segment.indexOf(':');
    const name = colon > 0 ? segment.slice(0, colon).trim() : '';
    const isCustom = name.startsWith('--');
    return { text: segment, name, isCustom };
  });
}

function collectVarRefs(text, into) {
  const re = /var\(\s*(--[\w-]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) into.add(m[1]);
}

// 渲染节点：先收集保留的非 keyframes 文本，再据此决定 keyframes 是否保留；
// 变量块（:root/[data-theme]）按闭包裁剪自定义属性声明。
function renderNodes(nodes, ctx) {
  const keptText = [];
  const varDefs = new Map();
  const varRefs = new Set(ctx.forcedVars);

  const walkCollect = (list) => {
    for (const node of list) {
      if (node.type === 'rule') {
        const keptSelectors = pickCriticalSelectors(node.prelude, ctx.options);
        if (keptSelectors.length) {
          node.keep = true;
          node.keptSelectors = keptSelectors;
          keptText.push(keptSelectors.join(','), node.body);
          collectVarRefs(node.body, varRefs);
          for (const decl of splitDeclarations(node.body)) {
            if (decl.isCustom) varDefs.set(decl.name, decl.text);
          }
        }
      } else if (node.type === 'container') {
        if (containerIsPrintOnly(node.prelude)) continue;
        walkCollect(node.children);
      } else if (node.type === 'raw-at') {
        const p = node.prelude.trim();
        if (/^@(?:font-face|property|counter-style)\b/.test(p)) {
          node.keep = true;
          keptText.push(node.prelude, node.body);
          collectVarRefs(node.body, varRefs);
          for (const decl of splitDeclarations(node.body)) {
            if (decl.isCustom) varDefs.set(decl.name, decl.text);
          }
        }
      }
    }
  };
  walkCollect(nodes);

  // 变量闭包：关键规则引用 → 变量值内继续引用，迭代至稳定。
  const closure = new Set();
  const queue = Array.from(varRefs);
  while (queue.length) {
    const name = queue.pop();
    if (closure.has(name)) continue;
    closure.add(name);
    const value = varDefs.get(name);
    if (!value) continue;
    const nested = new Set();
    collectVarRefs(value, nested);
    for (const ref of nested) if (!closure.has(ref)) queue.push(ref);
  }

  const varBlockRe = /^\s*:root\s*$|^\s*\[data-theme/;
  const keepVarName = (name) => {
    if (!name.startsWith('--')) return true;
    if (closure.has(name)) return true;
    return FORCED_VAR_PREFIXES.some((prefix) => name.startsWith(prefix));
  };

  const render = (list) => {
    const out = [];
    for (const node of list) {
      if (node.type === 'rule') {
        if (!node.keep) continue;
        if (varBlockRe.test(node.prelude)) {
          const decls = splitDeclarations(node.body).filter((decl) => keepVarName(decl.name));
          if (decls.length === 0) continue;
          out.push(node.prelude + '{' + decls.map((decl) => decl.text).join(';') + '}');
          ctx.stats.varDeclKept += decls.filter((decl) => decl.isCustom).length;
          continue;
        }
        ctx.stats.rulesKept += 1;
        out.push(node.keptSelectors.join(',') + '{' + node.body + '}');
        continue;
      }
      if (node.type === 'container') {
        const inner = render(node.children);
        if (!inner) continue;
        out.push(node.prelude + '{' + inner + '}');
        continue;
      }
      if (node.type === 'keyframes') {
        if (!node.keep && isKeyframeReferenced(node.name, keptText)) node.keep = true;
        if (node.keep) out.push(node.prelude + '{' + node.body + '}');
        continue;
      }
      if (node.type === 'raw-at' && node.keep) {
        out.push(node.prelude + '{' + node.body + '}');
        continue;
      }
      // statement / 未保留 raw-at / 未保留容器：丢弃
    }
    return out.join('\n');
  };

  return render(nodes);
}

function isKeyframeReferenced(name, keptText) {
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|[^\\w-])' + escaped + '(?:[^\\w-]|$)');
  return keptText.some((text) => re.test(text));
}

/**
 * 从全量 CSS 中提取首屏关键 CSS。
 * @param {string} css 全量样式（通常为 CleanCSS 压缩后的产物）
 * @param {{ isSelectorCritical?: (selector: string) => boolean, forcedVars?: string[] }} [options]
 * @returns {{ css: string, stats: { bytes: number, rulesTotal: number, rulesKept: number, varDeclKept: number } }}
 * @throws {TypeError|Error} 入参非字符串或 CSS 解析异常（由调用方回退全量阻塞样式）
 */
function extractCriticalCss(css, options) {
  if (typeof css !== 'string') throw new TypeError('extractCriticalCss 需要字符串入参');
  const opts = options || {};
  const ctx = {
    options: opts,
    stats: { bytes: 0, rulesTotal: 0, rulesKept: 0, varDeclKept: 0 },
    forcedVars: Array.isArray(opts.forcedVars) ? opts.forcedVars : [],
    forcedPrefixes: []
  };
  const nodes = parseNodes(css);
  let total = 0;
  const count = (list) => {
    for (const node of list) {
      if (node.type === 'rule') total += 1;
      else if (node.type === 'container') count(node.children);
    }
  };
  count(nodes);
  const critical = renderNodes(nodes, ctx);
  return {
    css: critical,
    stats: {
      bytes: Buffer.byteLength(critical, 'utf-8'),
      rulesTotal: total,
      rulesKept: ctx.stats.rulesKept,
      varDeclKept: ctx.stats.varDeclKept
    }
  };
}

module.exports = {
  extractCriticalCss,
  isCriticalSelector,
  pickCriticalSelectors,
  parseNodes,
  splitDeclarations,
  CLASS_CRITICAL_PREFIXES,
  FORCED_VAR_PREFIXES
};
