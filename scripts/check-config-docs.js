#!/usr/bin/env node
'use strict';
// 配置文档完备性校验（check-config-docs）：对照 docs/config-reference.md 检查
// 全部 15 个 JSON5 配置（14 个站点配置 + internals.json5 工程内部参数）的键是否均有文档覆盖。
//
// 口径（显式声明，避免歧义）：
//   1) full 文件（site/theme/features/navigation/sidebar/footer/security/tuning/
//      guard/compression）：顶层键 + 模块键（顶层键的直接子键）均须在文档中以
//      标识符出现；允许出现在表格、代码块、反引号或 CSS 变量名（--分类-键）中。
//   2) data 文件（ui-strings/tag-aliases/friends/content-policy）：采用
//      「文件级章节存在 + 模块级标题（顶层键）存在」口径——这些是词典/数据表，
//      逐键在文档复述无意义，键名即文档（详见各文件顶部注释与 config-reference 对应章节）。
//   3) features 反查：文档中 `### 3.x <模块名>` 小节标题必须对应现存模块，
//      防止已删除模块的条目残留。
//   4) 每个配置文件须有 `## N. <文件名>.json5` 形式的文件级章节标题。
//
// 退出码：零缺失 → 0；否则打印缺失清单 → 1。

const fs = require('fs');
const path = require('path');
const json5 = require('json5');

const ROOT = path.resolve(__dirname, '..');
const DOC_PATH = path.join(ROOT, 'docs', 'config-reference.md');

const FILE_POLICIES = [
  { file: 'site', depth: 2 },
  { file: 'theme', depth: 2 },
  { file: 'features', depth: 2 },
  { file: 'navigation', depth: 2 },
  { file: 'sidebar', depth: 2 },
  { file: 'footer', depth: 2 },
  { file: 'security', depth: 2 },
  { file: 'tuning', depth: 2 },
  { file: 'guard', depth: 2 },
  { file: 'compression', depth: 2 },
  { file: 'internals', depth: 2 },
  { file: 'ui-strings', depth: 1 },
  { file: 'tag-aliases', depth: 1 },
  { file: 'friends', depth: 1 },
  { file: 'content-policy', depth: 1 }
];

// 数据文件（不属于 14 个 JSON5 配置，但属于站点默认体验数据）：只校验文档中存在
// `## N. data/<file>.json5` 文件级章节；逐字段语义由数据文件头部注释与章节内容承担。
const DATA_FILE_POLICIES = [
  { file: 'data/quotes.json5' }
];

function readJson5(file) {
  let raw = fs.readFileSync(file, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return json5.parse(raw);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 键名在文档中的出现判定：纯标识符按词边界（允许 - 前缀以匹配 --分类-键 变量名），
// 含特殊字符（如 X-Frame-Options）的键按键名字面量判定。
function keyAppears(text, key) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    const re = new RegExp('(?<![A-Za-z0-9_$])' + escapeRegExp(key) + '(?![A-Za-z0-9_$])');
    return re.test(text);
  }
  return text.includes(key);
}

// 收集待校验键路径：顶层键；depth>=2 时追加各模块键（对象值的第一层子键）。
function collectKeys(config, depth) {
  const top = Object.keys(config);
  const out = top.slice();
  if (depth >= 2) {
    for (const key of top) {
      const value = config[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        for (const child of Object.keys(value)) out.push(key + '.' + child);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 文档作用域：键必须落在「自己的模块」范围里才算覆盖。
// 旧实现只把键路径最后一段叶子名丢进全文匹配，于是任何角落出现的 `enabled` 都能替
// `features.lightbox.enabled` 作证；矩阵文档里同一叶子的重复键因此互相顶替。
// 现口径（三条任一即可）：
//   1) 全文出现完整键路径（`lightbox.zoomStep`）；
//   2) 叶名在全站配置集合中唯一 → 全文出现该叶名即无歧义（如 `containerWidth`）；
//   3) 叶名在「所属模块」的文档作用域内出现：模块小节（###/#### 标题含模块名）内任意
//      位置，或（无模块小节时）文件小节内同一行同时出现模块名与叶名。
// ---------------------------------------------------------------------------
function parseHeadings(lines) {
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{2,4})\s+(.*)$/.exec(lines[i]);
    if (!match) continue;
    headings.push({ level: match[1].length, text: match[2].trim(), line: i });
  }
  return headings;
}

function sectionEnd(model, index, limit) {
  for (let i = index + 1; i < model.headings.length; i++) {
    if (model.headings[i].level <= model.headings[index].level) return model.headings[i].line;
  }
  return limit;
}

function fileSection(model, file) {
  const re = new RegExp('^\\d+\\.\\s.*' + escapeRegExp(file) + '\\.json5');
  for (let i = 0; i < model.headings.length; i++) {
    const heading = model.headings[i];
    if (heading.level === 2 && re.test(heading.text)) {
      return { start: heading.line, end: sectionEnd(model, i, model.lines.length) };
    }
  }
  return null;
}

function moduleSection(model, scope, moduleName) {
  if (!scope) return null;
  for (let i = 0; i < model.headings.length; i++) {
    const heading = model.headings[i];
    if (heading.level < 3 || heading.line < scope.start || heading.line >= scope.end) continue;
    if (!keyAppears(heading.text, moduleName)) continue;
    return { start: heading.line, end: sectionEnd(model, i, scope.end) };
  }
  return null;
}

// 文档习惯用斜杠省略公共前缀（`build.minifyHTML/CSS/JS`、`fontSystem.stack/displayStack`）。
// 机械展开：斜杠组第一个词按 camelCase 边界切出前缀，再与后续每一支组合，得到候选键名。
function slashExpansions(line) {
  const out = new Set();
  const runRe = /[A-Za-z_$][\w$.-]*(?:\/[A-Za-z_$][\w$.-]*)+/g;
  let match;
  while ((match = runRe.exec(line)) !== null) {
    const parts = match[0].split('/');
    const first = parts[0].split('.').pop();
    const prefixes = [first];
    for (let i = 1; i < first.length; i++) {
      if (/[a-z]/.test(first[i - 1]) && /[A-Z]/.test(first[i])) prefixes.push(first.slice(0, i));
    }
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].split('.').pop();
      out.add(part);
      for (const prefix of prefixes) out.add(prefix + part);
    }
  }
  return out;
}

function lineHasKey(line, key) {
  if (keyAppears(line, key)) return true;
  if (line.indexOf('/') < 0) return false;
  return slashExpansions(line).has(key);
}

function buildDocModel(docText) {
  const lines = docText.replace(/\r\n/g, '\n').split('\n');
  return { docText, lines, headings: parseHeadings(lines) };
}

// 键是否被文档覆盖（不再是「全文出现叶名」）。
function keyCovered(model, file, keyPath, leafCounts) {
  if (keyAppears(model.docText, keyPath)) return true;
  const segments = keyPath.split('.');
  const leaf = segments[segments.length - 1];
  // 顶层键与全站唯一叶名：本身即无歧义，全文出现即可
  if (segments.length === 1) return lineHasKey(model.docText, leaf);
  if ((leafCounts.get(leaf) || 0) === 1) return lineHasKey(model.docText, leaf);
  const fileScope = fileSection(model, file);
  const moduleScope = moduleSection(model, fileScope, segments[0]);
  const scope = moduleScope || fileScope;
  if (!scope) return false;
  const scopedLines = model.lines.slice(scope.start, scope.end);
  if (moduleScope) return scopedLines.some((line) => lineHasKey(line, leaf));
  // 没有模块小节（压缩成一张总表）：同一行必须同时出现模块名与叶名
  return scopedLines.some((line) => keyAppears(line, segments[0]) && lineHasKey(line, leaf));
}

function checkDocs({ root = ROOT, docText } = {}) {
  const doc = docText !== undefined ? docText : fs.readFileSync(DOC_PATH, 'utf-8');
  const model = buildDocModel(doc);
  const missing = [];
  const missingSections = [];
  const staleModules = [];
  let checked = 0;

  // 先收敛全站叶名出现次数：出现一次以上即为歧义叶名，必须靠模块作用域或完整路径作证
  const leafCounts = new Map();
  for (const policy of FILE_POLICIES) {
    const filePath = path.join(root, policy.file + '.json5');
    if (!fs.existsSync(filePath)) continue;
    for (const keyPath of collectKeys(readJson5(filePath), policy.depth)) {
      const leaf = keyPath.split('.').pop();
      leafCounts.set(leaf, (leafCounts.get(leaf) || 0) + 1);
    }
  }

  for (const policy of FILE_POLICIES) {
    const filePath = path.join(root, policy.file + '.json5');
    if (!fs.existsSync(filePath)) {
      missingSections.push(policy.file + '.json5（文件不存在）');
      continue;
    }
    const config = readJson5(filePath);
    const sectionRe = new RegExp('^## \\d+\\. .*' + escapeRegExp(policy.file) + '\\.json5', 'm');
    if (!sectionRe.test(doc)) missingSections.push(policy.file + '.json5');
    const keys = collectKeys(config, policy.depth);
    checked += keys.length;
    for (const keyPath of keys) {
      // 按完整键路径 / 全站唯一叶名 / 所属模块作用域判定，不再全文找叶名
      if (!keyCovered(model, policy.file, keyPath, leafCounts)) missing.push(policy.file + '.' + keyPath);
    }
    if (policy.file === 'features') {
      for (const match of doc.matchAll(/^### 3\.\d+ ([A-Za-z][A-Za-z0-9_]*)/gm)) {
        if (!Object.prototype.hasOwnProperty.call(config, match[1])) staleModules.push(match[1]);
      }
    }
  }
  for (const policy of DATA_FILE_POLICIES) {
    const filePath = path.join(root, policy.file);
    if (!fs.existsSync(filePath)) {
      missingSections.push(policy.file + '（文件不存在）');
      continue;
    }
    const sectionRe = new RegExp('^## \\d+\\. .*' + escapeRegExp(policy.file), 'm');
    if (!sectionRe.test(doc)) missingSections.push(policy.file);
  }
  return { checked, missing, missingSections, staleModules };
}

function main() {
  const result = checkDocs();
  console.log('[check-config-docs] 解析 15 个 JSON5：full 文件 11 个（顶层+模块键；含 internals.json5 工程内部参数）、data 文件 4 个（章节+模块标题）；' +
    '外加 data 数据文件 ' + DATA_FILE_POLICIES.length + ' 个（章节存在性）；共校验 ' + result.checked + ' 个键');
  const failed = result.missing.length > 0 || result.missingSections.length > 0 || result.staleModules.length > 0;
  if (result.missingSections.length) {
    console.error('[check-config-docs] 缺少文件级章节（## N. <文件>.json5）：');
    for (const item of result.missingSections) console.error('  - ' + item);
  }
  if (result.missing.length) {
    console.error('[check-config-docs] 发现 ' + result.missing.length + ' 个未覆盖键（docs/config-reference.md）：');
    for (const key of result.missing) console.error('  - ' + key);
  }
  if (result.staleModules.length) {
    console.error('[check-config-docs] 文档残留已删除的 features 模块小节：');
    for (const item of result.staleModules) console.error('  - features.' + item);
  }
  if (failed) {
    console.error('[check-config-docs] FAIL：请补齐上述章节/键或移除残留小节后重跑。');
    process.exitCode = 1;
    return;
  }
  console.log('[check-config-docs] PASS：15 个配置文件的键均已在 docs/config-reference.md 覆盖，且无残留模块小节');
}

if (require.main === module) main();

module.exports = { collectKeys, keyAppears, buildDocModel, keyCovered, checkDocs, FILE_POLICIES, DATA_FILE_POLICIES };
