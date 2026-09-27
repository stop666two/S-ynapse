'use strict';

// 页面内联 <style> 安全合并与 CSS 保守去重（compression.css.mergeInlineStyles / compression.css.dedupe）。
//
// 合并安全性（可证明）：
//   · 只合并「样式源顺序不变」的相邻块——SVG / <noscript> 内的 <style> 与外链
//     <link rel="stylesheet"> 都视为截断源，禁止跨过它们合并；被合并块必须同组
//     （同一 nonce 与同一 media 值），组内按原顺序拼接，合并块落在组内第一块的位置。
//   · 非 nonce / media 的属性（如 id）在合并时丢弃；单块页面不做任何改写。
//
// 去重安全性（可证明）：
//   · 同一规则内同属性且同 !important 状态的重复声明，CSS 语义「后者胜」，保留最后一条；
//     !important 状态不同的同名声明可能改变层叠结果，一律不动。
//   · 相邻（仅空白分隔）且完全相同的普通规则保留前一条；非相邻重复不删除；
//     @keyframes 内部、at-rule 结构、规则顺序一律不动。
//
// 解析异常（标签未闭合/配平失败、括号/引号/注释不配平、属性串非法）一律抛出，
// 由调用方跳过该文件并告警（不计入失败账本，不阻断构建）。

const TAG_NAME_RE = /[a-zA-Z][a-zA-Z0-9:-]*/iy;
const ATTR_NAME_RE = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/;
const DECL_NAME_RE = /^-{0,2}[a-zA-Z_][-\w]*$/;
const KEYFRAMES_RE = /^@[-\w]*keyframes\b/i;
const IMPORTANT_RE = /!\s*important\s*$/i;

function emptyStats() {
  return { blocksMerged: 0, rulesCollapsed: 0, declsDropped: 0, bytesSaved: 0 };
}

// 解析标签属性串（支持引号值与无引号值，兼容 minify-html 的 id=customCSS 形态）。
// 属性名非法、引号不闭合、值缺失一律抛出（调用方按解析异常跳过该文件）。
function parseAttributes(source) {
  const attrs = {};
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i++;
    if (i >= source.length) break;
    let name = '';
    while (i < source.length && !/[\s=]/.test(source[i])) name += source[i++];
    if (!ATTR_NAME_RE.test(name)) throw new Error('style 属性名非法: ' + JSON.stringify(name));
    while (i < source.length && /\s/.test(source[i])) i++;
    let value = '';
    if (source[i] === '=') {
      i++;
      while (i < source.length && /\s/.test(source[i])) i++;
      const quote = source[i];
      if (quote === '"' || quote === "'") {
        const close = source.indexOf(quote, i + 1);
        if (close === -1) throw new Error('style 属性引号未闭合: ' + name);
        value = source.slice(i + 1, close);
        i = close + 1;
      } else {
        while (i < source.length && !/\s/.test(source[i])) value += source[i++];
        if (value === '') throw new Error('style 属性值缺失: ' + name);
      }
    }
    attrs[name.toLowerCase()] = value;
  }
  return attrs;
}

function isStylesheetRel(value) {
  return typeof value === 'string' && value.toLowerCase().split(/\s+/).includes('stylesheet');
}

// 查找 name 元素内容的结束标签（`</name` + 空白 + `>`）；返回 { bodyEnd, end }，未找到返回 null。
// 正则 i 标志在原始串上定位，避免整串大小写转换导致的下标漂移（个别 Unicode 字符转换会改变长度）。
function findElementEnd(html, name, from) {
  const re = new RegExp('</' + name + '\\s*>', 'gi');
  re.lastIndex = from;
  const match = re.exec(html);
  return match ? { bodyEnd: match.index, end: match.index + match[0].length } : null;
}

// 从 from 起找开标签的结束 '>'：带引号属性值内的 '>' 不结束标签（对齐浏览器分词）。
// 返回 { end, quote }；end = -1 表示未找到，quote 非空表示属性引号未闭合。
function findTagEnd(html, from) {
  let quote = '';
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return { end: i, quote: '' };
    }
  }
  return { end: -1, quote };
}

// 上下文感知扫描页面内全部 <style> 位置与截断源；返回按文档顺序排列的条目：
//   { style: true, start, end, bodyStart, bodyEnd, attrs, excluded }
//   { style: false, start, end }（截断源：外链样式表 / SVG / noscript 内的 style）
//
// 配平计数只统计「真实标签语境」中的 script/style/svg/noscript，剔除规则对齐浏览器分词：
//   · HTML 注释（<!-- -->）整体跳过；
//   · RCDATA（<title>/<textarea>）与 rawtext（<script>/<style>）元素内容整体跳过——
//     标题文本、JS 字符串里的 `</script><script>`、`<style>` 字面都不再计为标签；
//   · 开标签内带引号属性值视为属性串，其中的 '<' 不启动新标签。
// 扫描模型参考 scripts/security-verify.js 的 scanScripts（引号属性 + 元素边界），
// 并补齐其未覆盖的分支（注释、title/textarea、跨元素开闭计数）。
// 解析异常（标签/属性引号未闭合、真实缺失闭合标签、开闭计数不平衡）一律抛出，
// 由调用方跳过该文件并告警。
function scanStyleSources(html) {
  const entries = [];
  const counts = {
    scriptOpen: 0, scriptClose: 0,
    styleOpen: 0, styleClose: 0,
    svgOpen: 0, svgClose: 0,
    noscriptOpen: 0, noscriptClose: 0
  };
  let svgDepth = 0;
  let noscriptDepth = 0;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      const close = html.indexOf('-->', lt + 4);
      i = close === -1 ? html.length : close + 3;
      continue;
    }
    const next = html[lt + 1];
    if (next === '!' || next === '?') {
      const declEnd = findTagEnd(html, lt + 2);
      i = declEnd.end === -1 ? html.length : declEnd.end + 1;
      continue;
    }
    const closing = next === '/';
    TAG_NAME_RE.lastIndex = lt + (closing ? 2 : 1);
    const nameMatch = TAG_NAME_RE.exec(html);
    if (!nameMatch) {
      i = lt + 1;
      continue;
    }
    const name = nameMatch[0].toLowerCase();
    const tag = findTagEnd(html, TAG_NAME_RE.lastIndex);
    if (tag.end === -1) {
      if (tag.quote) throw new Error('HTML 标签属性引号未闭合: <' + name);
      throw new Error('HTML 标签未闭合: <' + name);
    }
    const attrsText = html.slice(TAG_NAME_RE.lastIndex, tag.end).replace(/\/\s*$/, '');
    i = tag.end + 1;
    if (closing) {
      if (name === 'script') counts.scriptClose += 1;
      else if (name === 'style') counts.styleClose += 1;
      else if (name === 'svg') { counts.svgClose += 1; svgDepth = Math.max(0, svgDepth - 1); }
      else if (name === 'noscript') { counts.noscriptClose += 1; noscriptDepth = Math.max(0, noscriptDepth - 1); }
      continue;
    }
    if (name === 'script' || name === 'style') {
      const end = findElementEnd(html, name, i);
      if (!end) throw new Error('HTML 标签配平检查失败（script/style/svg/noscript）');
      if (name === 'script') {
        counts.scriptOpen += 1;
        counts.scriptClose += 1;
      } else {
        counts.styleOpen += 1;
        counts.styleClose += 1;
        entries.push({
          style: true,
          start: lt,
          end: end.end,
          bodyStart: tag.end + 1,
          bodyEnd: end.bodyEnd,
          attrs: parseAttributes(attrsText),
          excluded: svgDepth > 0 || noscriptDepth > 0
        });
      }
      i = end.end;
      continue;
    }
    if (name === 'title' || name === 'textarea') {
      const end = findElementEnd(html, name, i);
      if (!end) throw new Error('HTML 标签配平检查失败（RCDATA: ' + name + '）');
      i = end.end;
      continue;
    }
    if (name === 'svg') {
      counts.svgOpen += 1;
      svgDepth += 1;
      continue;
    }
    if (name === 'noscript') {
      counts.noscriptOpen += 1;
      noscriptDepth += 1;
      continue;
    }
    if (name === 'link') {
      const attrs = parseAttributes(attrsText);
      if (isStylesheetRel(attrs.rel)) entries.push({ style: false, start: lt, end: tag.end + 1 });
    }
  }
  if (counts.scriptOpen !== counts.scriptClose || counts.styleOpen !== counts.styleClose
    || counts.svgOpen !== counts.svgClose || counts.noscriptOpen !== counts.noscriptClose) {
    throw new Error('HTML 标签配平检查失败（script/style/svg/noscript）');
  }
  return entries;
}

// 合并分组键：nonce 与 media 必须一致（两者都是影响生效语义的属性）。
function styleGroupKey(attrs) {
  return (attrs.nonce || '') + '\u0000' + (attrs.media || '');
}

// 规划合并：把条目流切成 run（连续、同组、未被截断源中断），只返回长度 ≥2 的 run。
function planStyleMerges(entries) {
  const runs = [];
  let segment = 0;
  let current = null;
  for (const entry of entries) {
    if (!entry.style || entry.excluded) {
      segment += 1;
      current = null;
      continue;
    }
    const key = styleGroupKey(entry.attrs);
    if (current && current.segment === segment && current.key === key) {
      current.blocks.push(entry);
    } else {
      current = { segment, key, blocks: [entry] };
      runs.push(current);
    }
  }
  return runs.filter((run) => run.blocks.length > 1);
}

// CSS 配平校验：注释 / 引号 / 括号（含花括号）必须闭合；不配平即解析异常。
function assertCssBalanced(css) {
  const box = { comment: false, quote: '', paren: 0, bracket: 0, brace: 0 };
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (box.comment) {
      if (ch === '*' && css[i + 1] === '/') { box.comment = false; i += 1; }
      continue;
    }
    if (box.quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === box.quote) box.quote = '';
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') { box.comment = true; i += 1; continue; }
    if (ch === '"' || ch === "'") { box.quote = ch; continue; }
    if (ch === '(') box.paren += 1;
    else if (ch === ')') box.paren -= 1;
    else if (ch === '[') box.bracket += 1;
    else if (ch === ']') box.bracket -= 1;
    else if (ch === '{') box.brace += 1;
    else if (ch === '}') box.brace -= 1;
    if (box.paren < 0 || box.bracket < 0 || box.brace < 0) throw new Error('CSS 括号顺序异常');
  }
  if (box.comment || box.quote || box.paren !== 0 || box.bracket !== 0 || box.brace !== 0) {
    throw new Error('CSS 括号/引号/注释未配平');
  }
}

function escapeAttrValue(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildStyleTag(nonce, media) {
  const parts = [];
  if (nonce) parts.push(' nonce="' + escapeAttrValue(nonce) + '"');
  if (media) parts.push(' media="' + escapeAttrValue(media) + '"');
  return '<style' + parts.join('') + '>';
}

/**
 * 合并页面内联 <style> 块：按样式源顺序把同组（nonce + media 一致）且中间无
 * link/SVG/noscript 样式源的相邻块合并为一块，合并块落在第一块位置。
 * @param {string} html 页面 HTML
 * @param {{ nonce?: string }} [options] 合并块缺省 nonce（原块无 nonce 时生效）
 * @returns {{ html: string, changed: boolean, stats: object }}
 * @throws {TypeError|Error} 入参非字符串或 HTML/CSS 解析异常
 */
function mergeStyleBlocks(html, options) {
  if (typeof html !== 'string') throw new TypeError('mergeStyleBlocks 需要字符串入参');
  const opts = options || {};
  const entries = scanStyleSources(html);
  const runs = planStyleMerges(entries);
  const stats = emptyStats();
  if (runs.length === 0) return { html, changed: false, stats };

  const replacements = [];
  for (const run of runs) {
    const first = run.blocks[0];
    let merged = '';
    for (const block of run.blocks) {
      const css = html.slice(block.bodyStart, block.bodyEnd);
      assertCssBalanced(css);
      merged += css;
    }
    assertCssBalanced(merged);
    const nonce = first.attrs.nonce || opts.nonce || '';
    replacements.push({
      start: first.start,
      end: first.end,
      text: buildStyleTag(nonce, first.attrs.media || '') + merged + '</style>'
    });
    for (const block of run.blocks.slice(1)) replacements.push({ start: block.start, end: block.end, text: '' });
    stats.blocksMerged += run.blocks.length - 1;
  }
  replacements.sort((a, b) => b.start - a.start);
  let out = html;
  for (const item of replacements) out = out.slice(0, item.start) + item.text + out.slice(item.end);
  stats.bytesSaved = html.length - out.length;
  return { html: out, changed: out !== html, stats };
}

/**
 * 对页面内所有可安全处理的 <style> 块（排除 SVG / <noscript> 内）执行 dedupeCss。
 * @param {string} html 页面 HTML
 * @returns {{ html: string, changed: boolean, stats: object }}
 * @throws {TypeError|Error} 入参非字符串或 HTML/CSS 解析异常
 */
function dedupeStyleBlocks(html) {
  if (typeof html !== 'string') throw new TypeError('dedupeStyleBlocks 需要字符串入参');
  const stats = emptyStats();
  const entries = scanStyleSources(html);
  const replacements = [];
  for (const entry of entries) {
    if (!entry.style || entry.excluded) continue;
    const css = html.slice(entry.bodyStart, entry.bodyEnd);
    if (css.trim() === '') continue;
    const result = dedupeCss(css);
    if (!result.changed) continue;
    replacements.push({ start: entry.bodyStart, end: entry.bodyEnd, text: result.css });
    stats.rulesCollapsed += result.stats.rulesCollapsed;
    stats.declsDropped += result.stats.declsDropped;
  }
  let out = html;
  for (const item of replacements.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, item.start) + item.text + out.slice(item.end);
  }
  stats.bytesSaved = html.length - out.length;
  return { html: out, changed: out !== html, stats };
}

// 跳过注释 / 字符串，返回新位置；未闭合时返回 -1。
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

// 返回 from 之后第一个顶层 '{' 的下标（跳过注释/字符串/圆括号/方括号），无则 -1。
function findTopLevelBrace(text, from) {
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
    else if (ch === '{' && round === 0 && square === 0) return i;
    if (round < 0 || square < 0) throw new Error('CSS 括号顺序异常');
  }
  return -1;
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
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

// 按顶层 ';' 切分声明列表：返回 { text, sep, start }（sep 为该段之后的分隔符原文）。
function splitDeclarations(body) {
  const segments = [];
  let start = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '/' || ch === '"' || ch === "'") {
      const next = skipCommentOrString(body, i);
      if (next === -1) throw new Error('声明注释/字符串未闭合');
      i = next;
      continue;
    }
    if (ch === '{' || ch === '}') throw new Error('声明列表中出现花括号');
    if (ch === ';') {
      segments.push({ start, text: body.slice(start, i), sep: ';' });
      i += 1;
      start = i;
      continue;
    }
    i += 1;
  }
  if (start < body.length) segments.push({ start, text: body.slice(start), sep: '' });
  return segments;
}

function parseDeclaration(text) {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.startsWith('@')) return null;
  const colon = trimmed.indexOf(':');
  if (colon <= 0) return null;
  const name = trimmed.slice(0, colon).trim();
  if (!DECL_NAME_RE.test(name)) return null;
  const value = trimmed.slice(colon + 1).trim();
  return { name, important: IMPORTANT_RE.test(value) };
}

// 声明去重：同属性同 !important 状态的重复声明，仅保留最后一条（CSS 后者胜）。
function dedupeDeclarations(body, stats) {
  const segments = splitDeclarations(body);
  const lastPosition = new Map();
  const remove = new Set();
  for (let i = 0; i < segments.length; i++) {
    const decl = parseDeclaration(segments[i].text);
    if (!decl) continue;
    const key = decl.name + '\u0000' + (decl.important ? '!' : '');
    if (lastPosition.has(key)) remove.add(lastPosition.get(key));
    lastPosition.set(key, i);
  }
  if (remove.size === 0) return body;
  stats.declsDropped += remove.size;
  let out = '';
  for (let i = 0; i < segments.length; i++) {
    if (!remove.has(i)) out += segments[i].text + segments[i].sep;
  }
  return out;
}

// 处理一个「块列表」层级：切出 prelude + { body }，递归容器（@media/@supports/@layer 等），
// 对声明块去重，并折叠相邻且完全相同的普通规则；@keyframes 内部整体保留。
function processBlockList(text, stats) {
  const units = [];
  let pos = 0;
  while (pos < text.length) {
    const brace = findTopLevelBrace(text, pos);
    if (brace === -1) {
      units.push({ raw: text.slice(pos) });
      break;
    }
    const prelude = text.slice(pos, brace);
    const close = findMatchingBrace(text, brace);
    const body = text.slice(brace + 1, close);
    let newBody = body;
    const preludeTrim = prelude.trim();
    if (!KEYFRAMES_RE.test(preludeTrim)) {
      if (findTopLevelBrace(body, 0) !== -1) {
        // 容器 at-rule（@media/@supports/@layer 等）递归处理内部；
        // 普通规则声明值内的花括号（自定义属性值）不递归、不去重，整体保留。
        if (preludeTrim.startsWith('@')) newBody = processBlockList(body, stats).text;
      } else {
        newBody = dedupeDeclarations(body, stats);
      }
    }
    units.push({ prelude, body: newBody, isRule: preludeTrim !== '' && !preludeTrim.startsWith('@') });
    pos = close + 1;
    if (pos >= text.length) break;
  }

  let out = '';
  let prevRule = null;
  for (const unit of units) {
    if (unit.raw !== undefined) { out += unit.raw; prevRule = null; continue; }
    if (prevRule && unit.isRule) {
      // 相邻 = units 序列中两个普通规则直接相邻；两者之间只有当前 unit 的 prelude
      // （前导空白 + 该规则自身选择器），prelude 中的任何杂质都会使选择器比较不相等。
      const prevSel = prevRule.prelude.replace(/^\s+/, '').replace(/\s+$/, '');
      const unitSel = unit.prelude.replace(/^\s+/, '').replace(/\s+$/, '');
      if (prevSel !== '' && prevSel === unitSel && prevRule.body.trim() === unit.body.trim()) {
        stats.rulesCollapsed += 1;
        continue;
      }
    }
    out += unit.prelude + '{' + unit.body + '}';
    prevRule = unit.isRule ? unit : null;
  }
  return { text: out, stats };
}

/**
 * 保守 CSS 去重：同一规则内同属性同 !important 状态的重复声明保留最后一条；
 * 相邻且完全相同的普通规则保留前一条；不重排、不处理 @keyframes 内部、不动 at-rule 结构。
 * @param {string} css CSS 文本
 * @returns {{ css: string, changed: boolean, stats: object }}
 * @throws {TypeError|Error} 入参非字符串或 CSS 解析异常
 */
function dedupeCss(css) {
  if (typeof css !== 'string') throw new TypeError('dedupeCss 需要字符串入参');
  assertCssBalanced(css);
  const stats = emptyStats();
  const result = processBlockList(css, stats);
  stats.bytesSaved = css.length - result.text.length;
  return { css: result.text, changed: result.text !== css, stats };
}

module.exports = {
  mergeStyleBlocks,
  dedupeStyleBlocks,
  dedupeCss,
  parseAttributes,
  assertCssBalanced
};
