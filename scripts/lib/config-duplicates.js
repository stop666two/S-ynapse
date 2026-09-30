'use strict';
// 配置重复键扫描核心（verify:config-dupes 的纯函数层）。
//
// 目的：JSON5 解析器对同一对象内重复出现的键「后者生效、前者静默失效」，
// 这类重复不会报错，却会让较早的定义悄悄作废，属于隐性配置错误。
//
// 口径：
//   - 自研轻量扫描器逐字符跟踪字符串（含转义/换行续行）、// 行注释、/* */ 块注释与 {} [] 结构，
//     不依赖 json5.parse 的宽容解析（后者会吞掉重复信息）；
//   - 只有 `{` 进入新的对象作用域：键仅与其所在对象内的同名键比较，
//     数组内不同对象的同名键各自独立，不误报为重复；
//   - 键支持双引号/单引号/无引号（含 \u 转义），比较以解码后的键名为准；
//   - 字符串与注释中的伪键（如 "key:"、// key:）不参与判定；
//   - 只报告重复位置，不判定取值是否相同（同值删除属调用方决策）。
//
// 输出：findDuplicateKeys(text) -> { findings, keyCount }；
// findings 按重复位置升序，每项 { key, firstLine, duplicateLine }（行号从 1 起）；
// keyCount 为对象内键出现次数（含重复定义，用于报告扫描规模）。

// JSON5 标识符字符集：ASCII 字母/数字/_/$ 与任意非 ASCII 码位（覆盖面向上兼容）。
function isIdentStart(ch) {
  return /[A-Za-z_$]/.test(ch) || ch.charCodeAt(0) > 0x7F;
}

function isIdentPart(ch) {
  return /[A-Za-z0-9_$]/.test(ch) || ch.charCodeAt(0) > 0x7F;
}

function isWhitespace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\v' || ch === '\f' || ch === '\u00A0';
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

// 解码字符串/标识符中的反斜杠转义，返回替换值与吞掉的源字符数（不含反斜杠本身）。
function decodeEscape(src, at) {
  const ch = src[at];
  switch (ch) {
    case 'n': return { value: '\n', length: 1 };
    case 't': return { value: '\t', length: 1 };
    case 'r': return { value: '\r', length: 1 };
    case 'b': return { value: '\b', length: 1 };
    case 'f': return { value: '\f', length: 1 };
    case 'v': return { value: '\v', length: 1 };
    case '0': return { value: '\0', length: 1 };
    case 'x': {
      const hex = src.slice(at + 1, at + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) return { value: String.fromCharCode(parseInt(hex, 16)), length: 3 };
      return { value: 'x', length: 1 };
    }
    case 'u': {
      const hex = src.slice(at + 1, at + 5);
      if (/^[0-9A-Fa-f]{4}$/.test(hex)) return { value: String.fromCharCode(parseInt(hex, 16)), length: 5 };
      return { value: 'u', length: 1 };
    }
    default:
      return { value: ch, length: 1 };
  }
}

// 读取一个引号字符串；返回解码后的值、结束下标与跨行后的当前行号。
// 未闭合的字符串按语法错误处理：返回已读内容并以当前位置收尾（文件本身会由构建期报告语法错误）。
function readString(src, start, startLine) {
  const quote = src[start];
  let line = startLine;
  let value = '';
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      if (src[i + 1] === '\n') { line++; i += 2; continue; }
      if (src[i + 1] === '\r' && src[i + 2] === '\n') { line++; i += 3; continue; }
      const escaped = decodeEscape(src, i + 1);
      value += escaped.value;
      i += 1 + escaped.length;
      continue;
    }
    if (ch === quote) return { value, end: i + 1, line, unterminated: false };
    if (ch === '\n') return { value, end: i, line, unterminated: true };
    value += ch;
    i++;
  }
  return { value, end: i, line, unterminated: true };
}

// 读取一个无引号标识符（含 \uXXXX 转义）；起始字符不合法时返回 null。
function readIdentifier(src, start) {
  if (!isIdentStart(src[start])) return null;
  let value = '';
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && src[i + 1] === 'u') {
      const hex = src.slice(i + 2, i + 6);
      if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
        value += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        continue;
      }
    }
    if (!isIdentPart(ch)) break;
    value += ch;
    i++;
  }
  return { value, end: i };
}

// 跳过一个 // 行注释，返回换行符位置（换行由主循环统一计数）。
function skipLineComment(src, start) {
  let i = start + 2;
  while (i < src.length && src[i] !== '\n') i++;
  return i;
}

// 跳过一个 /* */ 块注释，块内换行累加到 state.line；未闭合时读到文件末尾。
function skipBlockComment(src, start, state) {
  let i = start + 2;
  while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
    if (src[i] === '\n') state.line++;
    i++;
  }
  return Math.min(i + 2, src.length);
}

// 键登记：冒号前的最后一个名字令牌是当前对象的键，重复即记录。
function registerKey(scopes, findings, token) {
  if (!token || scopes.length === 0) return false;
  const scope = scopes[scopes.length - 1];
  const seen = scope.get(token.value);
  if (seen === undefined) {
    scope.set(token.value, token.line);
    return true;
  }
  findings.push({ key: token.value, firstLine: seen, duplicateLine: token.line });
  return true;
}

/**
 * 扫描 JSON5 文本，返回同一对象作用域内的重复键清单。
 * @param {string} text JSON5 原文（可带 BOM）
 * @returns {{ findings: Array<{key:string, firstLine:number, duplicateLine:number}>, keyCount: number }}
 */
function findDuplicateKeys(text) {
  const src = stripBom(text == null ? '' : String(text));
  const scopes = [];
  const findings = [];
  const state = { line: 1 };
  let keyCount = 0;
  let lastToken = null;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') { state.line++; i++; continue; }
    if (isWhitespace(ch)) { i++; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = skipLineComment(src, i); continue; }
    if (ch === '/' && src[i + 1] === '*') { i = skipBlockComment(src, i, state); continue; }
    if (ch === '"' || ch === "'") {
      const startLine = state.line;
      const str = readString(src, i, startLine);
      state.line = str.line;
      lastToken = { value: str.value, line: startLine };
      i = str.end;
      continue;
    }
    if (isIdentStart(ch)) {
      const ident = readIdentifier(src, i);
      lastToken = { value: ident.value, line: state.line };
      i = ident.end;
      continue;
    }
    if (ch === ':') {
      if (lastToken && registerKey(scopes, findings, lastToken)) keyCount += 1;
      lastToken = null;
      i++;
      continue;
    }
    if (ch === '{') { scopes.push(new Map()); lastToken = null; i++; continue; }
    if (ch === '}') { scopes.pop(); lastToken = null; i++; continue; }
    lastToken = null;
    i++;
  }

  findings.sort((a, b) => a.duplicateLine - b.duplicateLine);
  return { findings, keyCount };
}

// 豁免名单条目与文件路径匹配：支持精确相对路径与路径后缀（如 'site.json5' 命中 real-site/site.json5）。
function matchesAllowlistFile(relPath, entryFile) {
  const target = String(relPath).replace(/\\/g, '/');
  const pattern = String(entryFile).replace(/\\/g, '/');
  return target === pattern || target.endsWith('/' + pattern);
}

/**
 * 按豁免名单拆分扫描结果：命中条目（键相同、文件匹配且理由非空）的进 suppressed，其余进 kept。
 * @param {Array<{key:string, firstLine:number, duplicateLine:number}>} findings
 * @param {Array<{file:string, key:string, reason:string}>} entries
 * @param {string} relPath 被扫描文件相对仓库根的路径
 * @returns {{ kept: Array, suppressed: Array }}
 */
function filterAllowlisted(findings, entries, relPath) {
  const list = Array.isArray(entries) ? entries : [];
  const kept = [];
  const suppressed = [];
  for (const finding of findings) {
    const entry = list.find((item) =>
      item && item.key === finding.key && Boolean(item.reason) && matchesAllowlistFile(relPath, item.file));
    if (entry) suppressed.push(Object.assign({}, finding, { reason: entry.reason }));
    else kept.push(finding);
  }
  return { kept, suppressed };
}

module.exports = {
  findDuplicateKeys,
  filterAllowlisted,
  matchesAllowlistFile
};
