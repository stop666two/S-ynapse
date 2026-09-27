'use strict';

/**
 * 配置注释审计核心（verify:config-comments 的纯函数层）。
 *
 * 口径（与 AGENTS.md「配置文件逐字段标注」要求一致，显式声明、不做静默豁免）：
 *   1. 文件头块注释：第一个键行之前须存在 ≥ HEADER_MIN_COMMENT_LINES 行连续注释；
 *   2. 键级注释：每个「对象键」（不含数组元素）须满足任一条：
 *      a. 同行行尾注释（// 在字符串之外）；或
 *      b. 紧邻前置行是注释行；或
 *      c. 同缩进分组注释：向上越过空白行与同一缩进的兄弟键，能到达注释行
 *         （允许一次覆盖同组子键；中间出现不同缩进的键即被打断）。
 *   3. 数组行策略（ARRAY_ROW_POLICY = 'skip'）：数组字面量内的元素是数据行，
 *      逐行键不参与判定；其字段说明由数组宿主键上方的分组注释承担（宿主键本身仍受规则 2 约束）。
 *   4. 区块策略（BLOCK_POLICY_FILES）：ui-strings.json5 / tag-aliases.json5 属于文案/映射表，
 *      采用「模块/区块级注释」口径——只要求根级键（最小缩进）被注释覆盖，模块内部键
 *      由模块注释统一说明。
 */

const HEADER_MIN_COMMENT_LINES = 2;
const BLOCK_POLICY_FILES = ['ui-strings.json5', 'tag-aliases.json5'];
const ARRAY_ROW_POLICY = 'skip';
const MAX_GROUP_BLANK_LINES = 3;

/**
 * 扫描单行，标记字符串内容位置并定位行尾注释起点。
 * @param {string} line 原始行
 * @returns {{ inString: boolean[], commentAt: number|null }} inString[i]=true 表示该字符位于字符串内容中（引号定界符本身为 false）；commentAt 为字符串外的 `//` 下标
 */
function scanLine(line) {
  const inString = new Array(line.length).fill(false);
  let quote = null;
  let commentAt = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      inString[i] = true;
      if (c === '\\') {
        if (i + 1 < line.length) {
          inString[i + 1] = true;
          i++;
        }
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '/' && line[i + 1] === '/') {
      commentAt = i;
      break;
    }
  }
  return { inString, commentAt };
}

/**
 * 提取单行中的键（`"key":` / `'key':` / `key:`，冒号前可带空白），并判断是否存在行尾注释。
 * @param {string} line 原始行
 * @returns {{ keys: string[], trailing: boolean }} keys 按出现顺序；trailing 表示该行有字符串外的行尾注释
 */
function keysOnLine(line) {
  const { inString, commentAt } = scanLine(line);
  const limit = commentAt === null ? line.length : commentAt;
  const re = /(?:"([^"\n]*)"|'([^'\n]*)'|([A-Za-z_$][\w$-]*))\s*:/g;
  const keys = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index >= limit) break;
    if (inString[m.index]) continue;
    keys.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  }
  return { keys, trailing: commentAt !== null && keys.length > 0 };
}

/**
 * 将配置文本逐行结构化：缩进、键、注释行、数组上下文。
 * @param {string} text JSON5 原文
 * @returns {Array<{line:number,raw:string,trimmed:string,indent:number,keys:string[],trailing:boolean,isComment:boolean,inArray:boolean}>}
 */
function tokenize(text) {
  const rawLines = text.split(/\r?\n/);
  const out = [];
  const brackets = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const trimmed = raw.trim();
    const indent = (raw.match(/^\s*/) || [''])[0].length;
    const { keys, trailing } = keysOnLine(raw);
    out.push({
      line: i + 1,
      raw,
      trimmed,
      indent,
      keys,
      trailing,
      isComment: trimmed.startsWith('//'),
      inArray: brackets.includes('['),
    });
    const { inString } = scanLine(raw);
    for (let c = 0; c < raw.length; c++) {
      if (inString[c]) continue;
      const ch = raw[c];
      if (ch === '/' && raw[c + 1] === '/') break;
      if (ch === '{' || ch === '[') brackets.push(ch);
      else if (ch === '}' || ch === ']') brackets.pop();
    }
  }
  return out;
}

/**
 * 检查文件头块注释：首个键之前须出现 ≥ HEADER_MIN_COMMENT_LINES 行连续注释。
 * 注释块允许位于起始 `{` 之后（如 tuning.json5 的头部写在花括号内），
 * 但不得与首个键之间夹带其它键。
 * @param {ReturnType<typeof tokenize>} lines 已结构化行
 * @returns {{line:number,key:string,reason:string}|null}
 */
function checkFileHeader(lines) {
  const firstKey = lines.findIndex((l) => l.keys.length > 0);
  if (firstKey === -1) return null;
  let maxRun = 0;
  let run = 0;
  for (let i = 0; i < firstKey; i++) {
    if (lines[i].isComment) {
      run++;
      if (run > maxRun) maxRun = run;
    } else {
      run = 0;
    }
  }
  if (maxRun < HEADER_MIN_COMMENT_LINES) {
    return { line: lines[firstKey].line, key: '(file-header)', reason: 'missing-file-header' };
  }
  return null;
}

/**
 * 判断某键行是否被注释覆盖（规则 2 的 a/b/c）。
 * @param {ReturnType<typeof tokenize>} lines 已结构化行
 * @param {number} i 当前行下标
 * @returns {boolean}
 */
function isCovered(lines, i) {
  const current = lines[i];
  if (current.trailing) return true;
  const prev = lines[i - 1];
  if (prev && prev.isComment) return true;
  let j = i - 1;
  let blanks = 0;
  while (j >= 0) {
    const probe = lines[j];
    if (probe.isComment) return true;
    if (probe.trimmed === '') {
      blanks++;
      if (blanks > MAX_GROUP_BLANK_LINES) return false;
      j--;
      continue;
    }
    if (probe.keys.length && probe.indent === current.indent) {
      j--;
      continue;
    }
    return false;
  }
  return false;
}

/**
 * 审计单个配置文本。
 * @param {string} text JSON5 原文
 * @param {{blockPolicy?: boolean}} [options] blockPolicy=true 时仅检查根级键（文案/映射表口径）
 * @returns {{violations: Array<{line:number,key:string,reason:string}>, keyCount:number, rootIndent:number}} violations 为空即通过
 */
function auditConfigText(text, options) {
  const opts = options || {};
  const lines = tokenize(text);
  const violations = [];
  const header = checkFileHeader(lines);
  if (header) violations.push(header);
  const objectKeys = lines.filter((l) => l.keys.length > 0 && !l.inArray);
  const keyCount = objectKeys.length;
  let rootIndent = Infinity;
  for (const l of objectKeys) rootIndent = Math.min(rootIndent, l.indent);
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    if (!current.keys.length || current.inArray) continue;
    if (opts.blockPolicy && current.indent !== rootIndent) continue;
    if (isCovered(lines, i)) continue;
    violations.push({ line: current.line, key: current.keys[0], reason: 'no-comment' });
  }
  return { violations, keyCount, rootIndent };
}

module.exports = {
  auditConfigText,
  tokenize,
  checkFileHeader,
  isCovered,
  scanLine,
  keysOnLine,
  HEADER_MIN_COMMENT_LINES,
  BLOCK_POLICY_FILES,
  ARRAY_ROW_POLICY,
  MAX_GROUP_BLANK_LINES,
};
