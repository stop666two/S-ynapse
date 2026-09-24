// config-error.js — returns a fully-formatted, actionable error report for
// JSON5 parse failures (file, line/column, context with caret, cause, hint).
// Pure function (only reads options.files when provided), unit-testable.

function formatConfigError(filename, err, opts) {
  opts = opts || {};
  const rawMessage = (err && err.message) || String(err);
  const lines = [];
  if (opts.fileText) {
    lines.push.apply(lines, opts.fileText.replace(/\r\n/g, '\n').split('\n'));
  }
  let line = err && err.lineNumber;
  let column = err && err.columnNumber;
  if (line == null || column == null) {
    let posMatch = /line (\d+)(?:,?\s*column (\d+))?/i.exec(rawMessage);
    if (!posMatch) posMatch = /at (\d+):(\d+)/i.exec(rawMessage);
    if (posMatch) {
      line = parseInt(posMatch[1], 10);
      column = posMatch[2] ? parseInt(posMatch[2], 10) : null;
    }
  }
  const causeMatch = /(JSON5:?|Expecting|missing|unexpected|invalid|leftover|Unexpected end|unterminated)[^\n]*/i.exec(rawMessage);
  const cause = causeMatch ? causeMatch[0] : rawMessage;
  /** @type {Array<[RegExp, string]>} */
  const hintMap = [
    [/missing comma|Expecting .*after|invalid character/i, '常见原因：对象/数组元素之间少了逗号，或引号未闭合（JSON5 字符串建议使用双引号）。'],
    [/unterminated string|Unexpected end/i, '常见原因：字符串引号未闭合（双引号被误写或缺失）或 JSON5 注释未闭合。'],
    [/unexpected token|invalid character/i, '常见原因：值为字符串时缺少引号，或逗号后出现非法字符。'],
    [/leftover text|Unexpected token'\]'/i, '常见原因：多余逗号后的内容、或花括号配对错误。']
  ];
  let hint = '请检查该行附近语法（字段名冒号、引号、逗号、括号配对）。';
  for (const [re, text] of hintMap) {
    if (re.test(cause)) { hint = text; break; }
  }
  const context = [];
  if (line != null) {
    const from = Math.max(1, line - 2);
    const to = Math.min(lines.length, line + 2);
    for (let i = from; i <= to; i++) {
      const num = String(i).padStart(3, ' ');
      const marker = i === line && column != null
        ? ' ' + ' '.repeat(Math.max(0, Math.min(column - 1, (lines[i - 1] || '').length))) + '^'
        : (i === line ? ' ^' : '');
      context.push(`    ${num} | ${lines[i - 1] || ''}${marker}`);
    }
  }
  const parts = [
    '',
    '  ============================================================',
    `  [FATAL] 配置文件解析失败: ${filename}`,
    `  位置    : ${opts.filePath || filename}${line != null ? ` 第 ${line} 行` : ''}${column != null ? ` 第 ${column} 列` : ''}`,
    `  原因    : ${cause}`,
    '  上下文  :'
  ];
  for (const c of context) parts.push(c);
  parts.push(`  提示    : ${hint}`);
  parts.push('  ============================================================');
  return parts.join('\n');
}

module.exports = { formatConfigError };
