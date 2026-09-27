#!/usr/bin/env node
'use strict';
// 配置文档完备性校验（check-config-docs）：对照 docs/config-reference.md 检查
// 全部 14 个 JSON5 配置文件的键是否均有文档覆盖。
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
function keyAppears(docText, key) {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    const re = new RegExp('(?<![A-Za-z0-9_$])' + escapeRegExp(key) + '(?![A-Za-z0-9_$])');
    return re.test(docText);
  }
  return docText.includes(key);
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

function moduleNameOf(keyPath) {
  return keyPath.includes('.') ? keyPath.split('.').pop() : keyPath;
}

function checkDocs({ root = ROOT, docText } = {}) {
  const doc = docText !== undefined ? docText : fs.readFileSync(DOC_PATH, 'utf-8');
  const missing = [];
  const missingSections = [];
  const staleModules = [];
  let checked = 0;

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
      if (!keyAppears(doc, moduleNameOf(keyPath))) missing.push(policy.file + '.' + keyPath);
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
  console.log('[check-config-docs] 解析 14 个 JSON5：full 文件 10 个（顶层+模块键）、data 文件 4 个（章节+模块标题）；' +
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
  console.log('[check-config-docs] PASS：14 个配置文件的键均已在 docs/config-reference.md 覆盖，且无残留模块小节');
}

if (require.main === module) main();

module.exports = { collectKeys, keyAppears, moduleNameOf, checkDocs, FILE_POLICIES, DATA_FILE_POLICIES };
