#!/usr/bin/env node
'use strict';

// 工程内部参数守卫（verify:internals）：
//   1. .nvmrc 存在且与 internals.ci.nodeVersion 一致（CI 用 node-version-file 读它）；
//   2. workers/wrangler.toml 的 [assets] directory 解析后与 internals.deploy.workerAssetsDir 一致；
//   3. CI 兼容任务（deploy.yml compat-node20）的 node-version 与 internals.ci.compatNodeVersion 一致；
//      派生副本（SYNAPSE_DERIVED_COPY=1）自带 CI 配置（.github 不随主仓同步），跳过本项；
//   4. 关键写死形态已消失（抽样正则，防止回退成双源字面量）。
// 退出码：全部通过 → 0；任一失败 → 1（打印逐条原因）。

const fs = require('fs');
const path = require('path');
const { loadInternals } = require('./lib/internals');

const ROOT = path.resolve(__dirname, '..');
const DERIVED_COPY = process.env.SYNAPSE_DERIVED_COPY === '1';
const failures = [];

function read(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
  } catch (err) {
    failures.push(rel + '：无法读取（' + err.message + '）');
    return '';
  }
}

function normalizeVersion(text) {
  return String(text).trim().replace(/^v/i, '');
}

function checkNvmrc(internals) {
  const file = path.join(ROOT, '.nvmrc');
  if (!fs.existsSync(file)) {
    failures.push('.nvmrc：文件缺失（CI 依赖 node-version-file 读取）');
    return;
  }
  const actual = normalizeVersion(fs.readFileSync(file, 'utf-8'));
  const expected = normalizeVersion(internals.ci.nodeVersion);
  if (actual !== expected) {
    failures.push('.nvmrc：内容 "' + actual + '" 与 internals.ci.nodeVersion "' + expected + '" 不一致');
  }
}

// 解析 wrangler.toml 的 [assets] 段 directory（相对 wrangler.toml 所在目录解析），
// 与 internals.deploy.workerAssetsDir（相对仓库根）比对为同一实际目录。
function readWranglerAssetsDir() {
  const text = read(path.join('workers', 'wrangler.toml'));
  const lines = text.split(/\r?\n/);
  let inAssets = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (/^\[[^\]]+\]$/.test(line)) {
      inAssets = line === '[assets]';
      continue;
    }
    if (!inAssets) continue;
    const match = /^directory\s*=\s*["']([^"']+)["']/.exec(line);
    if (match) return match[1];
  }
  return '';
}

function checkWranglerAssets(internals) {
  const raw = readWranglerAssetsDir();
  if (!raw) {
    failures.push('workers/wrangler.toml：[assets] directory 缺失或不可解析');
    return;
  }
  const actual = path.resolve(ROOT, 'workers', raw);
  const expected = path.resolve(ROOT, internals.deploy.workerAssetsDir);
  if (actual !== expected) {
    failures.push('workers/wrangler.toml：[assets] directory "' + raw + '"（解析为 ' + actual + '）与 internals.deploy.workerAssetsDir "' + internals.deploy.workerAssetsDir + '"（' + expected + '）不一致；部署前必须对齐构建输出目录');
  }
}

// 定位 index 所在行所属 YAML step 块的边界：向后找缩进更浅且以 "- " 开头的行作为块起点，
// 向前找同级或更浅的下一个 "- "（或更浅的键）作为块终点。只服务于本文件的结构断言，
// 不做完整 YAML 解析——被检查的是仓库内固定工作流，不是任意输入。
function findStepBlock(lines, index) {
  const indentOf = (line) => line.match(/^\s*/)[0].length;
  const runIndent = indentOf(lines[index]);
  let start = index;
  for (let i = index - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\s*-\s/.test(line) && indentOf(line) < runIndent) { start = i; break; }
  }
  const stepIndent = indentOf(lines[start]);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = indentOf(line);
    if (indent < stepIndent) { end = i; break; }
    if (/^\s*-\s/.test(line) && indent <= stepIndent) { end = i; break; }
  }
  return { start, end, block: lines.slice(start, end) };
}

// 审查 R-38：夜跑 job 的超时预算必须覆盖聚合器的最坏情况（检查项数 × internals.ci.checkTimeoutMs）。
// 硬编码的 timeout-minutes 会随 checkTimeoutMs 或检查项数增长而落后，落后后慢夜被平台杀掉，
// 报告写入 / ci/aggregate 状态 / if: always() 工件全部来不及执行——恰好丢掉夜跑要保留的证据。
function countAggregateChecks() {
  let text;
  try {
    text = fs.readFileSync(path.join(ROOT, 'scripts', 'ci-checks.js'), 'utf-8');
  } catch (err) {
    failures.push('scripts/ci-checks.js：无法读取（' + err.message + '），无法核算夜跑超时预算');
    return 0;
  }
  const start = text.indexOf('const CHECKS = [');
  if (start === -1) {
    failures.push('scripts/ci-checks.js：未找到 `const CHECKS = [`，无法核算夜跑超时预算');
    return 0;
  }
  const end = text.indexOf('\n];', start);
  if (end === -1) {
    failures.push('scripts/ci-checks.js：CHECKS 数组未闭合，无法核算夜跑超时预算');
    return 0;
  }
  return (text.slice(start, end).match(/name:\s*'/g) || []).length;
}

function readJobTimeout(file, jobName) {
  const lines = read(file).split(/\r?\n/);
  const jobHeader = new RegExp('^\\s{2}' + jobName + ':\\s*$');
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (jobHeader.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return { found: false, minutes: null };
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\s{2}\S/.test(line)) break;   // 出现同级键/下一个 job → 当前 job 结束
    const m = line.match(/^\s{4}timeout-minutes:\s*(\d+)\s*$/);
    if (m) return { found: true, minutes: Number(m[1]) };
  }
  return { found: false, minutes: null };
}

function checkNightlyBudget(internals) {
  const checks = countAggregateChecks();
  const perCheckMs = Number(internals.ci.checkTimeoutMs);
  if (!checks || !(perCheckMs > 0)) return;
  const requiredMinutes = Math.ceil((checks * perCheckMs) / 60000) + 30;   // 30min 缓冲：构建环境准备 + 报告写入
  const nightly = readJobTimeout('.github/workflows/nightly.yml', 'deep');
  if (!nightly.found) {
    failures.push('nightly.yml：nightly 作业（job `deep`）缺少显式 timeout-minutes；最坏预算 ' + requiredMinutes + 'min（' + checks + ' 项 × ' + perCheckMs + 'ms + 缓冲）');
  } else if (nightly.minutes < requiredMinutes) {
    failures.push('nightly.yml：job `deep` 的 timeout-minutes (' + nightly.minutes + ') 小于聚合器最坏预算 ' + requiredMinutes + 'min（' + checks + ' 项 × internals.ci.checkTimeoutMs ' + perCheckMs + 'ms + 30min 缓冲）；慢夜会被杀掉而丢掉报告与工件');
  }
}

function checkDeployWorkflow(internals) {
  const deployYml = read(path.join('.github', 'workflows', 'deploy.yml'));
  const deployYmlLines = deployYml.split(/\r?\n/);
  const compatToken = 'node-version: ' + internals.ci.compatNodeVersion;
  const compatPattern = new RegExp('node-version:\\s*[\'"]?' + internals.ci.compatNodeVersion.replace(/\./g, '\\.') + '[\'"]?');
  if (!compatPattern.test(deployYml)) {
    failures.push('deploy.yml：compat 任务未声明 node-version "' + internals.ci.compatNodeVersion + '"（须与 internals.ci.compatNodeVersion 一致）');
  }
  if (compatToken && !deployYml.includes('node-version-file: .nvmrc')) {
    failures.push('deploy.yml：主任务应使用 node-version-file: .nvmrc（由 .nvmrc/internals 单源控制版本）');
  }
  // 审查 R-34：此前只用 includes('node scripts/ci-checks.js') 做子串判断，把该步骤改成
  // `run: node scripts/ci-checks.js || true` 或加 `continue-on-error: true` / `if:` 后
  // verify:internals 仍然 PASS，而 lint/typecheck/测试/配置门禁/安全验证/构建全部不再阻断。
  // 这是单一事实源体系唯一的外部锚点，因此按 YAML 结构断言该 step 的 run 与两个失效开关。
  const aggregateRun = /^\s*run:\s*node scripts\/ci-checks\.js\s*$/;
  const runIndex = deployYmlLines.findIndex((line) => aggregateRun.test(line));
  if (runIndex === -1) {
    failures.push('deploy.yml：聚合检查器的 run 必须恰好是 `run: node scripts/ci-checks.js`（不接受 `|| true`、多命令或附加参数——那会让全部门禁静默失效）');
  } else {
    const step = findStepBlock(deployYmlLines, runIndex);
    if (step.block.some((line) => /^\s*continue-on-error:\s*true\s*$/.test(line))) {
      failures.push('deploy.yml：聚合门禁步骤不得设置 continue-on-error: true（会使 lint/测试/构建等全部门禁不再阻断）');
    }
    if (step.block.some((line) => /^\s*if:/.test(line))) {
      failures.push('deploy.yml：聚合门禁步骤不得附加 if 条件（可使其被条件跳过）');
    }
    if (!/^\s*-\s*name:/.test(step.block[0] || '')) {
      failures.push('deploy.yml：聚合门禁步骤必须保留具名 step（便于日志定位与本节结构断言）');
    }
  }
  if (!deployYml.includes('ci-checks')) {
    failures.push('deploy.yml：未上传 ci-checks 工件');
  }
}

// 抽样正则：这些写死形态必须已迁移到 internals/features/site 单源，禁止回退。
const LITERAL_GUARDS = [
  { file: 'scripts/a11y-audit.js', pattern: /Program Files[\\/]Google[\\/]Chrome/, label: 'Chrome 安装路径' },
  { file: 'scripts/perf-audit.js', pattern: /Program Files[\\/]Google[\\/]Chrome/, label: 'Chrome 安装路径' },
  { file: 'scripts/build/serve.js', pattern: /\|\|\s*3000\b/, label: 'serve 默认端口字面量' },
  { file: 'js/core/runtime.js', pattern: /\|\|\s*3000\b/, label: '配置超时兜底字面量' },
  { file: 'js/core/soft-nav.js', pattern: /300000/, label: '软导航缓存 TTL 字面量' },
  { file: 'js/core/soft-nav.js', pattern: /CACHE_MAX_FALLBACK\s*=\s*16/, label: '软导航缓存容量字面量' },
  { file: 'scripts/export.js', pattern: /'s-ynapse-backup'/, label: '导出前缀字面量' },
  { file: 'scripts/build/minify.js', pattern: /!==\s*'sw\.js'/, label: 'SW 固定文件名字面量' },
  { file: 'scripts/build/minify.js', pattern: /icon-\(192\|512\)/, label: 'PWA 图标名正则字面量' },
  { file: 'scripts/lib/pwa-sw.js', pattern: /'s-ynapse'/, label: 'SW 缓存基名字面量' },
  { file: 'scripts/release-prune.js', pattern: /RELEASE_LIST_LIMIT\s*=\s*200/, label: 'Release 列表上限字面量' },
  { file: 'scripts/dist-hash-guard.js', pattern: /PREVIEW_LIMIT\s*=\s*20/, label: 'diff 预览上限字面量' },
  { file: 'scripts/build/report.js', pattern: /#(?:16a34a|d97706)/i, label: '报告状态色字面量' },
  { file: 'scripts/build/report.js', pattern: /slice\(0,\s*10\)/, label: '报告 topN 字面量' },
  { file: 'scripts/build/helpers.js', pattern: /#fff\b/i, label: 'favicon 兜底颜色字面量' },
  { file: 'package.json', pattern: /--project-name=s-ynapse/, label: 'Pages 项目名字面量' },
  { file: 'package.json', pattern: /--port\s+3000/, label: 'serve 端口字面量' },
  { file: 'scripts/ci-checks.js', pattern: /node-version/, label: 'CI Node 版本字面量（应由 .nvmrc/internals 单源控制）' }
];

function checkLiteralGuards() {
  for (const guard of LITERAL_GUARDS) {
    const text = read(guard.file);
    if (guard.pattern.test(text)) {
      failures.push(guard.file + '：仍存在' + guard.label + '（' + guard.pattern + '），应改为 internals 单源');
    }
  }
}

// 审查 R-44：docs/architecture.md 的「规模口径」此前只能靠人工审查发现漂移
// （scripts/lib 76 → 78 → 82，实际已 83；同名单测也写错）。这里按目录实况校验，
// 任一处对不上即失败；数字被删除（正则不命中）同样失败，避免「删掉就不漂」。
function listJs(rel) {
  return fs.readdirSync(path.join(ROOT, rel)).filter((f) => f.endsWith('.js'));
}

function architectureActual() {
  const libFiles = listJs(path.join('scripts', 'lib'));
  const libTests = libFiles.filter((f) => f.endsWith('.test.js'));
  const sameName = libTests.filter((t) => fs.existsSync(path.join(ROOT, 'scripts', 'lib', t.replace(/\.test\.js$/, '.js'))));
  const count = (rel) => listJs(rel).length;
  return {
    libTotal: libFiles.length,
    libImpl: libFiles.length - libTests.length,
    libTests: libTests.length,
    libSameName: sameName.length,
    core: count(path.join('js', 'domains', 'core')),
    features: count(path.join('js', 'domains', 'features')),
    guard: count(path.join('js', 'domains', 'guard')),
    buildModules: count(path.join('scripts', 'build'))
  };
}

function architectureCountRules() {
  const a = architectureActual();
  const domains = a.core + a.features + a.guard;
  return [
    {
      label: 'scripts/lib 规模口径（文件/实现/测试）',
      pattern: /(\d+)\s*个文件：(\d+)\s*份实现\s*\+\s*(\d+)\s*份测试/,
      expected: [a.libTotal, a.libImpl, a.libTests]
    },
    {
      label: '分层图 scripts/lib 文件数',
      pattern: /scripts\/lib\/\*（(\d+)\s*文件/,
      expected: [a.libTotal]
    },
    {
      label: '同名单测数',
      pattern: /其中\s*(\d+)\s*份为同名单测/,
      expected: [a.libSameName]
    },
    {
      label: '前端领域模块分布（总数/core/features/guard）',
      pattern: /(\d+)\s*个前端领域模块（core\s*(\d+)\s*\/\s*features\s*(\d+)\s*\/\s*guard\s*(\d+)/,
      expected: [domains, a.core, a.features, a.guard]
    },
    {
      label: 'scripts/build 模块数',
      pattern: /构建模块（(\d+)\s*个/,
      expected: [a.buildModules]
    }
  ];
}

function checkArchitectureCounts() {
  const text = read('docs/architecture.md');
  if (!text) return; // read() 已记录「无法读取」；归档内 docs/ 不入包，与 .github 同源处理
  for (const rule of architectureCountRules()) {
    const m = rule.pattern.exec(text);
    if (!m) {
      failures.push('docs/architecture.md：未找到' + rule.label + '（口径被删除也会失败）');
      continue;
    }
    const actual = m.slice(1).map(Number);
    const mismatch = actual.some((v, i) => v !== rule.expected[i]);
    if (mismatch) {
      failures.push(
        'docs/architecture.md：' + rule.label + ' 写 ' + actual.join(' / ') +
          '，实际 ' + rule.expected.join(' / ')
      );
    }
  }
}

// 审查 R-04 / R-39 的结构性回归守卫：此前这两类只能靠人工 grep
// （「所有 uses 是否锁 SHA」「run: 里有没有直接内插可注入表达式」）。
// 这里解析全部 workflow，不依赖具体文件/行号，新增工作流自动纳入。
const SHA40 = /^[0-9a-f]{40}$/;
// 只有「字符串类」事件字段可注入 shell：message/title/body/email/head_ref/ref_name/inputs。
// SHA、ref 路径（github.sha / event.before / *.base.sha）是受限字符集，允许。
const INJECTABLE_IN_RUN =
  /\$\{\{\s*(?:github\.head_ref|github\.ref_name|inputs\.[\w.-]+|github\.event\.[\w.]*(?:message|title|body|email)|github\.event\.pull_request\.head\.(?:ref|label))/i;

function runBlocksOf(lines) {
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*)(?:-\s*)?run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const rest = m[2].trim();
    if (rest !== '|' && rest !== '>' && rest !== '|-' && rest !== '>-') {
      blocks.push({ start: i, text: rest });
      continue;
    }
    const indent = m[1].length;
    let end = i + 1;
    while (end < lines.length) {
      const line = lines[end];
      if (line.trim() === '') { end += 1; continue; }
      if (line.length - line.trimStart().length <= indent) break;
      end += 1;
    }
    blocks.push({ start: i, text: lines.slice(i + 1, end).join('\n') });
    i = end - 1;
  }
  return blocks;
}

// 权限最小化白名单：写权限按 scope 逐项登记到具体工作流。新增任何 write scope
// （id-token、pull-requests、packages…）都必须先改这里并说明用途，避免权限蔓延。
const WRITE_SCOPE_ALLOWLIST = {
  contents: ['release.yml', 'release-notes.yml'],
  statuses: ['deploy.yml', 'nightly.yml']
};
// 会发版的工作流必须有并发组：两条并行发布流会各自创建/清理 Release 与 Pages 产物。
const CONCURRENCY_REQUIRED = ['deploy.yml', 'release.yml'];

function checkWorkflowHygiene() {
  const dir = path.join(ROOT, '.github', 'workflows');
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  } catch (err) {
    failures.push('.github/workflows：无法读取（' + err.message + '）');
    return;
  }
  for (const file of files) {
    const text = read(path.join('.github', 'workflows', file));
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const m = /^\s*(?:-\s*)?uses:\s*(\S+)/.exec(line);
      if (!m) return;
      const ref = m[1];
      if (/^\.\//.test(ref) || /^docker:\/\//.test(ref)) return;
      const at = ref.lastIndexOf('@');
      const sha = at === -1 ? '' : ref.slice(at + 1);
      if (!SHA40.test(sha)) {
        failures.push(file + ':' + (index + 1) + '：uses 未锁定 40 位 commit SHA（可被上游重指）→ ' + ref);
      }
    });
    for (const block of runBlocksOf(lines)) {
      const hit = INJECTABLE_IN_RUN.exec(block.text);
      if (hit) {
        failures.push(
          file + ':' + (block.start + 1) + '：run 脚本直接内插可注入表达式 ' + hit[0] +
            '（应经 env: 传入后引用 "$VAR"，否则贡献者可控字符串会进入 shell）'
        );
      }
    }
    lines.forEach((line, index) => {
      if (/^\s*permissions:\s*write-all\s*$/.test(line)) {
        failures.push(file + ':' + (index + 1) + '：不得使用 permissions: write-all（按 scope 逐项授权）');
      }
      const scope = /^\s*([a-z-]+):\s*write\s*$/.exec(line);
      if (!scope) return;
      const allowed = WRITE_SCOPE_ALLOWLIST[scope[1]];
      if (!allowed || allowed.indexOf(file) === -1) {
        failures.push(
          file + ':' + (index + 1) + '：权限 ' + scope[1] + ': write 未在 check-internals 白名单登记' +
            '（如确需，请连同用途一起加进 WRITE_SCOPE_ALLOWLIST）'
        );
      }
    });
    if (CONCURRENCY_REQUIRED.indexOf(file) !== -1 && !/^concurrency:/m.test(text)) {
      failures.push(file + '：缺少顶层 concurrency（并发发布/部署会互相覆盖产物）');
    }
  }
}

function main() {
  let internals;
  try {
    internals = loadInternals();
  } catch (err) {
    console.error('[verify:internals] ' + err.message);
    process.exit(1);
  }
  checkNvmrc(internals);
  checkWranglerAssets(internals);
  if (DERIVED_COPY) {
    console.log('[verify:internals] 派生副本：跳过 deploy.yml / workflow 卫生 / 文档规模口径检查（.github 与 docs 不随主仓同步）');
  } else {
    checkDeployWorkflow(internals);
    checkNightlyBudget(internals);
    checkWorkflowHygiene();
    // docs/** 与 .github/** 都不入发布归档：派生副本里没有这些文件，
    // 与其他仓库形态检查同源跳过（否则归档内 verify:internals 必然红）。
    checkArchitectureCounts();
  }
  checkLiteralGuards();

  if (failures.length) {
    console.error('[verify:internals] FAIL：' + failures.length + ' 项：');
    for (const item of failures) console.error('  - ' + item);
    process.exit(1);
  }
  console.log('[verify:internals] PASS：.nvmrc / wrangler assets / CI 版本 / 关键写死形态 / 文档规模口径 / workflow 卫生（SHA 固定·注入面·写权限·并发组） 均与 internals 一致');
}

if (require.main === module) main();

module.exports = { checkNvmrc, checkWranglerAssets, checkDeployWorkflow, checkLiteralGuards, checkArchitectureCounts, checkWorkflowHygiene, LITERAL_GUARDS };
