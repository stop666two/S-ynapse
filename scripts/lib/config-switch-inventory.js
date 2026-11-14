'use strict';

// 配置开关盘点与测试覆盖矩阵（单一实现）：
//   - 开关全集 = features/tuning/site/internals 注册表中的布尔、枚举与数值叶子；
//   - 消费位置 = 按「叶子键 + 最近父段」评分定位的首个源码引用（file:line），供人工复核；
//   - 覆盖证据 = 测试文件中的 `// switch: <键路径>` 标记 > 既有测试键名引用 > 豁免登记。
// scripts/gen-config-switch-matrix.js 生成文档，scripts/check-config-single-source.js 校验。
//
// 证据口径（旧实现「文本里出现过就算覆盖」，门禁可自证）：
//   - marker 必须绑定到某个含断言的 `test()/it()` 回调：落在回调体内，或紧贴在该回调
//     之前（中间只有空行/注释行）；写在 describe 体内、文件任意位置的注释不再算覆盖；
//   - 索引先净化源码（注释与字符串字面量置空），键名出现在注释/文案里不构成「既有引用」；
//   - 既有引用还必须满足：所属模块名出现在命中行 ±2 行窗口内，且命中行落在 test 回调体内，
//     仅靠同名叶子 token（enabled/width…）不再算覆盖。

const fs = require('fs');
const path = require('path');
const { DEFAULT_FEATURES, ENUM_FIELDS } = require('./features-schema.js');
const { DEFAULT_TUNING } = require('./tuning-defaults.js');
const { DEFAULT_CONFIG } = require('./site-defaults.js');
const { DEFAULTS: INTERNAL_DEFAULTS } = require('./internals-defaults.js');

const ROOT = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['js', 'templates', 'scripts', 'workers'];
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'real-site', '.tmp-scripts', '.cache', 'build-artifacts']);
const SOURCE_EXCLUDE_FILES = new Set([
  'features-schema.js', 'site-defaults.js', 'tuning-defaults.js', 'guard-defaults.js',
  'internals-defaults.js', 'check-config-refs.js',
  'config-switch-exemptions.json', 'config-fallback-bindings.json'
]);

const SWITCH_MARKER_RE = /\/\/\s*switch:\s*([A-Za-z0-9_.-]+(?:\s*,\s*[A-Za-z0-9_.-]+)*)/g;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// 扫描源：优先取 Git 跟踪文件（干净检出与本地一致，排除 gitignore 构建产物）；
// 无 .git 环境（发布归档）回退到目录遍历——归档本身只含跟踪文件，结果等价。
function listFiles() {
  try {
    const out = require('child_process').execSync('git ls-files -z -- ' + SCAN_DIRS.join(' '), {
      cwd: ROOT,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const tracked = out.toString('utf8').split('\0').filter(Boolean).map(function (p) {
      return path.join(ROOT, p);
    });
    if (tracked.length > 0) return tracked;
  } catch (error) {
    // 无 git 可用时走目录遍历回退
  }
  const files = [];
  for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir), files);
  sortNormalized(files);
  return files;
}

// 统一按「/ 分隔的相对路径」排序，消除平台分隔符与文件系统枚举顺序差异
function sortNormalized(files) {
  files.sort(function (a, b) {
    const na = a.split(path.sep).join('/');
    const nb = b.split(path.sep).join('/');
    return na < nb ? -1 : na > nb ? 1 : 0;
  });
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (error) { return out; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (/\.(js|mjs|ejs|cjs)$/i.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function walkLeaves(obj, prefix, out) {
  if (!isPlainObject(obj)) { out.push([prefix, obj]); return; }
  for (const key of Object.keys(obj)) walkLeaves(obj[key], prefix ? prefix + '.' + key : key, out);
}

function enumPathsFor(moduleName) {
  const spec = ENUM_FIELDS[moduleName];
  return spec ? new Set(Object.keys(spec)) : new Set();
}

function collectRows() {
  const rows = [];
  const featureLeaves = [];
  walkLeaves(DEFAULT_FEATURES, '', featureLeaves);
  for (const [leafPath, value] of featureLeaves) {
    const segments = leafPath.split('.');
    const relative = segments.slice(1).join('.');
    const isEnum = enumPathsFor(segments[0]).has(relative);
    const type = typeof value === 'boolean' ? 'bool' : (isEnum ? 'enum' : (typeof value === 'number' ? 'number' : null));
    if (!type) continue;
    rows.push({ keyPath: 'features.' + leafPath, kind: 'features', type, def: value });
  }
  const tuningLeaves = [];
  walkLeaves(DEFAULT_TUNING, '', tuningLeaves);
  for (const [leafPath, value] of tuningLeaves) {
    const type = typeof value === 'boolean' ? 'bool' : (typeof value === 'number' ? 'number' : null);
    if (!type) continue;
    rows.push({ keyPath: 'tuning.' + leafPath, kind: 'tuning', type, def: value });
  }
  for (const section of Object.keys(DEFAULT_CONFIG)) {
    if (section === 'features') continue;
    const leaves = [];
    walkLeaves(DEFAULT_CONFIG[section], '', leaves);
    for (const [leafPath, value] of leaves) {
      const type = typeof value === 'boolean' ? 'bool' : (typeof value === 'number' ? 'number' : null);
      if (!type) continue;
      rows.push({ keyPath: section + '.' + leafPath, kind: section, type, def: value });
    }
  }
  const internalLeaves = [];
  walkLeaves(INTERNAL_DEFAULTS, '', internalLeaves);
  for (const [leafPath, value] of internalLeaves) {
    const type = typeof value === 'boolean' ? 'bool' : (typeof value === 'number' ? 'number' : null);
    if (!type) continue;
    rows.push({ keyPath: 'internals.' + leafPath, kind: 'internals', type, def: value });
  }
  rows.sort((a, b) => (a.keyPath < b.keyPath ? -1 : a.keyPath > b.keyPath ? 1 : 0));
  return rows;
}

function collectRegistryPaths() {
  const paths = new Set();
  const registries = [['features', DEFAULT_FEATURES], ['tuning', DEFAULT_TUNING], ['internals', INTERNAL_DEFAULTS]];
  for (const section of Object.keys(DEFAULT_CONFIG)) {
    if (section !== 'features') registries.push([section, DEFAULT_CONFIG[section]]);
  }
  for (const [prefix, root] of registries) {
    const leaves = [];
    walkLeaves(root, '', leaves);
    for (const [leafPath] of leaves) paths.add(prefix + '.' + leafPath);
  }
  return paths;
}

function relativePath(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// 词法净化：把注释与字符串字面量置为空格，只保留真实代码标识符。
// 逐字符扫描而非正则套正则：偏移与换行都保留，因此下标与行号仍可直接使用。
// ---------------------------------------------------------------------------
const REGEX_PREV_CHAR = /[=(,:;[!&|?{}~^+\-*%<>]$/;
const REGEX_PREV_WORD = /(?:^|[^\w$])(return|typeof|case|in|of|new|delete|void|instanceof|do|else|yield|await)$/;

// `/` 是正则字面量起始还是除号：看前文最后一个「有意义字符」。
function isRegexStart(prefix) {
  const trimmed = prefix.replace(/\s+$/, '');
  if (!trimmed) return true;
  return REGEX_PREV_CHAR.test(trimmed) || REGEX_PREV_WORD.test(trimmed);
}

function sanitizeCode(text) {
  const chars = text.split('');
  const n = text.length;
  const blank = function (from, to) {
    for (let k = from; k < to && k < n; k++) if (chars[k] !== '\n') chars[k] = ' ';
  };
  let i = 0;
  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === ch) { j += 1; break; }
        // 普通引号不跨行：未闭合即当行结束，避免一处笔误吞掉整份文件
        if (text[j] === '\n' && ch !== '`') break;
        j += 1;
      }
      blank(i, j);
      i = j;
      continue;
    }
    if (ch === '/' && isRegexStart(text.slice(Math.max(0, i - 24), i))) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const c = text[j];
        if (c === '\\') { j += 2; continue; }
        if (c === '\n') break;
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) { j += 1; closed = true; break; }
        j += 1;
      }
      if (closed) { blank(i, j); i = j; continue; }
    }
    i += 1;
  }
  return chars.join('');
}

// 从 openIndex 处的左括号找到配对的右括号下标；字符串/注释已被净化，只需数括号。
function matchDelimiter(code, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    const c = code[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// 扫描 `test(` / `it(` 调用，返回回调体（实为整个调用实参）的行区间与是否含断言。
// 返回行号与原文件一致（净化只替换字符、不动换行）。
const TEST_CALL_RE = /(^|[^\w$.])(test|it)\s*\(/g;

function scanTestBlocks(text) {
  const code = sanitizeCode(text);
  const newlineOffsets = [];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') newlineOffsets.push(i);
  const lineOf = function (pos) {
    let lo = 0;
    let hi = newlineOffsets.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlineOffsets[mid] < pos) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
  const blocks = [];
  TEST_CALL_RE.lastIndex = 0;
  let match;
  while ((match = TEST_CALL_RE.exec(code)) !== null) {
    const open = match.index + match[0].length - 1;
    const close = matchDelimiter(code, open);
    if (close < 0) continue;
    const inner = code.slice(open + 1, close);
    blocks.push({
      startLine: lineOf(open),
      endLine: lineOf(close),
      // 断言判定只看净化后的代码：注释里写一句 assert 不算断言
      hasAssert: /(^|[^\w$.])assert\b/.test(inner)
    });
    TEST_CALL_RE.lastIndex = close;
  }
  return blocks;
}

function buildIndex(files, { skipTests }) {
  const index = new Map();
  const filesByPath = new Map();
  for (const file of files) {
    const rel = relativePath(file);
    const isTest = rel.endsWith('.test.js');
    if (skipTests === isTest) continue;
    let text;
    try { text = fs.readFileSync(file, 'utf-8'); } catch (error) { continue; }
    // 先净化再切词——注释/字符串里的键名不构成「既有引用」
    const code = sanitizeCode(text);
    const lines = code.split(/\r?\n/);
    filesByPath.set(rel, { lines, blocks: isTest ? scanTestBlocks(text) : null });
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 400000) continue;
      const tokens = line.match(/[A-Za-z_$][\w$-]*/g);
      if (!tokens) continue;
      const ctx = line.slice(0, 240);
      const seen = new Set(tokens);
      for (const token of seen) {
        if (!index.has(token)) index.set(token, []);
        index.get(token).push({ file: rel, line: i + 1, ctx });
      }
    }
  }
  return { index, filesByPath };
}

// 消费位置定位（供人工复核，不构成覆盖证据）：叶子键名 + 父段评分。
function locate(index, keyPath, maxHits) {
  const segments = keyPath.split('.');
  const leaf = segments[segments.length - 1];
  const parents = segments.slice(1, -1).slice(-2);
  const hits = [];
  const seen = new Set();
  for (const hit of index.get(leaf) || []) {
    const lineKey = hit.file + ':' + hit.line;
    if (seen.has(lineKey)) continue;
    seen.add(lineKey);
    let score = 1;
    for (const parent of parents) if (hit.ctx.includes(parent)) score += 3;
    if (hit.ctx.includes(segments[0])) score += 1;
    hits.push({ file: hit.file, line: hit.line, score });
    if (hits.length >= (maxHits || 3) * 8) break;
  }
  hits.sort((a, b) => b.score - a.score || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line);
  return hits.slice(0, maxHits || 3).map((hit) => hit.file + ':' + hit.line);
}

function escapeToken(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasToken(line, token) {
  if (!line || !token) return false;
  return new RegExp('(?<![A-Za-z0-9_$])' + escapeToken(token) + '(?![A-Za-z0-9_$])').test(line);
}

// 模块名判定：既接受独立标识符（analytics → `analytics:`），也接受它作为
// 复合标识符的一个 camelCase 词出现（announcement → parseAnnouncement、
// autoCover → resolveAutoCoverConfig）——测试里通常以「解析函数名」体现所属模块，
// 若不认这种写法会把真实覆盖误判为缺失。
function hasModuleToken(line, module) {
  if (!line || !module) return false;
  if (hasToken(line, module)) return true;
  const needle = module.toLowerCase();
  const tokens = line.match(/[A-Za-z_$][\w$-]*/g) || [];
  for (const token of tokens) {
    const starts = [0];
    for (let i = 1; i < token.length; i++) {
      if (/[a-z]/.test(token[i - 1]) && /[A-Z0-9]/.test(token[i])) starts.push(i);
    }
    for (const start of starts) {
      if (token.slice(start, start + needle.length).toLowerCase() !== needle) continue;
      const end = start + needle.length;
      // 命中结束处必须是词尾或下一个词的开头（related → relatedArticles 通过，relate 的更长词不通过）
      if (end === token.length || /[A-Z0-9_$]/.test(token[end])) return true;
    }
  }
  return false;
}

// 所属模块名：键路径倒数第二段（features.analytics.enabled → analytics；
// contentPolicy.enabled 这类两段键取段名本身）。
function ownerTokenOf(keyPath) {
  const segments = keyPath.split('.');
  return segments.length > 1 ? segments[segments.length - 2] : segments[0];
}

const OWNER_WINDOW = 2;
// marker 与「其后最近的那个测试」之间允许的行距上限
const ATTACH_MAX_GAP = 12;

function ownerInWindow(lines, line, token) {
  const from = Math.max(0, line - 1 - OWNER_WINDOW);
  const to = Math.min(lines.length, line + OWNER_WINDOW);
  for (let i = from; i < to; i++) if (hasModuleToken(lines[i], token)) return true;
  return false;
}

// 既有引用证据：叶子 token 命中 + 所属模块名在 ±2 行窗口内 + 命中行落在
// test()/it() 回调体内。三者缺一，该命中就只是「同名 token」，不作覆盖证据。
function locateTestEvidence(filesByPath, index, keyPath, maxHits) {
  const segments = keyPath.split('.');
  const leaf = segments[segments.length - 1];
  const owner = ownerTokenOf(keyPath);
  const hits = [];
  const seen = new Set();
  for (const hit of index.get(leaf) || []) {
    const lineKey = hit.file + ':' + hit.line;
    if (seen.has(lineKey)) continue;
    const fileModel = filesByPath.get(hit.file);
    if (!fileModel || !fileModel.blocks) continue;
    if (!ownerInWindow(fileModel.lines, hit.line, owner)) continue;
    const inTest = fileModel.blocks.some((block) => hit.line >= block.startLine && hit.line <= block.endLine);
    if (!inTest) continue;
    seen.add(lineKey);
    hits.push({ file: hit.file, line: hit.line });
    if (hits.length >= (maxHits || 3) * 8) break;
  }
  hits.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line);
  return hits.slice(0, maxHits || 3).map((hit) => hit.file + ':' + hit.line);
}

function collectSwitchMarkers(testFiles) {
  const markers = new Map();
  for (const file of testFiles) {
    const rel = relativePath(file);
    let text;
    try { text = fs.readFileSync(file, 'utf-8'); } catch (error) { continue; }
    // marker 只承认两种位置，二者都必须绑定到「含断言的 test()/it() 回调」：
    //   (i)  落在该回调体之内；
    //   (ii) 位于其后最近的那个 `test(`/`it(` 之前（中间只有空行、注释行与普通语句，
    //        不得插入另一个 describe 分组，且行距不超过 ATTACH_MAX_GAP）——仓库既有写法
    //        「标记写在测试上方」，但仍要求该测试确有断言；文件里随意摆放的 `// switch:`
    //        因为后面没有测试（或测试无断言）而失效。
    const blocks = scanTestBlocks(text);
    const lines = text.split(/\r?\n/);
    const markerBlocks = blocks.filter((block) => block.hasAssert);
    const attachedBlock = function (lineIndex) {
      for (let i = lineIndex + 1; i < lines.length && i - lineIndex <= ATTACH_MAX_GAP; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
        if (/^(describe|suite)\s*\(/.test(trimmed)) return null;
        const block = blocks.find((candidate) => candidate.startLine === i + 1);
        if (block) return block.hasAssert ? block : null;
      }
      return null;
    };
    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1;
      if (lines[i].indexOf('switch:') < 0) continue;
      const inside = markerBlocks.some((block) => lineNo >= block.startLine && lineNo <= block.endLine);
      if (!inside && !attachedBlock(i)) continue;
      SWITCH_MARKER_RE.lastIndex = 0;
      let match;
      while ((match = SWITCH_MARKER_RE.exec(lines[i])) !== null) {
        for (const key of match[1].split(',').map((part) => part.trim()).filter(Boolean)) {
          if (!markers.has(key)) markers.set(key, []);
          markers.get(key).push(rel + ':' + lineNo);
        }
      }
    }
  }
  return markers;
}

function collectAllMarkers() {
  const files = listFiles();
  return collectSwitchMarkers(files.filter((file) => file.endsWith('.test.js')));
}

function loadExemptions(file) {
  const target = file || path.join(ROOT, 'scripts', 'config-switch-exemptions.json');
  const parsed = JSON.parse(fs.readFileSync(target, 'utf-8'));
  return { categories: parsed.categories || {}, keys: parsed.keys || {} };
}

function exemptionReason(exemptions, keyPath) {
  const value = exemptions.keys[keyPath];
  if (!value) return null;
  if (typeof value === 'string') return exemptions.categories[value] || value;
  return value.reason || '';
}

function collectInventory(options) {
  const opts = options || {};
  const files = listFiles();
  const sourceFiles = files.filter((file) => !file.endsWith('.test.js') && !SOURCE_EXCLUDE_FILES.has(path.basename(file)));
  const testFiles = files.filter((file) => file.endsWith('.test.js'));
  const sourceIndex = buildIndex(sourceFiles, { skipTests: true });
  const testIndex = buildIndex(testFiles, { skipTests: false });
  const markers = collectSwitchMarkers(testFiles);
  const exemptions = loadExemptions(opts.exemptionsPath);
  const rows = collectRows();
  return rows.map((row) => {
    const tested = markers.get(row.keyPath) || [];
    // 既有引用走严格判定（模块名 + test 回调体），不再用同名 token 顶替
    const existing = locateTestEvidence(testIndex.filesByPath, testIndex.index, row.keyPath, 2);
    const exemptReason = exemptionReason(exemptions, row.keyPath);
    let status = 'MISSING';
    if (tested.length) status = 'tested';
    else if (exemptReason) status = 'exempt';
    else if (existing.length) status = 'existing';
    return {
      ...row,
      consumers: locate(sourceIndex.index, row.keyPath, 3),
      tested,
      existing,
      exemptReason,
      status
    };
  });
}

function statusLabel(status) {
  if (status === 'tested') return '已测（marker）';
  if (status === 'existing') return '既有引用';
  if (status === 'exempt') return '豁免';
  return '缺失';
}

function formatDef(value) {
  if (typeof value === 'string') return value === '' ? '（空串）' : '`' + value + '`';
  if (typeof value === 'number') return String(value);
  return value ? 'true' : 'false';
}

function buildMatrix(inventory) {
  const rows = inventory || collectInventory();
  const counts = { tested: 0, existing: 0, exempt: 0, MISSING: 0, total: rows.length };
  for (const row of rows) counts[row.status] += 1;
  const lines = [];
  lines.push('# 配置开关矩阵（行为开关 → 消费位置 → 覆盖证据）');
  lines.push('');
  lines.push('> 本文件由 `node scripts/gen-config-switch-matrix.js` 生成，禁止手改；');
  lines.push('> 键全集来自 `features-schema.js` / `tuning-defaults.js` / `site-defaults.js`（site/navigation/sidebar/footer/theme/security/friends/tagAliases/contentPolicy 全段）/ `internals-defaults.js` 注册表；');
  lines.push('> `guard.json5` 细节键由 `guard-defaults.js` 与 guard 测试覆盖，不在本矩阵。');
  lines.push('> 覆盖证据优先级：`test()`/`it()` 断言回调内的 `// switch: <键路径>` 标记（或紧贴该测试上方的标记）> 测试代码中「叶名 + 所属模块名同现」的引用 > `scripts/config-switch-exemptions.json` 逐键豁免理由。');
  lines.push('> 证据口径：注释与字符串字面量先净化再切词，marker 必须绑定到含 assert 的测试回调，既有引用必须落在 test 回调内且 ±2 行内出现所属模块名——「文本里出现过」不再算覆盖。');
  lines.push('> 消费位置按「叶子键名 + 父段」评分定位首个源码引用，供人工复核；存在同名字段的模块以类型与默认值判别。');
  lines.push('> 回退字面量必须与注册表默认一致，由 `scripts/config-fallback-bindings.json` + `verify:config-single-source` 锁定。');
  lines.push('> 「缺失」行是已登记在 `scripts/config-switch-baseline.json` 的存量缺口：新增缺失会让门禁失败，基线只允许缩小。');
  lines.push('');
  lines.push('统计：开关共 ' + counts.total + '（已测 ' + counts.tested + '，既有引用 ' + counts.existing +
    '，豁免 ' + counts.exempt + '，缺失 ' + counts.MISSING + '）；缺失行均已在 `scripts/config-switch-baseline.json` 登记（只允许缩小）。');
  lines.push('');
  lines.push('| 键路径 | 类型 | 默认 | 消费位置 | 测试证据 | 覆盖状态 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const row of rows) {
    const evidence = row.status === 'tested'
      ? row.tested.slice(0, 2).join('<br>')
      : (row.status === 'existing' ? row.existing.join('<br>') : (row.status === 'exempt' ? '豁免理由见 `scripts/config-switch-exemptions.json`' : '—'));
    lines.push('| `' + row.keyPath + '` | ' + row.type + ' | ' + formatDef(row.def) + ' | ' +
      (row.consumers.join('<br>') || '—') + ' | ' + evidence + ' | ' + statusLabel(row.status) + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  ROOT,
  SWITCH_MARKER_RE,
  sanitizeCode,
  scanTestBlocks,
  collectRows,
  collectRegistryPaths,
  collectInventory,
  collectSwitchMarkers,
  collectAllMarkers,
  loadExemptions,
  exemptionReason,
  buildMatrix,
  statusLabel
};
