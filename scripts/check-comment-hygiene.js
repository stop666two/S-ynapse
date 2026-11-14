#!/usr/bin/env node
'use strict';
require('./lib/process-guard.js');

// 注释卫生门禁（规则 333/334）：注释只允许「代码说明」与「注意事项」。
//
// 禁止三类内容：
//   1) 流程标记：审查 / 评审 —— 评审编号与轮次是一次性协作产物，收口后不可查证，
//      也不反映代码当前是否成立；追溯信息应写进 CHANGELOG / 审查报告 / PR 描述。
//      「审计」「复核」作为**功能名**（无障碍审计、媒体审计）允许出现，不在此列。
//   2) 工单编号：裸 R-xx、issue #N、PR #N —— 同上。
//   3) 乱码：U+FFFD，以及 UTF-8 被按 GBK/CP936 解释后的特征串（写入链路猜过编码的痕迹）。
//
// 范围：源码/模板/配置/工作流（js/mjs/cjs/ejs/json5/yml/yaml/css/ts）。
// 豁免：docs/、README/CHANGELOG 等 Markdown、规则集自身（.opencode/）、构建产物。
//
// 退出码：0 = 干净；1 = 有违规（逐条打印 文件:行 与片段）。
const fs = require('fs');
const path = require('path');
const { listSourceFiles } = require('./lib/tracked-files');

const ROOT = path.resolve(__dirname, '..');
const EXTENSIONS = ['.js', '.mjs', '.cjs', '.ejs', '.json5', '.yml', '.yaml', '.css', '.ts'];
const EXCLUDE_DIRS = [
  'node_modules', '.git', 'dist', 'real-site', 'backups', 'build-artifacts',
  '.opencode', '.cache', '.tmp-scripts', '.playwright-mcp'
];

const RULES = [
  { kind: '流程标记', rx: /审查|评审/g, hint: '只写代码说明与注意事项；追溯信息放 CHANGELOG/PR/提交信息' },
  { kind: '工单编号', rx: /\bR-\d{2,}\b/g, hint: '不要引用审查编号；把原因本身写进注释' },
  { kind: '工单编号', rx: /\b(?:issue|pr)\s*#\d+/gi, hint: '不要引用 issue/PR 编号' },
  { kind: '乱码', rx: /\uFFFD/g, hint: '存在替换字符：写入链路编码被猜错过，需以 UTF-8 重新生成' },
  { kind: '乱码', rx: /[\u951b\u935c\u5a34\u9225\u9286\u9428\u93c3\u93c4\u6d63\u7487\u7ecb\u7f02\u5bee\u93ac\u65b0]{2,}/g, hint: '疑似 UTF-8 被按 GBK 写入的乱码' }
];

// 门禁自身与其夹具必须引用被禁模式（否则无法定义规则），与 check-config-refs.js
// 排除自身同理：显式登记两个文件，其余任何代码文件都不豁免。
const SELF_FILES = ['scripts/check-comment-hygiene.js', 'scripts/check-comment-hygiene.test.js'];

function inScope(rel) {
  if (!EXTENSIONS.some((ext) => rel.endsWith(ext))) return false;
  if (SELF_FILES.indexOf(rel) !== -1) return false;
  const segments = rel.split('/');
  return !segments.some((seg) => EXCLUDE_DIRS.indexOf(seg) !== -1);
}

// 纯函数：返回 [{ file, line, kind, snippet, hint }]
function findViolations(text, file) {
  const out = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const rule of RULES) {
      rule.rx.lastIndex = 0;
      const m = rule.rx.exec(line);
      if (!m) continue;
      const start = Math.max(0, m.index - 60);
      out.push({
        file: file,
        line: i + 1,
        kind: rule.kind,
        snippet: line.slice(start, Math.min(line.length, m.index + 60)).trim(),
        hint: rule.hint
      });
    }
  }
  return out;
}

function collectFiles() {
  // listSourceFiles 返回绝对路径（有 git 时来自 git ls-files，无 git 时来自遍历）：
  // 统一转成相对 ROOT 的 POSIX 路径再做范围判定与读取。
  const all = listSourceFiles(ROOT);
  return all
    .map((p) => path.relative(ROOT, String(p)).replace(/\\/g, '/'))
    .filter((rel) => rel && !rel.startsWith('..'))
    .filter(inScope);
}

function main() {
  const files = collectFiles();
  const violations = [];
  for (const rel of files) {
    let text;
    try { text = fs.readFileSync(path.join(ROOT, rel), 'utf-8'); } catch (err) { continue; }
    violations.push(...findViolations(text, rel));
  }
  if (violations.length) {
    console.error('[verify:comment-hygiene] FAIL：' + violations.length + ' 处注释不合规（扫描 ' + files.length + ' 个文件）');
    for (const v of violations.slice(0, 60)) {
      console.error('  ' + v.file + ':' + v.line + ' [' + v.kind + '] ' + v.snippet);
    }
    if (violations.length > 60) console.error('  … 其余 ' + (violations.length - 60) + ' 处省略');
    console.error('  规则 333：注释只写代码说明与注意事项；规则 334：禁止乱码。' + RULES[0].hint);
    process.exitCode = 1;
    return;
  }
  console.log('[verify:comment-hygiene] PASS：' + files.length + ' 个文件无审查/评审标记、无工单编号、无乱码');
}

module.exports = { findViolations, inScope, collectFiles };

if (require.main === module) main();
